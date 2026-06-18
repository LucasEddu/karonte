import { normalizeMoney } from './statementParser.js';

const COMPANY_SUFFIX = /\b(LTDA\.?|ME\.?|EPP|EIRELI|S\.?A\.?|S\/A)\b/i;
const METADATA_NOISE =
  /^(ABAIXO|DANFE|DOCUMENTO\s+AUXILIAR|NF-?E|NATUREZA\s+DA\s+OPERA|INSCRI|FONE|CEP|CNPJ|CPF|CHAVE|SÉRIE|Nº|DATA|HORA|PROTOCOLO)/i;

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

const cleanCompanyLine = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[:\-–—\s]+/, '')
    .replace(/[,\-–—]\s*$/, '')
    .trim()
    .slice(0, 120);

const isMetadataLine = (line) =>
  !line ||
  METADATA_NOISE.test(line) ||
  /EMISS[AÃ]O:|VALOR\s+TOTAL:|DESTINAT[AÁ]RIO:|CHAVE\s+DE\s+ACESSO:/i.test(line) ||
  /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(line) ||
  /^\d{3}\.\d{5}\.\d{2}-\d$/.test(line);

const looksLikeCompany = (line) => {
  const text = cleanCompanyLine(line);
  if (text.length < 4 || text.length > 120) return false;
  if (isMetadataLine(text)) return false;
  if (/^\d+$/.test(text.replace(/\D/g, ''))) return false;
  return COMPANY_SUFFIX.test(text) || /^[A-ZÁÉÍÓÚÀÃÕÇ0-9][A-ZÁÉÍÓÚÀÃÕÇ0-9\s.&\-]{3,}$/i.test(text);
};

const extractAccessKeyFromText = (text) => {
  const compact = String(text || '');
  const direct = compact.match(/\b(\d{44})\b/);
  if (direct) return direct[1];

  const grouped = compact.match(/(?:\d{4}\s+){10}\d{4}/);
  if (grouped) return grouped[0].replace(/\s/g, '');

  const digitsOnly = compact.replace(/\D/g, '');
  for (let i = 0; i <= digitsOnly.length - 44; i += 1) {
    const chunk = digitsOnly.slice(i, i + 44);
    if (/^(1[1-9]|2[0-9]|3[1-8]|4[1-9]|5[1-9])\d{42}$/.test(chunk)) return chunk;
  }
  return '';
};

const extractMoneyAfterLabels = (text, labels) => {
  for (const label of labels) {
    const re = new RegExp(`${label}[^\\dR$]{0,40}R?\\$?\\s*([\\d.,]+)`, 'i');
    const match = text.match(re);
    if (match) return match[1];
  }
  return '';
};

