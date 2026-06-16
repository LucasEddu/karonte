const DEFAULT_EXPENSE_CATS = ['Moradia', 'Alimentação', 'Lazer', 'Transporte', 'Saúde', 'Outros'];
const DEFAULT_INCOME_CATS = ['Salário', 'Investimentos', 'Freelance', 'Outros'];

const EXPENSE_KEYWORDS = [
  'debito', 'débito', 'compra', 'pagamento', 'pix enviado', 'envio pix', 'enviado',
  'boleto', 'saque', 'transferencia enviada', 'transferência enviada', 'ted enviada',
  'doc enviada', 'tarifa', 'juros', 'iof', 'anuidade', 'mensalidade',
];

const INCOME_KEYWORDS = [
  'credito', 'crédito', 'pix recebido', 'recebimento pix', 'recebido', 'salario', 'salário',
  'estorno', 'rendimento', 'deposito', 'depósito', 'ted recebida', 'doc recebida',
  'transferencia recebida', 'transferência recebida', 'resgate',
];

const CATEGORY_RULES = [
  { cats: ['Alimentação'], patterns: /mercado|supermercado|atacad[aã]o|assai|assa[ií]|s[aã]o\s*luiz|carrefour|p[aã]o\s*de\s*a[cç][uú]car|extra\s|hortifruti|padaria/i },
  { cats: ['Transporte'], patterns: /uber|99\s|99pay|combust[ií]vel|gasolina|posto|estacionamento|ped[aá]gio|onibus|[ôo]nibus|metro|metr[ôo]|ipva|detran/i },
  { cats: ['Saúde'], patterns: /farm[aá]cia|drogaria|cl[ií]nica|consulta|hospital|laborat[oó]rio|dentista|plano\s*de\s*sa[uú]de/i },
  { cats: ['Lazer'], patterns: /netflix|spotify|cinema|show|teatro|steam|playstation|xbox|ingresso|lazer|disney/i },
  { cats: ['Alimentação'], patterns: /ifood|rappi|restaurante|lanchonete|pizzaria|burger|caf[eé]|bar\s/i },
  { cats: ['Moradia'], patterns: /aluguel|energia|eletric|luz\s|agua|[áa]gua|internet|condom[ií]nio|iptu|alug/i },
  { cats: ['Salário'], patterns: /sal[aá]rio|folha\s*de\s*pagamento|pro[\s-]?labore/i, type: 'income' },
  { cats: ['Investimentos'], patterns: /rendimento|dividendo|juros\s*sobre|aplica[cç][aã]o|cdb|lci|lca/i, type: 'income' },
  { cats: ['Freelance'], patterns: /freelance|freela|honor[aá]rio/i, type: 'income' },
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

  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }

  const num = parseFloat(str.replace(/[^\d.]/g, ''));
  if (Number.isNaN(num) || num <= 0) return 0;
  return Math.abs(num);
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

export const detectTransactionType = (line, amountStr = '') => {
  const norm = String(line || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const raw = String(amountStr || line || '');
  if (raw.includes('-') || raw.includes('(')) return 'expense';
  if (/\bC\b\s*$/i.test(raw)) return 'income';
  if (/\bD\b\s*$/i.test(raw)) return 'expense';

  if (INCOME_KEYWORDS.some((kw) => norm.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
    return 'income';
  }
  if (EXPENSE_KEYWORDS.some((kw) => norm.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
    return 'expense';
  }

  return 'expense';
};

export const detectCategory = (description, type, customCategories = {}) => {
  const expenseList = [
    ...DEFAULT_EXPENSE_CATS,
    ...(customCategories.expense || []),
  ];
  const incomeList = [
    ...DEFAULT_INCOME_CATS,
    ...(customCategories.income || []),
  ];

  const desc = String(description || '');

  for (const rule of CATEGORY_RULES) {
    if (rule.type && rule.type !== type) continue;
    if (rule.patterns.test(desc)) {
      const cat = rule.cats[0];
      if (type === 'income' && incomeList.includes(cat)) return cat;
      if (type === 'expense' && expenseList.includes(cat)) return cat;
      if (type === 'income') return incomeList.includes(cat) ? cat : 'Outros';
      return expenseList.includes(cat) ? cat : 'Outros';
    }
  }

  return type === 'income' ? 'Outros' : 'Outros';
};

export const createTransactionHash = (transaction) => {
  const dateKey =
    transaction.date instanceof Date
      ? transaction.date.toISOString().slice(0, 10)
      : String(transaction.date || '').slice(0, 10);
  const amount = Number(transaction.amount || 0).toFixed(2);
  const desc = normalizeDescription(transaction.description);
  return `${dateKey}|${amount}|${desc}`;
};

export const markDuplicates = (parsedTransactions, existingTransactions = []) => {
  const existingHashes = new Set(
    existingTransactions.map((t) =>
      createTransactionHash({
        date: t.date,
        amount: t.amount,
        description: t.description,
      })
    )
  );

  const seenInBatch = new Set();

  return parsedTransactions.map((tx) => {
    const hash = createTransactionHash(tx);
    const isDuplicate = existingHashes.has(hash) || seenInBatch.has(hash);
    seenInBatch.add(hash);
    return { ...tx, duplicateHash: hash, isDuplicate, selected: !isDuplicate };
  });
};

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
