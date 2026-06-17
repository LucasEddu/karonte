import { describe, it, expect } from 'vitest';
import {
  calculateFamilySummary,
  calculateMemberSpending,
  calculateFamilyCategoryBreakdown,
  calculateFamilyBudgetUsage,
  buildFamilyInsights,
  getProjectMembers,
} from '../familyModeCalculations.js';

describe('familyModeCalculations', () => {
  const project = {
    userId: 'owner1',
    collaborators: ['mem2'],
    collaboratorNames: { owner1: 'Lucas', mem2: 'Ana' },
    collaboratorRoles: { mem2: 'add' },
  };

  const txs = [
    { type: 'income', amount: 5000, date: '2026-03-01', createdByUid: 'owner1' },
    { type: 'expense', amount: 800, date: '2026-03-05', categoryName: 'Alimentação', createdByUid: 'owner1' },
    { type: 'expense', amount: 200, date: '2026-03-06', categoryName: 'Transporte', createdByUid: 'mem2' },
  ];

  it('lista membros do projeto', () => {
    const members = getProjectMembers(project, { uid: 'owner1', username: 'Lucas' });
    expect(members).toHaveLength(2);
    expect(members[0].name).toBe('Lucas');
  });

  it('calcula resumo familiar', () => {
    const summary = calculateFamilySummary(txs);
    expect(summary.totalIncome).toBe(5000);
    expect(summary.totalExpense).toBe(1000);
    expect(summary.balance).toBe(4000);
  });

  it('calcula gastos por membro', () => {
    const members = getProjectMembers(project, { uid: 'owner1' });
    const { byMember } = calculateMemberSpending(txs, members);
    const owner = byMember.find((m) => m.uid === 'owner1');
    expect(owner.spent).toBe(800);
    expect(owner.sharePct).toBe(80);
  });

  it('calcula breakdown por categoria', () => {
    const breakdown = calculateFamilyCategoryBreakdown(txs);
    expect(breakdown[0].name).toBe('Alimentação');
    expect(breakdown[0].pct).toBe(80);
  });

  it('calcula uso do orçamento', () => {
    const budgets = { limitsByName: { Alimentação: 1000 }, limits: {}, schemaVersion: 2 };
    const usage = calculateFamilyBudgetUsage(txs, budgets, ['Alimentação', 'Transporte']);
    const food = usage.find((u) => u.category === 'Alimentação');
    expect(food.usagePct).toBe(80);
    expect(food.status).toBe('warning');
  });

  it('gera insights familiares', () => {
    const summary = calculateFamilySummary(txs);
    const breakdown = calculateFamilyCategoryBreakdown(txs);
    const insights = buildFamilyInsights({ summary, categoryBreakdown: breakdown, budgetUsage: [] });
    expect(insights.some((i) => i.includes('Alimentação'))).toBe(true);
  });
});
