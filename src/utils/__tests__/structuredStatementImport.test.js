import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  parseCsvText,
  parseOfxText,
  parseFlexibleDate,
  splitCsvLine,
} from '../structuredStatementParser.js';
import {
  validateStatementFile,
  processStatementFiles,
  STATEMENT_FORMATS,
} from '../../services/statementImportService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '../../../fixtures');

const toFile = (bytes, name, type) => ({
  name,
  type,
  size: bytes.length,
  text: async () => new TextDecoder().decode(bytes),
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
});

describe('structuredStatementParser', () => {
  it('parseia CSV da conta Nubank (PT)', () => {
    const csv = readFileSync(join(fixtures, 'nubank-conta.csv'), 'utf8');
    const txs = parseCsvText(csv, { referenceYear: 2020 });
    expect(txs.length).toBe(3);
    expect(txs.some((t) => t.type === 'income')).toBe(true);
    expect(txs.some((t) => t.description.toLowerCase().includes('mercado'))).toBe(true);
  });

  it('parseia CSV de fatura Nubank (EN/ISO)', () => {
    const csv = readFileSync(join(fixtures, 'nubank-fatura.csv'), 'utf8');
    const txs = parseCsvText(csv, { referenceYear: 2026 });
    expect(txs.length).toBe(3);
    expect(txs.find((t) => t.type === 'income')?.amount).toBe(500);
  });

  it('parseia OFX com STMTTRN', () => {
    const ofx = readFileSync(join(fixtures, 'nubank-extrato.ofx'), 'utf8');
    const txs = parseOfxText(ofx, { referenceYear: 2020 });
    expect(txs.length).toBe(3);
    expect(txs.find((t) => t.description.toLowerCase().includes('mercado'))?.type).toBe('expense');
  });

  it('parseFlexibleDate aceita ISO, BR e OFX', () => {
    expect(parseFlexibleDate('2026-05-03')?.getFullYear()).toBe(2026);
    expect(parseFlexibleDate('04/12/2020')?.getDate()).toBe(4);
    expect(parseFlexibleDate('20201204')?.getMonth()).toBe(11);
  });

  it('splitCsvLine respeita aspas', () => {
    expect(splitCsvLine('"a,b",c', ',')).toEqual(['a,b', 'c']);
  });
});

describe('statement import multi-formato', () => {
  it('valida CSV, OFX e rejeita txt', () => {
    const csv = toFile(new TextEncoder().encode('a'), 'extrato.csv', 'text/csv');
    const ofx = toFile(new TextEncoder().encode('a'), 'extrato.ofx', 'application/octet-stream');
    const txt = toFile(new TextEncoder().encode('a'), 'notas.txt', 'text/plain');

    expect(validateStatementFile(csv)).toEqual({ valid: true, format: STATEMENT_FORMATS.CSV });
    expect(validateStatementFile(ofx)).toEqual({ valid: true, format: STATEMENT_FORMATS.OFX });
    expect(validateStatementFile(txt).valid).toBe(false);
  });

  it('processa CSV e OFX reais', async () => {
    const csvBytes = readFileSync(join(fixtures, 'nubank-conta.csv'));
    const ofxBytes = readFileSync(join(fixtures, 'nubank-extrato.ofx'));

    const results = await processStatementFiles(
      [
        toFile(csvBytes, 'nubank-conta.csv', 'text/csv'),
        toFile(ofxBytes, 'nubank-extrato.ofx', 'application/octet-stream'),
      ],
      { parseOptions: { referenceYear: 2020 } }
    );

    expect(results.every((r) => r.status === 'done')).toBe(true);
    expect(results[0].transactions.length).toBe(3);
    expect(results[1].transactions.length).toBe(3);
  });
});
