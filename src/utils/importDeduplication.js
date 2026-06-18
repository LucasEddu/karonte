import {
  createTransactionHash,
  descriptionsAreSimilar,
  normalizeDescription,
} from './statementParser.js';

export { createTransactionHash, normalizeDescription as normalizeDescriptionForHash } from './statementParser.js';

const dateKey = (date) => {
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return String(date || '').slice(0, 10);
};

const sameAmount = (a, b) =>
  Number(a || 0).toFixed(2) === Number(b || 0).toFixed(2);

const sameDate = (a, b) => dateKey(a) === dateKey(b);

export const buildDedupIndex = (existingTransactions = []) => {
  const byDuplicateHash = new Map();
  const byDateAmount = new Map();
  const byImportBatchId = new Map();

  for (const tx of existingTransactions) {
    const hash = tx.duplicateHash || createTransactionHash(tx);
    if (!byDuplicateHash.has(hash)) byDuplicateHash.set(hash, tx);

    const daKey = `${dateKey(tx.date)}|${Number(tx.amount || 0).toFixed(2)}`;
    if (!byDateAmount.has(daKey)) byDateAmount.set(daKey, []);
    byDateAmount.get(daKey).push(tx);

    if (tx.importBatchId) {
      if (!byImportBatchId.has(tx.importBatchId)) byImportBatchId.set(tx.importBatchId, []);
      byImportBatchId.get(tx.importBatchId).push(tx);
    }
  }

  return { byDuplicateHash, byDateAmount, byImportBatchId };
};

export const findApproximateDuplicate = (row, dedupIndex) => {
  const daKey = `${dateKey(row.date)}|${Number(row.amount || 0).toFixed(2)}`;
  const candidates = dedupIndex.byDateAmount.get(daKey) || [];
  return candidates.find((t) =>
    descriptionsAreSimilar(t.description, row.description)
  ) || null;
};

export const findDuplicateMatch = (transaction, existingOrIndex, seenInBatch = new Set()) => {
  const dedupIndex = Array.isArray(existingOrIndex)
    ? buildDedupIndex(existingOrIndex)
    : existingOrIndex;
  const hash = transaction.duplicateHash || createTransactionHash(transaction);

  if (dedupIndex.byDuplicateHash.has(hash) || seenInBatch.has(hash)) {
    return { isDuplicate: true, isPossibleDuplicate: false, duplicateHash: hash };
  }

  const fuzzy = findApproximateDuplicate(transaction, dedupIndex);
  return {
    isDuplicate: false,
    isPossibleDuplicate: Boolean(fuzzy),
    duplicateHash: hash,
  };
};

export const markDuplicates = (importRows, existingTransactions = []) => {
  const dedupIndex = buildDedupIndex(existingTransactions);
  const seenInBatch = new Set();

  return importRows.map((row) => {
    const match = findDuplicateMatch(row, dedupIndex, seenInBatch);
    seenInBatch.add(match.duplicateHash);
    const isDup = match.isDuplicate || match.isPossibleDuplicate;
    return {
      ...row,
      duplicateHash: match.duplicateHash,
      isDuplicate: match.isDuplicate,
      isPossibleDuplicate: match.isPossibleDuplicate,
      selected: !isDup,
    };
  });
};
