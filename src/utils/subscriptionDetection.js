import { normalizeDescription } from './statementParser.js';

const SUBSCRIPTION_KEYWORDS = [
  'netflix', 'spotify', 'prime', 'amazon', 'disney', 'google', 'apple', 'icloud',
  'microsoft', 'xbox', 'playstation', 'academia', 'gym', 'internet', 'vivo', 'claro',
  'tim', 'oi', 'assinatura', 'mensalidade', 'plano', 'seguro', 'hbo', 'deezer',
  'youtube', 'adobe', 'notion', 'dropbox', 'github', 'linkedin',
];

export const normalizeMerchantName = (description) =>
  normalizeDescription(description).slice(0, 40);

export const descriptionsAreSimilar = (a, b) => {
  const na = normalizeMerchantName(a);
  const nb = normalizeMerchantName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 4 && longer.includes(shorter)) return true;

  const maxLen = Math.max(na.length, nb.length);
  let prefixMatches = 0;
  const compareLen = Math.min(na.length, nb.length);
  for (let i = 0; i < compareLen; i += 1) {
    if (na[i] === nb[i]) prefixMatches += 1;
  }
  return maxLen > 0 && prefixMatches / maxLen >= 0.6;
};

const amountsAreSimilar = (amounts, amount) => {
  if (!amounts.length) return true;
  const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
  return Math.abs(avg - amount) / Math.max(avg, 1) <= 0.2;
};

const monthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
};

const hasKeyword = (text) => {
  const norm = String(text || '').toLowerCase();
  return SUBSCRIPTION_KEYWORDS.some((kw) => norm.includes(kw));
};

export const getSubscriptionConfidence = (group) => {
  let score = 0;
  if (group.occurrences.length >= 3) score += 40;
  else if (group.occurrences.length >= 2) score += 25;

  const months = new Set(group.occurrences.map((t) => monthKey(t.date)));
  if (months.size >= 3) score += 25;
  else if (months.size >= 2) score += 15;

  const amounts = group.occurrences.map((t) => Number(t.amount) || 0);
  const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
  const variance = amounts.every((a) => Math.abs(a - avg) / avg <= 0.15);
  if (variance) score += 20;

  if (hasKeyword(group.merchant)) score += 15;

  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
};

export const groupRecurringTransactions = (transactions) => {
  const expenses = transactions.filter((t) => t.type === 'expense' && t.amount > 0);
  const groups = [];

  for (const tx of expenses) {
    let found = groups.find(
      (g) =>
        descriptionsAreSimilar(g.merchant, tx.description) &&
        amountsAreSimilar(g.amounts, Number(tx.amount) || 0)
    );
    if (!found) {
      found = {
        id: `sub-${normalizeMerchantName(tx.description)}`,
        merchant: tx.description,
        occurrences: [],
        amounts: [],
      };
      groups.push(found);
    }
    found.occurrences.push(tx);
    found.amounts.push(Number(tx.amount) || 0);
  }

  return groups
    .map((g) => {
      const sorted = [...g.occurrences].sort((a, b) => new Date(a.date) - new Date(b.date));
      const averageAmount = g.amounts.reduce((s, v) => s + v, 0) / g.amounts.length;
      const last = sorted[sorted.length - 1];
      const lastDate = new Date(last.date);
      const nextExpectedDate = new Date(lastDate);
      nextExpectedDate.setMonth(nextExpectedDate.getMonth() + 1);

      const item = {
        id: g.id,
        name: g.merchant,
        merchant: g.merchant,
        amount: averageAmount,
        averageAmount,
        frequency: 'monthly',
        categoryName: last.categoryName || last.category || 'Outros',
        firstSeen: sorted[0].date,
        lastSeen: last.date,
        nextExpectedDate: nextExpectedDate.toISOString(),
        occurrences: sorted,
        annualCost: averageAmount * 12,
        transactions: sorted,
      };
      item.confidence = getSubscriptionConfidence(item);
      return item;
    })
    .filter((g) => g.occurrences.length >= 2);
};

export const detectSubscriptions = (transactions) => {
  const grouped = groupRecurringTransactions(transactions);
  const monthlyGroups = grouped.filter((g) => {
    const months = new Set(g.occurrences.map((t) => monthKey(t.date)));
    return months.size >= 2 || hasKeyword(g.merchant);
  });
  return monthlyGroups.sort((a, b) => b.averageAmount - a.averageAmount);
};

export const calculateSubscriptionStats = (subscriptions) => {
  if (!subscriptions.length) {
    return { monthlyTotal: 0, annualTotal: 0, count: 0, mostExpensive: null };
  }
  const monthlyTotal = subscriptions.reduce((s, sub) => s + (sub.averageAmount || 0), 0);
  const mostExpensive = [...subscriptions].sort((a, b) => b.averageAmount - a.averageAmount)[0];
  return {
    monthlyTotal,
    annualTotal: monthlyTotal * 12,
    count: subscriptions.length,
    mostExpensive,
  };
};
