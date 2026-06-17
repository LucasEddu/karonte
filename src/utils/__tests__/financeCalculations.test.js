import { describe, it, expect } from 'vitest';
import {
  computePeriodTotals,
  computeCategoryStats,
  computeBudgetStats,
  getCategoryBudgetInfo,
  computeRuleStats,
  computeForecast,
  getCardInvoiceStats,
  filterTransactionsByPeriod,
} from '../financeCalculations.js';
import { formatMoney, parseMoneyInput } from '../money.js';
import {
  computeParcelaValue,
  computeParcelasPagas,
  computeTaskProgressPct,
} from '../taskCalculations.js';
import {
  listMissingRecurrenceMonths,
  buildRecurrenceClone,
} from '../../services/recurrenceService.js';
import { buildTransactionCategoryFields } from '../categoryModel.js';

describe('buildTransactionCategoryFields', () => {
  it('gera categoryId e categoryName para categorias padrão', () => {
    const fields = buildTransactionCategoryFields('Alimentação', 'expense', { expense: [], income: [] });
    expect(fields.categoryId).toBe('expense-alimentacao');
    expect(fields.categoryName).toBe('Alimentação');
    expect(fields.category).toBe('Alimentação');
  });

  it('usa id da categoria customizada quando existir', () => {
    const custom = {
      expense: [{ id: 'expense-custom-1', name: 'Academia' }],
      income: [],
    };
    const fields = buildTransactionCategoryFields('Academia', 'expense', custom);
    expect(fields.categoryId).toBe('expense-custom-1');
    expect(fields.categoryName).toBe('Academia');
  });
});

const tx = (overrides) => ({
  id: '1',
  type: 'expense',
  amount: 100,
  category: 'Alimentação',
  date: '2026-06-10T12:00:00.000Z',
  ...overrides,
});

describe('money utils', () => {
  it('formata valores em pt-BR', () => {
    expect(formatMoney(1234.5)).toMatch(/1\.234,50/);
  });

  it('parseia entrada monetária por centavos', () => {
    expect(parseMoneyInput('12345')).toBe(123.45);
    expect(parseMoneyInput('')).toBe(0);
  });
});

describe('computePeriodTotals', () => {
  it('calcula saldo do período', () => {
    const result = computePeriodTotals([
      tx({ type: 'income', amount: 1000 }),
      tx({ amount: 300 }),
      tx({ amount: 200 }),
    ]);
    expect(result.totalIncome).toBe(1000);
    expect(result.totalExpense).toBe(500);
    expect(result.balance).toBe(500);
  });
});

describe('getCategoryBudgetInfo', () => {
  it('marca alertas em 80% e 100%', () => {
    const budgets = { Alimentação: 100 };
    expect(getCategoryBudgetInfo(budgets, 'Alimentação', 50)).toEqual({
      limit: 100,
      pct: 50,
      isOver80: false,
      isOver100: false,
    });
    expect(getCategoryBudgetInfo(budgets, 'Alimentação', 85).isOver80).toBe(true);
    expect(getCategoryBudgetInfo(budgets, 'Alimentação', 110).isOver100).toBe(true);
  });
});

describe('computeRuleStats', () => {
  it('distribui necessidades, desejos e poupança', () => {
    const filtered = [
      tx({ category: 'Moradia', amount: 500 }),
      tx({ category: 'Lazer', amount: 200 }),
    ];
    const result = computeRuleStats(filtered, 300, {});
    expect(result.needsPct).toBeGreaterThan(0);
    expect(result.wantsPct).toBeGreaterThan(0);
    expect(result.savingsPct).toBeGreaterThan(0);
  });
});

describe('computeForecast', () => {
  it('projeta gasto com base na média dos últimos 90 dias', () => {
    const referenceDate = new Date(2026, 5, 15);
    const transactions = [
      tx({ date: '2026-05-10T12:00:00.000Z', amount: 900 }),
      tx({ date: '2026-06-05T12:00:00.000Z', amount: 300 }),
    ];
    const forecast = computeForecast(transactions, referenceDate);
    expect(forecast.currentMonthSpent).toBe(300);
    expect(forecast.forecastAmount).toBeGreaterThan(forecast.currentMonthSpent);
    expect(typeof forecast.isHigh).toBe('boolean');
  });
});

describe('task calculations', () => {
  it('calcula parcelas pagas e progresso', () => {
    expect(computeParcelaValue(1000, 10)).toBe(100);
    expect(computeParcelasPagas(250, 100, 10)).toBe(2);
    expect(computeTaskProgressPct({ type: 'despesa', metaValue: 1000, paidAmount: 500 })).toBe(50);
  });
});

describe('recurrence service', () => {
  it('identifica meses faltantes de recorrência', () => {
    const root = {
      id: 'root-1',
      userId: 'u1',
      isRecurring: true,
      date: '2026-04-10T12:00:00.000Z',
      amount: 50,
      type: 'expense',
      description: 'Assinatura',
      category: 'Lazer',
    };
    const missing = listMissingRecurrenceMonths(root, [root], new Date(2026, 5, 20));
    expect(missing.map((m) => m.key)).toEqual(['2026-5', '2026-6']);
    const clone = buildRecurrenceClone(root, 2026, 5);
    expect(clone.parentId).toBe('root-1');
    expect(clone.isRecurring).toBe(false);
  });
});

describe('getCardInvoiceStats', () => {
  it('soma despesas do ciclo de fechamento', () => {
    const card = { id: 'c1', limit: 1000, closingDay: 10 };
    const transactions = [
      tx({
        paymentMethod: 'card',
        cardId: 'c1',
        date: '2026-06-05T12:00:00.000Z',
        amount: 150,
      }),
    ];
    const stats = getCardInvoiceStats(card, transactions, 6, 2026);
    expect(stats.invoiceAmount).toBe(150);
    expect(stats.availableLimit).toBe(850);
  });
});

describe('filterTransactionsByPeriod', () => {
  it('filtra por mês e ano', () => {
    const list = [
      tx({ date: '2026-06-01T12:00:00.000Z' }),
      tx({ date: '2026-05-01T12:00:00.000Z' }),
    ];
    const june = filterTransactionsByPeriod(list, 6, 2026);
    expect(june).toHaveLength(1);
  });
});
