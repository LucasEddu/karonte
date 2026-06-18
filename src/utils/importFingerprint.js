import { createTransactionHash } from './statementParser.js';

const toDate = (value) => {
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const createImportPeriod = (rows = []) => {
  let start = null;
  let end = null;

  for (const row of rows) {
    const d = toDate(row.date);
    if (!d) continue;
    if (!start || d < start) start = d;
    if (!end || d > end) end = d;
  }

  if (!start || !end) {
    const now = new Date();
    return {
      periodStart: now.toISOString().slice(0, 10),
      periodEnd: now.toISOString().slice(0, 10),
    };
  }

  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
};

export const summarizeImportRows = (rows = []) => {
  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    if (row.type === 'income') incomeTotal += amount;
    else expenseTotal += amount;
  }

  const { periodStart, periodEnd } = createImportPeriod(rows);
  const hashes = rows.map((row) => row.duplicateHash || createTransactionHash(row));

  return {
    rowCount: rows.length,
    periodStart,
    periodEnd,
    incomeTotal,
    expenseTotal,
    firstHashes: hashes.slice(0, 10),
    lastHashes: hashes.slice(-10),
  };
};

export const createImportFingerprint = (rows = []) => {
  const summary = summarizeImportRows(rows);
  const payload = [
    summary.rowCount,
    summary.periodStart,
    summary.periodEnd,
    summary.incomeTotal.toFixed(2),
    summary.expenseTotal.toFixed(2),
    ...summary.firstHashes,
    ...summary.lastHashes,
  ].join('|');

  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(i);
    hash |= 0;
  }

  return {
    fingerprint: `fp_${Math.abs(hash).toString(36)}`,
    ...summary,
  };
};

export const findMatchingFingerprintBatch = (batches = [], fingerprint) => {
  if (!fingerprint) return null;
  return batches.find((b) => b.importFingerprint === fingerprint) || null;
};
