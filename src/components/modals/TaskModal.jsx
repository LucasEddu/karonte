import { formatMoney, parseMoneyInput } from '../../utils/money';
import { formatRelativeTime } from '../../utils/activityLog.js';

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
  comments = [],
  commentInput = '',
  commentSaving = false,
  canAddComments = true,
  currentUserId,
  onCommentInputChange,
  onAddComment,
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
  const sortedComments = [...comments].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  );

  const handleCommentKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onAddComment?.();
    }
  };

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
        <div className="task-comments-section">
          <div className="task-comments-header">
            <label>Comentários</label>
            {sortedComments.length > 0 ? (
              <span className="task-comments-count">{sortedComments.length}</span>
            ) : null}
          </div>
          {!isEdit ? (
            <p className="task-comments-hint">Salve a tarefa para adicionar comentários.</p>
          ) : (
            <>
              {sortedComments.length > 0 ? (
                <ul className="task-comments-list">
                  {sortedComments.map((comment) => (
                    <li key={comment.id} className="task-comment-item">
                      <p className="task-comment-text">{comment.text}</p>
                      <span className="task-comment-meta">
                        {comment.authorName}
                        {comment.authorUid === currentUserId ? ' (você)' : ''}
                        {' • '}
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="task-comments-hint">Nenhum comentário ainda.</p>
              )}
              {canAddComments ? (
                <div className="task-comment-compose">
                  <textarea
                    value={commentInput}
                    onChange={(e) => onCommentInputChange?.(e.target.value)}
                    onKeyDown={handleCommentKeyDown}
                    placeholder="Escreva um comentário…"
                    rows={2}
                    disabled={commentSaving}
                  />
                  <button
                    type="button"
                    className="submit-btn task-comment-submit"
                    onClick={onAddComment}
                    disabled={commentSaving || !commentInput.trim()}
                  >
                    {commentSaving ? '...' : 'Comentar'}
                  </button>
                </div>
              ) : (
                <p className="task-comments-hint">Você pode visualizar, mas não adicionar comentários neste projeto.</p>
              )}
            </>
          )}
        </div>
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
