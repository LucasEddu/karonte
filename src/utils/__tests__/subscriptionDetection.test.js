import { describe, it, expect } from 'vitest';
import {
  detectSubscriptions,
  normalizeMerchantName,
  calculateSubscriptionStats,
  getSubscriptionConfidence,
  groupRecurringTransactions,
} from '../subscriptionDetection.js';

describe('subscriptionDetection', () => {
  const monthlyTxs = [
    { id: '1', type: 'expense', amount: 39.9, description: 'NETFLIX.COM', date: '2026-01-10T12:00:00.000Z', category: 'Lazer' },
    { id: '2', type: 'expense', amount: 39.9, description: 'Netflix Assinatura', date: '2026-02-10T12:00:00.000Z', category: 'Lazer' },
    { id: '3', type: 'expense', amount: 39.9, description: 'NETFLIX', date: '2026-03-10T12:00:00.000Z', category: 'Lazer' },
    { id: '4', type: 'expense', amount: 120, description: 'Compra única loja', date: '2026-03-15T12:00:00.000Z', category: 'Outros' },
  ];

  it('detecta assinatura por descrição parecida', () => {
    const subs = detectSubscriptions(monthlyTxs);
    const netflix = subs.find((s) => s.merchant.toLowerCase().includes('netflix'));
    expect(netflix).toBeTruthy();
    expect(netflix.occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it('detecta assinatura por valor recorrente', () => {
    const groups = groupRecurringTransactions(monthlyTxs);
    expect(groups.some((g) => Math.abs(g.averageAmount - 39.9) < 1)).toBe(true);
  });

  it('calcula custo anual', () => {
    const subs = detectSubscriptions(monthlyTxs);
    const sub = subs[0];
    expect(sub.annualCost).toBeCloseTo(sub.averageAmount * 12, 1);
  });

  it('calcula próxima cobrança', () => {
    const subs = detectSubscriptions(monthlyTxs);
    expect(subs[0].nextExpectedDate).toBeTruthy();
    expect(new Date(subs[0].nextExpectedDate).getTime()).toBeGreaterThan(new Date('2026-03-10').getTime());
  });

  it('ignora transações únicas', () => {
    const subs = detectSubscriptions([monthlyTxs[3]]);
    expect(subs.length).toBe(0);
  });

  it('calcula confiança', () => {
    const subs = detectSubscriptions(monthlyTxs);
    const confidence = getSubscriptionConfidence(subs[0]);
    expect(['high', 'medium', 'low']).toContain(confidence);
  });

  it('normaliza merchant', () => {
    expect(normalizeMerchantName('Netflix Assinatura')).toContain('netflix');
  });

  it('calcula estatísticas agregadas', () => {
    const subs = detectSubscriptions(monthlyTxs);
    const stats = calculateSubscriptionStats(subs);
    expect(stats.monthlyTotal).toBeGreaterThan(0);
    expect(stats.count).toBeGreaterThan(0);
  });
});
