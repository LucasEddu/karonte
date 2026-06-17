# Status da reimplementação

**Atualizado:** 2026-06-17  
**Branch:** `master`  
**Fase 3:** 3.2, 3.3, 3.4, 3.5 concluídas (chat, shell, orçamentos v2, modais)

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
npm run test    # 21 testes
npm run build   # PWA + pdfjs chunk separado
```

## Métricas atuais

| Métrica | Valor |
|---------|-------|
| Linhas `App.jsx` | ~1380 (meta Fase 3: &lt;1500) ✅ |
| Views extraídas | 8 (+ `MainShell`) |
| Hooks | 3 (`usePermissions`, `useFinanceDerived`, `useChatAssistant`) |
| Testes Vitest | 21 |
| Import PDF | Preservado do GitHub + `categoryId` |

## O que ainda vive no `App.jsx`

- Auth (`onAuthStateChanged`), loading e roteamento de views
- Fetch de dados (transações, orçamentos, categorias, cartões, tarefas)
- Handlers de negócio (CRUD, convites, categorias, export CSV)
- Composição: `MainShell` + views + modais + `ChatAssistant` + `TransactionDrawer`
- `HubView` ainda em `components/` (não `views/`)

## Próximo passo

Fase **3.6** (infra opcional): ver [08-FASE-3.md](./08-FASE-3.md).
