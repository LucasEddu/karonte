import { useMemo } from 'react';
import {
  buildFamilyInsights,
  calculateFamilyBudgetUsage,
  calculateFamilyCategoryBreakdown,
  calculateFamilySummary,
  calculateMemberSpending,
  getPreviousPeriodTransactions,
  getProjectMembers,
} from '../utils/familyModeCalculations.js';
import { getProjectTypeLabel } from '../constants/projectTypes.js';

export default function FamilyModeView({
  activeProject,
  currentUser,
  filteredTransactions = [],
  transactions = [],
  budgets = {},
  expenseCategories = [],
  tasks = [],
  formatMoney,
  selectedMonth,
  selectedYear,
  onOpenTasks,
}) {
  const members = useMemo(
    () => getProjectMembers(activeProject, currentUser),
    [activeProject, currentUser]
  );

  const summary = useMemo(
    () => calculateFamilySummary(filteredTransactions),
    [filteredTransactions]
  );

  const prevTransactions = useMemo(
    () => getPreviousPeriodTransactions(transactions, selectedMonth, selectedYear),
    [transactions, selectedMonth, selectedYear]
  );

  const prevSummary = useMemo(
    () => calculateFamilySummary(prevTransactions),
    [prevTransactions]
  );

  const categoryBreakdown = useMemo(
    () => calculateFamilyCategoryBreakdown(filteredTransactions),
    [filteredTransactions]
  );

  const memberSpending = useMemo(
    () => calculateMemberSpending(filteredTransactions, members),
    [filteredTransactions, members]
  );

  const budgetUsage = useMemo(
    () => calculateFamilyBudgetUsage(filteredTransactions, budgets, expenseCategories),
    [filteredTransactions, budgets, expenseCategories]
  );

  const insights = useMemo(
    () =>
      buildFamilyInsights({
        summary,
        categoryBreakdown,
        budgetUsage,
        prevSummary,
      }),
    [summary, categoryBreakdown, budgetUsage, prevSummary]
  );

  const familyGoals = useMemo(
    () =>
      tasks.filter(
        (t) => !t.completed && (t.type === 'despesa' || Number(t.metaValue) > 0)
      ),
    [tasks]
  );

  const topCategory = categoryBreakdown[0];
  const familyConfig = activeProject?.familyConfig || {};

  if (!activeProject || activeProject.projectType !== 'family') {
    return (
      <main className="main-content family-view">
        <div className="card">
          <h2>Modo Família</h2>
          <p>Selecione um projeto do tipo Família para ver o painel familiar.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content family-view">
      <div className="card family-header">
        <div>
          <h2>Modo Família</h2>
          <p className="family-subtitle">
            {activeProject.name} • {getProjectTypeLabel(activeProject.projectType)}
          </p>
        </div>
        <span className="family-badge">👨‍👩‍👧‍👦 {members.length} membro(s)</span>
      </div>

      {insights.length > 0 ? (
        <div className="family-insights card">
          {insights.map((text) => (
            <div key={text} className="family-insight-item">{text}</div>
          ))}
        </div>
      ) : null}

      <div className="family-kpi-strip">
        <article className="card family-kpi">
          <span>Receitas</span>
          <strong className="text-success">R$ {formatMoney(summary.totalIncome)}</strong>
        </article>
        <article className="card family-kpi">
          <span>Despesas</span>
          <strong className="text-danger">R$ {formatMoney(summary.totalExpense)}</strong>
        </article>
        <article className="card family-kpi">
          <span>Saldo familiar</span>
          <strong>R$ {formatMoney(summary.balance)}</strong>
        </article>
        <article className="card family-kpi">
          <span>Economia</span>
          <strong>R$ {formatMoney(summary.savings)}</strong>
        </article>
        {topCategory ? (
          <article className="card family-kpi">
            <span>Maior gasto</span>
            <strong>{topCategory.name}</strong>
            <small>{Math.round(topCategory.pct)}% das despesas</small>
          </article>
        ) : null}
      </div>

      <div className="family-grid">
        <section className="card family-section">
          <h3>Gastos por membro</h3>
          {familyConfig.showMemberContribution === false ? (
            <p className="family-hint">Contribuição por membro desativada nas configurações.</p>
          ) : memberSpending.byMember.length === 0 ? (
            <p className="family-hint">Nenhuma despesa registrada no período.</p>
          ) : (
            <ul className="family-member-list">
              {memberSpending.byMember.map((m) => (
                <li key={m.uid} className="family-member-item">
                  <div className="family-member-head">
                    <strong>{m.name}</strong>
                    <span>R$ {formatMoney(m.spent)} ({m.sharePct.toFixed(0)}%)</span>
                  </div>
                  <div className="family-member-bar">
                    <div
                      className="family-member-bar-fill"
                      style={{ width: `${Math.min(100, m.sharePct)}%` }}
                    />
                  </div>
                  {m.topCategories.length > 0 ? (
                    <span className="family-member-cats">
                      Top: {m.topCategories.map((c) => c.name).join(', ')}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card family-section">
          <h3>Orçamento familiar</h3>
          {budgetUsage.length === 0 ? (
            <p className="family-hint">Defina orçamentos por categoria para acompanhar o uso.</p>
          ) : (
            <ul className="family-budget-list">
              {budgetUsage.map((b) => (
                <li key={b.category} className={`family-budget-item family-budget-item--${b.status}`}>
                  <div className="family-budget-head">
                    <span>{b.category}</span>
                    <span>
                      R$ {formatMoney(b.spent)}
                      {b.limit > 0 ? ` / R$ ${formatMoney(b.limit)}` : ''}
                    </span>
                  </div>
                  {b.limit > 0 ? (
                    <div className="family-budget-bar">
                      <div
                        className="family-budget-bar-fill"
                        style={{ width: `${Math.min(100, b.usagePct)}%` }}
                      />
                    </div>
                  ) : null}
                  {b.status === 'warning' ? (
                    <span className="family-budget-alert">Acima de 80% do orçamento</span>
                  ) : null}
                  {b.status === 'over' ? (
                    <span className="family-budget-alert">Orçamento ultrapassado</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card family-section">
          <h3>Distribuição por categoria</h3>
          {categoryBreakdown.length === 0 ? (
            <p className="family-hint">Sem despesas no período.</p>
          ) : (
            <ul className="family-category-list">
              {categoryBreakdown.slice(0, 8).map((c) => (
                <li key={c.name} className="family-category-item">
                  <span>{c.name}</span>
                  <span>R$ {formatMoney(c.amount)} ({c.pct.toFixed(0)}%)</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card family-section">
          <div className="family-section-head">
            <h3>Metas familiares</h3>
            {onOpenTasks ? (
              <button type="button" className="text-btn" onClick={onOpenTasks}>Ver tarefas</button>
            ) : null}
          </div>
          {familyGoals.length === 0 ? (
            <p className="family-hint">Crie tarefas de despesa para metas como viagem, reserva ou reforma.</p>
          ) : (
            <ul className="family-goals-list">
              {familyGoals.slice(0, 6).map((t) => (
                <li key={t.id} className="family-goal-item">
                  <span>{t.title}</span>
                  {Number(t.metaValue) > 0 ? (
                    <span>R$ {formatMoney(t.metaValue)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card family-section">
          <h3>Responsabilidades</h3>
          <p className="family-hint">
            Quem mais registrou despesas neste período:
          </p>
          {memberSpending.byMember.filter((m) => m.spent > 0).length === 0 ? (
            <p className="family-hint">Ainda sem registros por membro.</p>
          ) : (
            <ol className="family-ranking">
              {memberSpending.byMember
                .filter((m) => m.spent > 0)
                .map((m, i) => (
                  <li key={m.uid}>
                    {i + 1}. {m.name} — R$ {formatMoney(m.spent)} ({m.transactionCount} lançamentos)
                  </li>
                ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
