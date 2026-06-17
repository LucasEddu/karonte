# Testes

```bash
npm run test        # execução única
npm run test:watch  # modo watch
npm run build       # build de produção
```

Cobertura em `src/utils/__tests__/financeCalculations.test.js`:

- `buildTransactionCategoryFields`
- `formatMoney`, `parseMoneyInput`
- `computePeriodTotals`, `computeCategoryStats`, `computeBudgetStats`
- `getCategoryBudgetInfo`, `computeRuleStats`, `computeForecast`
- `getCardInvoiceStats`, recorrências, parcelas de tarefas
