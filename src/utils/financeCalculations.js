import { DEFAULT_CLASSIFICATIONS } from '../constants/categories.js';
import { resolveCategoryForTransaction } from './categoryModel.js';
import { getBudgetLimitByCategory, normalizeBudgets } from './budgetModel.js';

export const getTransactionCategoryLabel = (transaction) =>
  transaction.categoryName || transaction.category || 'Outros';

export const filterTransactionsByPeriod = (transactions, month, year) =>
  transactions
    .filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

export const computePeriodTotals = (transactions) => {
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);
  return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
};

export const computeCategoryStats = (filteredTransactions, expenseCategories) => {
  const expenses = filteredTransactions.filter((t) => t.type === 'expense');
  return expenseCategories
    .map((cat) => ({
      name: cat,
      total: expenses
        .filter((t) => getTransactionCategoryLabel(t) === cat)
        .reduce((sum, item) => sum + item.amount, 0),
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
};

export const computeMonthlyEvolution = (transactions, referenceDate = new Date()) => {
  const data = [];
  for (let i = 5; i >= 0; i--) {
    const targetDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const tMonth = targetDate.getMonth() + 1;
    const tYear = targetDate.getFullYear();
    const monthTrans = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() + 1 === tMonth && d.getFullYear() === tYear;
    });
    const mIncome = monthTrans.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const mExpense = monthTrans.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    data.push({
      name: targetDate.toLocaleString('pt-BR', { month: 'short' }).toUpperCase(),
      Receitas: mIncome,
      Despesas: mExpense,
      Saldo: mIncome - mExpense,
    });
  }
  return data;
};

export const computeTotalBudgetLimit = (budgets) => {
  const { limitsByName } = normalizeBudgets(budgets);
  return Object.values(limitsByName).reduce((sum, val) => sum + (Number(val) || 0), 0);
};

export const computeBudgetStats = (filteredTransactions, budgets, expenseCategories, customCategories = {}) => {
  const expenses = filteredTransactions.filter((t) => t.type === 'expense');
  return expenseCategories
    .map((cat) => {
      const { categoryId } = resolveCategoryForTransaction(cat, 'expense', customCategories);
      const limit = getBudgetLimitByCategory(budgets, categoryId, cat);
      const spent = expenses
        .filter((t) => getTransactionCategoryLabel(t) === cat)
        .reduce((sum, item) => sum + item.amount, 0);
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      return { name: cat, spent, limit, percent };
    })
    .filter((item) => item.limit > 0)
    .sort((a, b) => b.spent - a.spent);
};

export const getCategoryBudgetInfo = (budgets, catName, currentSpent, categoryId = null) => {
  const limit = categoryId
    ? getBudgetLimitByCategory(budgets, categoryId, catName)
    : getBudgetLimitByCategory(budgets, null, catName);
  if (limit === 0) return { limit: 0, pct: 0, isOver80: false, isOver100: false };
  const pct = (currentSpent / limit) * 100;
  return {
    limit,
    pct: Math.min(pct, 100),
    isOver80: pct >= 80,
    isOver100: pct > 100,
  };
};

export const computeRuleStats = (filteredTransactions, balance, classifications = {}) => {
  const expenses = filteredTransactions.filter((t) => t.type === 'expense');
  let needsSpent = 0;
  let wantsSpent = 0;
  let savingsSpent = 0;

  expenses.forEach((t) => {
    const cls = classifications[getTransactionCategoryLabel(t)] || DEFAULT_CLASSIFICATIONS[getTransactionCategoryLabel(t)] || 'wants';
    if (cls === 'needs') needsSpent += t.amount;
    else if (cls === 'savings') savingsSpent += t.amount;
    else wantsSpent += t.amount;
  });

  const savingsAmount = (balance > 0 ? balance : 0) + savingsSpent;
  const total = needsSpent + wantsSpent + savingsAmount;
  if (total === 0) {
    return { needsPct: 0, wantsPct: 0, savingsPct: 0, needsSpent: 0, wantsSpent: 0, savingsAmount: 0 };
  }

  return {
    needsPct: (needsSpent / total) * 100,
    wantsPct: (wantsSpent / total) * 100,
    savingsPct: (savingsAmount / total) * 100,
    needsSpent,
    wantsSpent,
    savingsAmount,
  };
};

export const computeForecast = (transactions, referenceDate = new Date()) => {
  const currentMonth = referenceDate.getMonth() + 1;
  const currentYear = referenceDate.getFullYear();

  const currentMonthSpent = transactions
    .filter((t) => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, curr) => acc + curr.amount, 0);

  const threeMonthsAgo = new Date(referenceDate);
  threeMonthsAgo.setMonth(referenceDate.getMonth() - 3);

  const pastTransactions = transactions.filter((t) => {
    const d = new Date(t.date);
    return (
      t.type === 'expense' &&
      d < new Date(currentYear, currentMonth - 1, 1) &&
      d >= threeMonthsAgo
    );
  });

  const totalPastDays = 90;
  const totalPastSpent = pastTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  const dailyAverage = totalPastSpent / totalPastDays;
  const monthlyAverage = dailyAverage * 30;

  const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysRemaining = lastDayOfMonth - referenceDate.getDate();
  const forecastAmount = currentMonthSpent + dailyAverage * daysRemaining;
  const variationPct = monthlyAverage > 0 ? ((forecastAmount - monthlyAverage) / monthlyAverage) * 100 : 0;

  return {
    currentMonthSpent,
    monthlyAverage,
    forecastAmount,
    variationPct,
    isHigh: variationPct > 15,
  };
};

export const getCardInvoiceStats = (card, transactionsList, selectedMonth, selectedYear) => {
  const limit = Number(card.limit) || 0;
  const closingDay = Number(card.closingDay) || 5;
  const closingDate = new Date(selectedYear, selectedMonth - 1, closingDay, 23, 59, 59);
  const prevClosingDate = new Date(selectedYear, selectedMonth - 2, closingDay, 23, 59, 59);

  const cardExpenses = transactionsList.filter(
    (t) => t.type === 'expense' && t.paymentMethod === 'card' && t.cardId === card.id
  );

  const invoiceAmount = cardExpenses
    .filter((t) => {
      const tDate = new Date(t.date);
      return tDate > prevClosingDate && tDate <= closingDate;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    invoiceAmount,
    availableLimit: limit - invoiceAmount,
    percentUsed: limit > 0 ? (invoiceAmount / limit) * 100 : 0,
  };
};
