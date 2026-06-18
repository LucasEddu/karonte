import { describe, it, expect } from 'vitest';
import { createImportFingerprint, createImportPeriod } from '../importFingerprint.js';

const row = (overrides) => ({
  type: 'expense',
  amount: 50,
  date: new Date('2026-03-10'),
  description: 'Teste',
  ...overrides,
});

describe('createImportPeriod', () => {
  it('retorna primeira e última data', () => {
    const period = createImportPeriod([
      row({ date: new Date('2026-01-05') }),
      row({ date: new Date('2026-03-20') }),
    ]);
    expect(period.periodStart).toBe('2026-01-05');
    expect(period.periodEnd).toBe('2026-03-20');
  });
});

describe('createImportFingerprint', () => {
  it('gera mesma fingerprint para mesmo conjunto', () => {
    const rows = [
      row({ date: new Date('2026-01-05'), amount: 10 }),
      row({ date: new Date('2026-02-05'), amount: 20 }),
    ];
    const a = createImportFingerprint(rows);
    const b = createImportFingerprint(rows);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('altera fingerprint quando valores mudam', () => {
    const base = [row({ amount: 10 })];
    const changed = [row({ amount: 99 })];
    expect(createImportFingerprint(base).fingerprint).not.toBe(
      createImportFingerprint(changed).fingerprint
    );
  });
});
