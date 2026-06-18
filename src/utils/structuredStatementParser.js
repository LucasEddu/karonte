import {
  normalizeMoney,
  detectTransactionType,
  detectCategory,
} from './statementParser.js';

const DATE_HEADERS = [
  'data',
  'date',
  'dtposted',
  'dt',
  'dia',
  'data lancamento',
  'data lançamento',
  'data movimento',
];

const AMOUNT_HEADERS = [
  'valor',
  'amount',
  'trnamt',
  'value',
  'montante',
  'quantia',
  'vlr',
];

const DESC_HEADERS = [
  'descricao',
  'descrição',
  'description',
  'memo',
  'title',
  'titulo',
  'título',
  'historico',
  'histórico',
  'detalhe',
  'detalhes',
  'lancamento',
  'lançamento',
  'estabelecimento',
];

const TYPE_HEADERS = ['tipo', 'type', 'trntype', 'natureza'];

const CATEGORY_HEADERS = ['category', 'categoria', 'categoria nubank'];

const normalizeHeader = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\ufeff/, '')
    .trim();

const findColumnIndex = (headers, candidates) => {
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h === candidate || h.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
};

export const parseFlexibleDate = (value, referenceYear = new Date().getFullYear()) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const br = raw.match(/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?/);
  if (br) {
    let year = br[3] ? parseInt(br[3], 10) : referenceYear;
    if (year < 100) year += 2000;
    const date = new Date(year, parseInt(br[2], 10) - 1, parseInt(br[1], 10), 12, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const ofx = raw.replace(/\D/g, '').slice(0, 8);
  if (ofx.length === 8) {
    const year = parseInt(ofx.slice(0, 4), 10);
    const month = parseInt(ofx.slice(4, 6), 10);
    const day = parseInt(ofx.slice(6, 8), 10);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const inferTypeFromAmount = (amountStr, description, explicitType) => {
  const raw = String(amountStr || '').trim();
  const normType = String(explicitType || '').toLowerCase();

  if (/credit|credito|crédito|receita|income|deposit|depósito/.test(normType)) return 'income';
  if (/debit|debito|débito|despesa|expense|payment|pagamento/.test(normType)) return 'expense';

  if (raw.startsWith('-') || raw.startsWith('(')) return 'expense';
  if (raw.startsWith('+')) return 'income';

  const amount = normalizeMoney(raw);
  const parsed = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
  if (!Number.isNaN(parsed) && parsed < 0) return 'expense';

  return detectTransactionType(description, raw || String(amount));
};

const buildTransaction = (row, options = {}) => {
  const date = parseFlexibleDate(row.date, options.referenceYear);
  const amount = normalizeMoney(row.amount);
  if (!date || amount <= 0) return null;

  const description = String(row.description || '').trim();
  if (description.length < 2) return null;

  const type = inferTypeFromAmount(row.amount, description, row.type);
  const category =
    row.category && String(row.category).trim()
      ? detectCategory(String(row.category), type, options.customCategories)
      : detectCategory(description, type, options.customCategories);

  return {
    date,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    rawDescription: row.rawDescription || description,
    amount,
    type,
    category,
    externalId: row.externalId || null,
  };
};

export const parseCsvRows = (rows, options = {}) => {
  if (!rows?.length) return [];

  const headerRow = rows[0].map(normalizeHeader);
  const dateIdx = findColumnIndex(headerRow, DATE_HEADERS);
  const amountIdx = findColumnIndex(headerRow, AMOUNT_HEADERS);
  const descIdx = findColumnIndex(headerRow, DESC_HEADERS);
  const typeIdx = findColumnIndex(headerRow, TYPE_HEADERS);
  const categoryIdx = findColumnIndex(headerRow, CATEGORY_HEADERS);

  if (dateIdx < 0 || amountIdx < 0 || descIdx < 0) return [];

  const results = [];
  const seen = new Set();

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row?.length) continue;

    const tx = buildTransaction(
      {
        date: row[dateIdx],
        amount: row[amountIdx],
        description: row[descIdx],
        type: typeIdx >= 0 ? row[typeIdx] : '',
        category: categoryIdx >= 0 ? row[categoryIdx] : '',
        rawDescription: row.join(' | '),
        externalId: row[findColumnIndex(headerRow, ['identificador', 'identifier', 'fitid', 'id'])] || null,
      },
      options
    );

    if (!tx) continue;
    const key = `${tx.date.toISOString().slice(0, 10)}|${tx.amount}|${tx.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(tx);
  }

  return results.sort((a, b) => b.date - a.date);
};

export const splitCsvLine = (line, delimiter) => {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
};

export const detectCsvDelimiter = (text) => {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : ',';
};

export const parseCsvText = (text, options = {}) => {
  const normalized = String(text || '').replace(/^\ufeff/, '');
  if (!normalized.trim()) return [];

  const delimiter = detectCsvDelimiter(normalized);
  const rows = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => splitCsvLine(line, delimiter));

  return parseCsvRows(rows, options);
};

export const parseSpreadsheetRows = (rows, options = {}) => parseCsvRows(rows, options);

const extractOfxTag = (block, tag) => {
  const re = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
  const match = block.match(re);
  return match ? match[1].trim() : '';
};

export const parseOfxText = (text, options = {}) => {
  const content = String(text || '');
  if (!content.trim()) return [];

  const blocks =
    content.match(/<STMTTRN>[\s\S]*?(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi) ||
    content.match(/<STMTTRN[\s\S]*?(?=<STMTTRN>|$)/gi) ||
    [];

  const results = [];
  const seen = new Set();

  for (const block of blocks) {
    const dateRaw = extractOfxTag(block, 'DTPOSTED') || extractOfxTag(block, 'DTUSER');
    const amountRaw = extractOfxTag(block, 'TRNAMT');
    const description =
      extractOfxTag(block, 'MEMO') ||
      extractOfxTag(block, 'NAME') ||
      extractOfxTag(block, 'PAYEE') ||
      '';
    const typeRaw = extractOfxTag(block, 'TRNTYPE');
    const fitId = extractOfxTag(block, 'FITID');

    const tx = buildTransaction(
      {
        date: dateRaw,
        amount: amountRaw,
        description,
        type: typeRaw,
        rawDescription: block.replace(/\s+/g, ' ').slice(0, 200),
        externalId: fitId,
      },
      options
    );

    if (!tx) continue;
    const key = fitId || `${tx.date.toISOString().slice(0, 10)}|${tx.amount}|${tx.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(tx);
  }

  return results.sort((a, b) => b.date - a.date);
};
