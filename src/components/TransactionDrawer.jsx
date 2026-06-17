import React from 'react';

export default function TransactionDrawer({
  open,
  onClose,
  onSubmit,
  isEdit = false,
  transactionDate = '',
  setTransactionDate,
  description,
  setDescription,
  amount,
  handleAmountChange,
  type,
  setType,
  category,
  setCategory,
  isRecurring,
  setIsRecurring,
  isInstallment,
  setIsInstallment,
  installmentTotal,
  setInstallmentTotal,
  installmentCurrent,
  setInstallmentCurrent,
  paymentMethod,
  setPaymentMethod,
  selectedCardId,
  setSelectedCardId,
  expenseCategories,
  incomeCategories,
  creditCards,
  showCatManager,
  setShowCatManager,
  customCategories,
  handleRemoveCustomCategory,
  newCatName,
  setNewCatName,
  newCatType,
  setNewCatType,
  newCatClassification,
  setNewCatClassification,
  handleAddCustomCategory,
  catSaving,
  canEditCategories = true,
}) {
  if (!open) return null;

  const totalInstallments = parseInt(installmentTotal, 10) || 2;
  const installmentOptions = Array.from({ length: 23 }, (_, i) => i + 2);
  const currentInstallmentOptions = Array.from({ length: totalInstallments }, (_, i) => i + 1);

  const resetInstallmentFields = () => {
    setIsInstallment(false);
    setInstallmentTotal('2');
    setInstallmentCurrent('1');
  };

  const handleTypeChange = (value) => {
    setType(value);
    setCategory('');
    setIsRecurring(false);
    resetInstallmentFields();
  };

  const handleInstallmentToggle = (checked) => {
    setIsInstallment(checked);
    if (checked) {
      setIsRecurring(false);
      if (!installmentTotal || parseInt(installmentTotal, 10) < 2) setInstallmentTotal('2');
      if (!installmentCurrent || parseInt(installmentCurrent, 10) < 1) setInstallmentCurrent('1');
    } else {
      setInstallmentTotal('2');
      setInstallmentCurrent('1');
    }
  };

  const handleInstallmentTotalChange = (value) => {
    setInstallmentTotal(value);
    const total = parseInt(value, 10) || 2;
    const current = parseInt(installmentCurrent, 10) || 1;
    if (current > total) setInstallmentCurrent(String(total));
  };

  return (
    <div className="transaction-drawer-overlay" onClick={onClose}>
      <aside className="transaction-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="transaction-drawer-header">
          <h3>{isEdit ? 'Editar lançamento' : 'Novo lançamento'}</h3>
          <button type="button" className="chat-close-btn" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="transaction-drawer-body">
          <form onSubmit={onSubmit} className="transaction-drawer-form">
            <div className="form-group">
              <label>Data</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Descrição</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Conta de Luz" required />
            </div>

            <div className="form-group">
              <label>{isInstallment && type === 'expense' ? 'Valor da parcela (R$)' : 'Valor (R$)'}</label>
              <input type="text" value={amount} onChange={handleAmountChange} placeholder="0,00" required />
              {isInstallment && type === 'expense' && amount && (
                <span className="installment-hint">
                  Total da compra: R$ {(() => {
                    const parcel = parseFloat(String(amount).replace(/\./g, '').replace(',', '.'));
                    const total = parseInt(installmentTotal, 10) || 0;
                    if (Number.isNaN(parcel) || total < 2) return '—';
                    return (parcel * total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  })()}
                </span>
              )}
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label>Tipo</label>
                <select value={type} onChange={(e) => handleTypeChange(e.target.value)}>
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </div>

              <div className="form-group">
                <label>Categoria</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} required>
                  <option value="" disabled>Selecione</option>
                  {(type === 'expense' ? expenseCategories : incomeCategories).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {type === 'expense' && (
              <>
                <div className="form-group">
                  <label>Forma de Pagamento</label>
                  <select value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); if (e.target.value !== 'card') setSelectedCardId(''); }}>
                    <option value="avulsa">Compra Avulsa</option>
                    <option value="card">Cartão de Crédito</option>
                  </select>
                </div>

                {paymentMethod === 'card' && (
                  <div className="form-group">
                    <label>Escolher Cartão</label>
                    <select value={selectedCardId} onChange={(e) => setSelectedCardId(e.target.value)} required>
                      <option value="" disabled>Selecione o cartão</option>
                      {creditCards.length === 0 ? (
                        <option value="" disabled>Cadastre cartões em Orçamentos</option>
                      ) : (
                        creditCards.map(card => (
                          <option key={card.id} value={card.id}>{card.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                <div className="recurring-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isInstallment}
                      onChange={e => handleInstallmentToggle(e.target.checked)}
                    />
                    <span>Compra parcelada</span>
                  </label>
                </div>

                {isInstallment && (
                  <>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Total de parcelas</label>
                        <select value={installmentTotal} onChange={e => handleInstallmentTotalChange(e.target.value)}>
                          {installmentOptions.map(n => (
                            <option key={n} value={String(n)}>{n}x</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Parcela atual</label>
                        <select value={installmentCurrent} onChange={e => setInstallmentCurrent(e.target.value)}>
                          {currentInstallmentOptions.map(n => (
                            <option key={n} value={String(n)}>{n}ª parcela</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="installment-hint installment-hint--block">
                      Informe o valor de <strong>uma parcela</strong>. Este lançamento registra a parcela {installmentCurrent} de {installmentTotal}.
                    </p>
                  </>
                )}

                <div className="recurring-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      disabled={isInstallment}
                      onChange={e => setIsRecurring(e.target.checked)}
                    />
                    <span>Repetir mensalmente</span>
                  </label>
                </div>
              </>
            )}

            <button type="submit" className="submit-btn transaction-drawer-submit">
              {isEdit ? 'Salvar alterações' : 'Registrar lançamento'}
            </button>
          </form>

          {canEditCategories ? (
          <>
          <div className="cat-manager-toggle" onClick={() => setShowCatManager(!showCatManager)}>
            <span>{showCatManager ? '▾' : '▸'} Gerenciar categorias personalizadas</span>
          </div>

          {showCatManager && (
            <div className="cat-manager-content">
              <div className="cat-list-wrapper">
                <div>
                  <h4>Despesas</h4>
                  <div className="cat-chips">
                    {customCategories.expense.length === 0 ? <span className="no-cats">Nenhuma personalizada</span> : null}
                    {customCategories.expense.map(cat => {
                      const label = typeof cat === 'string' ? cat : cat.name;
                      return (
                      <span key={label} className="cat-chip">
                        <span>{label}</span> <button type="button" onClick={() => handleRemoveCustomCategory(label, 'expense')}>×</button>
                      </span>
                    );})}
                  </div>
                </div>
                <div style={{ marginTop: 15 }}>
                  <h4>Receitas</h4>
                  <div className="cat-chips">
                    {customCategories.income.length === 0 ? <span className="no-cats">Nenhuma personalizada</span> : null}
                    {customCategories.income.map(cat => {
                      const label = typeof cat === 'string' ? cat : cat.name;
                      return (
                      <span key={label} className="cat-chip">
                        <span>{label}</span> <button type="button" onClick={() => handleRemoveCustomCategory(label, 'income')}>×</button>
                      </span>
                    );})}
                  </div>
                </div>
              </div>

              <div className="cat-add-form">
                <input
                  type="text"
                  placeholder="Nome da categoria..."
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleAddCustomCategory()}
                />
                <select value={newCatType} onChange={e => setNewCatType(e.target.value)}>
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
                {newCatType === 'expense' && (
                  <div className="cat-classify-group">
                    <label>Classificar (50-30-20):</label>
                    <select value={newCatClassification} onChange={e => setNewCatClassification(e.target.value)}>
                      <option value="needs">Necessidades (50%)</option>
                      <option value="wants">Desejos (30%)</option>
                      <option value="savings">Poupança/Investimento (20%)</option>
                    </select>
                  </div>
                )}
                <button type="button" onClick={handleAddCustomCategory} disabled={catSaving || !newCatName.trim()}>
                  {catSaving ? '...' : '+'}
                </button>
              </div>
            </div>
          )}
          </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
