import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  validateStatementFile,
  processStatementFiles,
  getImportErrorMessage,
  MAX_FILE_SIZE_BYTES,
  ACCEPTED_EXTENSIONS,
} from '../services/statementImportService';
import { markDuplicates, createTransactionHash, findDuplicateMatch } from '../utils/statementParser';

const STATUS_LABELS = {
  waiting: 'Aguardando',
  processing: 'Processando…',
  done: 'Concluído',
  error: 'Erro',
};

function ImportProgressBar({ title, current, total, detail }) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((current / safeTotal) * 100));

  return (
    <div
      className="import-progress"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={title}
    >
      <div className="import-progress-header">
        <span className="import-progress-title">{title}</span>
        <span className="import-progress-percent">{percent}%</span>
      </div>
      <div className="progress-bg import-progress-bg">
        <div className="progress-fill import-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="import-progress-meta">
        {current} de {total}
        {detail ? ` • ${detail}` : ''}
      </p>
    </div>
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function toDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromDateInputValue(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function StatementImportView({
  currentUser,
  activeProjectId,
  activeProject,
  transactions = [],
  expenseCategories = [],
  incomeCategories = [],
  customCategories = { expense: [], income: [] },
  canAddToProject = true,
  onImportTransactions,
  onImportBatchComplete,
  onUndoImport,
  formatMoney,
  selectedMonth,
  selectedYear,
  embedded = false,
}) {
  const fileInputRef = useRef(null);
  const [fileEntries, setFileEntries] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [importBatchId, setImportBatchId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [summary, setSummary] = useState(null);
  const [globalError, setGlobalError] = useState('');
  const [isUndoing, setIsUndoing] = useState(false);
  const [processProgress, setProcessProgress] = useState(null);
  const [importProgress, setImportProgress] = useState(null);

  const addFiles = useCallback((fileList) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    setSummary(null);
    setGlobalError('');

    const newEntries = [];
    const errors = [];

    for (const file of incoming) {
      const validation = validateStatementFile(file);
      if (!validation.valid) {
        errors.push(`${file.name}: ${getImportErrorMessage(validation.error)}`);
        continue;
      }
      const duplicate = fileEntries.some((e) => e.name === file.name && e.size === file.size);
      if (duplicate) continue;

      newEntries.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        status: 'waiting',
        error: null,
      });
    }

    if (errors.length) setGlobalError(errors.join(' '));
    if (newEntries.length) setFileEntries((prev) => [...prev, ...newEntries]);
  }, [fileEntries]);

  const handleFileInput = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (id) => {
    setFileEntries((prev) => prev.filter((f) => f.id !== id));
  };

  const handleProcess = async () => {
    if (fileEntries.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setSummary(null);
    setGlobalError('');
    setParsedRows([]);
    setProcessProgress({ current: 0, total: fileEntries.length, detail: 'Iniciando…' });

    const batchId = crypto.randomUUID();
    setImportBatchId(batchId);

    setFileEntries((prev) => prev.map((f) => ({ ...f, status: 'waiting', error: null })));

    const files = fileEntries.map((e) => e.file);

    try {
      const referenceYear = selectedYear || new Date().getFullYear();
      const results = await processStatementFiles(files, {
        parseOptions: { customCategories, referenceYear },
        onFileProgress: (index, status, fileName, errorMsg) => {
          setFileEntries((prev) =>
            prev.map((entry, i) => {
              if (i !== index) return entry;
              return {
                ...entry,
                status,
                error: status === 'error' ? errorMsg : null,
              };
            })
          );

          const completed =
            status === 'done' || status === 'error'
              ? index + 1
              : index + 0.5;

          setProcessProgress({
            current: completed,
            total: files.length,
            detail:
              status === 'processing'
                ? `Processando ${fileName}…`
                : status === 'error'
                  ? `Erro em ${fileName}`
                  : `Concluído ${fileName}`,
          });
        },
      });

      const flat = [];
      for (const result of results) {
        for (const tx of result.transactions) {
          flat.push({
            id: crypto.randomUUID(),
            ...tx,
            sourceFileName: result.fileName,
            selected: true,
            isDuplicate: false,
          });
        }
      }

      const withDupes = markDuplicates(flat, transactions);
      setParsedRows(withDupes);

      const successCount = results.filter((r) => r.status === 'done').length;
      const errorCount = results.filter((r) => r.status === 'error').length;

      if (flat.length === 0) {
        setGlobalError(
          errorCount > 0
            ? 'Nenhuma transação detectada. Verifique os erros por arquivo acima.'
            : 'Nenhuma transação detectada nos arquivos selecionados.'
        );
      } else if (errorCount > 0) {
        setGlobalError(`${successCount} arquivo(s) processado(s), ${errorCount} com erro.`);
      }
    } catch (err) {
      setGlobalError(err.message || 'Erro ao processar os arquivos.');
    } finally {
      setIsProcessing(false);
      setProcessProgress(null);
    }
  };

  const handleClear = () => {
    setFileEntries([]);
    setParsedRows([]);
    setImportBatchId(null);
    setSummary(null);
    setGlobalError('');
    setHideDuplicates(false);
    setProcessProgress(null);
    setImportProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateRow = (id, patch) => {
    setParsedRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, ...patch };
        if (patch.description !== undefined || patch.amount !== undefined || patch.date !== undefined) {
          const match = findDuplicateMatch(updated, transactions);
          updated.duplicateHash = match.duplicateHash;
          updated.isDuplicate = match.isDuplicate;
          updated.isPossibleDuplicate = match.isPossibleDuplicate;
        }
        return updated;
      })
    );
  };

  const toggleRow = (id) => {
    setParsedRows((prev) => prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)));
  };

  const toggleAll = (selected) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (hideDuplicates && (r.isDuplicate || r.isPossibleDuplicate)) return r;
        return { ...r, selected };
      })
    );
  };

  const visibleRows = useMemo(() => {
    if (!hideDuplicates) return parsedRows;
    return parsedRows.filter((r) => !r.isDuplicate && !r.isPossibleDuplicate);
  }, [parsedRows, hideDuplicates]);

  const selectedRows = useMemo(
    () => parsedRows.filter((r) => r.selected),
    [parsedRows]
  );

  const duplicateCount = useMemo(
    () => parsedRows.filter((r) => r.isDuplicate || r.isPossibleDuplicate).length,
    [parsedRows]
  );

  const handleImport = async () => {
    if (!canAddToProject) {
      setGlobalError('Você não tem permissão para adicionar lançamentos neste projeto.');
      return;
    }
    if (!currentUser) return;
    if (selectedRows.length === 0) {
      setGlobalError('Selecione ao menos uma transação para importar.');
      return;
    }

    setIsImporting(true);
    setGlobalError('');
    setImportProgress({ current: 0, total: selectedRows.length, detail: 'Salvando transações…' });

    const importedAt = new Date().toISOString();
    const createdByName =
      currentUser.username || currentUser.displayName || currentUser.email || currentUser.uid;

    let imported = 0;
    let failed = 0;
    const errors = [];
    const importedIds = [];
    const failedRows = [];
    const total = selectedRows.length;

    for (let i = 0; i < selectedRows.length; i += 1) {
      const row = selectedRows[i];
      const dateObj = row.date instanceof Date ? row.date : new Date(row.date);
      const amount = parseFloat(String(row.amount).replace(',', '.'));
      if (!dateObj || Number.isNaN(dateObj.getTime()) || Number.isNaN(amount) || amount <= 0) {
        failed += 1;
        failedRows.push({
          description: row.description,
          amount,
          reason: 'data ou valor inválido',
        });
        errors.push(`"${row.description}": data ou valor inválido`);
      } else {
        try {
          const saved = await onImportTransactions({
            description: row.description.trim(),
            amount,
            type: row.type,
            category: row.category,
            date: dateObj.toISOString(),
            displayDate: dateObj.toLocaleDateString('pt-BR'),
            paymentMethod: 'avulsa',
            source: 'statement_import',
            importBatchId,
            importedAt,
            rawDescription: row.rawDescription || row.description,
            duplicateHash: row.duplicateHash || createTransactionHash(row),
            createdByName,
          });
          if (saved?.id) importedIds.push(saved.id);
          imported += 1;
        } catch (e) {
          failed += 1;
          failedRows.push({
            description: row.description,
            amount,
            reason: e.message || 'erro ao salvar',
          });
          errors.push(`"${row.description}": ${e.message || 'erro ao salvar'}`);
        }
      }

      const processed = i + 1;
      if (processed === total || processed % 10 === 0) {
        setImportProgress({
          current: processed,
          total,
          detail: `${imported} importada(s), ${failed} falha(s)`,
        });
      }
    }

    const ignored = parsedRows.length - selectedRows.length;
    const dupes = duplicateCount;
    const skippedRows = parsedRows
      .filter((r) => !r.selected)
      .map((r) => ({
        description: r.description,
        amount: r.amount,
        date: r.date instanceof Date ? r.date.toISOString() : r.date,
        reason: r.isDuplicate || r.isPossibleDuplicate ? 'duplicate' : 'not_selected',
      }));

    setSummary({
      imported,
      ignored,
      duplicates: dupes,
      failed,
      errors,
      importBatchId,
      importedIds,
    });

    if (onImportBatchComplete && importBatchId) {
      onImportBatchComplete({
        importBatchId,
        type: 'statement',
        fileNames: fileEntries.map((f) => f.name),
        importedAt,
        counts: {
          detected: parsedRows.length,
          imported,
          failed,
          ignored,
          duplicates: dupes,
        },
        importedTransactionIds: importedIds,
        failedRows,
        skippedRows,
        createdByName,
      });
    }

    setFileEntries([]);
    setParsedRows([]);
    setImportBatchId(null);
    setHideDuplicates(false);
    setImportProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsImporting(false);
  };

  const handleUndoLastImport = async () => {
    if (!summary?.importedIds?.length || !onUndoImport || isUndoing) return;
    if (!window.confirm(`Desfazer importação de ${summary.importedIds.length} transação(ões)? Esta ação não pode ser revertida.`)) {
      return;
    }
    setIsUndoing(true);
    setGlobalError('');
    try {
      await onUndoImport({
        importBatchId: summary.importBatchId,
        importedIds: summary.importedIds,
        count: summary.imported,
      });
      setSummary(null);
    } catch (err) {
      setGlobalError(err.message || 'Erro ao desfazer importação.');
    } finally {
      setIsUndoing(false);
    }
  };

  if (!canAddToProject) {
    const denied = (
      <div className="import-permission-denied card">
        <h3>Importação indisponível</h3>
        <p>Você não tem permissão para adicionar lançamentos neste projeto.</p>
      </div>
    );
    return embedded ? denied : <main className="import-view main-content">{denied}</main>;
  }

  const content = (
    <>
      <div className="import-intro card">
        <h3>Importar Extrato</h3>
        <p>
          Selecione extratos bancários em <strong>PDF, CSV, XLS/XLSX ou OFX</strong>. O processamento é feito{' '}
          <strong>100% no seu navegador</strong> — os arquivos não são enviados nem armazenados em nenhum servidor.
        </p>
        {activeProjectId && activeProject ? (
          <p className="import-context">
            Importando para o projeto: <strong>{activeProject.name}</strong>
          </p>
        ) : (
          <p className="import-context">Importando para: <strong>Finanças Gerais</strong></p>
        )}
        {selectedMonth && selectedYear ? (
          <p className="import-hint import-hint--period">
            Datas sem ano no extrato usam o período selecionado: {String(selectedMonth).padStart(2, '0')}/{selectedYear}
          </p>
        ) : null}
        <p className="import-hint">
          Limite: {MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB por arquivo • {ACCEPTED_EXTENSIONS.join(', ')} • PDF exige texto selecionável (sem OCR)
        </p>
      </div>

      {globalError ? <div className="import-alert import-alert--error">{globalError}</div> : null}
      {summary ? (
        <div className="import-alert import-alert--success">
          <strong>Importação concluída</strong>
          <ul>
            <li>{summary.imported} transação(ões) importada(s)</li>
            <li>{summary.ignored} ignorada(s) (não selecionadas)</li>
            <li>{summary.duplicates} duplicada(s) detectada(s) no total</li>
            {summary.failed > 0 ? <li>{summary.failed} falha(s) ao salvar</li> : null}
          </ul>
          {summary.errors?.length > 0 ? (
            <details>
              <summary>Ver erros</summary>
              <ul>{summary.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </details>
          ) : null}
          {summary.imported > 0 && summary.importedIds?.length > 0 && onUndoImport ? (
            <div className="import-undo-row">
              <button
                type="button"
                className="text-btn import-undo-btn"
                onClick={handleUndoLastImport}
                disabled={isUndoing}
              >
                {isUndoing ? 'Desfazendo…' : `↩ Desfazer importação (${summary.importedIds.length})`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={`import-dropzone card ${dragOver ? 'import-dropzone--active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv,.xls,.xlsx,.ofx,.qfx,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          className="import-file-input"
          onChange={handleFileInput}
        />
        <span className="import-dropzone-icon">📄</span>
        <p className="import-dropzone-title">Clique ou arraste arquivos aqui</p>
        <p className="import-dropzone-sub">PDF, CSV, XLS/XLSX, OFX — múltiplos arquivos suportados</p>
      </div>

      {fileEntries.length > 0 ? (
        <div className="import-files card">
          <div className="import-files-header">
            <h4>Arquivos selecionados ({fileEntries.length})</h4>
            <div className="import-files-actions">
              <button
                type="button"
                className="submit-btn"
                onClick={handleProcess}
                disabled={isProcessing || isImporting}
              >
                {isProcessing ? 'Processando…' : 'Processar arquivos'}
              </button>
              <button type="button" className="text-btn" onClick={handleClear} disabled={isProcessing || isImporting}>
                Limpar importação
              </button>
            </div>
          </div>
          {isProcessing && processProgress ? (
            <ImportProgressBar
              title="Processando arquivos"
              current={processProgress.current}
              total={processProgress.total}
              detail={processProgress.detail}
            />
          ) : null}
          <ul className="import-file-list">
            {fileEntries.map((entry) => (
              <li key={entry.id} className={`import-file-item import-file-item--${entry.status}`}>
                <div className="import-file-info">
                  <span className="import-file-name">{entry.name}</span>
                  <span className="import-file-meta">{formatFileSize(entry.size)}</span>
                </div>
                <span className={`import-file-status import-file-status--${entry.status}`}>
                  {STATUS_LABELS[entry.status] || entry.status}
                </span>
                {entry.error ? <span className="import-file-error">{entry.error}</span> : null}
                {entry.status === 'waiting' && !isProcessing ? (
                  <button type="button" className="import-file-remove" onClick={() => removeFile(entry.id)} title="Remover">×</button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {parsedRows.length > 0 ? (
        <div className="import-review card list-section">
          <div className="import-review-header list-header">
            <div>
              <h2>Revisão ({parsedRows.length} detectadas)</h2>
              <p className="import-review-sub">
                {duplicateCount > 0 ? `${duplicateCount} possível(is) duplicada(s) — desmarcadas por padrão` : 'Revise antes de importar'}
              </p>
            </div>
            <div className="import-review-tools">
              <label className="import-checkbox-label">
                <input
                  type="checkbox"
                  checked={hideDuplicates}
                  onChange={(e) => setHideDuplicates(e.target.checked)}
                />
                Ocultar duplicados
              </label>
              <button type="button" className="text-btn" onClick={() => toggleAll(true)}>Selecionar todas</button>
              <button type="button" className="text-btn" onClick={() => toggleAll(false)}>Desmarcar todas</button>
            </div>
          </div>

          <div className="import-table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Arquivo</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className={row.isDuplicate || row.isPossibleDuplicate ? 'import-row--duplicate' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggleRow(row.id)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="import-cell-input"
                        value={toDateInputValue(row.date)}
                        onChange={(e) => {
                          const d = fromDateInputValue(e.target.value);
                          if (d) updateRow(row.id, { date: d });
                        }}
                      />
                    </td>
                    <td className="import-desc-cell">
                      <div className="import-desc-content">
                        <input
                          type="text"
                          className="import-cell-input import-cell-input--wide"
                          value={row.description}
                          onChange={(e) => updateRow(row.id, { description: e.target.value })}
                        />
                        {row.isDuplicate ? <span className="import-dup-badge">Duplicada</span> : null}
                        {row.isPossibleDuplicate && !row.isDuplicate ? (
                          <span className="import-dup-badge import-dup-badge--possible">Possível duplicada</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="import-cell-input import-cell-input--money"
                        value={typeof row.amount === 'number' ? row.amount.toFixed(2).replace('.', ',') : row.amount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.'));
                          if (!Number.isNaN(val)) updateRow(row.id, { amount: val });
                        }}
                      />
                    </td>
                    <td>
                      <select
                        className="import-cell-input"
                        value={row.type}
                        onChange={(e) => {
                          const type = e.target.value;
                          const cats = type === 'income' ? incomeCategories : expenseCategories;
                          updateRow(row.id, {
                            type,
                            category: cats.includes(row.category) ? row.category : cats[0] || 'Outros',
                          });
                        }}
                      >
                        <option value="expense">Despesa</option>
                        <option value="income">Receita</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="import-cell-input"
                        value={row.category}
                        onChange={(e) => updateRow(row.id, { category: e.target.value })}
                      >
                        {(row.type === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="import-file-col" title={row.sourceFileName}>{row.sourceFileName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="import-review-footer">
            {isImporting && importProgress ? (
              <ImportProgressBar
                title="Importando transações"
                current={importProgress.current}
                total={importProgress.total}
                detail={importProgress.detail}
              />
            ) : null}
            <div className="import-review-footer-actions">
              <span className="import-selected-count">
                {selectedRows.length} selecionada(s) • Total: R$ {formatMoney(selectedRows.reduce((s, r) => s + (Number(r.amount) || 0), 0))}
              </span>
              <button
                type="button"
                className="submit-btn"
                onClick={handleImport}
                disabled={isImporting || selectedRows.length === 0}
              >
                {isImporting ? 'Importando…' : 'Importar selecionadas'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  return embedded ? content : <main className="import-view main-content">{content}</main>;
}
