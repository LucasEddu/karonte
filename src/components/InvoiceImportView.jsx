import React, { useState, useRef } from 'react';
import { parseInvoiceFile } from '../utils/invoiceParser';
import { extractTextFromPdf } from '../services/statementImportService';
import { MAX_FILE_SIZE_BYTES } from '../services/statementImportService';

const emptyDraft = () => ({
  purchaseDescription: '',
  issuerName: '',
  issuerDocument: '',
  accessKey: '',
  invoiceNumber: '',
  series: '',
  issueDate: '',
  totalAmount: '',
  category: 'Outros',
  type: 'expense',
  notes: '',
  items: [],
});

export default function InvoiceImportView({
  expenseCategories = [],
  canAddToProject = true,
  onSaveInvoice,
  formatMoney,
}) {
  const fileInputRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [sourceFileName, setSourceFileName] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setSuccess(null);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('O arquivo excede o limite de 5 MB.');
      return;
    }

    setIsParsing(true);
    setSourceFileName(file.name);

    try {
      const parsed = await parseInvoiceFile(file, extractTextFromPdf);
      setDraft({
        ...emptyDraft(),
        purchaseDescription: parsed.purchaseDescription || '',
        issuerName: parsed.issuerName || '',
        issuerDocument: parsed.issuerDocument || '',
        accessKey: parsed.accessKey || '',
        invoiceNumber: parsed.invoiceNumber || '',
        series: parsed.series || '',
        issueDate: parsed.issueDate
          ? new Date(parsed.issueDate).toISOString().slice(0, 10)
          : '',
        totalAmount: parsed.totalAmount ? String(parsed.totalAmount) : '',
        category: parsed.category || 'Outros',
        type: parsed.type || 'expense',
        notes: '',
        items: parsed.items || [],
        sourceFormat: parsed.sourceFormat,
      });
    } catch (e) {
      setError(e.message || 'Erro ao ler a nota fiscal.');
      setDraft(null);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateField = (field, value) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async () => {
    if (!draft || isSaving) return;
    setError('');
    setSuccess(null);

    const amount = parseFloat(String(draft.totalAmount).replace(',', '.'));
    if (!draft.purchaseDescription.trim()) {
      setError('Informe uma descrição para esta compra.');
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Valor total inválido.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await onSaveInvoice({
        ...draft,
        totalAmount: amount,
        purchaseDescription: draft.purchaseDescription.trim(),
        sourceFileName,
      });
      setSuccess(result);
      setDraft(null);
      setSourceFileName('');
    } catch (e) {
      setError(e.message || 'Erro ao salvar nota.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!canAddToProject) {
    return (
      <div className="import-permission-denied card">
        <h3>Importação indisponível</h3>
        <p>Você não tem permissão para adicionar lançamentos neste projeto.</p>
      </div>
    );
  }

  return (
    <div className="invoice-import">
      <div className="import-intro card">
        <h3>Nota fiscal de compra</h3>
        <p>
          Envie o <strong>XML da NF-e</strong> ou o <strong>PDF (DANFE)</strong>. Os campos são extraídos no
          navegador e o arquivo original é <strong>descartado</strong> — apenas o modelo Karonte é salvo.
        </p>
        <p className="import-hint">Formatos: .xml, .pdf • Limite: {MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB</p>
      </div>

      {error ? <div className="import-alert import-alert--error">{error}</div> : null}
      {success ? (
        <div className="import-alert import-alert--success">
          <strong>Nota registrada</strong>
          <p>
            {success.purchaseDescription} — R$ {formatMoney(success.totalAmount)}
            {success.linkedTransactionId ? ' • Despesa criada no lançamentos' : ''}
          </p>
        </div>
      ) : null}

      {!draft ? (
        <div
          className="import-dropzone card"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,.pdf,application/xml,text/xml,application/pdf"
            className="import-file-input"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <span className="import-dropzone-icon">🧾</span>
          <p className="import-dropzone-title">
            {isParsing ? 'Extraindo campos…' : 'Clique ou arraste a nota fiscal'}
          </p>
          <p className="import-dropzone-sub">XML NF-e ou PDF — o arquivo não é armazenado</p>
        </div>
      ) : (
        <div className="invoice-form card">
          <div className="invoice-form-header">
            <h4>Revisar nota Karonte</h4>
            <p className="import-hint">
              Origem: {sourceFileName} ({draft.sourceFormat}) — arquivo descartado após extração
            </p>
          </div>

          <div className="invoice-form-grid">
            <label className="invoice-field invoice-field--wide">
              <span>O que é esta compra?</span>
              <input
                type="text"
                value={draft.purchaseDescription}
                onChange={(e) => updateField('purchaseDescription', e.target.value)}
                placeholder="Ex: Compra no supermercado"
              />
            </label>
            <label className="invoice-field">
              <span>Valor total (R$)</span>
              <input
                type="text"
                value={draft.totalAmount}
                onChange={(e) => updateField('totalAmount', e.target.value)}
              />
            </label>
            <label className="invoice-field">
              <span>Data da nota</span>
              <input
                type="date"
                value={draft.issueDate}
                onChange={(e) => updateField('issueDate', e.target.value)}
              />
            </label>
            <label className="invoice-field">
              <span>Categoria</span>
              <select value={draft.category} onChange={(e) => updateField('category', e.target.value)}>
                {expenseCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>
            <label className="invoice-field invoice-field--wide">
              <span>Emitente</span>
              <input
                type="text"
                value={draft.issuerName}
                onChange={(e) => updateField('issuerName', e.target.value)}
              />
            </label>
            <label className="invoice-field">
              <span>CNPJ/CPF</span>
              <input
                type="text"
                value={draft.issuerDocument}
                onChange={(e) => updateField('issuerDocument', e.target.value)}
              />
            </label>
            <label className="invoice-field">
              <span>Número NF</span>
              <input
                type="text"
                value={draft.invoiceNumber}
                onChange={(e) => updateField('invoiceNumber', e.target.value)}
              />
            </label>
            <label className="invoice-field invoice-field--wide">
              <span>Chave de acesso</span>
              <input
                type="text"
                value={draft.accessKey}
                onChange={(e) => updateField('accessKey', e.target.value)}
              />
            </label>
            <label className="invoice-field invoice-field--wide">
              <span>Observações</span>
              <input
                type="text"
                value={draft.notes}
                onChange={(e) => updateField('notes', e.target.value)}
              />
            </label>
          </div>

          {draft.items?.length > 0 ? (
            <div className="invoice-items">
              <h5>Itens extraídos ({draft.items.length})</h5>
              <ul>
                {draft.items.slice(0, 8).map((item, idx) => (
                  <li key={idx}>
                    {item.description}
                    {item.totalAmount ? ` — R$ ${formatMoney(item.totalAmount)}` : ''}
                  </li>
                ))}
                {draft.items.length > 8 ? (
                  <li className="import-hint">+ {draft.items.length - 8} item(ns)…</li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <div className="invoice-form-actions">
            <button type="button" className="text-btn" onClick={() => setDraft(null)} disabled={isSaving}>
              Cancelar
            </button>
            <button type="button" className="submit-btn" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando…' : 'Salvar nota e criar despesa'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
