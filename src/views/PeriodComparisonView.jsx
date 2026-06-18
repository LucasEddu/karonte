import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { comparePeriods, getPeriodPreset } from '../utils/periodComparison.js';

const PRESETS = [
  { id: 'month_vs_previous', label: 'Mês atual × anterior' },
  { id: 'year_vs_previous', label: 'Ano atual × anterior' },
  { id: 'custom', label: 'Personalizado' },
];

const formatPct = (value) => {
  const n = Number(value) || 0;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(0)}%`;
};

const IndicatorRow = ({ label, data, isPercent = false }) => (
  <div className="comparison-indicator">
    <span className="comparison-indicator-label">{label}</span>
    <span className={`comparison-indicator-value ${data.difference >= 0 ? 'positive' : 'negative'}`}>
      {formatPct(data.percent)}
    </span>
    <span className="comparison-indicator-detail">
      {isPercent
        ? `${(data.valueA || 0).toFixed(0)}% → ${(data.valueB || 0).toFixed(0)}%`
        : `R$ ${(data.valueA || 0).toFixed(0)} → R$ ${(data.valueB || 0).toFixed(0)}`}
    </span>
  </div>
);

export default function PeriodComparisonView({
  transactions = [],
  budgets = {},
  expenseCategories = [],
  customCategories = {},
  creditCards = [],
  tasks = [],
  formatMoney,
  chartTheme,
  chartTooltipStyle,
  selectedMonth,
  selectedYear,
  activeProjectId,
}) {
  const [preset, setPreset] = useState('month_vs_previous');
  const [customA, setCustomA] = useState({ month: selectedMonth, year: selectedYear });
  const [customB, setCustomB] = useState(() => {
    let m = selectedMonth - 1;
    let y = selectedYear;
    if (m < 1) { m = 12; y -= 1; }
    return { month: m, year: y };
  });

  const periods = useMemo(() => {
    if (preset === 'custom') {
      return {
        periodA: { ...customA, label: `${customA.month}/${customA.year}` },
        periodB: { ...customB, label: `${customB.month}/${customB.year}` },
      };
    }
    return getPeriodPreset(preset, new Date(selectedYear, selectedMonth - 1, 15));
  }, [preset, customA, customB, selectedMonth, selectedYear]);

  const result = useMemo(
    () => comparePeriods({
      transactions,
      periodA: periods.periodA,
      periodB: periods.periodB,
      budgets,
      expenseCategories,
      customCategories,
      creditCards,
      tasks,
    }),
    [transactions, periods, budgets, expenseCategories, customCategories, creditCards, tasks]
  );

  return (
    <main className="main-content analytics-view comparison-view">
      <section className="card analytics-toolbar">
        <div className="analytics-toolbar-row">
          <span className="analytics-scope-label">
            {activeProjectId ? 'Projeto ativo' : 'Geral (pessoal)'}
          </span>
          <div className="analytics-filter-group">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`calendar-filter-btn ${preset === p.id ? 'active' : ''}`}
                onClick={() => setPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {preset === 'custom' ? (
          <div className="comparison-custom-periods">
            <label>
              Período A
              <input type="number" min={1} max={12} value={customA.month} onChange={(e) => setCustomA({ ...customA, month: Number(e.target.value) })} />
              <input type="number" value={customA.year} onChange={(e) => setCustomA({ ...customA, year: Number(e.target.value) })} />
            </label>
            <label>
              Período B
              <input type="number" min={1} max={12} value={customB.month} onChange={(e) => setCustomB({ ...customB, month: Number(e.target.value) })} />
              <input type="number" value={customB.year} onChange={(e) => setCustomB({ ...customB, year: Number(e.target.value) })} />
            </label>
          </div>
        ) : null}
      </section>

      <section className="analytics-summary">
        <article className="analytics-summary-card card">
          <span>Receitas ({periods.periodB.label} vs {periods.periodA.label})</span>
          <strong className={result.summary.income.percent >= 0 ? 'positive' : 'negative'}>
            {formatPct(result.summary.income.percent)}
          </strong>
        </article>
        <article className="analytics-summary-card card">
          <span>Despesas</span>
          <strong className={result.summary.expense.percent <= 0 ? 'positive' : 'negative'}>
            {formatPct(result.summary.expense.percent)}
          </strong>
        </article>
        <article className="analytics-summary-card card">
          <span>Saldo</span>
          <strong className={result.summary.balance.percent >= 0 ? 'positive' : 'negative'}>
            {formatPct(result.summary.balance.percent)}
          </strong>
        </article>
        <article className="analytics-summary-card card">
          <span>Poupança</span>
          <strong>{formatPct(result.summary.savings.percent)}</strong>
        </article>
      </section>

      <section className="analytics-grid">
        <article className="card analytics-side-card">
          <div className="card-title">Indicadores</div>
          <IndicatorRow label="Receitas" data={result.summary.income} />
          <IndicatorRow label="Despesas" data={result.summary.expense} />
          <IndicatorRow label="Saldo" data={result.summary.balance} />
          <IndicatorRow label="Poupança (%)" data={result.summary.savings} isPercent />
          <IndicatorRow label="Uso orçamento (%)" data={result.summary.budgetUsage} isPercent />
          <IndicatorRow label="Cartões (% limite)" data={result.summary.cards} isPercent />
        </article>

        <article className="card analytics-chart-card">
          <div className="card-title">Categorias — {periods.periodA.label} vs {periods.periodB.label}</div>
          <div className="hub-chart-wrap analytics-chart-wrap">
            {result.chartCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.chartCategories} barCategoryGap="20%" margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-tertiary)" fontSize={10} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} width={42} />
                  <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => `R$ ${formatMoney(v)}`} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="periodA" name={`Período A (${periods.periodA.label})`} fill={chartTheme.palette[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="periodB" name={`Período B (${periods.periodB.label})`} fill={chartTheme.palette[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="hub-empty">Sem dados para comparar.</p>
            )}
          </div>
        </article>

        <article className="card analytics-side-card">
          <div className="card-title">Insights automáticos</div>
          {result.insights.length === 0 ? (
            <p className="hub-empty">Sem variações relevantes.</p>
          ) : (
            <ul className="analytics-insight-list">
              {result.insights.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          )}
        </article>

        <article className="card analytics-table-card">
          <div className="card-title">Comparação por categoria</div>
          <div className="analytics-table-wrap">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Período A</th>
                  <th>Período B</th>
                  <th>Diferença</th>
                  <th>Variação</th>
                </tr>
              </thead>
              <tbody>
                {result.categories.map((row) => (
                  <tr key={row.category}>
                    <td>{row.category}</td>
                    <td>R$ {formatMoney(row.periodA)}</td>
                    <td>R$ {formatMoney(row.periodB)}</td>
                    <td>R$ {formatMoney(row.difference)}</td>
                    <td className={row.variationPct >= 0 ? 'negative' : 'positive'}>
                      {formatPct(row.variationPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  );
}
