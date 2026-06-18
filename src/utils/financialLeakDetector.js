import { getTransactionCategoryLabel, filterTransactionsByPeriod } from './financeCalculations.js';
import { normalizeMerchantName } from './subscriptionDetection.js';

const SEVERITY_THRESHOLDS = { moderate: 20, high: 40, critical: 60 };

export const getSeverityLevel = (increasePct) => {
  if (increasePct >= SEVERITY_THRESHOLDS.critical) return 'critical';
  if (increasePct >= SEVERITY_THRESHOLDS.high) return 'high';
  if (increasePct >= SEVERITY_THRESHOLDS.moderate) return 'moderate';
  return 'ok';
};

export const calculateCategoryAverage = (transactions, category, months = 3, referenceDate = new Date()) => {
  let total = 0;
  let count = 0;

  for (let i = 1; i <= months; i += 1) {
    let m = referenceDate.getMonth() + 1 - i;
    let y = referenceDate.getFullYear();
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    const monthTxs = filterTransactionsByPeriod(transactions, m, y);
    const spent = monthTxs
      .filter((t) => t.type === 'expense' && getTransactionCategoryLabel(t) === category)
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    total += spent;
    count += 1;
  }

  return count > 0 ? total / count : 0;
};

export const calculateAnomalyScore = (current, average) => {
  if (average <= 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - average) / average) * 100;
};

const groupExpensesByMerchant = (transactions) => {
  const map = {};
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const merchant = normalizeMerchantName(t.description) || 'Outros';
      if (!map[merchant]) {
        map[merchant] = { merchant, total: 0, occurrences: [] };
      }
      map[merchant].total += Number(t.amount) || 0;
      map[merchant].occurrences.push(t);
    });
  return Object.values(map);
};

const merchantAverage = (occurrences, months, referenceDate) => {
  const byMonth = {};
  occurrences.forEach((t) => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    byMonth[key] = (byMonth[key] || 0) + (Number(t.amount) || 0);
  });

  const refMonth = referenceDate.getMonth() + 1;
  const refYear = referenceDate.getFullYear();
  let total = 0;
  let count = 0;

  for (let i = 1; i <= months; i += 1) {
    let m = refMonth - i;
    let y = refYear;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    const key = `${y}-${m}`;
    total += byMonth[key] || 0;
    count += 1;
  }

  return count > 0 ? total / count : 0;
};

export const detectFinancialLeaks = ({
  transactions = [],
  referenceDate = new Date(),
  month,
  year,
}) => {
  const refMonth = month ?? referenceDate.getMonth() + 1;
  const refYear = year ?? referenceDate.getFullYear();
  const currentTxs = filterTransactionsByPeriod(transactions, refMonth, refYear);
  const categoryMap = {};

  currentTxs.filter((t) => t.type === 'expense').forEach((t) => {
    const cat = getTransactionCategoryLabel(t);
    categoryMap[cat] = (categoryMap[cat] || 0) + (Number(t.amount) || 0);
  });

  const categoryLeaks = Object.entries(categoryMap).map(([category, current]) => {
    const avg3 = calculateCategoryAverage(transactions, category, 3, referenceDate);
    const avg6 = calculateCategoryAverage(transactions, category, 6, referenceDate);
    const increasePct = calculateAnomalyScore(current, avg3);
    const severity = getSeverityLevel(increasePct);
    const excess = Math.max(0, current - avg3);
    const potentialAnnualSavings = excess * 12;

    return {
      type: 'category',
      category,
      current,
      average3Months: avg3,
      average6Months: avg6,
      difference: current - avg3,
      increasePct,
      severity,
      excess,
      potentialAnnualSavings,
    };
  }).filter((l) => l.severity !== 'ok' && l.average3Months > 0);

  const merchants = groupExpensesByMerchant(transactions);
  const merchantLeaks = merchants.map((g) => {
    const currentMonthTotal = g.occurrences
      .filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() + 1 === refMonth && d.getFullYear() === refYear;
      })
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const avg3 = merchantAverage(g.occurrences, 3, referenceDate);
    const increasePct = calculateAnomalyScore(currentMonthTotal, avg3);
    const severity = getSeverityLevel(increasePct);
    const excess = Math.max(0, currentMonthTotal - avg3);

    return {
      type: 'merchant',
      merchant: g.merchant,
      current: currentMonthTotal,
      average3Months: avg3,
      difference: currentMonthTotal - avg3,
      increasePct,
      severity,
      excess,
      potentialAnnualSavings: excess * 12,
    };
  }).filter((l) => l.severity !== 'ok' && l.average3Months > 0 && l.current > 0);

  const allLeaks = [...categoryLeaks, ...merchantLeaks].sort((a, b) => b.increasePct - a.increasePct);

  return allLeaks;
};

export const buildLeakReport = (leaks = []) => {
  const categoryLeaks = leaks.filter((l) => l.type === 'category');
  const merchantLeaks = leaks.filter((l) => l.type === 'merchant');

  const biggestIncrease = leaks[0] || null;
  const criticalCategory = categoryLeaks.find((l) => l.severity === 'critical')
    || categoryLeaks[0]
    || null;

  const totalExcess = leaks.reduce((s, l) => s + (l.excess || 0), 0);
  const potentialAnnualSavings = leaks.reduce((s, l) => s + (l.potentialAnnualSavings || 0), 0);

  const bySeverity = {
    critical: leaks.filter((l) => l.severity === 'critical').length,
    high: leaks.filter((l) => l.severity === 'high').length,
    moderate: leaks.filter((l) => l.severity === 'moderate').length,
  };

  return {
    leaks,
    categoryLeaks,
    merchantLeaks,
    biggestIncrease,
    criticalCategory,
    totalExcess,
    potentialAnnualSavings,
    bySeverity,
    count: leaks.length,
  };
};
