# Categorias v2 + compatibilidade GitHub

## GitHub (runtime)

- `normalizeCategoryName`, `categoriesMatch` em `categoriesService.js`

## Local (persistência)

- Schema v2: `{ id, name }[]`, `classificationsById`
- Transações: `categoryId`, `categoryName`, `category`

## Unificação implementada

1. `categoryModel.normalizeCategories` migra strings e objetos legados
2. `categoriesService` exporta helpers de compat + migração Firestore
3. `getTransactionCategoryLabel(t)` em `financeCalculations.js`
4. PDF import usa `buildTransactionCategoryFields` em `handleStatementImport`
