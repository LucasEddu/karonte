# Manifesto de arquivos

## Novos (reimplementação)

```
vitest.config.js
src/constants/categories.js
src/utils/money.js
src/utils/categoryModel.js
src/utils/financeCalculations.js
src/utils/taskCalculations.js
src/utils/__tests__/financeCalculations.test.js
src/services/recurrenceService.js
src/hooks/usePermissions.js
src/hooks/useFinanceDerived.js
src/components/ErrorBoundary.jsx
src/views/*.jsx (7 arquivos)
DOCUMENTACAO.md
docs/reimplementacao/*
```

## Modificados

```
package.json (+ vitest, pdfjs-dist)
firestore.rules (RBAC granular)
src/services/categoriesService.js (schema v2 + compat)
src/App.jsx (refatoração + import PDF)
README.md
```

## Preservados do GitHub

```
src/components/StatementImportView.jsx
src/services/statementImportService.js
src/utils/statementParser.js
PWA (vite.config.js, scripts, ícones)
```
