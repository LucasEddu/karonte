import { useMemo, useState } from 'react';
import {
  buildSavingsScenario,
  buildSavingsTargets,
} from '../utils/savingsSimulator.js';
import { saveSavingsScenario } from '../services/savingsScenariosService.js';

const PERCENT_PRESETS = [10, 20, 30, 50];
const PERIOD_PRESETS = [
  { id: 1, label: '1 mês' },
  { id: 3, label: '3 meses' },
  { id: 6, label: '6 meses' },
  { id: 12, label: '12 meses' },
];

export default function SavingsSimulatorView({
  transactions = [],
  expenseCategories = [],
  totalIncome = 0,
  totalExpense = 0,
  currentUser,
  activeProjectId,
  formatMoney,
}) {
  const targets = useMemo(
    () => buildSavingsTargets(transactions, expenseCategories),
    [transactions, expenseCategories]
  );

  const [targetKind, setTargetKind] = useState('category');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [reductionMode, setReductionMode] = useState('percent');
  const [reductionPercent, setReductionPercent] = useState(20);
  const [reductionFixed, setReductionFixed] = useState('');
  const [periodMonths, setPeriodMonths] = useState(12);
  const [customMonths, setCustomMonths] = useState('');
  const [scenarioName, setScenarioName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const activeList =
    targetKind === 'category'
      ? targets.categories
      : targetKind === 'subscription'
        ? targets.subscriptions
        : [];

  const selectedTarget = activeList.find((t) => t.id === selectedTargetId) || null;

  const months =
    periodMonths === 'custom'
      ? Math.max(1, parseInt(customMonths, 10) || 1)
      : periodMonths;

  const reductionValue =
    reductionMode === 'percent'
      ? reductionPercent
      : parseFloat(String(reductionFixed).replace(/\./g, '').replace(',', '.')) || 0;

  const currentAmount =
    targetKind === 'custom'
      ? parseFloat(String(customAmount).replace(/\./g, '').replace(',', '.')) || 0
      : selectedTarget?.currentAmount || 0;

  const targetName =
    targetKind === 'custom'
      ? 'Gasto personalizado'
      : selectedTarget?.targetName || '';

  const scenario = useMemo(
    () =>
      buildSavingsScenario(transactions, {
        targetType: targetKind,
        targetName,
        currentAmount,
        reductionType: reductionMode,
        reductionValue,
        months,
        income: totalIncome,
        expenses: totalExpense,
      }),
    [
      transactions,
      targetKind,
      targetName,
      currentAmount,
      reductionMode,
      reductionValue,
      months,
      totalIncome,
      totalExpense,
    ]
  );

  const handleSave = async () => {
    if (!currentUser?.uid || !scenarioName.trim()) return;
    setSaving(true);
    setSaveMsg('');
    try {
      await saveSavingsScenario({
        name: scenarioName.trim(),
        projectId: activeProjectId || null,
        targetType: targetKind,
        targetName,
        currentAmount: scenario.currentAmount,
        reductionType: reductionMode,
        reductionValue,
        months,
        estimatedSavings: scenario.totalSavings,
      });
      setSaveMsg('Simulação salva com sucesso.');
      setScenarioName('');
    } catch (err) {
      setSaveMsg('Erro ao salvar simulação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="main-content simulator-view">
      <div className="card simulator-intro">
        <h2>Simulador de Economia</h2>
        <p>
          Simule quanto você economizaria ao reduzir gastos em uma categoria, assinatura ou valor personalizado.
          Todos os cálculos são feitos localmente no seu dispositivo.
        </p>
      </div>

      <div className="simulator-layout">
        <div className="card simulator-panel">
          <h3>1. O que reduzir?</h3>
          <div className="simulator-tabs">
            {[
              { id: 'category', label: 'Categoria' },
              { id: 'subscription', label: 'Assinatura' },
              { id: 'custom', label: 'Personalizado' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`calendar-filter-btn ${targetKind === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setTargetKind(tab.id);
                  setSelectedTargetId('');
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {targetKind !== 'custom' ? (
            <div className="form-group">
              <label>Selecione</label>
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
              >
                <option value="">Escolha...</option>
                {activeList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.targetName} — R$ {formatMoney(t.currentAmount)}/mês (média)
                  </option>
                ))}
              </select>
              {activeList.length === 0 ? (
                <p className="simulator-hint">Nenhum item detectado com histórico suficiente.</p>
              ) : null}
            </div>
          ) : (
            <div className="form-group">
              <label>Gasto mensal atual (R$)</label>
              <input
                type="text"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
          )}

          <h3>2. Quanto reduzir?</h3>
          <div className="simulator-tabs">
            <button
              type="button"
              className={`calendar-filter-btn ${reductionMode === 'percent' ? 'active' : ''}`}
              onClick={() => setReductionMode('percent')}
            >
              Percentual
            </button>
            <button
              type="button"
              className={`calendar-filter-btn ${reductionMode === 'fixed' ? 'active' : ''}`}
              onClick={() => setReductionMode('fixed')}
            >
              Valor fixo
            </button>
          </div>

          {reductionMode === 'percent' ? (
            <div className="simulator-presets">
              {PERCENT_PRESETS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  className={`calendar-filter-btn ${reductionPercent === pct ? 'active' : ''}`}
                  onClick={() => setReductionPercent(pct)}
                >
                  {pct}%
                </button>
              ))}
            </div>
          ) : (
            <div className="form-group">
              <label>Redução mensal (R$)</label>
              <input
                type="text"
                value={reductionFixed}
                onChange={(e) => setReductionFixed(e.target.value)}
                placeholder="0,00"
              />
            </div>
          )}

          <h3>3. Período</h3>
          <div className="simulator-presets">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`calendar-filter-btn ${periodMonths === p.id ? 'active' : ''}`}
                onClick={() => setPeriodMonths(p.id)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className={`calendar-filter-btn ${periodMonths === 'custom' ? 'active' : ''}`}
              onClick={() => setPeriodMonths('custom')}
            >
              Personalizado
            </button>
          </div>
          {periodMonths === 'custom' ? (
            <div className="form-group">
              <label>Meses</label>
              <input
                type="number"
                min="1"
                max="120"
                value={customMonths}
                onChange={(e) => setCustomMonths(e.target.value)}
              />
            </div>
          ) : null}
        </div>

        <div className="card simulator-results">
          <h3>Resultado</h3>
          {scenario.currentAmount <= 0 ? (
            <p className="simulator-hint">Selecione um alvo com valor mensal para simular.</p>
          ) : (
            <>
              {scenario.message ? (
                <p className="simulator-message">{scenario.message}</p>
              ) : null}
              <div className="simulator-kpis">
                <div className="simulator-kpi">
                  <span>Gasto atual/mês</span>
                  <strong>R$ {formatMoney(scenario.currentAmount)}</strong>
                </div>
                <div className="simulator-kpi">
                  <span>Economia/mês</span>
                  <strong className="text-success">R$ {formatMoney(scenario.monthlySavings)}</strong>
                </div>
                <div className="simulator-kpi">
                  <span>Economia total</span>
                  <strong className="text-success">R$ {formatMoney(scenario.totalSavings)}</strong>
                </div>
                <div className="simulator-kpi">
                  <span>Novo gasto/mês</span>
                  <strong>R$ {formatMoney(scenario.newMonthlyAmount)}</strong>
                </div>
              </div>

              <div className="simulator-compare">
                <h4>Antes / Depois</h4>
                <div className="simulator-compare-row">
                  <span>Despesas mensais</span>
                  <span>R$ {formatMoney(scenario.impact.beforeExpenses)} → R$ {formatMoney(scenario.impact.afterExpenses)}</span>
                </div>
                <div className="simulator-compare-row">
                  <span>Taxa de poupança</span>
                  <span>
                    {scenario.impact.beforeSavingsRate.toFixed(1)}% → {scenario.impact.afterSavingsRate.toFixed(1)}%
                    {scenario.impact.savingsRateDelta > 0 ? (
                      <em className="text-success"> (+{scenario.impact.savingsRateDelta.toFixed(1)} pp)</em>
                    ) : null}
                  </span>
                </div>
              </div>

              <div className="simulator-save">
                <h4>Salvar simulação (opcional)</h4>
                <div className="simulator-save-row">
                  <input
                    type="text"
                    placeholder="Nome do cenário"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={handleSave}
                    disabled={saving || !scenarioName.trim()}
                  >
                    {saving ? '...' : 'Salvar'}
                  </button>
                </div>
                {saveMsg ? <p className="simulator-hint">{saveMsg}</p> : null}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
