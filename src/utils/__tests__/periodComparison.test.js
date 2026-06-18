import { describe, it, expect } from 'vitest';
import {
  comparePeriods,
  compareCategories,
  calculateVariation,
  buildComparisonSummary,
  getPeriodPreset,
} from '../periodComparison.js';

const tx = (overrides) => ({
  id: '1',
  type: 'expense',
  amount: 100,
  description: 'Teste',
  date: '2026-06-10T12:00:00.000Z',
  category: 'Alimentação',
  categoryName: 'Alimentação',
  ...overrides,
});

describe('calculateVariation', () => {
  it('calcula variação percentual', () => {
    const result = calculateVariation(1100, 800);
    expect(result.difference).toBe(300);
    expect(result.percent).toBeCloseTo(37.5);
  });

  it('lida com período base zero', () => {
    const result = calculateVariation(500, 0);
    expect(result.percent).toBe(100);
  });
});

describe('compareCategories', () => {
  it('compara gastos por categoria', () => {
    const periodA = [tx({ amount: 800, date: '2026-05-10T12:00:00.000Z' })];
    const periodB = [tx({ amount: 1100, date: '2026-06-10T12:00:00.000Z' })];
    const categories = compareCategories(periodA, periodB);
    expect(categories[0].periodA).toBe(800);
    expect(categories[0].periodB).toBe(1100);
    expect(categories[0].variationPct).toBeCloseTo(37.5);
  });

  it('retorna vazio para períodos sem despesas', () => {
    const categories = compareCategories([], []);
    expect(categories).toHaveLength(0);
  });
});

describe('comparePeriods', () => {
  it('compara mês atual vs anterior', () => {
    const transactions = [
      tx({ id: '1', type: 'income', amount: 5000, date: '2026-05-15T12:00:00.000Z', category: 'Salário' }),
      tx({ id: '2', type: 'income', amount: 5600, date: '2026-06-15T12:00:00.000Z', category: 'Salário' }),
      tx({ id: '3', amount: 800, date: '2026-05-20T12:00:00.000Z' }),
      tx({ id: '4', amount: 1100, date: '2026-06-20T12:00:00.000Z' }),
    ];
    const preset = getPeriodPreset('month_vs_previous', new Date(2026, 5, 15));
    const result = comparePeriods({
      transactions,
      periodA: preset.periodA,
      periodB: preset.periodB,
      expenseCategories: ['Alimentação'],
    });

    expect(result.summary.income.percent).toBeGreaterThan(0);
    expect(result.summary.expense.percent).toBeGreaterThan(0);
    expect(result.insights.length).toBeGreaterThan(0);
  });
});

describe('buildComparisonSummary', () => {
  it('monta indicadores principais', () => {
    const summary = buildComparisonSummary({
      totalsA: { totalIncome: 5000, totalExpense: 3000, balance: 2000 },
      totalsB: { totalIncome: 5600, totalExpense: 2760, balance: 2840 },
    });
    expect(summary.income.percent).toBeCloseTo(12);
    expect(summary.expense.percent).toBeCloseTo(-8);
    expect(summary.balance.percent).toBeCloseTo(42);
  });
});
