import { getTransactionCategoryLabel } from './financeCalculations.js';
import { detectSubscriptions } from './subscriptionDetection.js';

const matchesCategory = (tx, categoryKey) => {
  if (!categoryKey) return false;
  return (
    tx.categoryName === categoryKey ||
    tx.category === categoryKey ||
    tx.categoryId === categoryKey
  );
};

export const calculateCategoryAverage = (transactions, categoryKey, months = 3, referenceDate = new Date()) => {
  if (!categoryKey || months < 1) return 0;

  const buckets = {};
  for (let i = 0; i < months; i += 1) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    buckets[`${d.getFullYear()}-${d.getMonth() + 1}`] = 0;
  }

  transactions.forEach((t) => {
    if (t.type !== 'expense' || !matchesCategory(t, categoryKey)) return;
    const d = new Date(t.date);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!(key in buckets)) return;
    buckets[key] += Number(t.amount) || 0;
  });

  const total = Object.values(buckets).reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  return total / months;
};

export const simulateSavings = ({
  currentAmount = 0,
  reductionType = 'percent',
  reductionValue = 0,
  months = 12,
}) => {
  const base = Math.max(0, Number(currentAmount) || 0);
  const periodMonths = Math.max(1, Number(months) || 1);
  let monthlySavings = 0;

  if (reductionType === 'percent') {
    const pct = Math.min(100, Math.max(0, Number(reductionValue) || 0));
    monthlySavings = base * (pct / 100);
  } else {
    monthlySavings = Math.min(Math.max(0, Number(reductionValue) || 0), base);
  }

  const newMonthlyAmount = Math.max(0, base - monthlySavings);
  const totalSavings = monthlySavings * periodMonths;

  return {
    currentAmount: base,
    monthlySavings,
    totalSavings,
    newMonthlyAmount,
    months: periodMonths,
    reductionType,
    reductionValue: Number(reductionValue) || 0,
  };
};

export const calculateSavingsImpact = ({ income = 0, expenses = 0, savingsAmount = 0 }) => {
  const inc = Math.max(0, Number(income) || 0);
  const exp = Math.max(0, Number(expenses) || 0);
  const savings = Math.max(0, Number(savingsAmount) || 0);
  const afterExpenses = Math.max(0, exp - savings);

  const beforeSavingsRate = inc > 0 ? ((inc - exp) / inc) * 100 : 0;
  const afterSavingsRate = inc > 0 ? ((inc - afterExpenses) / inc) * 100 : 0;

  return {
    income: inc,
    beforeExpenses: exp,
    afterExpenses,
    beforeSavingsRate,
    afterSavingsRate,
    savingsRateDelta: afterSavingsRate - beforeSavingsRate,
  };
};

export const buildSavingsTargets = (transactions, expenseCategories = [], referenceDate = new Date()) => {
  const categories = expenseCategories
    .map((name) => ({
      id: `cat-${name}`,
      targetType: 'category',
      targetName: name,
      currentAmount: calculateCategoryAverage(transactions, name, 3, referenceDate),
    }))
    .filter((c) => c.currentAmount > 0)
    .sort((a, b) => b.currentAmount - a.currentAmount);

  const subscriptions = detectSubscriptions(transactions).map((sub) => ({
    id: sub.id,
    targetType: 'subscription',
    targetName: sub.name || sub.merchant,
    currentAmount: sub.averageAmount || sub.amount || 0,
  }));

  return { categories, subscriptions };
};

export const buildSavingsScenario = (transactions, options = {}) => {
  const {
    targetType = 'category',
    targetName = '',
    currentAmount: overrideAmount,
    reductionType = 'percent',
    reductionValue = 20,
    months = 12,
    income = 0,
    expenses = 0,
    lookbackMonths = 3,
    referenceDate = new Date(),
  } = options;

  let currentAmount = Number(overrideAmount) || 0;
  if (!currentAmount && targetType === 'category' && targetName) {
    currentAmount = calculateCategoryAverage(transactions, targetName, lookbackMonths, referenceDate);
  }

  const simulation = simulateSavings({
    currentAmount,
    reductionType,
    reductionValue,
    months,
  });

  const impact = calculateSavingsImpact({
    income,
    expenses,
    savingsAmount: simulation.monthlySavings,
  });

  const pctLabel =
    reductionType === 'percent'
      ? `${reductionValue}%`
      : `R$ ${Number(reductionValue).toFixed(2)}`;

  const message =
    targetName && simulation.monthlySavings > 0
      ? `Se você reduzir ${targetName} em ${pctLabel}, economizará R$ ${simulation.monthlySavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por mês e R$ ${simulation.totalSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${months} meses.`
      : null;

  return {
    targetType,
    targetName,
    ...simulation,
    impact,
    message,
  };
};
