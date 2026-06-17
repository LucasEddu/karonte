import { formatMoney, parseMoneyInput } from '../../utils/money';

export default function TaskModal({
  open,
  isEdit,
  title,
  type,
  metaValue,
  parcelaValue,
  parcelas,
  parcelasPaid,
  saving,
  onTitleChange,
  onTypeChange,
  onMetaValueChange,
  onParcelaValueChange,
  onParcelasChange,
  onParcelasPaidChange,
  onMoneyInput,
  onClose,
  onSave,
}) {
  if (!open) return null;

  const parcelasNum = parseInt(parcelas, 10) || 0;
  const parcelaMoney = parseMoneyInput(parcelaValue);
  const parcelasPaidNum = parseInt(parcelasPaid, 10) || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-task" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Editar tarefa' : 'Nova tarefa'}</h2>
          <button type="button" className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="form-group">
          <label>Descrição da tarefa</label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSave(); } }}
            placeholder="Ex: Conta de luz, Empréstimo"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Tipo</label>
          <select value={type} onChange={(e) => onTypeChange(e.target.value)}>
            <option value="tarefa">Tarefa</option>
            <option value="despesa">Despesa / Dívida</option>
          </select>
        </div>
        {type === 'despesa' && (
          <>
            <div className="form-group">
              <label>Valor total (R$)</label>
              <input
                type="text"
                value={metaValue}
                onChange={(e) => onMoneyInput(e, onMetaValueChange)}
                placeholder="0,00"
              />
            </div>
            <div className="form-group">
              <label>Valor da parcela (R$) (opcional)</label>
              <input
                type="text"
                value={parcelaValue}
                onChange={(e) => onMoneyInput(e, onParcelaValueChange)}
                placeholder="0,00"
              />
              {parcelasNum > 0 && parcelaMoney > 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Total calculado: R$ {formatMoney(parcelasNum * parcelaMoney)}
                </div>
              ) : null}
            </div>
            <div className="form-group">
              <label>Número de parcelas (opcional)</label>
              <input
                type="number"
                min="1"
                value={parcelas}
                onChange={(e) => onParcelasChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Ex: 12"
              />
            </div>
            <div className="form-group">
              <label>Parcelas já pagas (opcional)</label>
              <input
                type="number"
                min="0"
                value={parcelasPaid}
                onChange={(e) => onParcelasPaidChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Ex: 3"
              />
              {parcelaMoney > 0 && parcelasPaidNum > 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Abatimento calculado: R$ {formatMoney(Math.min(parcelasPaidNum, parcelasNum) * parcelaMoney)}
                </div>
              ) : null}
            </div>
          </>
        )}
        {type === 'tarefa' && (
          <div className="form-group">
            <label>Valor meta (R$), opcional</label>
            <input
              type="text"
              value={metaValue}
              onChange={(e) => onMoneyInput(e, onMetaValueChange)}
              placeholder="0,00"
            />
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="submit-btn" onClick={onSave} disabled={saving || !title.trim()}>
            {saving ? '...' : (isEdit ? 'Salvar' : 'Adicionar')}
          </button>
        </div>
      </div>
    </div>
  );
}
