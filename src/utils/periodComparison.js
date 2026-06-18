import {
  computePeriodTotals,
  getTransactionCategoryLabel,
  filterTransactionsByPeriod,
  computeBudgetStats,
  getCardInvoiceStats,
} from './financeCalculations.js';

export const calculateVariation = (valueA, valueB) => {
  const a = Number(valueA) || 0;
  const b = Number(valueB) || 0;
  const difference = a - b;
  if (b === 0) {
    return { valueA: a, valueB: b, difference, percent: a > 0 ? 100 : 0 };
  }
  return { valueA: a, valueB: b, difference, percent: (difference / b) * 100 };
};

export const compareCategories = (transactionsA, transactionsB) => {
  const mapA = {};
  const mapB = {};

  transactionsA.filter((t) => t.type === 'expense').forEach((t) => {
    const cat = getTransactionCategoryLabel(t);
    mapA[cat] = (mapA[cat] || 0) + (Number(t.amount) || 0);
  });

  transactionsB.filter((t) => t.type === 'expense').forEach((t) => {
    const cat = getTransactionCategoryLabel(t);
    mapB[cat] = (mapB[cat] || 0) + (Number(t.amount) || 0);
  });

  const allCategories = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);

  return [...allCategories]
    .map((category) => {
      const periodA = mapA[category] || 0;
      const periodB = mapB[category] || 0;
      const variation = calculateVariation(periodB, periodA);
      return {
        category,
        periodA,
        periodB,
        difference: variation.difference,
        variationPct: variation.percent,
      };
    })
    .filter((item) => item.periodA > 0 || item.periodB > 0)
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
};

const savingsRate = (totals) => {
  if (totals.totalIncome <= 0) return 0;
  return (totals.balance / totals.totalIncome) * 100;
};

const budgetUsagePct = (filteredTransactions, budgets, expenseCategories, customCategories) => {
  const stats = computeBudgetStats(filteredTransactions, budgets, expenseCategories, customCategories);
  const totalLimit = stats.reduce((s, b) => s + b.limit, 0);
  const totalSpent = stats.reduce((s, b) => s + b.spent, 0);
  return totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
};

const cardUsageSummary = (creditCards, transactions, month, year) => {
  if (!creditCards.length) return { totalUsed: 0, totalLimit: 0, usagePct: 0 };
  let totalUsed = 0;
  let totalLimit = 0;
  creditCards.forEach((card) => {
    const stats = getCardInvoiceStats(card, transactions, month, year);
    totalUsed += stats.invoiceAmount;
    totalLimit += Number(card.limit) || 0;
  });
  return {
    totalUsed,
    totalLimit,
    usagePct: totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0,
  };
};

const taskGoalsSummary = (tasks = []) => {
  const active = tasks.filter((t) => !t.completed && t.type === 'despesa');
  const totalMeta = active.reduce((s, t) => s + (Number(t.metaValue) || 0), 0);
  const totalPaid = active.reduce((s, t) => s + (Number(t.paidAmount) || 0), 0);
  return { activeCount: active.length, totalMeta, totalPaid, remaining: Math.max(0, totalMeta - totalPaid) };
};

export const buildComparisonSummary = ({
  totalsA,
  totalsB,
  budgetUsageA = 0,
  budgetUsageB = 0,
  cardUsageA = { usagePct: 0 },
  cardUsageB = { usagePct: 0 },
  goalsA = { remaining: 0 },
  goalsB = { remaining: 0 },
}) => {
  const income = calculateVariation(totalsB.totalIncome, totalsA.totalIncome);
  const expense = calculateVariation(totalsB.totalExpense, totalsA.totalExpense);
  const balance = calculateVariation(totalsB.balance, totalsA.balance);
  const savingsA = savingsRate(totalsA);
  const savingsB = savingsRate(totalsB);
  const savings = calculateVariation(savingsB, savingsA);
  const budget = calculateVariation(budgetUsageB, budgetUsageA);
  const cards = calculateVariation(cardUsageB.usagePct, cardUsageA.usagePct);
  const goals = calculateVariation(goalsB.remaining, goalsA.remaining);

  return {
    income,
    expense,
    balance,
    savings: { ...savings, valueA: savingsA, valueB: savingsB },
    budgetUsage: budget,
    cards,
    goals,
  };
};

