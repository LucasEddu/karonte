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
src/views/*.jsx (8 arquivos + MainShell)
DOCUMENTACAO.md
docs/reimplementacao/*
```

## Fase 3 (adicional)

```
src/utils/chatParser.js
src/utils/categoryDetection.js
src/utils/budgetModel.js
src/hooks/useChatAssistant.js
src/views/MainShell.jsx
src/components/ChatAssistant.jsx
src/components/ProjectSelectorDropdown.jsx
src/components/NotificationsDropdown.jsx
src/components/modals/*.jsx
src/utils/__tests__/categoryDetection.test.js
src/utils/__tests__/budgetModel.test.js
src/utils/__tests__/chatParser.test.js
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
