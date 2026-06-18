import { getTransactionCategoryLabel, computePeriodTotals, getCardInvoiceStats } from './financeCalculations.js';
import { hasRecurrenceForMonth } from '../services/recurrenceService.js';

const addMonths = (year, month, count) => {
  let y = year;
  let m = month + count;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return { year: y, month: m };
};

const monthLabel = (month, year) => {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
};

const getRecurringRoots = (transactions) =>
  transactions.filter((t) => t.isRecurring && !t.parentId);

const getInstallmentRoots = (transactions) =>
  transactions.filter((t) => t.isInstallment && Number(t.installments) > 1 && t.installmentNumber);

const hasInstallmentInMonth = (transactions, root, year, month) =>
  transactions.some((t) => {
    if (t.parentId !== root.id && t.id !== root.id) return false;
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

export const projectRecurringTransactions = (transactions, year, month) => {
  const projected = [];
  for (const root of getRecurringRoots(transactions)) {
    if (hasRecurrenceForMonth(transactions, root.id, year, month)) continue;
    const rootDate = new Date(root.date);
    const forecastDate = new Date(year, month - 1, Math.min(rootDate.getDate(), new Date(year, month, 0).getDate()), 12, 0, 0);
    if (forecastDate < rootDate) continue;

    projected.push({
      id: `proj-rec-${root.id}-${year}-${month}`,
      type: root.type,
      amount: Number(root.amount) || 0,
      description: root.description,
      categoryName: getTransactionCategoryLabel(root),
      source: 'recurring',
    });
  }
  return projected;
};

export const projectInstallments = (transactions, year, month) => {
  const projected = [];
  for (const root of getInstallmentRoots(transactions)) {
    const total = Number(root.installments) || 0;
    const current = Number(root.installmentNumber) || 1;
    const rootDate = new Date(root.date);

    for (let n = current + 1; n <= total; n += 1) {
      const offset = n - current;
      const target = addMonths(rootDate.getFullYear(), rootDate.getMonth() + 1, offset);
      if (target.year !== year || target.month !== month) continue;
      if (hasInstallmentInMonth(transactions, root, year, month)) continue;

      projected.push({
        id: `proj-inst-${root.id}-${n}`,
        type: 'expense',
        amount: Number(root.amount) || 0,
        description: `${root.description} (${n}/${total})`,
        categoryName: getTransactionCategoryLabel(root),
        source: 'installment',
      });
    }
  }
  return projected;
};

export const projectSubscriptions = (subscriptions = [], year, month) => {
  const projected = [];
  for (const sub of subscriptions) {
    const amount = Number(sub.averageAmount ?? sub.amount) || 0;
    if (amount <= 0) continue;
    if (sub.status === 'ignored') continue;

    projected.push({
      id: `proj-sub-${sub.id || sub.merchant}-${year}-${month}`,
      type: 'expense',
      amount,
      description: sub.name || sub.merchant || 'Assinatura',
      categoryName: sub.categoryName || 'Outros',
      source: 'subscription',
    });
  }
  return projected;
};

const computeVariableExpenseBaseline = (transactions, referenceDate = new Date()) => {
  const recurringDesc = new Set(getRecurringRoots(transactions).map((t) => t.description?.toLowerCase()));
  const installmentDesc = new Set(getInstallmentRoots(transactions).map((t) => t.description?.toLowerCase()));

  let total = 0;
  let months = 0;
  for (let i = 1; i <= 3; i += 1) {
    const ref = addMonths(referenceDate.getFullYear(), referenceDate.getMonth() + 1, -i);
    const monthTxs = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === ref.year && d.getMonth() + 1 === ref.month;
    });
    const variable = monthTxs
      .filter((t) => {
        if (t.type !== 'expense') return false;
        const desc = String(t.description || '').toLowerCase();
        if (recurringDesc.has(desc)) return false;
        if (installmentDesc.has(desc)) return false;
        if (t.isRecurring || t.parentId) return false;
        return true;
      })
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    total += variable;
    months += 1;
  }
  return months > 0 ? total / months : 0;
};

export const projectFutureTransactions = ({
  transactions = [],
  subscriptions = [],
  year,
  month,
  variableExpenseBaseline = 0,
}) => {
  const recurring = projectRecurringTransactions(transactions, year, month);
  const installments = projectInstallments(transactions, year, month);
  const subs = projectSubscriptions(subscriptions, year, month);

  const income = recurring.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const recurringExpense = recurring.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const installmentExpense = installments.reduce((s, t) => s + t.amount, 0);
  const subscriptionExpense = subs.reduce((s, t) => s + t.amount, 0);
  const variableExpense = variableExpenseBaseline;

  const projectedIncome = income;
  const projectedExpenses = recurringExpense + installmentExpense + subscriptionExpense + variableExpense;
  const projectedBalance = projectedIncome - projectedExpenses;

  return {
    month,
    year,
    label: monthLabel(month, year),
    projectedIncome,
    projectedExpenses,
    projectedBalance,
    breakdown: {
      recurringIncome: income,
      recurringExpense,
      installmentExpense,
      subscriptionExpense,
      variableExpense,
    },
    items: [...recurring, ...installments, ...subs],
  };
};

