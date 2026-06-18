import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { buildCashFlowForecast } from '../utils/cashFlowForecast.js';
import { detectSubscriptions } from '../utils/subscriptionDetection.js';

const HORIZON_OPTIONS = [
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
];

export default function CashFlowForecastView({
  transactions = [],
  creditCards = [],
  formatMoney,
  chartTheme,
  chartTooltipStyle,
  activeProjectId,
}) {
  const [monthsAhead, setMonthsAhead] = useState(6);

  const subscriptions = useMemo(() => detectSubscriptions(transactions), [transactions]);

  const forecast = useMemo(
    () => buildCashFlowForecast({
      transactions,
      creditCards,
      subscriptions,
      monthsAhead,
    }),
    [transactions, creditCards, subscriptions, monthsAhead]
  );

  const nextMonth = forecast.months[0];

  return (
    <main className="main-content analytics-view cashflow-view">
      <section className="analytics-summary">
        <article className="analytics-summary-card card">
          <span>Receitas previstas</span>
          <strong>R$ {formatMoney(forecast.summary.totalProjectedIncome)}</strong>
        </article>
        <article className="analytics-summary-card card">
          <span>Despesas previstas</span>
          <strong>R$ {formatMoney(forecast.summary.totalProjectedExpenses)}</strong>
        </article>
        <article className="analytics-summary-card card">
          <span>Saldo previsto</span>
          <strong style={{ color: forecast.summary.totalProjectedBalance >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
            R$ {formatMoney(forecast.summary.totalProjectedBalance)}
          </strong>
        </article>
        <article className="analytics-summary-card card">
          <span>Próximo mês</span>
          <strong>{nextMonth ? `${nextMonth.label} — R$ ${formatMoney(nextMonth.projectedBalance)}` : '—'}</strong>
        </article>
      </section>

      <section className="card analytics-toolbar">
        <div className="analytics-toolbar-row">
          <span className="analytics-scope-label">
            {activeProjectId ? 'Projeto ativo' : 'Geral (pessoal)'}
          </span>
          <div className="analytics-filter-group">
            {HORIZON_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`calendar-filter-btn ${monthsAhead === opt.value ? 'active' : ''}`}
                onClick={() => setMonthsAhead(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="analytics-grid">
        <article className="card analytics-chart-card">
          <div className="card-title">Projeção de fluxo de caixa</div>
          <div className="hub-chart-wrap analytics-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecast.chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-tertiary)" fontSize={10} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} width={42} />
                <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => `R$ ${formatMoney(v)}`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="Receitas" stroke={chartTheme.income} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Despesas" stroke={chartTheme.expense} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Saldo" stroke={chartTheme.balance} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card analytics-side-card">
          <div className="card-title">Resumo do período</div>
          <ul className="analytics-stat-list">
            <li>
              <span>Melhor mês previsto</span>
              <strong>
                {forecast.summary.bestMonth
                  ? `${forecast.summary.bestMonth.label} — R$ ${formatMoney(forecast.summary.bestMonth.projectedBalance)}`
                  : '—'}
              </strong>
            </li>
            <li>
              <span>Pior mês previsto</span>
              <strong>
                {forecast.summary.worstMonth
                  ? `${forecast.summary.worstMonth.label} — R$ ${formatMoney(forecast.summary.worstMonth.projectedBalance)}`
                  : '—'}
              </strong>
            </li>
            <li>
              <span>Média mensal de saldo</span>
              <strong>R$ {formatMoney(forecast.summary.averageMonthlyBalance)}</strong>
            </li>
            <li>
              <span>Despesas variáveis (média/mês)</span>
              <strong>R$ {formatMoney(forecast.variableExpenseBaseline)}</strong>
            </li>
          </ul>
        </article>

        <article className="card analytics-side-card">
          <div className="card-title">Alertas</div>
          {forecast.alerts.length === 0 ? (
            <p className="hub-empty">Nenhum alerta no horizonte selecionado.</p>
          ) : (
            <ul className="analytics-alert-list">
              {forecast.alerts.map((alert, idx) => (
                <li key={`${alert.type}-${idx}`} className={`analytics-alert analytics-alert--${alert.severity}`}>
                  {alert.message}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card analytics-table-card">
          <div className="card-title">Detalhamento mensal</div>
          <div className="analytics-table-wrap">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Receitas</th>
                  <th>Despesas</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {forecast.months.map((m) => (
                  <tr key={`${m.year}-${m.month}`}>
                    <td>{m.label}/{m.year}</td>
                    <td>R$ {formatMoney(m.projectedIncome)}</td>
                    <td>R$ {formatMoney(m.projectedExpenses)}</td>
                    <td style={{ color: m.projectedBalance >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                      R$ {formatMoney(m.projectedBalance)}
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
