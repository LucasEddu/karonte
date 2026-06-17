import { describe, it, expect } from 'vitest';
import { processChatMessage } from '../chatParser.js';

const baseCtx = {
  balance: 500,
  totalExpense: 300,
  totalIncome: 800,
  categoryStats: [{ name: 'Alimentação', total: 150 }],
  calculateForecast: () => ({
    currentMonthSpent: 300,
    forecastAmount: 400,
    monthlyAverage: 350,
    variationPct: 10,
    isHigh: false,
  }),
  expenseCategories: ['Alimentação', 'Transporte'],
  customCategories: { expense: [], income: [] },
  getCategoryBudgetInfoForCat: () => ({ limit: 0, pct: 0, isOver80: false, isOver100: false }),
};

describe('chatParser', () => {
  it('responde consulta de saldo', () => {
    const result = processChatMessage('qual meu saldo?', baseCtx);
    expect(result.type).toBe('answer');
    expect(result.text).toContain('500');
  });

  it('cria ação para gasto com valor', () => {
    const result = processChatMessage('50 pizza', baseCtx);
    expect(result.type).toBe('action');
    expect(result.payload.amount).toBe(50);
    expect(result.payload.type).toBe('expense');
  });
});
