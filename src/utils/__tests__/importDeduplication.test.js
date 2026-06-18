import { describe, it, expect } from 'vitest';
import {
  buildDedupIndex,
  markDuplicates,
  findDuplicateMatch,
  createTransactionHash,
} from '../importDeduplication.js';

const tx = (overrides) => ({
  id: '1',
  type: 'expense',
  amount: 100,
  description: 'PIX Mercado',
  date: '2026-06-10T12:00:00.000Z',
  ...overrides,
});

describe('buildDedupIndex', () => {
  it('indexa por duplicateHash', () => {
    const index = buildDedupIndex([tx({ duplicateHash: 'abc' })]);
    expect(index.byDuplicateHash.has('abc')).toBe(true);
  });
});

describe('markDuplicates', () => {
  it('marca duplicata exata sem Firestore', () => {
    const existing = [tx({ id: 'e1', duplicateHash: '2026-06-10|100.00|pixmercado' })];
    const rows = [tx({ id: 'n1', description: 'PIX Mercado' })];
    const marked = markDuplicates(rows, existing);
    expect(marked[0].isDuplicate).toBe(true);
    expect(marked[0].selected).toBe(false);
  });

  it('detecta duplicidade aproximada por data+valor', () => {
    const existing = [tx({ id: 'e1', description: 'PIX Mercado Sao Luiz' })];
    const rows = [tx({ id: 'n1', description: 'PIX Mercado Sao Lu' })];
    const marked = markDuplicates(rows, existing);
    expect(marked[0].isPossibleDuplicate).toBe(true);
  });
});

describe('findDuplicateMatch', () => {
  it('aceita array de transações existentes', () => {
    const existing = [tx({ id: 'e1' })];
    const match = findDuplicateMatch(tx({ id: 'n1' }), existing);
    expect(match.duplicateHash).toBeTruthy();
  });
});

describe('createTransactionHash', () => {
  it('gera hash estável', () => {
    const hash = createTransactionHash(tx());
    expect(hash).toContain('100.00');
  });
});
