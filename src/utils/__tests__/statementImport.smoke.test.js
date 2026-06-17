import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  validatePdfFile,
  extractTextFromPdf,
  extractTextFromMultiplePdfs,
  getImportErrorMessage,
  IMPORT_ERRORS,
  MAX_PDF_SIZE_BYTES,
} from '../../services/statementImportService.js';
import { parseStatementText, markDuplicates } from '../statementParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pdfBytes = readFileSync(join(__dirname, '../../../fixtures/smoke-extrato.pdf'));

const toFile = (bytes, name, type = 'application/pdf') => ({
  name,
  type,
  size: bytes.length,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
});

describe('statement import smoke', () => {
  it('valida tipo e tamanho de arquivo', () => {
    const pdf = toFile(pdfBytes, 'extrato.pdf');
    expect(validatePdfFile(pdf).valid).toBe(true);
    expect(validatePdfFile(toFile(pdfBytes, 'x.txt', 'text/plain')).error).toBe(IMPORT_ERRORS.NOT_PDF);
    expect(validatePdfFile({ ...pdf, size: MAX_PDF_SIZE_BYTES + 1 }).error).toBe(IMPORT_ERRORS.TOO_LARGE);
  });

  it('extrai texto e detecta transações de PDF real (pdfjs)', async () => {
    const text = await extractTextFromPdf(toFile(pdfBytes, 'extrato.pdf'));
    expect(text.length).toBeGreaterThan(10);

    const txs = parseStatementText(text, { referenceYear: 2026 });
    expect(txs.length).toBeGreaterThanOrEqual(2);
    expect(txs.some((t) => t.type === 'income')).toBe(true);
    expect(txs.some((t) => t.category === 'Alimentação')).toBe(true);
  });

  it('processa múltiplos PDFs e marca duplicatas', async () => {
    const file = toFile(pdfBytes, 'extrato.pdf');
    const results = await extractTextFromMultiplePdfs([file, file], {
      parseOptions: { referenceYear: 2026 },
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'done')).toBe(true);

    const flat = results.flatMap((r) => r.transactions);
    const marked = markDuplicates(flat.slice(0, 3), [
      {
        date: flat[0].date.toISOString(),
        amount: flat[0].amount,
        description: flat[0].description,
      },
    ]);
    expect(marked[0].isDuplicate).toBe(true);
    expect(marked[0].selected).toBe(false);
  });

  it('retorna erro quando PDF não tem transações', async () => {
    const headerOnly = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 55>>stream
BT /F1 11 Tf 72 720 Td (EXTRATO BANCARIO SEM LANCAMENTOS) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000246 00000 n 
0000000354 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
420
%%EOF`;
    const emptyBytes = new TextEncoder().encode(headerOnly);
    const results = await extractTextFromMultiplePdfs([toFile(emptyBytes, 'vazio.pdf')], {
      parseOptions: { referenceYear: 2026 },
    });
    expect(results[0].status).toBe('error');
    expect(
      results[0].error === getImportErrorMessage(IMPORT_ERRORS.NO_TRANSACTIONS) ||
        results[0].error === getImportErrorMessage(IMPORT_ERRORS.SCANNED)
    ).toBe(true);
  });
});
