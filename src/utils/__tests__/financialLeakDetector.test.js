import { describe, it, expect } from 'vitest';
import {
  detectFinancialLeaks,
  buildLeakReport,
  calculateCategoryAverage,
  calculateAnomalyScore,
  getSeverityLevel,
} from '../financialLeakDetector.js';

const tx = (overrides) => ({
  id: '1',
  type: 'expense',
  amount: 100,
  description: 'Teste',
  date: '2026-06-10T12:00:00.000Z',
  category: 'Delivery',
  categoryName: 'Delivery',
  ...overrides,
});

describe('getSeverityLevel', () => {
  it('classifica alerta moderado acima de 20%', () => {
    expect(getSeverityLevel(25)).toBe('moderate');
  });

  it('classifica alerta alto acima de 40%', () => {
    expect(getSeverityLevel(45)).toBe('high');
  });

  it('classifica alerta crítico acima de 60%', () => {
    expect(getSeverityLevel(72)).toBe('critical');
  });
});

describe('calculateAnomalyScore', () => {
  it('calcula aumento percentual', () => {
    expect(calculateAnomalyScore(430, 250)).toBeCloseTo(72);
  });
});

describe('calculateCategoryAverage', () => {
  it('calcula média dos últimos meses', () => {
    const transactions = [
      tx({ amount: 200, date: '2026-03-10T12:00:00.000Z' }),
      tx({ amount: 250, date: '2026-04-10T12:00:00.000Z' }),
      tx({ amount: 300, date: '2026-05-10T12:00:00.000Z' }),
    ];
    const avg = calculateCategoryAverage(transactions, 'Delivery', 3, new Date(2026, 5, 15));
    expect(avg).toBeCloseTo(250);
  });
});

describe('detectFinancialLeaks', () => {
  it('detecta aumento crítico por categoria', () => {
    const transactions = [
      tx({ id: 'a', amount: 250, date: '2026-03-10T12:00:00.000Z' }),
      tx({ id: 'b', amount: 250, date: '2026-04-10T12:00:00.000Z' }),
      tx({ id: 'c', amount: 250, date: '2026-05-10T12:00:00.000Z' }),
      tx({ id: 'd', amount: 430, date: '2026-06-10T12:00:00.000Z' }),
    ];
    const leaks = detectFinancialLeaks({
      transactions,
      month: 6,
      year: 2026,
      referenceDate: new Date(2026, 5, 15),
    });
    const categoryLeak = leaks.find((l) => l.type === 'category');
    expect(categoryLeak).toBeTruthy();
    expect(categoryLeak.severity).toBe('critical');
    expect(categoryLeak.increasePct).toBeGreaterThan(60);
  });

  it('detecta aumento por descrição/estabelecimento', () => {
    const transactions = [
      tx({ id: 'a', description: 'iFood pedido', amount: 180, date: '2026-03-10T12:00:00.000Z', category: 'Alimentação' }),
      tx({ id: 'b', description: 'iFood pedido', amount: 180, date: '2026-04-10T12:00:00.000Z', category: 'Alimentação' }),
      tx({ id: 'c', description: 'iFood pedido', amount: 180, date: '2026-05-10T12:00:00.000Z', category: 'Alimentação' }),
      tx({ id: 'd', description: 'iFood pedido', amount: 350, date: '2026-06-10T12:00:00.000Z', category: 'Alimentação' }),
    ];
    const leaks = detectFinancialLeaks({
      transactions,
      month: 6,
      year: 2026,
      referenceDate: new Date(2026, 5, 15),
    });
    const merchantLeak = leaks.find((l) => l.type === 'merchant');
    expect(merchantLeak).toBeTruthy();
    expect(merchantLeak.increasePct).toBeGreaterThan(40);
  });
});

describe('buildLeakReport', () => {
  it('calcula economia potencial anual', () => {
    const leaks = [
      {
        type: 'category',
        category: 'Delivery',
        excess: 250,
        potentialAnnualSavings: 3000,
        severity: 'critical',
        increasePct: 72,
      },
    ];
    const report = buildLeakReport(leaks);
    expect(report.potentialAnnualSavings).toBe(3000);
    expect(report.criticalCategory.category).toBe('Delivery');
  });
});
