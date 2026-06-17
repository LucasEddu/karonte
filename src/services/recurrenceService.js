import { addTransaction } from './transactionService';

const monthKey = (year, month) => `${year}-${month}`;

export const getRecurringRoots = (transactions, userId) =>
  transactions.filter((t) => t.userId === userId && t.isRecurring && !t.parentId);

export const hasRecurrenceForMonth = (transactions, parentId, year, month) =>
  transactions.some((t) => {
    if (t.parentId !== parentId) return false;
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

export const buildRecurrenceClone = (root, year, month) => {
  const rootDate = new Date(root.date);
  const targetDay = Math.min(rootDate.getDate(), new Date(year, month, 0).getDate());
  const targetDate = new Date(year, month - 1, targetDay, 12, 0, 0);

  const { id, ...rest } = root;
  return {
    ...rest,
    parentId: root.id,
    date: targetDate.toISOString(),
    displayDate: targetDate.toLocaleDateString('pt-BR'),
    isRecurring: false,
  };
};

export const listMissingRecurrenceMonths = (root, transactions, referenceDate = new Date()) => {
  const rootDate = new Date(root.date);
  const currentMonth = referenceDate.getMonth() + 1;
  const currentYear = referenceDate.getFullYear();
  const missing = [];

  let year = rootDate.getFullYear();
  let month = rootDate.getMonth() + 1;

  while (year < currentYear || (year === currentYear && month < currentMonth)) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    if (!hasRecurrenceForMonth(transactions, root.id, year, month)) {
      missing.push({ year, month, key: monthKey(year, month) });
    }
  }

  return missing;
};

export const persistMissingRecurrences = async ({
  userId,
  transactions,
  projectId = null,
  referenceDate = new Date(),
}) => {
  const roots = getRecurringRoots(transactions, userId);
  const created = [];
  let workingSet = [...transactions];

  for (const root of roots) {
    const missingMonths = listMissingRecurrenceMonths(root, workingSet, referenceDate);
    for (const { year, month } of missingMonths) {
      const payload = buildRecurrenceClone(root, year, month);
      const saved = await addTransaction(payload, projectId || root.projectId || null);
      created.push(saved);
      workingSet.push(saved);
    }
  }

  return created;
};
