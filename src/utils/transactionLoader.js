import { getScopeKey, getScopeCache, setWindowTransactions, getAllCachedTransactions, hasWindowTransactions } from './dataCache.js';
import { getTransactionsForDateWindow, getTransactionsForMonths } from '../services/transactionService.js';

export const getDefaultMonthsBack = () => 18;

export const getWindowForMonthsBack = (monthsBack = getDefaultMonthsBack(), referenceDate = new Date()) => {
  const end = new Date(referenceDate);
  const start = new Date(referenceDate);
  start.setMonth(start.getMonth() - monthsBack);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return { startDate: start, endDate: end };
};

export async function loadTransactionsForScope({
  userId,
  projectId = null,
  monthsBack = getDefaultMonthsBack(),
  referenceDate = new Date(),
  force = false,
}) {
  const scopeKey = getScopeKey(userId, projectId);
  const cache = getScopeCache(scopeKey);
  const { startDate, endDate } = getWindowForMonthsBack(monthsBack, referenceDate);

  if (!force && hasWindowTransactions(cache, startDate, endDate)) {
    return getAllCachedTransactions(cache);
  }

  const txs = await getTransactionsForMonths({
    userId,
    projectId,
    monthsBack,
    referenceDate,
  });

  setWindowTransactions(cache, startDate, endDate, txs);
  return getAllCachedTransactions(cache);
}

export async function loadTransactionsForImportWindow({
  userId,
  projectId = null,
  startDate,
  endDate,
  inMemoryTransactions = [],
}) {
  const scopeKey = getScopeKey(userId, projectId);
  const cache = getScopeCache(scopeKey);

  if (hasWindowTransactions(cache, startDate, endDate)) {
    return getAllCachedTransactions(cache);
  }

  const cached = getAllCachedTransactions(cache);
  const hasCoverage = inMemoryTransactions.length > 0 || cached.length > 0;
  const source = inMemoryTransactions.length ? inMemoryTransactions : cached;

  if (hasCoverage) {
    const minDate = new Date(startDate);
    const maxDate = new Date(endDate);
    maxDate.setHours(23, 59, 59, 999);

    const filtered = source.filter((tx) => {
      const d = new Date(tx.date);
      return d >= minDate && d <= maxDate;
    });

    if (filtered.length > 0) {
      setWindowTransactions(cache, startDate, endDate, filtered);
      return getAllCachedTransactions(cache);
    }
  }

  const txs = await getTransactionsForDateWindow({
    userId,
    projectId,
    startDate,
    endDate,
  });

  setWindowTransactions(cache, startDate, endDate, txs);
  return getAllCachedTransactions(cache);
}
