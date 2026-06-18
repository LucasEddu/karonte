/**
 * Reconstrói lotes a partir de transações quando o documento em importBatches
 * não existe (importação anterior ao histórico ou falha ao salvar o lote).
 */
export const reconstructBatchesFromTransactions = (transactions = [], scopeProjectId = undefined) => {
  const groups = {};

  for (const tx of transactions) {
    if (!tx.importBatchId) continue;
    if (tx.source !== 'statement_import' && tx.source !== 'invoice_import' && tx.source !== 'statement_pdf') {
      continue;
    }

    const txProjectId = tx.projectId || null;
    if (scopeProjectId !== undefined) {
      const scopeIsGeral = scopeProjectId === null;
      const txIsGeral = !txProjectId || txProjectId === 'geral';
      if (scopeIsGeral && !txIsGeral) continue;
      if (!scopeIsGeral && txProjectId !== scopeProjectId) continue;
    }

    const batchId = tx.importBatchId;
    if (!groups[batchId]) {
      groups[batchId] = {
        id: batchId,
        type: tx.source === 'invoice_import' ? 'invoice' : 'statement',
        importedAt: tx.importedAt || tx.createdAt,
        createdAt: tx.createdAt,
        status: 'completed',
        projectId: txProjectId,
        fileNames: [],
        counts: { detected: 0, imported: 0, ignored: 0, failed: 0, duplicates: 0 },
        importedTransactionIds: [],
        skippedRows: [],
        failedRows: [],
        _reconstructed: true,
      };
    }

    groups[batchId].importedTransactionIds.push(tx.id);
    groups[batchId].counts.imported += 1;
    groups[batchId].counts.detected = groups[batchId].counts.imported;
  }

  return Object.values(groups);
};

export const mergeImportBatches = (firestoreBatches = [], reconstructed = []) => {
  const byId = new Map();

  for (const batch of firestoreBatches) {
    byId.set(batch.id, batch);
  }

  for (const batch of reconstructed) {
    if (!byId.has(batch.id)) {
      byId.set(batch.id, batch);
    }
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.importedAt || b.createdAt) - new Date(a.importedAt || a.createdAt)
  );
};

export const getScopeLabel = (activeProjectId, activeProjectName) => {
  if (activeProjectId) return activeProjectName || 'Projeto ativo';
  return 'Geral (pessoal)';
};
