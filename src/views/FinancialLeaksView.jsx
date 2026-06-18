import { useMemo } from 'react';
import { detectFinancialLeaks, buildLeakReport } from '../utils/financialLeakDetector.js';

const SEVERITY_LABELS = {
  moderate: 'Moderado',
  high: 'Alto',
  critical: 'Crítico',
};

export default function FinancialLeaksView({
  transactions = [],
  formatMoney,
  selectedMonth,
  selectedYear,
  activeProjectId,
}) {
  const leaks = useMemo(
    () => detectFinancialLeaks({
      transactions,
      month: selectedMonth,
      year: selectedYear,
      referenceDate: new Date(selectedYear, selectedMonth - 1, 15),
    }),
    [transactions, selectedMonth, selectedYear]
  );

  const report = useMemo(() => buildLeakReport(leaks), [leaks]);

  return (
    <main className="main-content analytics-view leaks-view">
      <section className="analytics-summary">
        <article className="analytics-summary-card card">
          <span>Maior aumento</span>
          <strong>
            {report.biggestIncrease
              ? `${report.biggestIncrease.type === 'category' ? report.biggestIncrease.category : report.biggestIncrease.merchant} (+${report.biggestIncrease.increasePct.toFixed(0)}%)`
              : '—'}
          </strong>
        </article>
        <article className="analytics-summary-card card">
          <span>Categoria crítica</span>
          <strong>{report.criticalCategory?.category || '—'}</strong>
        </article>
        <article className="analytics-summary-card card">
          <span>Valor acima da média</span>
          <strong>R$ {formatMoney(report.totalExcess)}</strong>
        </article>
        <article className="analytics-summary-card card">
          <span>Economia potencial/ano</span>
          <strong style={{ color: 'var(--success-color)' }}>R$ {formatMoney(report.potentialAnnualSavings)}</strong>
        </article>
      </section>

      <section className="card analytics-toolbar">
        <span className="analytics-scope-label">
          Análise de {selectedMonth}/{selectedYear} — {activeProjectId ? 'Projeto ativo' : 'Geral (pessoal)'}
        </span>
        <div className="leaks-severity-badges">
          <span className="leak-badge leak-badge--critical">{report.bySeverity.critical} críticos</span>
          <span className="leak-badge leak-badge--high">{report.bySeverity.high} altos</span>
          <span className="leak-badge leak-badge--moderate">{report.bySeverity.moderate} moderados</span>
        </div>
      </section>

      <section className="analytics-grid leaks-grid">
        <article className="card analytics-table-card">
          <div className="card-title">Por categoria</div>
          {report.categoryLeaks.length === 0 ? (
            <p className="hub-empty">Nenhum vazamento por categoria detectado.</p>
          ) : (
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Média 3m</th>
                    <th>Atual</th>
                    <th>Diferença</th>
                    <th>Aumento</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.categoryLeaks.map((row) => (
                    <tr key={row.category}>
                      <td>{row.category}</td>
                      <td>R$ {formatMoney(row.average3Months)}</td>
                      <td>R$ {formatMoney(row.current)}</td>
                      <td>R$ {formatMoney(row.difference)}</td>
                      <td>+{row.increasePct.toFixed(0)}%</td>
                      <td>
                        <span className={`leak-status leak-status--${row.severity}`}>
                          {SEVERITY_LABELS[row.severity]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="card analytics-table-card">
          <div className="card-title">Por estabelecimento</div>
          {report.merchantLeaks.length === 0 ? (
            <p className="hub-empty">Nenhum vazamento por estabelecimento detectado.</p>
          ) : (
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Estabelecimento</th>
                    <th>Média 3m</th>
                    <th>Atual</th>
                    <th>Aumento</th>
                    <th>Economia/ano</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.merchantLeaks.map((row) => (
                    <tr key={row.merchant}>
                      <td>{row.merchant}</td>
                      <td>R$ {formatMoney(row.average3Months)}</td>
                      <td>R$ {formatMoney(row.current)}</td>
                      <td>+{row.increasePct.toFixed(0)}%</td>
                      <td>R$ {formatMoney(row.potentialAnnualSavings)}</td>
                      <td>
                        <span className={`leak-status leak-status--${row.severity}`}>
                          {SEVERITY_LABELS[row.severity]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
