import { inferCategory } from './categoryDetection.js';

const EXPENSE_KEYWORDS = [
  'debito', 'débito', 'compra', 'pagamento', 'pix enviado', 'envio pix', 'enviado',
  'pix para', 'pix -', 'ted enviada', 'doc enviada', 'transferencia enviada',
  'transferência enviada', 'boleto', 'saque', 'tarifa', 'juros', 'iof', 'anuidade',
  'mensalidade', 'debito automatico', 'débito automático', 'compra cartao', 'compra cartão',
];

const INCOME_KEYWORDS = [
  'credito', 'crédito', 'pix recebido', 'recebimento pix', 'recebido', 'pix de',
  'salario', 'salário', 'estorno', 'rendimento', 'deposito', 'depósito',
  'ted recebida', 'doc recebida', 'transferencia recebida', 'transferência recebida',
  'resgate', 'credito em conta', 'crédito em conta',
];

const MONEY_PATTERN = /(?:R\$\s*)?[-+]?\s*\(?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*\)?/gi;

const DATE_PATTERN = /\b(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\b/;

export const normalizeDescription = (desc) =>
  String(desc || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 50);

export const normalizeMoney = (value) => {
  if (typeof value === 'number' && !Number.isNaN(value)) return Math.abs(value);
  let str = String(value || '').trim();
  if (!str) return 0;

  str = str
    .replace(/R\$\s*/gi, '')
    .replace(/[()]/g, '')
    .replace(/\s*[DC]\s*$/i, '')
    .trim();

  if (str.startsWith('-')) {
    str = str.slice(1).trim();
  }

  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }

  const num = parseFloat(str.replace(/[^\d.]/g, ''));
  if (Number.isNaN(num) || num <= 0) return 0;
  return Math.abs(num);
};

export const isNegativeMoney = (value) => {
  const str = String(value || '').trim();
  return str.startsWith('-') || /^\(/.test(str);
};

export const normalizeDate = (value, referenceYear = new Date().getFullYear()) => {
  const match = String(value || '').match(DATE_PATTERN);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  let year = match[3] ? parseInt(match[3], 10) : referenceYear;
  if (year < 100) year += 2000;

  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (Number.isNaN(date.getTime()) || date.getDate() !== day) return null;
  return date;
};

const normalizeLine = (line) =>
  String(line || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const detectTransactionType = (line, amountStr = '') => {
  const norm = normalizeLine(line);
  const raw = String(amountStr || line || '');

  if (isNegativeMoney(raw)) return 'expense';
  if (raw.includes('-') && /\d/.test(raw)) return 'expense';
  if (/\bC\b\s*$/i.test(raw)) return 'income';
  if (/\bD\b\s*$/i.test(raw)) return 'expense';

  if (/pix\s*(enviad|envio|para|transferencia\s*saida)/.test(norm)) return 'expense';
  if (/pix\s*(receb|credito|de\s)/.test(norm)) return 'income';
  if (/\bpix\b/.test(norm) && /receb/.test(norm)) return 'income';
  if (/\bpix\b/.test(norm)) return 'expense';

  if (/\b(ted|doc)\b/.test(norm) && /enviad|debito|saida/.test(norm)) return 'expense';
  if (/\b(ted|doc)\b/.test(norm) && /receb|credito/.test(norm)) return 'income';

  if (INCOME_KEYWORDS.some((kw) => norm.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
    return 'income';
  }
  if (EXPENSE_KEYWORDS.some((kw) => norm.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
    return 'expense';
  }

  return 'expense';
};

export const detectCategory = inferCategory;

const dateKey = (date) => {
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return String(date || '').slice(0, 10);
};

export const createTransactionHash = (transaction) => {
  const amount = Number(transaction.amount || 0).toFixed(2);
  const desc = normalizeDescription(transaction.description);
  return `${dateKey(transaction.date)}|${amount}|${desc}`;
};

export const descriptionsAreSimilar = (a, b) => {
  const na = normalizeDescription(a);
  const nb = normalizeDescription(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 5 && longer.includes(shorter)) return true;

  const maxLen = Math.max(na.length, nb.length);
  let prefixMatches = 0;
  const compareLen = Math.min(na.length, nb.length);
  for (let i = 0; i < compareLen; i += 1) {
    if (na[i] === nb[i]) prefixMatches += 1;
  }
  return maxLen > 0 && prefixMatches / maxLen >= 0.75;
};

export { markDuplicates, findDuplicateMatch } from './importDeduplication.js';

const extractMoneyMatches = (line) => {
  const matches = [];
  let m;
  const regex = new RegExp(MONEY_PATTERN.source, 'gi');
  while ((m = regex.exec(line)) !== null) {
    matches.push({ raw: m[0], index: m.index });
  }
  return matches;
};

const cleanDescription = (text) =>
  String(text || '')
    .replace(DATE_PATTERN, '')
    .replace(MONEY_PATTERN, '')
    .replace(/\s*[DC]\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

const parseLine = (line, options = {}) => {
  const trimmed = line.trim();
  if (trimmed.length < 8) return null;

  const dateMatch = trimmed.match(DATE_PATTERN);
  if (!dateMatch) return null;

  const moneyMatches = extractMoneyMatches(trimmed);
  if (moneyMatches.length === 0) return null;

  const lastMoney = moneyMatches[moneyMatches.length - 1];
  const amount = normalizeMoney(lastMoney.raw);
  if (amount <= 0) return null;

  const date = normalizeDate(dateMatch[0], options.referenceYear);
  if (!date) return null;

  const beforeMoney = trimmed.slice(0, lastMoney.index);
  const description = cleanDescription(beforeMoney);
  if (!description || description.length < 2) return null;

  const type = detectTransactionType(trimmed, lastMoney.raw);
  const category = detectCategory(description, type, options.customCategories);

  return {
    date,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    rawDescription: trimmed,
    amount,
    type,
    category,
  };
};

export const parseStatementText = (text, options = {}) => {
  if (!text || typeof text !== 'string') return [];

  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const results = [];
  const seen = new Set();

  for (const line of lines) {
    const skipHeader =
      /saldo\s+anterior|saldo\s+final|extrato|ag[eê]ncia|conta\s+corrente|per[ií]odo|lan[cç]amentos|data\s+descri[cç][aã]o/i.test(line);
    if (skipHeader && !DATE_PATTERN.test(line.slice(0, 12))) continue;

    const parsed = parseLine(line, options);
    if (!parsed) continue;

    const key = createTransactionHash(parsed);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(parsed);
  }

  return results.sort((a, b) => b.date - a.date);
};

export const parseMultipleStatementTexts = (filesText = [], options = {}) =>
  filesText.map(({ fileName, text }) => ({
    fileName: fileName || 'extrato.pdf',
    transactions: parseStatementText(text, options),
  }));
