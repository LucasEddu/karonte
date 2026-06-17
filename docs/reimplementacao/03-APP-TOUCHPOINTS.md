# Touchpoints no App.jsx

## Imports

- `Suspense`, `lazy` do React
- `StatementImportView` (lazy)
- `ErrorBoundary`, views, hooks, utils, `recurrenceService`

## Categorias

- `mergeCategoryNames` + `getClassificationsByName`
- `buildTransactionCategoryFields` em lançamentos e import PDF

## Hooks

- `usePermissions` — papéis de projeto
- `useFinanceDerived` — KPIs e gráficos
- `activeProject` useMemo — para StatementImportView

## Recorrências

`useEffect` → `persistMissingRecurrences` após carregar transações

## Import PDF

- Nav desktop/mobile: `currentView === 'import'`
- `handleStatementImport` com `buildTransactionCategoryFields`
- `<Suspense><StatementImportView /></Suspense>`

## Export

`AppWrapper` envolve `<App />` com `<ErrorBoundary>`
