/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseNfeXml, buildKaronteInvoiceFromParsed, parseInvoicePdfText } from '../invoiceParser.js';

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

  it('parseia DANFE em PDF sem misturar destinatário no emitente', () => {
    const pdfText = `
DANFE
IDENTIFICAÇÃO DO EMITENTE
DISTRIBUIDORA NORDESTE LTDA
CNPJ: 12.345.678/0001-90
EMISSÃO: 01/04/2026
VALOR TOTAL: R$ 4.213,20
DESTINATÁRIO: Sp Rn Gelateria LTDA - Avenida Senador Salgado Filho
Nº 000.456.789
SÉRIE 1
CHAVE DE ACESSO
3526 0612 3456 7800 0190 5500 1000 0123 4512 3456 7890 1234
    `;

    const invoice = parseInvoicePdfText(pdfText);
    expect(invoice.issuerName).toContain('DISTRIBUIDORA NORDESTE');
    expect(invoice.issuerName).not.toContain('DESTINATÁRIO');
    expect(invoice.purchaseDescription).toContain('DISTRIBUIDORA NORDESTE');
    expect(invoice.totalAmount).toBe(4213.2);
    expect(invoice.invoiceNumber).toBe('456789');
    expect(invoice.accessKey).toHaveLength(44);
    expect(invoice.issueDateDisplay).toBe('01/04/2026');
  });

  it('parseia linha concatenada típica de PDF mal extraído', () => {
    const pdfText =
      'ABAIXO. EMISSÃO: 01/04/2026 VALOR TOTAL: R$ 4.213,20 DESTINATÁRIO: Sp Rn Gelateria LTDA - Avenida Senador Salgado Filho, CNPJ: 05.284.873/0001-97';

    const invoice = parseInvoicePdfText(pdfText);
    expect(invoice.totalAmount).toBe(4213.2);
    expect(invoice.purchaseDescription).toContain('Sp Rn Gelateria');
    expect(invoice.purchaseDescription).not.toContain('VALOR TOTAL');
    expect(invoice.issuerDocument).toBe('05284873000197');
  });
});
