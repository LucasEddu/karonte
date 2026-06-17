export const CATEGORY_SCHEMA_VERSION = 2;

const slugify = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const createCategoryItem = (name, type = 'expense', stableId = null) => ({
  id: stableId || `${type}-${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`,
  name,
});

const isCategoryObject = (item) => item && typeof item === 'object' && item.id && item.name;

export const normalizeCategories = (raw = {}) => {
  const expenseRaw = raw.expense || [];
  const incomeRaw = raw.income || [];
  const legacyClassifications = raw.classifications || {};
  const classificationsById = raw.classificationsById || {};

  const migrateList = (list, type) => {
    if (!list.length) return [];
    if (isCategoryObject(list[0])) return list;
    return list.map((name) => createCategoryItem(name, type, `${type}-${slugify(name)}`));
  };

  const expense = migrateList(expenseRaw, 'expense');
  const income = migrateList(incomeRaw, 'income');

  const nameToId = {};
  [...expense, ...income].forEach((item) => {
    nameToId[item.name] = item.id;
  });

  const mergedClassificationsById = { ...classificationsById };
  Object.entries(legacyClassifications).forEach(([name, cls]) => {
    if (nameToId[name] && !mergedClassificationsById[nameToId[name]]) {
      mergedClassificationsById[nameToId[name]] = cls;
    }
  });

  return {
    schemaVersion: CATEGORY_SCHEMA_VERSION,
    expense,
    income,
    classificationsById: mergedClassificationsById,
    classifications: legacyClassifications,
  };
};

export const mergeCategoryNames = (defaults, customItems = []) => {
  const customNames = customItems.map((item) => (typeof item === 'string' ? item : item.name));
  return [...new Set([...defaults, ...customNames])];
};

export const getClassificationsByName = (categories) => {
  const byName = { ...(categories.classifications || {}) };
  const byId = categories.classificationsById || {};
  [...(categories.expense || []), ...(categories.income || [])].forEach((item) => {
    if (isCategoryObject(item) && byId[item.id]) {
      byName[item.name] = byId[item.id];
    }
  });
  return byName;
};

export const serializeCategoriesForSave = (categories) => ({
  schemaVersion: CATEGORY_SCHEMA_VERSION,
  expense: categories.expense,
  income: categories.income,
  classificationsById: categories.classificationsById || {},
  classifications: getClassificationsByName(categories),
});

export const resolveCategoryForTransaction = (categoryName, type, customCategories = {}) => {
  const name = (categoryName || 'Outros').trim();
  const list = type === 'income' ? customCategories.income || [] : customCategories.expense || [];
  const found = list.find((item) => (typeof item === 'string' ? item : item.name) === name);
  if (found && typeof found === 'object') {
    return { categoryId: found.id, categoryName: found.name };
  }
  return {
    categoryId: `${type}-${slugify(name)}`,
    categoryName: name,
  };
};

export const buildTransactionCategoryFields = (categoryName, type, customCategories = {}) => {
  const resolved = resolveCategoryForTransaction(categoryName, type, customCategories);
  return {
    categoryId: resolved.categoryId,
    categoryName: resolved.categoryName,
    category: resolved.categoryName,
  };
};