export const calculateForecastSummary = (months = []) => {
  if (!months.length) {
    return {
      totalProjectedIncome: 0,
      totalProjectedExpenses: 0,
      totalProjectedBalance: 0,
      bestMonth: null,
      worstMonth: null,
      averageMonthlyBalance: 0,
    };
  }

  const totalProjectedIncome = months.reduce((s, m) => s + m.projectedIncome, 0);
  const totalProjectedExpenses = months.reduce((s, m) => s + m.projectedExpenses, 0);
  const totalProjectedBalance = totalProjectedIncome - totalProjectedExpenses;

  const sorted = [...months].sort((a, b) => b.projectedBalance - a.projectedBalance);
  return {
    totalProjectedIncome,
    totalProjectedExpenses,
    totalProjectedBalance,
    bestMonth: sorted[0],
    worstMonth: sorted[sorted.length - 1],
    averageMonthlyBalance: totalProjectedBalance / months.length,
  };
};

const buildCategoryGrowthAlerts = (transactions, months, referenceDate = new Date()) => {
  const alerts = [];
  const categoryTotals = {};

  months.forEach((m) => {
    m.items.filter((i) => i.type === 'expense').forEach((item) => {
      const cat = item.categoryName || 'Outros';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + item.amount;
    });
  });

  const avgMonths = 3;
  const historical = {};
  for (let i = 1; i <= avgMonths; i += 1) {
    const ref = addMonths(referenceDate.getFullYear(), referenceDate.getMonth() + 1, -i);
    transactions
      .filter((t) => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getFullYear() === ref.year && d.getMonth() + 1 === ref.month;
      })
      .forEach((t) => {
        const cat = getTransactionCategoryLabel(t);
        historical[cat] = (historical[cat] || 0) + (Number(t.amount) || 0);
      });
  }

  Object.entries(categoryTotals).forEach(([cat, projectedTotal]) => {
    const histAvg = (historical[cat] || 0) / avgMonths;
    const projectedAvg = projectedTotal / Math.max(months.length, 1);
    if (histAvg > 0 && projectedAvg > histAvg * 1.25) {
      const growth = ((projectedAvg - histAvg) / histAvg) * 100;
      alerts.push({
        type: 'category_growth',
        severity: growth > 50 ? 'high' : 'moderate',
        message: `${cat} com crescimento previsto de ${growth.toFixed(0)}%`,
        category: cat,
        growthPct: growth,
      });
    }
  });

  return alerts;
};

const buildCardAlerts = (creditCards = [], transactions = [], months = [], referenceDate = new Date()) => {
  const alerts = [];
  const refMonth = referenceDate.getMonth() + 1;
  const refYear = referenceDate.getFullYear();

  creditCards.forEach((card) => {
    const stats = getCardInvoiceStats(card, transactions, refMonth, refYear);
    const limit = Number(card.limit) || 0;
    if (limit > 0 && stats.invoiceAmount > limit) {
      alerts.push({
        type: 'card_over_limit',
        severity: 'high',
        message: `Fatura ${card.name} acima do limite (R$ ${stats.invoiceAmount.toFixed(0)} / R$ ${limit.toFixed(0)})`,
        cardId: card.id,
        cardName: card.name,
      });
    } else if (limit > 0 && stats.percentUsed > 80) {
      alerts.push({
        type: 'card_near_limit',
        severity: 'moderate',
        message: `Fatura ${card.name} usando ${stats.percentUsed.toFixed(0)}% do limite`,
        cardId: card.id,
        cardName: card.name,
      });
    }
  });

  return alerts;
};

export const buildCashFlowForecast = ({
  transactions = [],
  creditCards = [],
  subscriptions = [],
  monthsAhead = 6,
  referenceDate = new Date(),
}) => {
  const variableBaseline = computeVariableExpenseBaseline(transactions, referenceDate);
  const months = [];

  for (let i = 1; i <= monthsAhead; i += 1) {
    const { year, month } = addMonths(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + 1,
      i
    );
    months.push(
      projectFutureTransactions({
        transactions,
        subscriptions,
        year,
        month,
        variableExpenseBaseline: variableBaseline,
      })
    );
  }

  const summary = calculateForecastSummary(months);
  const alerts = [];

  months.forEach((m) => {
    if (m.projectedBalance < 0) {
      alerts.push({
        type: 'negative_balance',
        severity: 'high',
        message: `Saldo negativo previsto em ${m.label}/${m.year}`,
        month: m.month,
        year: m.year,
        balance: m.projectedBalance,
      });
    }
  });

  if (summary.totalProjectedExpenses > summary.totalProjectedIncome && summary.totalProjectedIncome > 0) {
    alerts.push({
      type: 'expenses_above_income',
      severity: 'high',
      message: 'Despesas previstas superam receitas no período',
    });
  }

  alerts.push(...buildCategoryGrowthAlerts(transactions, months, referenceDate));
  alerts.push(...buildCardAlerts(creditCards, transactions, months, referenceDate));

  const chartData = months.map((m) => ({
    name: m.label,
    Receitas: m.projectedIncome,
    Despesas: m.projectedExpenses,
    Saldo: m.projectedBalance,
  }));

  return {
    months,
    summary,
    alerts,
    chartData,
    variableExpenseBaseline: variableBaseline,
    monthsAhead,
  };
};

export const getNextMonthForecast = (forecast) => forecast.months[0] || null;
