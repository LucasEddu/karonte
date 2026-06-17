# Status da reimplementação

**Atualizado:** 2026-06-17  
**Branch:** `master`  
**Commit de referência:** `647dbbf` — `refactor: reaplicar melhorias locais sobre base com importacao PDF`

## Fases 0–12 — Concluídas

| Fase | Item | Status |
|------|------|--------|
| 0 | Vitest + scripts `npm run test` | ✅ |
| 1 | `constants/categories.js`, `utils/money.js` | ✅ |
| 2 | `utils/categoryModel.js` | ✅ |
| 3 | `financeCalculations.js`, `taskCalculations.js`, testes | ✅ |
| 4 | `recurrenceService.js` + effect no App | ✅ |
| 5 | `usePermissions`, `useFinanceDerived` | ✅ |
| 6 | `categoriesService.js` v2 + migração | ✅ |
| 7 | `firestore.rules` RBAC granular | ✅ |
| 8 | `ErrorBoundary` + `AppWrapper` | ✅ |
| 9 | Views em `src/views/` (7 arquivos) | ✅ |
| 10 | Integração `App.jsx` refatorado | ✅ |
| 11 | Import PDF + `buildTransactionCategoryFields` | ✅ |
| 12 | `DOCUMENTACAO.md`, `README.md` | ✅ |

## Validação

```bash
npm run test    # 12 testes
npm run build   # PWA + pdfjs chunk separado
```

## Métricas atuais

| Métrica | Valor |
|---------|-------|
| Linhas `App.jsx` | ~2700 (meta Fase 3: &lt;1500) |
| Views extraídas | 7 |
| Hooks | 2 (`usePermissions`, `useFinanceDerived`) |
| Testes Vitest | 12 |
| Import PDF | Preservado do GitHub + `categoryId` |

## O que ainda vive no `App.jsx`

- Shell (sidebar, mobile nav, top-bar, notificações)
- Chatbot FAB + parser + voz
- Modais: projeto, tarefa, pagamento, orçamento
- Handlers de auth, projetos, convites, categorias
- `HubView` ainda importado de `components/` (não `views/`)

## Próximo passo

Ver [08-FASE-3.md](./08-FASE-3.md).
