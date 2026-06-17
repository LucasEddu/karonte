export const BUDGET_SCHEMA_VERSION = 2;

const RESERVED_KEYS = new Set(['ownerId', 'projectId', 'schemaVersion', 'limits', 'limitsByName']);

export const EMPTY_BUDGETS = {
  schemaVersion: BUDGET_SCHEMA_VERSION,
  limits: {},
  limitsByName: {},
};

export const normalizeBudgets = (raw = {}) => {
  const limits = { ...(raw.limits || {}) };
  const limitsByName = { ...(raw.limitsByName || {}) };

  Object.entries(raw).forEach(([key, val]) => {
    if (RESERVED_KEYS.has(key)) return;
    if (typeof val === 'number' && !Number.isNaN(val)) {
      limitsByName[key] = val;
    }
  });

  return {
    schemaVersion: BUDGET_SCHEMA_VERSION,
    limits,
    limitsByName,
  };
};

export const needsBudgetMigration = (raw = {}) =>
  !raw.schemaVersion || raw.schemaVersion < BUDGET_SCHEMA_VERSION || Object.keys(raw).some(
    (key) => !RESERVED_KEYS.has(key) && typeof raw[key] === 'number'
  );

export const getBudgetLimitByName = (budgets, categoryName) => {
  const normalized = normalizeBudgets(budgets);
  return Number(normalized.limitsByName[categoryName]) || 0;
};

export const getBudgetLimitByCategory = (budgets, categoryId, categoryName) => {
  const normalized = normalizeBudgets(budgets);
  if (categoryId && normalized.limits[categoryId] != null) {
    return Number(normalized.limits[categoryId]) || 0;
  }
  return getBudgetLimitByName(normalized, categoryName);
};

export const setBudgetLimit = (budgets, categoryName, categoryId, value) => {
  const normalized = normalizeBudgets(budgets);
  const num = Number(value) || 0;
  const next = {
    schemaVersion: BUDGET_SCHEMA_VERSION,
    limits: { ...normalized.limits },
    limitsByName: { ...normalized.limitsByName },
  };

  if (num <= 0) {
    delete next.limitsByName[categoryName];
    if (categoryId) delete next.limits[categoryId];
  } else {
    next.limitsByName[categoryName] = num;
    if (categoryId) next.limits[categoryId] = num;
  }

  return next;
};

export const serializeBudgetsForSave = (budgets) => {
  const normalized = normalizeBudgets(budgets);
  return {
    schemaVersion: BUDGET_SCHEMA_VERSION,
    limits: normalized.limits,
    limitsByName: normalized.limitsByName,
  };
};
