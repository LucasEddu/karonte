import { formatMoney, parseMoneyInput } from '../../utils/money';

export default function PaymentModal({
  open,
  task,
  mode,
  amountInput,
  parcelasInput,
  saving,
  onModeChange,
  onAmountChange,
  onParcelasInputChange,
  onMoneyInput,
  onClose,
  onConfirm,
}) {
  if (!open || !task) return null;

  const meta = Number(task.metaValue) || 0;
  const parcelas = Number(task.parcelas) || 0;
  const parcelaValue = meta > 0 && parcelas > 0 ? meta / parcelas : 0;
  const parcelasNow = parseInt(parcelasInput, 10) || 0;

  const resetClose = () => {
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={resetClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Registrar pagamento</h2>
          <button type="button" className="close-btn" onClick={resetClose}>✕</button>
        </div>
        <p className="modal-subtitle">
          Abater valor em &quot;{task.title}&quot;. Valor pago até agora: R$ {formatMoney(Number(task.paidAmount) || 0)} de R$ {formatMoney(meta)}.
        </p>
        <div className="form-group">
          <label>Modo de abatimento</label>
          <select value={mode} onChange={(e) => onModeChange(e.target.value)}>
            <option value="valor">Por valor</option>
            <option value="parcelas">Por parcelas</option>
          </select>
        </div>
        <div className="form-group">
          {mode === 'parcelas' ? (
            <>
              <label>Parcelas pagas agora</label>
              <input
                type="number"
                min="1"
                value={parcelasInput}
                onChange={(e) => onParcelasInputChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Ex: 1"
                autoFocus
              />
              {parcelaValue > 0 && parcelasNow > 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Valor abatido: R$ {formatMoney(parcelasNow * parcelaValue)}
                </div>
              ) : (
                parcelas <= 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--danger-color)', marginTop: 4 }}>
                    Esta despesa não tem parcelas definidas.
                  </div>
                ) : null
              )}
            </>
          ) : (
            <>
              <label>Valor a abater (R$)</label>
              <input
                type="text"
                value={amountInput}
                onChange={(e) => onMoneyInput(e, onAmountChange)}
                placeholder="0,00"
                autoFocus
              />
            </>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={resetClose}>Cancelar</button>
          <button
            type="button"
            className="submit-btn"
            onClick={onConfirm}
            disabled={saving || (mode === 'parcelas' ? parcelasNow <= 0 : parseMoneyInput(amountInput) <= 0)}
          >
            {saving ? '...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
