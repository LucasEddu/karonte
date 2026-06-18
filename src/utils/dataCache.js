export const getScopeKey = (userId, projectId = null) =>
  `${userId || 'anon'}:${projectId || 'geral'}`;

export const windowCacheKey = (startDate, endDate) => {
  const start = startDate instanceof Date ? startDate.toISOString().slice(0, 10) : String(startDate).slice(0, 10);
  const end = endDate instanceof Date ? endDate.toISOString().slice(0, 10) : String(endDate).slice(0, 10);
  return `${start}_${end}`;
};

export const monthCacheKey = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}`;

const scopeStores = new Map();

export const getScopeCache = (scopeKey) => {
  if (!scopeStores.has(scopeKey)) {
    scopeStores.set(scopeKey, createScopeCache());
  }
  return scopeStores.get(scopeKey);
};

export const createScopeCache = () => ({
  transactionsByWindow: new Map(),
  transactionsByMonth: new Map(),
  transactionsIndex: new Map(),
  importBatches: null,
  creditCards: null,
  budgets: null,
  tasks: null,
  lastFetchedAt: null,
});

export const invalidateScopeCache = (scopeKey) => {
  scopeStores.delete(scopeKey);
};

export const invalidateAllScopeCaches = () => {
  scopeStores.clear();
};

const txKey = (tx) => tx.id || `${tx.date}|${tx.amount}|${tx.description}`;

export const indexTransaction = (cache, tx) => {
  if (!tx?.id) return;
  cache.transactionsIndex.set(tx.id, tx);
};

export const setWindowTransactions = (cache, startDate, endDate, transactions = []) => {
  const key = windowCacheKey(startDate, endDate);
  cache.transactionsByWindow.set(key, transactions);
  transactions.forEach((tx) => indexTransaction(cache, tx));
  cache.lastFetchedAt = Date.now();
  return transactions;
};

export const getWindowTransactions = (cache, startDate, endDate) => {
  const key = windowCacheKey(startDate, endDate);
  return cache.transactionsByWindow.get(key) || null;
};

export const hasWindowTransactions = (cache, startDate, endDate) =>
  cache.transactionsByWindow.has(windowCacheKey(startDate, endDate));

export const getAllCachedTransactions = (cache) => {
  const byId = new Map();
  for (const txs of cache.transactionsByWindow.values()) {
    for (const tx of txs) {
      if (tx?.id) byId.set(tx.id, tx);
    }
  }
  for (const [id, tx] of cache.transactionsIndex.entries()) {
    byId.set(id, tx);
  }
  return [...byId.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
};

export const addTransactionsToCache = (cache, transactions = []) => {
  for (const tx of transactions) {
    indexTransaction(cache, tx);
  }
  return getAllCachedTransactions(cache);
};

export const updateTransactionInCache = (cache, tx) => {
  if (!tx?.id) return getAllCachedTransactions(cache);
  indexTransaction(cache, tx);
  for (const [key, list] of cache.transactionsByWindow.entries()) {
    const idx = list.findIndex((item) => item.id === tx.id);
    if (idx >= 0) {
      const next = [...list];
      next[idx] = tx;
      cache.transactionsByWindow.set(key, next);
    }
  }
  return getAllCachedTransactions(cache);
};

export const removeTransactionsFromCache = (cache, ids = []) => {
  const idSet = new Set(ids.filter(Boolean));
  for (const id of idSet) {
    cache.transactionsIndex.delete(id);
  }
  for (const [key, list] of cache.transactionsByWindow.entries()) {
    cache.transactionsByWindow.set(key, list.filter((tx) => !idSet.has(tx.id)));
  }
  return getAllCachedTransactions(cache);
};

export const removeImportBatchFromCache = (cache, importBatchId) => {
  if (!importBatchId) return getAllCachedTransactions(cache);
  const ids = [];
  for (const tx of getAllCachedTransactions(cache)) {
    if (tx.importBatchId === importBatchId) ids.push(tx.id);
  }
  return removeTransactionsFromCache(cache, ids);
};

export const setImportBatchesCache = (cache, batches) => {
  cache.importBatches = batches;
  cache.lastFetchedAt = Date.now();
};

export const getImportBatchesCache = (cache) => cache.importBatches;

export const setCreditCardsCache = (cache, cards) => {
  cache.creditCards = cards;
};

export const getCreditCardsCache = (cache) => cache.creditCards;

export const setBudgetsCache = (cache, budgets) => {
  cache.budgets = budgets;
};

export const getBudgetsCache = (cache) => cache.budgets;

export const setTasksCache = (cache, tasks) => {
  cache.tasks = tasks;
};

export const getTasksCache = (cache) => cache.tasks;

export const filterTransactionsInMemory = (transactions, { startDate, endDate, projectId, userId } = {}) => {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (end) end.setHours(23, 59, 59, 999);

  return transactions.filter((tx) => {
    const d = new Date(tx.date);
    if (start && d < start) return false;
    if (end && d > end) return false;

    if (projectId) {
      return tx.projectId === projectId;
    }
    if (userId) {
      return tx.userId === userId && (!tx.projectId || tx.projectId === 'geral');
    }
    return true;
  });
};

export const mergeTransactionLists = (...lists) => {
  const byId = new Map();
  for (const list of lists) {
    for (const tx of list || []) {
      if (tx?.id) byId.set(tx.id, tx);
    }
  }
  return [...byId.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
};
