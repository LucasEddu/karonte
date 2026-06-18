import { describe, it, expect, beforeEach } from 'vitest';
import {
  getScopeKey,
  getScopeCache,
  setWindowTransactions,
  getAllCachedTransactions,
  addTransactionsToCache,
  updateTransactionInCache,
  removeTransactionsFromCache,
  invalidateScopeCache,
} from '../dataCache.js';

const tx = (id, date = '2026-06-10T12:00:00.000Z') => ({
  id,
  type: 'expense',
  amount: 10,
  description: `Tx ${id}`,
  date,
  userId: 'user1',
});

describe('dataCache', () => {
  beforeEach(() => {
    invalidateScopeCache(getScopeKey('user1', null));
  });

  it('cacheia transações por janela', () => {
    const cache = getScopeCache(getScopeKey('user1', null));
    setWindowTransactions(cache, '2026-06-01', '2026-06-30', [tx('a')]);
    expect(getAllCachedTransactions(cache)).toHaveLength(1);
  });

  it('insere transações no cache', () => {
    const cache = getScopeCache(getScopeKey('user1', null));
    addTransactionsToCache(cache, [tx('b')]);
    expect(getAllCachedTransactions(cache).some((item) => item.id === 'b')).toBe(true);
  });

  it('atualiza transação no cache', () => {
    const cache = getScopeCache(getScopeKey('user1', null));
    addTransactionsToCache(cache, [tx('c')]);
    updateTransactionInCache(cache, { ...tx('c'), amount: 999 });
    expect(getAllCachedTransactions(cache).find((item) => item.id === 'c').amount).toBe(999);
  });

  it('remove transações do cache', () => {
    const cache = getScopeCache(getScopeKey('user1', null));
    addTransactionsToCache(cache, [tx('d')]);
    removeTransactionsFromCache(cache, ['d']);
    expect(getAllCachedTransactions(cache)).toHaveLength(0);
  });
});
