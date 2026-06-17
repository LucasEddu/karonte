import { useEffect, useMemo, useState } from 'react';
import { detectSubscriptions, calculateSubscriptionStats } from '../utils/subscriptionDetection.js';
import {
  getUserSubscriptions,
  saveSubscription,
  ensureSubscriptionParent,
} from '../services/subscriptionsService.js';

const CONFIDENCE_LABELS = { high: 'Alta', medium: 'Média', low: 'Baixa' };

export default function SubscriptionsView({
  transactions = [],
  currentUser,
  activeProjectId,
  formatMoney,
  canManageProject,
  customCategories,
}) {
  const [saved, setSaved] = useState([]);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ name: '', amount: '', categoryName: 'Outros', day: '10' });

  const detected = useMemo(
    () => detectSubscriptions(transactions),
    [transactions]
  );

  const ignoredMerchants = useMemo(
    () => new Set(saved.filter((s) => s.status === 'ignored').map((s) => s.merchant?.toLowerCase())),
    [saved]
  );

  const activeSaved = saved.filter((s) => s.status === 'active' || s.status === 'manual');

  const visibleDetected = detected.filter(
    (d) => !ignoredMerchants.has(String(d.merchant).toLowerCase()) &&
      !activeSaved.some((s) => s.detectedId === d.id || s.merchant === d.merchant)
  );

  useEffect(() => {
    if (!currentUser?.uid) return;
    setLoading(true);
    ensureSubscriptionParent(currentUser.uid)
      .then(() => getUserSubscriptions(currentUser.uid, activeProjectId))
      .then(setSaved)
      .finally(() => setLoading(false));
  }, [currentUser?.uid, activeProjectId]);

  const displayList = useMemo(() => {
    let list = [
      ...activeSaved.map((s) => ({ ...s, source: s.source || 'manual', confidence: 'high' })),
      ...visibleDetected.map((d) => ({ ...d, source: 'detected', status: 'detected' })),
    ];
    if (filter === 'high') list = list.filter((i) => i.confidence === 'high');
    if (filter === 'medium') list = list.filter((i) => i.confidence === 'medium' || i.confidence === 'high');
    if (filter === 'expensive') list = list.filter((i) => (i.averageAmount || i.amount) >= 50);

    list.sort((a, b) => {
      const av = a.averageAmount || a.amount || 0;
      const bv = b.averageAmount || b.amount || 0;
      if (sort === 'annual') return (b.annualCost || bv * 12) - (a.annualCost || av * 12);
      if (sort === 'name') return String(a.name).localeCompare(String(b.name));
      if (sort === 'next') return new Date(a.nextExpectedDate || 0) - new Date(b.nextExpectedDate || 0);
      return bv - av;
    });
    return list;
  }, [activeSaved, visibleDetected, filter, sort]);

  const stats = calculateSubscriptionStats(
    displayList.filter((i) => i.status !== 'ignored').map((i) => ({
      averageAmount: i.averageAmount || i.amount || 0,
    }))
  );

  const persist = async (data, id = null) => {
    const item = await saveSubscription(currentUser.uid, {
      ...data,
      projectId: activeProjectId || null,
    }, id);
    setSaved((prev) => {
      const next = id ? prev.map((p) => (p.id === id ? item : p)) : [...prev, item];
      return next;
    });
  };

  const handleConfirm = async (sub) => {
    await persist({
      name: sub.name || sub.merchant,
      merchant: sub.merchant,
      amount: sub.averageAmount || sub.amount,
      categoryName: sub.categoryName,
      status: 'active',
      source: 'detected',
      detectedId: sub.id,
    });
  };

  const handleIgnore = async (sub) => {
    await persist({
      name: sub.name || sub.merchant,
      merchant: sub.merchant,
      amount: sub.averageAmount || sub.amount,
      categoryName: sub.categoryName,
      status: 'ignored',
      source: 'detected',
      detectedId: sub.id,
    });
  };

  const handleManualSave = async (e) => {
    e.preventDefault();
    const amount = parseFloat(manualForm.amount.replace(',', '.'));
    if (!manualForm.name.trim() || Number.isNaN(amount)) return;
    await persist({
      name: manualForm.name.trim(),
      merchant: manualForm.name.trim(),
      amount,
      categoryName: manualForm.categoryName,
      expectedDay: Number(manualForm.day) || 10,
      status: 'active',
      source: 'manual',
    });
    setManualForm({ name: '', amount: '', categoryName: 'Outros', day: '10' });
    setManualOpen(false);
  };

  const expenseCats = [
    ...(customCategories?.expense || []).map((c) => (typeof c === 'string' ? c : c.name)),
    'Outros',
  ];

  return (
    <main className="main-content subscriptions-view">
      <div className="card subscriptions-summary">
        <h2>Central de Assinaturas</h2>
        <div className="subscriptions-stats">
          <div><span>Total mensal</span><strong>R$ {formatMoney(stats.monthlyTotal)}</strong></div>
          <div><span>Total anual estimado</span><strong>R$ {formatMoney(stats.annualTotal)}</strong></div>
          <div><span>Detectadas</span><strong>{stats.count}</strong></div>
          {stats.mostExpensive ? (
            <div><span>Mais cara</span><strong>{stats.mostExpensive.name || stats.mostExpensive.merchant}</strong></div>
          ) : null}
        </div>
      </div>

      <div className="card subscriptions-toolbar">
        <div className="subscriptions-filters">
          {['all', 'high', 'medium', 'expensive'].map((f) => (
            <button key={f} type="button" className={`calendar-filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Todas' : f === 'high' ? 'Alta confiança' : f === 'medium' ? 'Média+' : 'Custo alto'}
            </button>
          ))}
        </div>
        <div className="subscriptions-sort">
          <label>Ordenar</label>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="monthly">Maior custo mensal</option>
            <option value="annual">Maior custo anual</option>
            <option value="next">Próxima cobrança</option>
            <option value="name">Nome</option>
          </select>
        </div>
        {canManageProject ? (
          <button type="button" className="submit-btn" onClick={() => setManualOpen((v) => !v)}>+ Manual</button>
        ) : null}
      </div>

      {manualOpen && canManageProject ? (
        <form className="card subscriptions-manual-form" onSubmit={handleManualSave}>
          <input placeholder="Nome" value={manualForm.name} onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })} required />
          <input placeholder="Valor mensal" value={manualForm.amount} onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })} required />
          <select value={manualForm.categoryName} onChange={(e) => setManualForm({ ...manualForm, categoryName: e.target.value })}>
            {expenseCats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" min="1" max="31" placeholder="Dia" value={manualForm.day} onChange={(e) => setManualForm({ ...manualForm, day: e.target.value })} />
          <button type="submit" className="submit-btn">Salvar assinatura</button>
        </form>
      ) : null}

      {loading ? (
        <div className="card"><p>Carregando assinaturas…</p></div>
      ) : displayList.length === 0 ? (
        <div className="card"><p>Nenhuma assinatura detectada ainda. Importe extratos ou adicione lançamentos recorrentes.</p></div>
      ) : (
        <div className="subscriptions-grid">
          {displayList.map((sub) => (
            <article key={sub.id} className="card subscription-card">
              <header>
                <h3>{sub.name || sub.merchant}</h3>
                <span className={`subscription-confidence subscription-confidence--${sub.confidence || 'medium'}`}>
                  {CONFIDENCE_LABELS[sub.confidence] || 'Detectada'}
                </span>
              </header>
              <p className="subscription-amount">R$ {formatMoney(sub.averageAmount || sub.amount)} / mês</p>
              <p className="subscription-meta">Anual: R$ {formatMoney((sub.averageAmount || sub.amount) * 12)} • {sub.occurrences?.length || 0} ocorrência(s)</p>
              {sub.nextExpectedDate ? (
                <p className="subscription-meta">Próxima: {new Date(sub.nextExpectedDate).toLocaleDateString('pt-BR')}</p>
              ) : null}
              {sub.source === 'detected' && canManageProject ? (
                <div className="subscription-actions">
                  <button type="button" className="submit-btn" onClick={() => handleConfirm(sub)}>Confirmar</button>
                  <button type="button" className="text-btn" onClick={() => handleIgnore(sub)}>Ignorar</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
