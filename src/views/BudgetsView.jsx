import { getTransactionCategoryLabel } from '../utils/financeCalculations';

export default function BudgetsView({
  budgetsSubTab,
  onSubTabChange,
  expenseCategories,
  filteredTransactions,
  formatMoney,
  getCategoryBudgetInfo,
  getCatFill,
  getCatTrack,
  onBudgetChange,
  creditCards,
  transactions,
  getCardInvoiceStats,
  onDeleteCreditCard,
  newCardName,
  newCardLimit,
  newCardClosingDay,
  newCardDueDay,
  cardSavingActive,
  onNewCardNameChange,
  onNewCardLimitChange,
  onNewCardClosingDayChange,
  onNewCardDueDayChange,
  onCreateCreditCard,
  onTaskMoneyInput,
}) {
  return (
    <main className="main-content">
      <div className="sub-tab-nav" style={{ display: 'flex', gap: 15, marginBottom: 15, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
        <button
          type="button"
          className={`sub-tab-item ${budgetsSubTab === 'categories' ? 'active' : ''}`}
          onClick={() => onSubTabChange('categories')}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            color: budgetsSubTab === 'categories' ? 'var(--text-highlight)' : 'var(--text-tertiary)',
            borderBottom: budgetsSubTab === 'categories' ? '2px solid var(--text-highlight)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          Limites Orçamentários
        </button>
        <button
          type="button"
          className={`sub-tab-item ${budgetsSubTab === 'cards' ? 'active' : ''}`}
          onClick={() => onSubTabChange('cards')}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            color: budgetsSubTab === 'cards' ? 'var(--text-highlight)' : 'var(--text-tertiary)',
            borderBottom: budgetsSubTab === 'cards' ? '2px solid var(--text-highlight)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          Cartões de Crédito
        </button>
      </div>

      {budgetsSubTab === 'categories' && (
        <div className="card list-section">
          <div className="list-header">
            <h2>Gestão de Limite Mensal (Orçamento)</h2>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: '1rem' }}>
            Defina um teto de gastos para alertar quando estiver próximo ao limite. Clique sobre a categoria para editar.
          </div>
          <div className="history-list">
            {expenseCategories.map((cat) => {
              const catSpent = filteredTransactions
                .filter((t) => t.type === 'expense' && getTransactionCategoryLabel(t) === cat)
                .reduce((acc, curr) => acc + curr.amount, 0);
              const info = getCategoryBudgetInfo(cat, catSpent);
              const hasBudget = info.limit > 0;
              const fillCol = info.isOver100 ? 'var(--danger-color)' : getCatFill(0, cat);
              const trackCol = getCatTrack(cat);
              return (
                <div key={cat} className="history-item" onClick={() => onBudgetChange(cat)} style={{ cursor: 'pointer' }}>
                  <div className="t-details">
                    <span className="t-name">{cat}</span>
                    <span className="t-meta">
                      {hasBudget ? `Gasto: R$ ${formatMoney(catSpent)} de R$ ${formatMoney(info.limit)}` : 'Sem Limite (Clique para definir)'}
                    </span>
                  </div>
                  {hasBudget ? (
                    <div style={{ width: 100, marginRight: 15 }}>
                      <div className="progress-bg" style={{ backgroundColor: trackCol }}>
                        <div className="progress-fill" style={{ width: `${info.pct}%`, backgroundColor: fillCol }} />
                      </div>
                    </div>
                  ) : null}
                  <div className="t-amount" style={{ color: info.isOver80 ? 'var(--danger-color)' : 'var(--text-tertiary)' }}>
                    {hasBudget ? `${info.pct.toFixed(0)}%` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {budgetsSubTab === 'cards' && (
        <div className="card-manager-grid">
          <div className="card list-section" style={{ margin: 0 }}>
            <div className="list-header">
              <h2>Meus Cartões de Crédito</h2>
              <span className="link-all" style={{ color: 'var(--text-tertiary)' }}>{creditCards.length} cadastrados</span>
            </div>
            <div className="history-list" style={{ marginTop: 15 }}>
              {creditCards.length === 0 ? (
                <div style={{ fontSize: 11, padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  Nenhum cartão cadastrado. Use o formulário ao lado para cadastrar.
                </div>
              ) : (
                creditCards.map((card) => {
                  const stats = getCardInvoiceStats(card, transactions);
                  const progressPct = Math.min(stats.percentUsed, 100);
                  let colorClass = 'safe';
                  if (stats.percentUsed > 100) colorClass = 'danger';
                  else if (stats.percentUsed > 80) colorClass = 'warning';
                  return (
                    <div key={card.id} className="history-item" style={{ cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 1rem' }}>
                      <div className="t-details" style={{ flex: 1 }}>
                        <span className="t-name" style={{ fontSize: 13, fontWeight: 600 }}>💳 {card.name}</span>
                        <span className="t-meta" style={{ fontSize: 10, marginTop: 4 }}>
                          Vencimento: Dia {card.dueDay} • Fechamento: Dia {card.closingDay}
                        </span>
                        <span className="t-meta" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                          Fatura Atual: <strong style={{ color: 'var(--text-primary)' }}>R$ {formatMoney(stats.invoiceAmount)}</strong>
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, marginRight: 15, width: 140 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textAlign: 'right' }}>
                          Disponível: R$ {formatMoney(stats.availableLimit)} / R$ {formatMoney(card.limit)}
                        </div>
                        <div className="budget-progress-track" style={{ width: '100%', height: 6 }}>
                          <div className={`budget-progress-fill ${colorClass}`} style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="delete-btn-subtle"
                        onClick={() => onDeleteCreditCard(card.id)}
                        title="Remover Cartão"
                        style={{ fontSize: 16, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0 5px' }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="card form-section" style={{ margin: 0 }}>
            <div className="card-title" style={{ fontSize: 14, fontWeight: 700, marginBottom: 15 }}>Cadastrar Novo Cartão</div>
            <form onSubmit={onCreateCreditCard} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Nome do Cartão</label>
                <input
                  type="text"
                  value={newCardName}
                  onChange={(e) => onNewCardNameChange(e.target.value)}
                  placeholder="Ex: Nubank, Visa"
                  required
                  style={{ fontSize: 11, padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Limite Total (R$)</label>
                <input
                  type="text"
                  value={newCardLimit}
                  onChange={(e) => onTaskMoneyInput(e, onNewCardLimitChange)}
                  placeholder="0,00"
                  required
                  style={{ fontSize: 11, padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Dia de Fechamento</label>
                <select
                  value={newCardClosingDay}
                  onChange={(e) => onNewCardClosingDayChange(e.target.value)}
                  style={{ fontSize: 11, padding: '8px', borderRadius: 6, border: '0.5px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>Dia {day}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Dia de Vencimento</label>
                <select
                  value={newCardDueDay}
                  onChange={(e) => onNewCardDueDayChange(e.target.value)}
                  style={{ fontSize: 11, padding: '8px', borderRadius: 6, border: '0.5px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>Dia {day}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="submit-btn" disabled={cardSavingActive || !newCardName.trim()} style={{ marginTop: 10, alignSelf: 'stretch', padding: '10px' }}>
                {cardSavingActive ? 'Adicionando...' : 'Cadastrar Cartão'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
