/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseNfeXml, buildKaronteInvoiceFromParsed } from '../invoiceParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const xml = readFileSync(join(__dirname, '../../../fixtures/sample-nfe.xml'), 'utf8');

describe('invoiceParser', () => {
  it('extrai campos de NF-e XML', () => {
    const invoice = parseNfeXml(xml);
    expect(invoice.issuerName).toContain('MERCADO');
    expect(invoice.totalAmount).toBe(89.9);
    expect(invoice.invoiceNumber).toBe('12345');
    expect(invoice.items.length).toBe(1);
    expect(invoice.accessKey.length).toBe(44);
  });

  it('monta modelo Karonte com overrides do usuário', () => {
    const invoice = buildKaronteInvoiceFromParsed(
      { issuerName: 'Loja', totalAmount: 10, items: [] },
      { purchaseDescription: 'Compra teste', category: 'Alimentação' }
    );
    expect(invoice.purchaseDescription).toBe('Compra teste');
    expect(invoice.category).toBe('Alimentação');
  });
});
