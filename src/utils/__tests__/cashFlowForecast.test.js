import { describe, it, expect } from 'vitest';
import {
  buildCashFlowForecast,
  projectRecurringTransactions,
  projectInstallments,
  projectSubscriptions,
  calculateForecastSummary,
} from '../cashFlowForecast.js';

const tx = (overrides) => ({
  id: '1',
  type: 'expense',
  amount: 100,
  description: 'Teste',
  date: '2026-03-10T12:00:00.000Z',
  category: 'Outros',
  ...overrides,
});

describe('projectRecurringTransactions', () => {
  it('projeta receita recorrente', () => {
    const transactions = [
      tx({ id: 'r1', type: 'income', amount: 5000, isRecurring: true, description: 'Salário' }),
    ];
    const projected = projectRecurringTransactions(transactions, 2026, 5);
    expect(projected).toHaveLength(1);
    expect(projected[0].type).toBe('income');
    expect(projected[0].amount).toBe(5000);
  });

  it('projeta despesa recorrente', () => {
    const transactions = [
      tx({ id: 'r2', isRecurring: true, amount: 200, description: 'Aluguel' }),
    ];
    const projected = projectRecurringTransactions(transactions, 2026, 4);
    expect(projected).toHaveLength(1);
    expect(projected[0].amount).toBe(200);
  });
});

describe('projectInstallments', () => {
  it('projeta parcelas restantes', () => {
    const transactions = [
      tx({
        id: 'p1',
        isInstallment: true,
        installments: 12,
        installmentNumber: 4,
        amount: 300,
        description: 'Notebook',
        date: '2026-01-15T12:00:00.000Z',
      }),
    ];
    const may = projectInstallments(transactions, 2026, 5);
    const jun = projectInstallments(transactions, 2026, 6);
    expect(may).toHaveLength(1);
    expect(may[0].description).toContain('8/12');
    expect(jun).toHaveLength(1);
    expect(jun[0].description).toContain('9/12');
  });
});

describe('projectSubscriptions', () => {
  it('projeta assinaturas mensais', () => {
    const subs = [{ id: 's1', name: 'Netflix', amount: 55, averageAmount: 55 }];
    const projected = projectSubscriptions(subs, 2026, 6);
    expect(projected).toHaveLength(1);
    expect(projected[0].amount).toBe(55);
  });
});

describe('buildCashFlowForecast', () => {
  it('gera projeção para múltiplos meses', () => {
    const referenceDate = new Date(2026, 2, 15);
    const transactions = [
      tx({ id: 'r1', type: 'income', amount: 4000, isRecurring: true, description: 'Salário', date: '2026-01-05T12:00:00.000Z' }),
      tx({ id: 'r2', isRecurring: true, amount: 1500, description: 'Aluguel', date: '2026-01-05T12:00:00.000Z' }),
    ];
    const forecast = buildCashFlowForecast({
      transactions,
      subscriptions: [{ id: 'n', name: 'Spotify', amount: 30 }],
      monthsAhead: 3,
      referenceDate,
    });

    expect(forecast.months).toHaveLength(3);
    expect(forecast.summary.totalProjectedIncome).toBeGreaterThan(0);
    expect(forecast.chartData).toHaveLength(3);
    forecast.months.forEach((m) => {
      expect(m).toHaveProperty('projectedBalance');
      expect(m.projectedIncome).toBe(4000);
    });
  });

  it('calcula melhor e pior mês', () => {
    const months = [
      { projectedBalance: 500, projectedIncome: 1000, projectedExpenses: 500 },
      { projectedBalance: -200, projectedIncome: 800, projectedExpenses: 1000 },
    ];
    const summary = calculateForecastSummary(months);
    expect(summary.bestMonth.projectedBalance).toBe(500);
    expect(summary.worstMonth.projectedBalance).toBe(-200);
  });
});