const extractIssueDateFromText = (text) => {
  const patterns = [
    /EMISS[AÃ]O[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
    /DATA\s+DE\s+EMISS[AÃ]O[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
    /(?:^|\s)(\d{2}\/\d{2}\/\d{4})(?:\s|$)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const [d, m, y] = match[1].split('/').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
};

const extractInvoiceNumberFromText = (text) => {
  const patterns = [
    /N[º°o\.]\s*([\d.]{1,15})/i,
    /N[UÚ]MERO\s*(?:DA\s+NOTA)?[:\s]*([\d.]{1,15})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const digits = match[1].replace(/\./g, '').replace(/^0+/, '');
      if (digits) return digits;
    }
  }
  return '';
};

const extractAllCnpjs = (text) =>
  [...String(text).matchAll(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g)].map((m) =>
    m[0].replace(/\D/g, '')
  );

const extractSeriesFromText = (text) => {
  const match = text.match(/S[EÉ]RIE[:\s]*(\d{1,3})/i);
  return match?.[1] || '';
};

const extractCnpjFromSection = (section) => {
  const matches = [...String(section || '').matchAll(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g)];
  if (matches[0]) return matches[0][0].replace(/\D/g, '');
  const cpf = String(section || '').match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  return cpf?.[0].replace(/\D/g, '') || '';
};

const extractEmitenteFromLines = (lines) => {
  const startLabels = [
    /^IDENTIFICA[CÇ][AÃ]O\s+DO\s+EMITENTE/i,
    /^DADOS\s+DO\s+EMITENTE/i,
    /^EMITENTE$/i,
  ];

  for (let i = 0; i < lines.length; i += 1) {
    if (!startLabels.some((re) => re.test(lines[i]))) continue;
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j += 1) {
      const candidate = cleanCompanyLine(lines[j]);
      if (looksLikeCompany(candidate)) return candidate;
    }
  }

  const razaoIdx = lines.findIndex((l) => /RAZ[AÃ]O\s+SOCIAL/i.test(l));
  if (razaoIdx >= 0) {
    for (let j = razaoIdx + 1; j < Math.min(razaoIdx + 4, lines.length); j += 1) {
      const candidate = cleanCompanyLine(lines[j]);
      if (looksLikeCompany(candidate) && !/DESTINAT/i.test(candidate)) return candidate;
    }
  }

  return '';
};

const extractDestinatarioFromText = (text) => {
  const match = text.match(
    /DESTINAT[AÁ]RIO[:\s/]*(.{3,120}?)(?:\s+-\s+[\w\s,.º°\-/]+)?(?:\n|CNPJ|CPF|VALOR|$)/i
  );
  if (!match) return '';
  return cleanCompanyLine(match[1].split(/CNPJ|CPF/i)[0]);
};

const extractEmitenteFromText = (text, lines) => {
  const fromLines = extractEmitenteFromLines(lines);
  if (fromLines) return fromLines;

  const emitenteBlock = text.split(/DESTINAT[AÁ]RIO/i)[0] || text;
  const inline = emitenteBlock.match(
    /EMITENTE[:\s/]*(.{3,120}?)(?:\s+-\s+[\w\s,.º°\-/]+)?(?:\n|CNPJ|CPF|DESTINAT|$)/i
  );
  if (inline) {
    const candidate = cleanCompanyLine(inline[1].split(/CNPJ|CPF/i)[0]);
    if (looksLikeCompany(candidate)) return candidate;
  }

  for (const line of lines.slice(0, 40)) {
    const candidate = cleanCompanyLine(line);
    if (looksLikeCompany(candidate) && !/DESTINAT/i.test(candidate)) return candidate;
  }

  return '';
};

export const parseInvoicePdfText = (text) => {
  const content = String(text || '').replace(/\r/g, '\n');
  if (!content.trim()) throw new Error('PDF sem texto extraível.');

  const normalized = content.replace(/[ \t]+/g, ' ');
  const lines = content
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const destSectionSplit = content.split(/DESTINAT[AÁ]RIO/i);
  const emitenteSection = destSectionSplit[0] || content;

  const issuerName = extractEmitenteFromText(content, lines);
  const recipientName = extractDestinatarioFromText(normalized);
  const accessKey = extractAccessKeyFromText(content);
  const totalAmount =
    extractMoneyAfterLabels(normalized, [
      'VALOR\\s+TOTAL\\s+DA\\s+NOTA',
      'VALOR\\s+TOTAL\\s+NF',
      'VALOR\\s+TOTAL',
      'V\\.?\\s*NF',
    ]) || '';
  const issueDate = extractIssueDateFromText(normalized);
  const invoiceNumber = extractInvoiceNumberFromText(normalized);
  const series = extractSeriesFromText(normalized);
  let issuerDocument = extractCnpjFromSection(emitenteSection);
  if (!issuerDocument) {
    const cnpjs = extractAllCnpjs(content);
    issuerDocument = cnpjs[0] || '';
  }

  const purchaseDescription = issuerName
    ? `Compra — ${issuerName}`
    : recipientName
      ? `Compra — ${recipientName}`
      : 'Compra com nota fiscal (PDF)';

  const parsed = {
    issuerName: issuerName || recipientName || '',
    issuerTradeName: '',
    issuerDocument,
    issuerDocumentType: issuerDocument.length === 14 ? 'CNPJ' : 'CPF',
    accessKey,
    invoiceNumber,
    series,
    issueDate,
    issueDateISO: issueDate?.toISOString(),
    totalAmount,
    items: [],
    purchaseDescription,
    recipientName,
    sourceFormat: 'pdf_text',
  };

  if (!parsed.totalAmount) {
    throw new Error('Não foi possível identificar o valor total no PDF.');
  }

  if (!parsed.issuerName && !parsed.recipientName) {
    throw new Error('Não foi possível identificar o emitente ou destinatário no PDF.');
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
