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

  const monthlyEvolutionData = useMemo(
    () => computeMonthlyEvolution(transactions),
    [transactions]
  );

  const totalBudgetLimit = useMemo(() => computeTotalBudgetLimit(budgets), [budgets]);

  const budgetStats = useMemo(
    () => computeBudgetStats(filteredTransactions, budgets, expenseCategories, customCategories),
    [filteredTransactions, budgets, expenseCategories, customCategories]
  );

  const ruleStats = useMemo(
    () => computeRuleStats(filteredTransactions, balance, classifications),
    [filteredTransactions, balance, classifications]
  );

  const calculateForecast = () => computeForecast(transactions);

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
