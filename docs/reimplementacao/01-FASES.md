# Fases de reimplementação

## Fases 0–12 — Concluídas ✅

| Fase | Conteúdo | Status |
|------|----------|--------|
| 0 | Vitest (`vitest.config.js`, scripts npm) | ✅ |
| 1 | `constants/categories.js`, `utils/money.js` | ✅ |
| 2 | `utils/categoryModel.js` | ✅ |
| 3 | `financeCalculations.js`, `taskCalculations.js`, testes | ✅ |
| 4 | `recurrenceService.js` + effect no App | ✅ |
| 5 | `usePermissions`, `useFinanceDerived` | ✅ |
| 6 | `categoriesService.js` v2 | ✅ |
| 7 | `firestore.rules` RBAC | ✅ |
| 8 | `ErrorBoundary` + AppWrapper | ✅ |
| 9 | Views extraídas (7 arquivos) | ✅ |
| 10 | Integração `App.jsx` | ✅ |
| 11 | Compat PDF import (`buildTransactionCategoryFields`) | ✅ |
| 12 | `DOCUMENTACAO.md`, `README.md` | ✅ |

Validação: `npm run test` && `npm run build`

Detalhes: [07-STATUS.md](./07-STATUS.md)

## Fase 3 — Concluída (3.1–3.5) ✅

Ver [08-FASE-3.md](./08-FASE-3.md).

| Subfase | Conteúdo | Status |
|---------|----------|--------|
| 3.1 | Limpeza modais mortos | ✅ |
| 3.2 | `chatParser`, `useChatAssistant`, `ChatAssistant` | ✅ |
| 3.3 | `MainShell` + dropdowns | ✅ |
| 3.4 | Orçamentos com `categoryId` (`budgetModel` v2) | ✅ |
| 3.5 | Modais → `components/modals/` | ✅ |
| 3.6 | Infra (iOS, Sentry, `dueDate`, export PDF, etc.) | ⏳ futuro |
