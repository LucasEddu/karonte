import { DEFAULT_EXPENSE_CATS, DEFAULT_INCOME_CATS } from '../constants/categories.js';
import { mergeCategoryNames } from './categoryModel.js';
import { normalizeCategoryName } from '../services/categoriesService.js';

export const CATEGORY_RULES = [
  {
    cats: ['Alimentação'],
    patterns:
      /mercado|supermercado|atacad[aã]o|assai|assa[ií]|s[aã]o\s*luiz|carrefour|p[aã]o\s*de\s*a[cç][uú]car|extra\s|hortifruti|padaria|ifood|rappi|restaurante|lanchonete|pizzaria|pizza|burger|lanche|comida|acougue|feira|caf[eé]|almo[cç]o|jantar|doce|bar\s/i,
  },
  {
    cats: ['Transporte'],
    patterns:
      /transporte|uber|99\s|99pay|gasolina|combust[ií]vel|posto|estacionamento|ped[aá]gio|onibus|[ôo]nibus|metro|metr[ôo]|trem|ipva|detran|oficina|carro|moto/i,
  },
  {
    cats: ['Saúde'],
    patterns:
      /farm[aá]cia|drogaria|cl[ií]nica|consulta|hospital|laborat[oó]rio|dentista|plano\s*de\s*sa[uú]de|medico|remedio|exame|saude|psicologo|terapia|plano/i,
  },
  {
    cats: ['Lazer'],
    patterns:
      /academia|cinema|bar|lazer|balada|jogo|game|festa|viagem|netflix|streaming|spotify|show|teatro|shopping|passeio|steam|playstation|xbox|ingresso|disney/i,
  },
  {
    cats: ['Moradia'],
    patterns:
      /aluguel|reforma|condominio|condom[ií]nio|luz\s|agua|[áa]gua|conta|energia|eletric|internet|gas|iptu|moveis|casa|apartamento|alug/i,
  },
  { cats: ['Salário'], patterns: /sal[aá]rio|folha\s*de\s*pagamento|pro[\s-]?labore|pagamento/i, type: 'income' },
  {
    cats: ['Investimentos'],
    patterns: /investimento|dividendo|dividendos|juros|rendimento|aplica[cç][aã]o|cdb|lci|lca/i,
    type: 'income',
  },
  { cats: ['Freelance'], patterns: /freelance|freela|honor[aá]rio|projeto|job/i, type: 'income' },
];

const normalizeForMatch = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const findCustomCategoryInText = (text, items = []) => {
  const normalized = normalizeForMatch(text);
  for (const item of items) {
    const name = normalizeCategoryName(item);
    if (!name) continue;
    const normName = normalizeForMatch(name);
    if (normName && normalized.includes(normName)) return name;
  }
  return null;
};

const matchCategoryByRules = (text, type) => {
  const desc = String(text || '');
  const normalized = normalizeForMatch(desc);

  for (const rule of CATEGORY_RULES) {
    if (rule.type && rule.type !== type) continue;
    if (rule.patterns.test(desc) || rule.patterns.test(normalized)) {
      return rule.cats[0];
    }
  }
  return null;
};

/** Inferência compartilhada entre chat e importação de extrato. */
export const inferCategory = (text, type, customCategories = {}) => {
  const expenseNames = mergeCategoryNames(DEFAULT_EXPENSE_CATS, customCategories.expense || []);
  const incomeNames = mergeCategoryNames(DEFAULT_INCOME_CATS, customCategories.income || []);
  const allowedNames = type === 'income' ? incomeNames : expenseNames;
  const customList = type === 'income' ? customCategories.income : customCategories.expense;

  const customMatch = findCustomCategoryInText(text, customList || []);
  if (customMatch && allowedNames.includes(customMatch)) return customMatch;

  const ruleMatch = matchCategoryByRules(text, type);
  if (ruleMatch && allowedNames.includes(ruleMatch)) return ruleMatch;

  return 'Outros';
};
