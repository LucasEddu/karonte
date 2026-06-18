import { normalizeMoney } from './statementParser.js';

const byLocalName = (root, name) =>
  [...root.getElementsByTagName('*')].filter((el) => el.localName === name);

const firstText = (root, name) => {
  const nodes = byLocalName(root, name);
  return nodes[0]?.textContent?.trim() || '';
};

const parseXmlDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : `${raw.slice(0, 10)}T12:00:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

const extractAccessKey = (infNFe) => {
  const id = infNFe?.getAttribute?.('Id') || '';
  const digits = id.replace(/\D/g, '');
  if (digits.length >= 44) return digits.slice(-44);
  return '';
};

export const buildKaronteInvoiceFromParsed = (parsed, overrides = {}) => {
  const issueDate = parsed.issueDate instanceof Date ? parsed.issueDate : parseXmlDate(parsed.issueDateISO);
  const totalAmount = normalizeMoney(parsed.totalAmount);
  const items = (parsed.items || []).map((item) => ({
    description: String(item.description || '').trim(),
    quantity: Number(item.quantity) || 1,
    unitPrice: normalizeMoney(item.unitPrice),
    totalAmount: normalizeMoney(item.totalAmount || item.unitPrice),
    productCode: item.productCode || null,
  })).filter((item) => item.description);

  const purchaseDescription =
    overrides.purchaseDescription ||
    parsed.purchaseDescription ||
    parsed.issuerName ||
    items[0]?.description ||
    'Compra com nota fiscal';

  return {
    issuerName: parsed.issuerName || '',
    issuerTradeName: parsed.issuerTradeName || '',
    issuerDocument: parsed.issuerDocument || '',
    issuerDocumentType: parsed.issuerDocumentType || 'CNPJ',
    accessKey: parsed.accessKey || '',
    invoiceNumber: parsed.invoiceNumber || '',
    series: parsed.series || '',
    issueDate: issueDate ? issueDate.toISOString() : null,
    issueDateDisplay: issueDate ? issueDate.toLocaleDateString('pt-BR') : '',
    totalAmount,
    items,
    purchaseDescription,
    type: overrides.type || 'expense',
    category: overrides.category || 'Outros',
    notes: overrides.notes || '',
    sourceFormat: parsed.sourceFormat || 'unknown',
    extractedAt: new Date().toISOString(),
  };
};

export const parseNfeXml = (xmlText) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('XML inválido ou corrompido.');
  }

  const infNFe = byLocalName(doc, 'infNFe')[0];
  if (!infNFe) throw new Error('Arquivo XML não é uma NF-e reconhecida.');

  const ide = byLocalName(infNFe, 'ide')[0];
  const emit = byLocalName(infNFe, 'emit')[0];
  const totalNode = byLocalName(infNFe, 'ICMSTot')[0] || byLocalName(infNFe, 'total')[0];

  const issuerDocument =
    firstText(emit, 'CNPJ') ||
    firstText(emit, 'CPF') ||
    '';
  const items = byLocalName(infNFe, 'det').map((det) => {
    const prod = byLocalName(det, 'prod')[0] || det;
    return {
      description: firstText(prod, 'xProd'),
      quantity: parseFloat(firstText(prod, 'qCom') || '1') || 1,
      unitPrice: firstText(prod, 'vUnCom') || firstText(prod, 'vProd'),
      totalAmount: firstText(prod, 'vProd'),
      productCode: firstText(prod, 'cProd') || null,
    };
  }).filter((item) => item.description);

  const parsed = {
    issuerName: firstText(emit, 'xNome'),
    issuerTradeName: firstText(emit, 'xFant'),
    issuerDocument,
    issuerDocumentType: firstText(emit, 'CNPJ') ? 'CNPJ' : 'CPF',
    accessKey: extractAccessKey(infNFe),
    invoiceNumber: ide ? firstText(ide, 'nNF') : '',
    series: ide ? firstText(ide, 'serie') : '',
    issueDate: parseXmlDate(firstText(ide, 'dhEmi') || firstText(ide, 'dEmi')),
    issueDateISO: firstText(ide, 'dhEmi') || firstText(ide, 'dEmi'),
    totalAmount: totalNode ? firstText(totalNode, 'vNF') : '',
    items,
    purchaseDescription: firstText(emit, 'xFant') || firstText(emit, 'xNome') || items[0]?.description,
    sourceFormat: 'nfe_xml',
  };

  if (!parsed.totalAmount && items.length) {
    parsed.totalAmount = items.reduce((sum, item) => sum + normalizeMoney(item.totalAmount), 0);
  }

  if (!parsed.issuerName && !parsed.totalAmount) {
    throw new Error('Não foi possível extrair dados da NF-e.');
  }

  return buildKaronteInvoiceFromParsed(parsed);
};

export const parseInvoicePdfText = (text) => {
  const content = String(text || '');
  if (!content.trim()) throw new Error('PDF sem texto extraível.');

  const cnpjMatch = content.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
  const cpfMatch = content.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  const accessKeyMatch = content.match(/\b(\d{44})\b/);
  const totalMatch =
    content.match(/(?:VALOR\s+TOTAL|Total\s+(?:da\s+)?Nota|vNF)[:\s]*R?\$?\s*([\d.,]+)/i) ||
    content.match(/R\$\s*([\d.,]+)\s*(?:\n|$)/);

  const dateMatch =
    content.match(/(?:Emissão|Data\s+de\s+Emissão)[:\s]*(\d{2}\/\d{2}\/\d{4})/i) ||
    content.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);

  let issueDate = null;
  if (dateMatch) {
    const [d, m, y] = dateMatch[1].split('/').map(Number);
    issueDate = new Date(y, m - 1, d, 12, 0, 0);
  }

  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const issuerName =
    lines.find((l) => /ltda|me\b|eireli|s\.a\.|comercio|mercado|loja/i.test(l)) ||
    lines.slice(0, 5).find((l) => l.length > 5 && l.length < 80) ||
    '';

  const parsed = {
    issuerName: String(issuerName).slice(0, 120),
    issuerTradeName: '',
    issuerDocument: (cnpjMatch?.[0] || cpfMatch?.[0] || '').replace(/\D/g, ''),
    issuerDocumentType: cnpjMatch ? 'CNPJ' : 'CPF',
    accessKey: accessKeyMatch?.[1] || '',
    invoiceNumber: '',
    series: '',
    issueDate,
    issueDateISO: issueDate?.toISOString(),
    totalAmount: totalMatch?.[1] || '',
    items: [],
    purchaseDescription: String(issuerName).slice(0, 120) || 'Compra com nota fiscal (PDF)',
    sourceFormat: 'pdf_text',
  };

  if (!parsed.totalAmount) {
    throw new Error('Não foi possível identificar o valor total no PDF.');
  }

  return buildKaronteInvoiceFromParsed(parsed);
};

export const detectInvoiceFormat = (file) => {
  if (!file?.name) return null;
  const name = file.name.toLowerCase();
  if (name.endsWith('.xml') || file.type === 'text/xml' || file.type === 'application/xml') return 'xml';
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  return null;
};

export const parseInvoiceFile = async (file, extractPdfText) => {
  const format = detectInvoiceFormat(file);
  if (!format) throw new Error('Formato não suportado. Use XML (NF-e) ou PDF.');

  if (format === 'xml') {
    const text = await file.text();
    return parseNfeXml(text);
  }

  const text = await extractPdfText(file);
  return parseInvoicePdfText(text);
};
