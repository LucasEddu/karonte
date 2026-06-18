import { useMemo } from 'react';
import {
  filterTransactionsByPeriod,
  computePeriodTotals,
  computeCategoryStats,
  computeMonthlyEvolution,
  computeTotalBudgetLimit,
  computeBudgetStats,
  computeRuleStats,
  computeForecast,
} from '../utils/financeCalculations';
import { filterTransactionsInMemory } from '../utils/dataCache.js';

export function useFinanceDerived({
  transactions,
  budgets,
  selectedMonth,
  selectedYear,
  expenseCategories,
  classifications,
  customCategories,
}) {
  const filteredTransactions = useMemo(
    () => filterTransactionsByPeriod(transactions, selectedMonth, selectedYear),
    [transactions, selectedMonth, selectedYear]
  );

  const { totalIncome, totalExpense, balance } = useMemo(
    () => computePeriodTotals(filteredTransactions),
    [filteredTransactions]
  );

  const categoryStats = useMemo(
    () => computeCategoryStats(filteredTransactions, expenseCategories),
    [filteredTransactions, expenseCategories]
  );

  const monthlyEvolutionData = useMemo(() => {
    const end = new Date(selectedYear, selectedMonth - 1, 1);
    const start = new Date(selectedYear, selectedMonth - 6, 1);
    const windowTxs = filterTransactionsInMemory(transactions, {
      startDate: start,
      endDate: end,
    });
    return computeMonthlyEvolution(windowTxs, end);
  }, [transactions, selectedMonth, selectedYear]);

  const totalBudgetLimit = useMemo(() => computeTotalBudgetLimit(budgets), [budgets]);

  const budgetStats = useMemo(
    () => computeBudgetStats(filteredTransactions, budgets, expenseCategories, customCategories),
    [filteredTransactions, budgets, expenseCategories, customCategories]
  );

  const ruleStats = useMemo(
    () => computeRuleStats(filteredTransactions, balance, classifications),
    [filteredTransactions, balance, classifications]
  );

  const calculateForecast = () => {
    const end = new Date(selectedYear, selectedMonth - 1, 1);
    const start = new Date(selectedYear, selectedMonth - 3, 1);
    const windowTxs = filterTransactionsInMemory(transactions, {
      startDate: start,
      endDate: end,
    });
    return computeForecast(windowTxs, end);
  };

  return {
    filteredTransactions,
    totalIncome,
    totalExpense,
    balance,
    categoryStats,
    monthlyEvolutionData,
    totalBudgetLimit,
    budgetStats,
    ruleStats,
    calculateForecast,
  };
}
