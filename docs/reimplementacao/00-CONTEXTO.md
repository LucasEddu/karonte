# Contexto — Reimplementação pós-sync GitHub

## Base remota (GitHub `master`)

Commit alvo: `origin/master` (inclui PWA + importação PDF).

Inclui (não reaplicar do zero):

- PWA (`vite-plugin-pwa`, ícones, service worker)
- **Importação de extrato PDF** (`StatementImportView`, `statementImportService`, `statementParser`, `pdfjs-dist`)
- Normalização runtime de categorias legadas (`normalizeCategoryName`, `categoriesMatch`)

## Trabalho local reaplicado nesta branch

| Área | Descrição |
|------|-----------|
| Schema categorias v2 | `{ id, name }`, migração Firestore, `categoryId` em transações |
| Recorrências | Clones automáticos de meses faltantes |
| Refatoração | Views, hooks, utils extraídos do `App.jsx` |
| RBAC Firestore | Permissões granulares por papel no projeto |
| Testes | Vitest + `financeCalculations.test.js` |
| Resiliência | `ErrorBoundary` |
| Docs | `DOCUMENTACAO.md` |

## Branch de backup

`backup/refatoracao-local` — snapshot do trabalho anterior ao reset.

Consultar: `git show backup/refatoracao-local:<caminho>`
