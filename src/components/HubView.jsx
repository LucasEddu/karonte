import React from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
  AreaChart, Area
} from 'recharts';

export default function HubView({
  formatMoney,
  balance,
  totalIncome,
  totalExpense,
  totalBudgetLimit,
  calculateForecast,
  categoryStats,
  getCategoryBudgetInfo,
  getCatFill,
  getCatTrack,
  chartTheme,
  chartTooltipStyle,
  monthlyEvolutionData,
  budgetStats,
  ruleStats,
  filteredTransactions,
  creditCards,
  canAddToProject,
  canDeleteInProject,
  onAddClick,
  onDelete,
  selectedMonth,
  selectedYear,
}) {
  const forecast = calculateForecast();

  return (
    <main className="hub-layout main-content">
      <section className="hub-kpi-strip">
        <article className="hub-kpi hub-kpi--balance card">
          <span className="hub-kpi-label">Saldo</span>
          <span className="hub-kpi-value">R$ {formatMoney(balance)}</span>
          <span className="hub-kpi-meta">{balance >= 0 ? 'Positivo no período' : 'Déficit no período'}</span>
        </article>
        <article className="hub-kpi hub-kpi--income card">
          <span className="hub-kpi-label">Entradas</span>
          <span className="hub-kpi-value">R$ {formatMoney(totalIncome)}</span>
        </article>
        <article className="hub-kpi hub-kpi--expense card">
          <span className="hub-kpi-label">Saídas</span>
          <span className="hub-kpi-value">R$ {formatMoney(totalExpense)}</span>
        </article>
        <article className={`hub-kpi hub-kpi--forecast card ${forecast.isHigh ? 'hub-kpi--alert' : ''}`}>
          <span className="hub-kpi-label">Previsão {forecast.isHigh ? '⚠️' : '🔮'}</span>
          <span className="hub-kpi-value">R$ {formatMoney(forecast.forecastAmount)}</span>
          <span className="hub-kpi-meta">Média: R$ {formatMoney(forecast.monthlyAverage)}</span>
        </article>
      </section>

      <section className="hub-bento">
        <article className="hub-bento-cell hub-bento-chart-main card grid-card">
          <div className="card-title">Evolução do saldo — 6 meses</div>
          <div className="hub-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyEvolutionData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartTheme.balance} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={chartTheme.balance} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-tertiary)" fontSize={10} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} width={42} />
                <RechartsTooltip
                  contentStyle={chartTooltipStyle}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  formatter={v => `R$ ${formatMoney(v)}`}
                />
                <Area type="monotone" dataKey="Saldo" stroke={chartTheme.balance} strokeWidth={2.5} fill="url(#gradSaldo)" dot={{ fill: chartTheme.balance, r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="hub-bento-cell hub-bento-categories card grid-card">
          <div className="card-title">Top categorias</div>
          <div className="category-list">
            {categoryStats.length === 0 ? (
              <div className="hub-empty">Nenhuma despesa no mês.</div>
            ) : (
              categoryStats.slice(0, 4).map((item, index) => {
                const budgetInfo = getCategoryBudgetInfo(item.name, item.total);
                const isUnbudgeted = budgetInfo.limit === 0;
                const visualPct = isUnbudgeted ? Math.min((item.total / totalExpense) * 100, 100) : budgetInfo.pct;
                const fillCol = budgetInfo.isOver100 ? 'var(--danger-color)' : getCatFill(index, item.name);
                const trackCol = getCatTrack(item.name);
                return (
                  <div key={item.name} className="cat-item">
                    <div className="cat-header">
                      <span className="cat-name">{item.name}</span>
                      <div>
                        {budgetInfo.isOver80 ? <span className="badge-alert">{visualPct.toFixed(0)}%</span> : null}
                        <span className="cat-value" style={{ color: fillCol }}>R$ {formatMoney(item.total)}</span>
                      </div>
                    </div>
                    <div className="progress-bg" style={{ backgroundColor: trackCol }}>
                      <div className="progress-fill" style={{ width: `${visualPct}%`, backgroundColor: fillCol }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="hub-bento-cell hub-bento-bars card grid-card">
          <div className="card-title">Receitas vs despesas</div>
          <div className="hub-chart-wrap hub-chart-wrap--short">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyEvolutionData} barCategoryGap="25%" margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-tertiary)" fontSize={10} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} width={42} />
                <RechartsTooltip contentStyle={chartTooltipStyle} formatter={v => `R$ ${formatMoney(v)}`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Receitas" fill={chartTheme.income} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="Despesas" fill={chartTheme.expense} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="hub-bento-cell hub-bento-donut card grid-card">
          <div className="card-title">Composição ({selectedMonth}/{selectedYear})</div>
          {categoryStats.length > 0 ? (
            <div className="hub-chart-wrap hub-chart-wrap--short">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStats}
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="total"
                  >
                    {categoryStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={chartTheme.palette[index % chartTheme.palette.length]} stroke="rgba(0,0,0,0)" />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={chartTooltipStyle} formatter={v => `R$ ${formatMoney(v)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="hub-empty">Sem despesas no período.</div>
          )}
        </article>

        <article className="hub-bento-cell hub-bento-budget card grid-card">
          <div className="card-title">Orçado vs realizado</div>
          <div className="budget-real-list">
            {budgetStats.length > 0 ? (
              budgetStats.slice(0, 4).map(stat => {
                let colorClass = 'safe';
                if (stat.percent > 100) colorClass = 'danger';
                else if (stat.percent > 80) colorClass = 'warning';
                return (
                  <div key={stat.name} className="budget-real-item">
                    <div className="budget-real-item-header">
                      <span className="budget-real-name">{stat.name}</span>
                      <span className="budget-real-values">R$ {formatMoney(stat.spent)}</span>
                    </div>
                    <div className="budget-progress-track">
                      <div className={`budget-progress-fill ${colorClass}`} style={{ width: `${Math.min(stat.percent, 100)}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="hub-empty">Sem orçamentos no período.</div>
            )}
          </div>
        </article>

        <article className="hub-bento-cell hub-bento-rule card grid-card">
          <div className="card-title">Regra 50-30-20</div>
          <div className="rule-visual-container">
            <div className="rule-progress-bar">
              {ruleStats.needsPct > 0 && <div className="rule-progress-fill needs" style={{ width: `${ruleStats.needsPct}%` }} />}
              {ruleStats.wantsPct > 0 && <div className="rule-progress-fill wants" style={{ width: `${ruleStats.wantsPct}%` }} />}
              {ruleStats.savingsPct > 0 && <div className="rule-progress-fill savings" style={{ width: `${ruleStats.savingsPct}%` }} />}
            </div>
            <div className="rule-legend">
              <div className="rule-legend-item">
                <span className="dot needs" />
                <div className="rule-legend-info">
                  <span className="rule-label">Necessidades</span>
                  <span className="rule-val">{ruleStats.needsPct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="rule-legend-item">
                <span className="dot wants" />
                <div className="rule-legend-info">
                  <span className="rule-label">Desejos</span>
                  <span className="rule-val">{ruleStats.wantsPct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="rule-legend-item">
                <span className="dot savings" />
                <div className="rule-legend-info">
                  <span className="rule-label">Poupança</span>
                  <span className="rule-val">{ruleStats.savingsPct.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="hub-bento-cell hub-bento-metrics card grid-card">
          <div className="card-title">Indicadores</div>
          <div className="hub-mini-metrics">
            <div className="hub-mini-metric">
              <span className="hub-mini-metric-label">Poupança</span>
              <span className="hub-mini-metric-value" style={{ color: 'var(--success-color)' }}>
                {totalIncome > 0 ? `${((totalIncome - totalExpense) / totalIncome * 100).toFixed(0)}%` : '0%'}
              </span>
            </div>
            <div className="hub-mini-metric">
              <span className="hub-mini-metric-label">Uso orçamento</span>
              <span className="hub-mini-metric-value" style={{ color: totalExpense > totalBudgetLimit && totalBudgetLimit > 0 ? 'var(--danger-color)' : 'var(--text-highlight)' }}>
                {totalBudgetLimit > 0 ? `${((totalExpense / totalBudgetLimit) * 100).toFixed(0)}%` : '—'}
              </span>
            </div>
            <div className="hub-mini-metric">
              <span className="hub-mini-metric-label">Maior gasto</span>
              <span className="hub-mini-metric-value">{categoryStats[0]?.name || '—'}</span>
            </div>
          </div>
        </article>

        <article className="hub-bento-cell hub-bento-insights card grid-card insight-highlight-card">
          <div className="card-title" style={{ color: 'var(--text-highlight)' }}>Análise rápida 💡</div>
          <ul className="quick-insights-list hub-insights-list">
            {totalIncome > 0 && (totalExpense / totalIncome > 0.8) && (
              <li>⚠️ Gastos acima de 80% das receitas este mês.</li>
            )}
            {budgetStats.some(s => s.percent > 100) && (
              <li>⚠️ {budgetStats.filter(s => s.percent > 100).length} categoria(s) estouraram o orçamento.</li>
            )}
            {ruleStats.savingsPct >= 20 ? (
              <li style={{ color: 'var(--success-color)' }}>🎉 Poupança acima de 20% — excelente!</li>
            ) : (
              <li>💡 Reduza desejos para chegar aos 20% de poupança.</li>
            )}
            <li>🔮 Fechamento estimado: R$ {formatMoney(forecast.forecastAmount)}.</li>
          </ul>
        </article>
      </section>

      <section className="hub-transactions card list-section">
        <div className="hub-transactions-header list-header">
          <div>
            <h2>Últimos lançamentos</h2>
            <span className="hub-transactions-count">{filteredTransactions.length} registros</span>
          </div>
          {canAddToProject && (
            <button type="button" className="hub-add-btn submit-btn" onClick={onAddClick}>
              + Novo lançamento
            </button>
          )}
        </div>

        <div className="history-list">
          {filteredTransactions.length === 0 ? (
            <div className="hub-empty hub-empty--center">
              Ainda não há registros neste mês.
              {canAddToProject && (
                <button type="button" className="text-btn hub-empty-action" onClick={onAddClick}>Adicionar primeiro lançamento</button>
              )}
            </div>
          ) : (
            filteredTransactions.map(t => (
              <div key={t.id} className="history-item">
                <div className={`t-icon-box ${t.type}`}>
                  <div className={t.type === 'expense' ? 'arrow-down' : 'arrow-up'} />
                </div>
                <div className="t-details">
                  <span className="t-name">
                    <span>{t.description}</span>
                            {t.isRecurring ? <span title="Despesa Recorrente" style={{ marginLeft: 4, color: 'var(--primary-color)' }}>⟳</span> : null}
                            {t.isInstallment && t.installments > 1 ? (
                              <span className="installment-badge" title="Compra parcelada">
                                {t.installmentNumber || 1}/{t.installments}x
                              </span>
                            ) : null}
                  </span>
                  <span className="t-meta">
                    <span>{t.category}</span>
                    {t.paymentMethod === 'card' && t.cardId && (
                      <>
                        <span> • </span>
                        <span style={{ color: 'var(--text-highlight)', fontWeight: 600 }}>
                          💳 {creditCards.find(c => c.id === t.cardId)?.name || 'Cartão'}
                        </span>
                      </>
                    )}
                    <span> • </span><span>{t.displayDate}</span>
                    {t.createdByName ? (<><span> • </span><span>por {t.createdByName}</span></>) : null}
                  </span>
                </div>
                <div className={`t-amount ${t.type}`}>
                  <span>{t.type === 'expense' ? '− ' : '+ '}</span><span>R$ {formatMoney(t.amount)}</span>
                </div>
                {canDeleteInProject && <button type="button" className="delete-btn-subtle" onClick={() => onDelete(t.id)} title="Remover">×</button>}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
