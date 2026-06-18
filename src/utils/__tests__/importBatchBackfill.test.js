import { describe, it, expect } from 'vitest';
import {
  reconstructBatchesFromTransactions,
  mergeImportBatches,
} from '../importBatchBackfill.js';

const tx = (overrides) => ({
  id: '1',
  type: 'expense',
  amount: 100,
  description: 'Teste',
  date: '2026-06-10T12:00:00.000Z',
  source: 'statement_import',
  importBatchId: 'batch-1',
  ...overrides,
});

describe('reconstructBatchesFromTransactions', () => {
  it('agrupa transações importadas por importBatchId', () => {
    const transactions = [
      tx({ id: 'a', importBatchId: 'batch-1' }),
      tx({ id: 'b', importBatchId: 'batch-1' }),
      tx({ id: 'c', importBatchId: 'batch-2' }),
    ];
    const batches = reconstructBatchesFromTransactions(transactions);
    expect(batches).toHaveLength(2);
    expect(batches.find((b) => b.id === 'batch-1').counts.imported).toBe(2);
  });

  it('filtra por escopo de projeto', () => {
    const transactions = [
      tx({ id: 'a', importBatchId: 'batch-1', projectId: 'proj-vida' }),
      tx({ id: 'b', importBatchId: 'batch-2' }),
    ];
    const projectBatches = reconstructBatchesFromTransactions(transactions, 'proj-vida');
    expect(projectBatches).toHaveLength(1);
    expect(projectBatches[0].id).toBe('batch-1');

    const geralBatches = reconstructBatchesFromTransactions(transactions, null);
    expect(geralBatches).toHaveLength(1);
    expect(geralBatches[0].id).toBe('batch-2');
  });
});

describe('mergeImportBatches', () => {
  it('prefere lote do Firestore sobre reconstruído', () => {
    const firestore = [{ id: 'batch-1', counts: { imported: 5 }, importedAt: '2026-06-01' }];
    const reconstructed = [{ id: 'batch-1', counts: { imported: 2 }, _reconstructed: true }];
    const merged = mergeImportBatches(firestore, reconstructed);
    expect(merged).toHaveLength(1);
    expect(merged[0].counts.imported).toBe(5);
  });

  it('inclui lotes reconstruídos ausentes no Firestore', () => {
    const merged = mergeImportBatches([], [{ id: 'batch-x', counts: { imported: 3 } }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('batch-x');
  });
});
