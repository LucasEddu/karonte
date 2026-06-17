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

## Causa raiz conhecida: `?` na UI

Se aparecerem `?` no lugar de acentos (Or?amentos) ou ícones (◈, ⚙, 🔔), o arquivo `src/App.jsx` foi salvo com **encoding incorreto** (UTF-8 corrompido).

**Correção:** restaurar de `docs/reimplementacao/backup/App.jsx` (UTF-8 válido) e reaplicar patches de import PDF.

**Prevenção:** salvar arquivos sempre em UTF-8 no editor; `index.html` já declara `<meta charset="UTF-8" />`.


`backup/refatoracao-local` — snapshot do trabalho anterior ao reset.

Consultar: `git show backup/refatoracao-local:<caminho>`

## Documentação desta pasta

| Arquivo | Conteúdo |
|---------|----------|
| [01-FASES.md](./01-FASES.md) | Roadmap por fase |
| [07-STATUS.md](./07-STATUS.md) | Status atual e métricas |
| [08-FASE-3.md](./08-FASE-3.md) | Próximas entregas |
| [02–06](./02-ARQUIVOS.md) | Manifesto, touchpoints, RBAC, categorias, testes |
