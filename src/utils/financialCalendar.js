import { getRecurringRoots, hasRecurrenceForMonth } from '../services/recurrenceService.js';
import { getTransactionCategoryLabel } from './financeCalculations.js';
import { computeParcelaValue, computeParcelasPagas } from './taskCalculations.js';

const pad = (n) => String(n).padStart(2, '0');

export const toDateKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const getMonthCalendarGrid = (month, year) => {
  const first = new Date(year, month - 1, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = [];
  let day = 1 - startOffset;

  for (let w = 0; w < 6; w += 1) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(year, month - 1, day, 12, 0, 0);
      week.push({
        date,
        day,
        inMonth: day >= 1 && day <= daysInMonth,
        key: toDateKey(date),
      });
      day += 1;
    }
    weeks.push(week);
    if (day > daysInMonth) break;
  }
  return weeks;
};

const monthInRange = (y, m, month, year) => y === year && m === month;

const addMonths = (date, count) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + count);
  return d;
};

const buildTransactionEvent = (tx, status = 'confirmed') => ({
  id: `tx-${tx.id}`,
  type: tx.type === 'income' ? 'income' : 'expense',
  title: tx.description,
  amount: Number(tx.amount) || 0,
  date: new Date(tx.date),
  categoryName: getTransactionCategoryLabel(tx),
  sourceId: tx.id,
  projectId: tx.projectId || null,
  status,
  metadata: { transaction: tx },
});

const buildInstallmentForecastEvents = (transactions, month, year) => {
  const events = [];
  const roots = transactions.filter(
    (t) => t.isInstallment && t.installments > 1 && t.installmentNumber
  );

  for (const root of roots) {
    const total = Number(root.installments) || 0;
    const current = Number(root.installmentNumber) || 1;
    const rootDate = new Date(root.date);

    for (let n = current + 1; n <= total; n += 1) {
      const forecastDate = addMonths(rootDate, n - current);
      const fy = forecastDate.getFullYear();
      const fm = forecastDate.getMonth() + 1;
      if (!monthInRange(fy, fm, month, year)) continue;

      const duplicate = transactions.some((t) => {
        if (t.parentId !== root.id && t.id !== root.id) return false;
        const d = new Date(t.date);
        return d.getFullYear() === fy && d.getMonth() + 1 === fm;
      });
      if (duplicate) continue;

      events.push({
        id: `inst-${root.id}-${n}`,
        type: 'installment',
        title: `${root.description} (${n}/${total})`,
        amount: Number(root.amount) || 0,
        date: forecastDate,
        categoryName: getTransactionCategoryLabel(root),
        sourceId: root.id,
        projectId: root.projectId || null,
        status: 'forecast',
        metadata: { installmentNumber: n, installments: total },
      });
    }
  }
  return events;
};

const buildRecurringForecastEvents = (transactions, userId, month, year) => {
  const events = [];
  const roots = getRecurringRoots(transactions, userId);

  for (const root of roots) {
    if (hasRecurrenceForMonth(transactions, root.id, year, month)) continue;

    const rootDate = new Date(root.date);
    const day = Math.min(rootDate.getDate(), new Date(year, month, 0).getDate());
    const forecastDate = new Date(year, month - 1, day, 12, 0, 0);

    if (forecastDate < rootDate) continue;

    events.push({
      id: `rec-${root.id}-${year}-${month}`,
      type: 'recurring',
      title: root.description,
      amount: Number(root.amount) || 0,
      date: forecastDate,
      categoryName: getTransactionCategoryLabel(root),
      sourceId: root.id,
      projectId: root.projectId || null,
      status: 'forecast',
      metadata: { recurring: true },
    });
  }
  return events;
};

const buildCardInvoiceEvents = (creditCards, month, year) =>
  creditCards.map((card) => {
    const dueDay = Math.min(Number(card.dueDay) || 10, new Date(year, month, 0).getDate());
    const date = new Date(year, month - 1, dueDay, 12, 0, 0);
    return {
      id: `card-${card.id}-${year}-${month}`,
      type: 'card_invoice',
      title: `Fatura ${card.name}`,
      amount: 0,
      date,
      categoryName: 'Cartão',
      sourceId: card.id,
      projectId: card.projectId === 'geral' ? null : card.projectId || null,
      status: 'forecast',
      metadata: { card, dueDay, closingDay: card.closingDay },
    };
  });