export const generateComparisonInsights = (summary, categories = []) => {
  const insights = [];

  categories.slice(0, 5).forEach((cat) => {
    if (Math.abs(cat.variationPct) >= 10) {
      const direction = cat.variationPct > 0 ? 'aumentou' : 'reduziu';
      insights.push(`${cat.category} ${direction} ${Math.abs(cat.variationPct).toFixed(0)}%`);
    }
  });

  if (summary.balance.difference > 0) {
    insights.push(`Você economizou R$ ${Math.abs(summary.balance.difference).toFixed(0)} a mais`);
  } else if (summary.balance.difference < 0) {
    insights.push(`Saldo caiu R$ ${Math.abs(summary.balance.difference).toFixed(0)} em relação ao período anterior`);
  }

  if (summary.income.percent > 5) {
    insights.push(`Receitas subiram ${summary.income.percent.toFixed(0)}%`);
  }
  if (summary.expense.percent < -5) {
    insights.push(`Despesas caíram ${Math.abs(summary.expense.percent).toFixed(0)}%`);
  }

  return insights.slice(0, 8);
};

export const comparePeriods = ({
  transactions = [],
  periodA = {},
  periodB = {},
  budgets = {},
  expenseCategories = [],
  customCategories = {},
  creditCards = [],
  tasks = [],
}) => {
  const txsA = periodA.transactions
    ?? (periodA.month && periodA.year
      ? filterTransactionsByPeriod(transactions, periodA.month, periodA.year)
      : filterTransactionsByDateRange(transactions, periodA.startDate, periodA.endDate));

  const txsB = periodB.transactions
    ?? (periodB.month && periodB.year
      ? filterTransactionsByPeriod(transactions, periodB.month, periodB.year)
      : filterTransactionsByDateRange(transactions, periodB.startDate, periodB.endDate));

  const totalsA = computePeriodTotals(txsA);
  const totalsB = computePeriodTotals(txsB);
  const categories = compareCategories(txsA, txsB);

  const budgetUsageA = periodA.month
    ? budgetUsagePct(txsA, budgets, expenseCategories, customCategories)
    : 0;
  const budgetUsageB = periodB.month
    ? budgetUsagePct(txsB, budgets, expenseCategories, customCategories)
    : 0;

  const cardUsageA = periodA.month
    ? cardUsageSummary(creditCards, transactions, periodA.month, periodA.year)
    : { usagePct: 0, totalUsed: 0, totalLimit: 0 };
  const cardUsageB = periodB.month
    ? cardUsageSummary(creditCards, transactions, periodB.month, periodB.year)
    : { usagePct: 0, totalUsed: 0, totalLimit: 0 };

  const goalsA = taskGoalsSummary(tasks);
  const goalsB = taskGoalsSummary(tasks);

  const summary = buildComparisonSummary({
    totalsA,
    totalsB,
    budgetUsageA,
    budgetUsageB,
    cardUsageA,
    cardUsageB,
    goalsA,
    goalsB,
  });

  const insights = generateComparisonInsights(summary, categories);

  const topGrowth = [...categories].filter((c) => c.variationPct > 0).sort((a, b) => b.variationPct - a.variationPct).slice(0, 5);
  const topReduction = [...categories].filter((c) => c.variationPct < 0).sort((a, b) => a.variationPct - b.variationPct).slice(0, 5);

  const chartCategories = categories.slice(0, 6).map((c) => ({
    name: c.category.length > 12 ? `${c.category.slice(0, 12)}…` : c.category,
    periodA: c.periodA,
    periodB: c.periodB,
  }));

  return {
    periodA: { ...periodA, totals: totalsA, transactionCount: txsA.length },
    periodB: { ...periodB, totals: totalsB, transactionCount: txsB.length },
    summary,
    categories,
    insights,
    topGrowth,
    topReduction,
    chartCategories,
  };
};

export const filterTransactionsByDateRange = (transactions, startDate, endDate) => {
  if (!startDate || !endDate) return [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return transactions.filter((t) => {
    const d = new Date(t.date);
    return d >= start && d <= end;
  });
};

export const getPeriodPreset = (preset, referenceDate = new Date()) => {
  const month = referenceDate.getMonth() + 1;
  const year = referenceDate.getFullYear();

  if (preset === 'month_vs_previous') {
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    return {
      periodA: { month: prevMonth, year: prevYear, label: `${prevMonth}/${prevYear}` },
      periodB: { month, year, label: `${month}/${year}` },
    };
  }

  if (preset === 'year_vs_previous') {
    return {
      periodA: { startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31`, label: String(year - 1) },
      periodB: { startDate: `${year}-01-01`, endDate: `${year}-12-31`, label: String(year) },
    };
  }

  return {
    periodA: { month, year, label: `${month}/${year}` },
    periodB: { month, year, label: `${month}/${year}` },
  };
};
