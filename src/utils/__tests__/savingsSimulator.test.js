import { describe, it, expect } from 'vitest';
import {
  calculateCategoryAverage,
  simulateSavings,
  calculateSavingsImpact,
  buildSavingsScenario,
} from '../savingsSimulator.js';

describe('savingsSimulator', () => {
  const txs = [
    { type: 'expense', amount: 500, categoryName: 'Alimentação', date: '2026-03-10T12:00:00.000Z' },
    { type: 'expense', amount: 400, categoryName: 'Alimentação', date: '2026-02-10T12:00:00.000Z' },
    { type: 'expense', amount: 300, categoryName: 'Alimentação', date: '2026-01-10T12:00:00.000Z' },
    { type: 'income', amount: 5000, categoryName: 'Salário', date: '2026-03-01T12:00:00.000Z' },
  ];

  it('calcula média mensal por categoria', () => {
    const ref = new Date('2026-03-15T12:00:00.000Z');
    const avg = calculateCategoryAverage(txs, 'Alimentação', 3, ref);
    expect(avg).toBeCloseTo(400, 0);
  });

  it('simula economia percentual', () => {
    const result = simulateSavings({
      currentAmount: 900,
      reductionType: 'percent',
      reductionValue: 20,
      months: 12,
    });
    expect(result.monthlySavings).toBeCloseTo(180, 0);
    expect(result.totalSavings).toBeCloseTo(2160, 0);
    expect(result.newMonthlyAmount).toBeCloseTo(720, 0);
  });

  it('simula economia com valor fixo', () => {
    const result = simulateSavings({
      currentAmount: 500,
      reductionType: 'fixed',
      reductionValue: 100,
      months: 6,
    });
    expect(result.monthlySavings).toBe(100);
    expect(result.totalSavings).toBe(600);
  });

  it('calcula impacto na taxa de poupança', () => {
    const impact = calculateSavingsImpact({
      income: 5000,
      expenses: 3000,
      savingsAmount: 200,
    });
    expect(impact.afterExpenses).toBe(2800);
    expect(impact.afterSavingsRate).toBeGreaterThan(impact.beforeSavingsRate);
  });

  it('monta cenário completo com mensagem', () => {
    const scenario = buildSavingsScenario(txs, {
      targetType: 'category',
      targetName: 'Alimentação',
      reductionType: 'percent',
      reductionValue: 20,
      months: 12,
      income: 5000,
      expenses: 3000,
      referenceDate: new Date('2026-03-15T12:00:00.000Z'),
    });
    expect(scenario.monthlySavings).toBeGreaterThan(0);
    expect(scenario.message).toContain('Alimentação');
    expect(scenario.message).toContain('20%');
  });
});
