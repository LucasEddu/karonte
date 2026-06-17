# Fases de reimplementação

| Fase | Conteúdo |
|------|----------|
| 0 | Vitest (`vitest.config.js`, scripts npm) |
| 1 | `constants/categories.js`, `utils/money.js` |
| 2 | `utils/categoryModel.js` |
| 3 | `financeCalculations.js`, `taskCalculations.js`, testes |
| 4 | `recurrenceService.js` + effect no App |
| 5 | `usePermissions`, `useFinanceDerived` |
| 6 | `categoriesService.js` v2 |
| 7 | `firestore.rules` RBAC |
| 8 | `ErrorBoundary` + AppWrapper |
| 9 | Views extraídas (7 arquivos) |
| 10 | Integração `App.jsx` |
| 11 | Compat PDF import (`buildTransactionCategoryFields`) |
| 12 | `DOCUMENTACAO.md`, `README.md` |

Validação: `npm run test` && `npm run build`
