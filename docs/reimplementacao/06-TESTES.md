# Testes

```bash
npm run test        # execução única (43 testes)
npm run test:watch  # modo watch
npm run build       # build de produção
```

## Arquivos de teste

| Arquivo | Foco |
|---------|------|
| `financeCalculations.test.js` | Totais, orçamentos, 50-30-20, previsão, cartões, recorrências, parcelas |
| `categoryDetection.test.js` | Inferência de categoria (chat/PDF) |
| `budgetModel.test.js` | Schema v2, migração de limites legados |
| `statementImport.smoke.test.js` | PDF real (pdfjs), validação, múltiplos arquivos, duplicatas |

## `financeCalculations.test.js` (principais casos)

- `buildTransactionCategoryFields`
- `formatMoney`, `parseMoneyInput`
- `computePeriodTotals`, `computeCategoryStats`, `computeBudgetStats`
- `getCategoryBudgetInfo`, `computeRuleStats`, `computeForecast`
- `getCardInvoiceStats`, recorrências, parcelas de tarefas
