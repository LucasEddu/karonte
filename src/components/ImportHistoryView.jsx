import React, { useEffect, useState } from 'react';
import { getImportBatchesForScope, getImportBatch } from '../services/importBatchService';
import { getTransactionsByImportBatchId } from '../services/transactionService';

const TYPE_LABELS = {
  statement: 'Extrato',
  invoice: 'Nota fiscal',
};

const STATUS_LABELS = {
  completed: 'Concluída',
  undone: 'Desfeita',
  partial: 'Parcial',
};

const REASON_LABELS = {
  duplicate: 'Duplicada',
  not_selected: 'Não selecionada',
  'data ou valor inválido': 'Dados inválidos',
};

function formatReason(reason) {
  return REASON_LABELS[reason] || reason || '—';
}

export default function ImportHistoryView({
  currentUser,
  activeProjectId,
  canDeleteInProject = true,
  onUndoImport,
  formatMoney,
}) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [importedTxs, setImportedTxs] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState('');

  const loadBatches = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    try {
      const rows = await getImportBatchesForScope(currentUser.uid, activeProjectId);
      setBatches(rows);
    } catch (e) {
      setError(e.message || 'Erro ao carregar histórico.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [currentUser?.uid, activeProjectId]);

  const openDetail = async (batchId) => {
    setSelectedId(batchId);
    setLoadingDetail(true);
    setError('');
    try {
      const batch = await getImportBatch(batchId);
      setDetail(batch);
      const txs = await getTransactionsByImportBatchId(batchId);
      setImportedTxs(txs);
    } catch (e) {
      setError(e.message || 'Erro ao carregar detalhes.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setImportedTxs([]);
  };

  const handleUndo = async () => {
    if (!detail || !canDeleteInProject || undoing) return;
    const ids = detail.importedTransactionIds || importedTxs.map((t) => t.id);
    if (!ids.length) return;
    if (!window.confirm(`Desfazer importação de ${ids.length} lançamento(s)?`)) return;

    setUndoing(true);
    setError('');
    try {
      await onUndoImport({
        importBatchId: detail.id,
        importedIds: ids,
        count: ids.length,
      });
      closeDetail();
      await loadBatches();
    } catch (e) {
      setError(e.message || 'Erro ao desfazer.');
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="import-history">
      <div className="import-intro card">
        <h3>Histórico de importações</h3>
        <p>Veja o que foi importado, o que ficou de fora e desfaça lotes anteriores.</p>
      </div>

      {error ? <div className="import-alert import-alert--error">{error}</div> : null}

      {loading ? (
        <div className="card import-history-loading">Carregando histórico…</div>
      ) : batches.length === 0 ? (
        <div className="card import-history-empty">Nenhuma importação registrada ainda.</div>
      ) : (
        <div className="import-history-list card">
          <ul>
            {batches.map((batch) => (
              <li key={batch.id} className="import-history-item">
                <button type="button" className="import-history-item-btn" onClick={() => openDetail(batch.id)}>
                  <div className="import-history-item-main">
                    <strong>{TYPE_LABELS[batch.type] || batch.type}</strong>
                    <span className="import-history-date">
                      {new Date(batch.importedAt || batch.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="import-history-item-meta">
                    <span>{batch.counts?.imported ?? 0} importada(s)</span>
                    <span>{batch.counts?.ignored ?? 0} ignorada(s)</span>
                    <span>{batch.counts?.failed ?? 0} falha(s)</span>
                    <span className={`import-history-status import-history-status--${batch.status}`}>
                      {STATUS_LABELS[batch.status] || batch.status}
                    </span>
                  </div>
                  {batch.fileNames?.length ? (
                    <p className="import-hint">{batch.fileNames.join(', ')}</p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedId ? (
        <div className="import-history-detail card">
          <div className="import-history-detail-header">
            <h4>Detalhes da importação</h4>
            <button type="button" className="text-btn" onClick={closeDetail}>Fechar</button>
          </div>

          {loadingDetail || !detail ? (
            <p>Carregando…</p>
          ) : (
            <>
              <div className="import-history-stats">
                <span><strong>{detail.counts?.detected ?? 0}</strong> detectadas</span>
                <span><strong>{detail.counts?.imported ?? 0}</strong> importadas</span>
                <span><strong>{detail.counts?.ignored ?? 0}</strong> ignoradas</span>
                <span><strong>{detail.counts?.failed ?? 0}</strong> falhas</span>
              </div>

              <div className="import-history-columns">
                <section>
                  <h5>Importadas ({importedTxs.length})</h5>
                  <ul className="import-history-rows">
                    {importedTxs.length === 0 ? (
                      <li className="import-hint">Nenhum lançamento encontrado.</li>
                    ) : (
                      importedTxs.map((tx) => (
                        <li key={tx.id}>
                          <span>{tx.displayDate || String(tx.date || '').slice(0, 10)}</span>
                          <span>{tx.description}</span>
                          <span>R$ {formatMoney(tx.amount)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </section>

                <section>
                  <h5>Não importadas ({(detail.skippedRows?.length || 0) + (detail.failedRows?.length || 0)})</h5>
                  <ul className="import-history-rows">
                    {(detail.skippedRows || []).map((row, idx) => (
                      <li key={`s-${idx}`}>
                        <span>{row.description}</span>
                        <span>R$ {formatMoney(row.amount)}</span>
                        <span className="import-history-reason">{formatReason(row.reason)}</span>
                      </li>
                    ))}
                    {(detail.failedRows || []).map((row, idx) => (
                      <li key={`f-${idx}`} className="import-history-row--failed">
                        <span>{row.description}</span>
                        <span>{formatReason(row.reason)}</span>
                      </li>
                    ))}
                    {!detail.skippedRows?.length && !detail.failedRows?.length ? (
                      <li className="import-hint">Tudo foi importado.</li>
                    ) : null}
                  </ul>
                </section>
              </div>

              {detail.status === 'completed' && canDeleteInProject && importedTxs.length > 0 ? (
                <div className="import-undo-row">
                  <button type="button" className="text-btn import-undo-btn" onClick={handleUndo} disabled={undoing}>
                    {undoing ? 'Desfazendo…' : `↩ Desfazer importação (${importedTxs.length})`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