const buildTaskEvents = (tasks, month, year) => {
  const events = [];
  for (const task of tasks) {
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      if (monthInRange(d.getFullYear(), d.getMonth() + 1, month, year)) {
        events.push({
          id: `task-due-${task.id}`,
          type: 'task',
          title: task.title,
          amount: Number(task.metaValue) || 0,
          date: d,
          categoryName: task.type === 'despesa' ? 'Tarefa despesa' : 'Tarefa',
          sourceId: task.id,
          projectId: task.projectId || null,
          status: task.completed ? 'done' : 'pending',
          metadata: { task },
        });
      }
    } else if (task.type === 'despesa' && Number(task.parcelas) > 0 && !task.completed) {
      const parcelas = Number(task.parcelas);
      const meta = Number(task.metaValue) || 0;
      const paid = Number(task.paidAmount) || 0;
      const parcelaValue = computeParcelaValue(meta, parcelas);
      const paidCount = computeParcelasPagas(paid, parcelaValue, parcelas);
      if (paidCount < parcelas) {
        const base = new Date(task.updatedAt || task.createdAt || Date.now());
        const nextDate = addMonths(base, 1);
        if (monthInRange(nextDate.getFullYear(), nextDate.getMonth() + 1, month, year)) {
          events.push({
            id: `task-parcel-${task.id}`,
            type: 'task',
            title: `${task.title} (parcela ${paidCount + 1}/${parcelas})`,
            amount: parcelaValue,
            date: nextDate,
            categoryName: 'Tarefa despesa',
            sourceId: task.id,
            projectId: task.projectId || null,
            status: 'forecast',
            metadata: { task },
          });
        }
      }
    }
  }
  return events;
};

export const buildFinancialCalendarEvents = ({
  transactions = [],
  creditCards = [],
  tasks = [],
  month,
  year,
  userId,
}) => {
  const events = [];
  const seenTx = new Set();

  for (const tx of transactions) {
    const d = new Date(tx.date);
    if (!monthInRange(d.getFullYear(), d.getMonth() + 1, month, year)) continue;
    if (seenTx.has(tx.id)) continue;
    seenTx.add(tx.id);
    events.push(buildTransactionEvent(tx));
  }

  events.push(...buildInstallmentForecastEvents(transactions, month, year));
  if (userId) {
    events.push(...buildRecurringForecastEvents(transactions, userId, month, year));
  }
  events.push(...buildCardInvoiceEvents(creditCards, month, year));
  events.push(...buildTaskEvents(tasks, month, year));

  return events.sort((a, b) => a.date - b.date);
};

export const groupEventsByDate = (events) => {
  const map = {};
  for (const ev of events) {
    const key = toDateKey(ev.date);
    if (!key) continue;
    if (!map[key]) map[key] = [];
    map[key].push(ev);
  }
  return map;
};

export const calculateDayTotals = (events) => {
  let income = 0;
  let expense = 0;
  for (const ev of events) {
    if (ev.type === 'income') income += ev.amount;
    else if (ev.type === 'expense' || ev.type === 'installment' || ev.type === 'recurring') {
      expense += ev.amount;
    }
  }
  return { income, expense, balance: income - expense };
};

export const calculateMonthCalendarSummary = (events) => {
  let income = 0;
  let expense = 0;
  let cardInvoices = 0;
  let tasksDue = 0;

  for (const ev of events) {
    if (ev.type === 'income') income += ev.amount;
    if (ev.type === 'expense' || ev.type === 'installment' || ev.type === 'recurring') {
      expense += ev.amount;
    }
    if (ev.type === 'card_invoice') cardInvoices += 1;
    if (ev.type === 'task') tasksDue += 1;
  }

  return {
    income,
    expense,
    projectedBalance: income - expense,
    cardInvoices,
    tasksDue,
    eventCount: events.length,
  };
};
