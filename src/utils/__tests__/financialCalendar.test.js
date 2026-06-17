import { describe, it, expect } from 'vitest';
import {
  buildFinancialCalendarEvents,
  groupEventsByDate,
  calculateDayTotals,
  calculateMonthCalendarSummary,
  getMonthCalendarGrid,
  toDateKey,
} from '../financialCalendar.js';

describe('financialCalendar', () => {
  const txs = [
    {
      id: 't1',
      userId: 'u1',
      type: 'expense',
      amount: 50,
      description: 'Mercado',
      category: 'Alimentação',
      date: '2026-06-10T12:00:00.000Z',
    },
    {
      id: 't2',
      userId: 'u1',
      type: 'income',
      amount: 1000,
      description: 'Salário',
      category: 'Salário',
      date: '2026-06-15T12:00:00.000Z',
    },
    {
      id: 'r1',
      userId: 'u1',
      type: 'expense',
      amount: 30,
      description: 'Academia',
      category: 'Lazer',
      date: '2026-04-10T12:00:00.000Z',
      isRecurring: true,
    },
  ];

  it('agrupa eventos por data', () => {
    const events = buildFinancialCalendarEvents({ transactions: txs, month: 6, year: 2026, userId: 'u1' });
    const grouped = groupEventsByDate(events);
    expect(grouped['2026-06-10']?.length).toBeGreaterThanOrEqual(1);
    expect(grouped['2026-06-15']?.length).toBe(1);
  });

  it('calcula totais do dia', () => {
    const events = buildFinancialCalendarEvents({ transactions: txs, month: 6, year: 2026, userId: 'u1' });
    const day = groupEventsByDate(events)['2026-06-15'];
    const totals = calculateDayTotals(day);
    expect(totals.income).toBe(1000);
    expect(totals.expense).toBe(0);
  });

  it('calcula resumo mensal', () => {
    const events = buildFinancialCalendarEvents({ transactions: txs, month: 6, year: 2026, userId: 'u1' });
    const summary = calculateMonthCalendarSummary(events);
    expect(summary.income).toBeGreaterThanOrEqual(1000);
    expect(summary.expense).toBeGreaterThanOrEqual(50);
  });

  it('evita duplicar recorrência já persistida', () => {
    const withClone = [
      ...txs,
      {
        id: 'r1-jun',
        userId: 'u1',
        parentId: 'r1',
        type: 'expense',
        amount: 30,
        description: 'Academia',
        date: '2026-06-10T12:00:00.000Z',
      },
    ];
    const events = buildFinancialCalendarEvents({ transactions: withClone, month: 6, year: 2026, userId: 'u1' });
    const recurring = events.filter((e) => e.type === 'recurring' && e.sourceId === 'r1');
    expect(recurring.length).toBe(0);
  });

  it('cria evento de fatura por dueDay', () => {
    const cards = [{ id: 'c1', name: 'Nubank', dueDay: 12, closingDay: 5, limit: 1000 }];
    const events = buildFinancialCalendarEvents({ transactions: [], creditCards: cards, month: 6, year: 2026 });
    const invoice = events.find((e) => e.type === 'card_invoice');
    expect(invoice).toBeTruthy();
    expect(toDateKey(invoice.date)).toBe('2026-06-12');
  });

  it('monta grade do mês', () => {
    const grid = getMonthCalendarGrid(6, 2026);
    expect(grid.length).toBeGreaterThanOrEqual(4);
    expect(grid.flat().some((c) => c.inMonth && c.day === 15)).toBe(true);
  });
});
