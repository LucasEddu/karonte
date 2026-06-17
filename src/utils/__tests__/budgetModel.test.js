import { describe, it, expect } from 'vitest';
import {
  normalizeBudgets,
  setBudgetLimit,
  getBudgetLimitByCategory,
  getBudgetLimitByName,
  serializeBudgetsForSave,
} from '../budgetModel.js';

describe('budgetModel', () => {
  it('migra orçamento legado por nome para schema v2', () => {
    const legacy = { Alimentação: 500, Transporte: 200, ownerId: 'u1' };
    const normalized = normalizeBudgets(legacy);
    expect(normalized.limitsByName).toEqual({ Alimentação: 500, Transporte: 200 });
    expect(normalized.schemaVersion).toBe(2);
  });

  it('grava e lê limite por categoryId e nome', () => {
    let budgets = normalizeBudgets({});
    budgets = setBudgetLimit(budgets, 'Alimentação', 'expense-alimentacao', 750);
    expect(getBudgetLimitByName(budgets, 'Alimentação')).toBe(750);
    expect(getBudgetLimitByCategory(budgets, 'expense-alimentacao', 'Alimentação')).toBe(750);
    const saved = serializeBudgetsForSave(budgets);
    expect(saved.limits['expense-alimentacao']).toBe(750);
    expect(saved.limitsByName['Alimentação']).toBe(750);
  });

  it('remove limite quando valor é zero', () => {
    let budgets = setBudgetLimit(normalizeBudgets({}), 'Lazer', 'expense-lazer', 100);
    budgets = setBudgetLimit(budgets, 'Lazer', 'expense-lazer', 0);
    expect(getBudgetLimitByName(budgets, 'Lazer')).toBe(0);
    expect(budgets.limits['expense-lazer']).toBeUndefined();
  });
});
