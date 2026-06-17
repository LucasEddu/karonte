export default function BudgetModal({
  open,
  categoryName,
  value,
  onValueChange,
  onClose,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="budget-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Limite para {categoryName}</h3>
          <button type="button" className="chat-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="modal-subtitle">Defina o teto de gastos mensal para esta categoria.</p>
          <div className="budget-input-wrapper">
            <span className="currency-prefix">R$</span>
            <input
              type="number"
              step="0.01"
              placeholder="0,00"
              className="budget-main-input"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              autoFocus
            />
          </div>
          <p className="modal-hint">Digite 0 para remover o limite.</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-confirm" onClick={onConfirm}>Salvar Limite</button>
        </div>
      </div>
    </div>
  );
}
