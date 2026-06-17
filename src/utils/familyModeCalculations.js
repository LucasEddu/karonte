import { computePeriodTotals, getTransactionCategoryLabel, filterTransactionsByPeriod } from './financeCalculations.js';
import { getBudgetLimitByName, normalizeBudgets } from './budgetModel.js';

export const getProjectMembers = (project, currentUser) => {
  if (!project) return [];
  const namesMap = project.collaboratorNames || {};
  const ownerName =
    project.userId === currentUser?.uid
      ? currentUser?.username || currentUser?.displayName || currentUser?.email || 'Dono'
      : namesMap[project.userId] || 'Dono';

  const members = [
    { uid: project.userId, name: ownerName, role: 'owner' },
  ];

  for (const uid of project.collaborators || []) {
    members.push({
      uid,
      name: namesMap[uid] || 'Colaborador',
      role: project.collaboratorRoles?.[uid] || 'view',
    });
  }
  return members;
};

export const calculateFamilySummary = (transactions) => {
  const { totalIncome, totalExpense, balance } = computePeriodTotals(transactions);
  return {
    totalIncome,
    totalExpense,
    balance,
    savings: Math.max(0, balance),
  };
};

export const calculateMemberSpending = (transactions, members = []) => {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const totalExpense = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const byMember = members.map((m) => {
    const memberTxs = expenses.filter(
      (t) => (t.createdByUid || t.userId) === m.uid
    );
    const spent = memberTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const categories = {};
    memberTxs.forEach((t) => {
      const cat = getTransactionCategoryLabel(t);
      categories[cat] = (categories[cat] || 0) + (Number(t.amount) || 0);
    });
    const topCategories = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, total]) => ({ name, total }));

    return {
      ...m,
      spent,
      transactionCount: memberTxs.length,
      sharePct: totalExpense > 0 ? (spent / totalExpense) * 100 : 0,
      topCategories,
    };
  }).sort((a, b) => b.spent - a.spent);

  return { totalExpense, byMember };
};

export const calculateFamilyCategoryBreakdown = (transactions) => {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const total = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const map = {};

  expenses.forEach((t) => {
    const cat = getTransactionCategoryLabel(t);
    map[cat] = (map[cat] || 0) + (Number(t.amount) || 0);
  });

  return Object.entries(map)
    .map(([name, amount]) => ({
      name,
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
};

export const calculateFamilyBudgetUsage = (transactions, budgets, expenseCategories = []) => {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const norm = normalizeBudgets(budgets);

  return expenseCategories
    .map((cat) => {
      const spent = expenses
        .filter((t) => getTransactionCategoryLabel(t) === cat)
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const limit = getBudgetLimitByName(norm, cat);
      const usagePct = limit > 0 ? (spent / limit) * 100 : 0;
      let status = 'ok';
      if (usagePct >= 100) status = 'over';
      else if (usagePct >= 80) status = 'warning';
      return { category: cat, spent, limit, usagePct, status };
    })
    .filter((c) => c.limit > 0 || c.spent > 0)
    .sort((a, b) => b.usagePct - a.usagePct);
};

export const buildFamilyInsights = ({
  summary,
  categoryBreakdown = [],
  budgetUsage = [],
  prevSummary = null,
}) => {
  const insights = [];

  if (prevSummary && prevSummary.totalExpense > 0) {
    const delta =
      ((summary.totalExpense - prevSummary.totalExpense) / prevSummary.totalExpense) * 100;
    if (delta >= 5) {
      insights.push(`A família gastou ${Math.round(delta)}% a mais que no mês passado`);
    } else if (delta <= -5) {
      insights.push(`A família gastou ${Math.round(Math.abs(delta))}% a menos que no mês passado`);
    }
  }

  const top = categoryBreakdown[0];
  if (top && top.pct >= 15) {
    insights.push(`${top.name} representa ${Math.round(top.pct)}% das despesas`);
  }

  budgetUsage
    .filter((b) => b.status === 'ok' && b.limit > 0)
    .slice(0, 2)
    .forEach((b) => {
      insights.push(`O orçamento de ${b.category} está dentro do previsto`);
    });

  budgetUsage
    .filter((b) => b.status === 'over')
    .forEach((b) => {
      insights.push(`O orçamento de ${b.category} foi ultrapassado`);
    });

  if (summary.balance < 0) {
    insights.push('As despesas familiares superaram as receitas neste período');
  } else if (summary.savings > 0 && summary.totalIncome > 0) {
    const rate = (summary.savings / summary.totalIncome) * 100;
    if (rate >= 10) {
      insights.push(`A família poupou cerca de ${Math.round(rate)}% da receita no período`);
    }
  }

  return insights.slice(0, 6);
};

export const getPreviousPeriodTransactions = (transactions, month, year) => {
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  return filterTransactionsByPeriod(transactions, prevMonth, prevYear);
};
