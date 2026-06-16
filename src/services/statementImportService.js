import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseStatementText } from '../utils/statementParser';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;
export const MIN_CHARS_PER_PAGE = 25;

export const IMPORT_ERRORS = {
  NOT_PDF: 'NOT_PDF',
  TOO_LARGE: 'TOO_LARGE',
  PASSWORD: 'PASSWORD',
  SCANNED: 'SCANNED',
  NO_TEXT: 'NO_TEXT',
  NO_TRANSACTIONS: 'NO_TRANSACTIONS',
};

export const getImportErrorMessage = (code) => {
  switch (code) {
    case IMPORT_ERRORS.NOT_PDF:
      return 'Apenas arquivos PDF são aceitos.';
    case IMPORT_ERRORS.TOO_LARGE:
      return 'O arquivo excede o limite de 5 MB.';
    case IMPORT_ERRORS.PASSWORD:
      return 'Este PDF está protegido por senha e não pode ser lido.';
    case IMPORT_ERRORS.SCANNED:
    case IMPORT_ERRORS.NO_TEXT:
      return 'Não foi possível extrair texto deste PDF. PDFs escaneados ou baseados em imagem ainda não são suportados nesta versão (sem OCR).';
    case IMPORT_ERRORS.NO_TRANSACTIONS:
      return 'Nenhuma transação foi detectada neste extrato.';
    default:
      return 'Erro ao processar o PDF.';
  }
};

export const validatePdfFile = (file) => {
  if (!file) return { valid: false, error: IMPORT_ERRORS.NOT_PDF };
  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return { valid: false, error: IMPORT_ERRORS.NOT_PDF };
  if (file.size > MAX_PDF_SIZE_BYTES) return { valid: false, error: IMPORT_ERRORS.TOO_LARGE };
  return { valid: true };
};

export const extractTextFromPdf = async (file) => {
  const validation = validatePdfFile(file);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.code = validation.error;
    throw err;
  }

  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    const err = new Error(IMPORT_ERRORS.NO_TEXT);
    err.code = IMPORT_ERRORS.NO_TEXT;
    throw err;
  }

  let pdf;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: buffer, useWorkerFetch: false, isEvalSupported: false });
    pdf = await loadingTask.promise;
  } catch (e) {
    const msg = String(e?.message || e || '').toLowerCase();
    if (msg.includes('password') || e?.name === 'PasswordException') {
      const err = new Error(IMPORT_ERRORS.PASSWORD);
      err.code = IMPORT_ERRORS.PASSWORD;
      throw err;
    }
    const err = new Error(IMPORT_ERRORS.NO_TEXT);
    err.code = IMPORT_ERRORS.NO_TEXT;
    throw err;
  } finally {
    buffer = null;
  }

  const pageTexts = [];
  let totalChars = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    pageTexts.push(pageText);
    totalChars += pageText.replace(/\s/g, '').length;
  }

  const fullText = pageTexts.join('\n');

  if (totalChars < pdf.numPages * MIN_CHARS_PER_PAGE) {
    const err = new Error(IMPORT_ERRORS.SCANNED);
    err.code = IMPORT_ERRORS.SCANNED;
    throw err;
  }

  if (!fullText.trim()) {
    const err = new Error(IMPORT_ERRORS.NO_TEXT);
    err.code = IMPORT_ERRORS.NO_TEXT;
    throw err;
  }

  return fullText;
};

export const parsePdfFile = async (file, options = {}) => {
  const text = await extractTextFromPdf(file);
  const transactions = parseStatementText(text, options);
  if (transactions.length === 0) {
    const err = new Error(IMPORT_ERRORS.NO_TRANSACTIONS);
    err.code = IMPORT_ERRORS.NO_TRANSACTIONS;
    throw err;
  }
  return transactions;
};

export const extractTextFromMultiplePdfs = async (files, { onFileProgress, parseOptions } = {}) => {
  const results = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    onFileProgress?.(i, 'processing', file.name);

    try {
      const transactions = await parsePdfFile(file, parseOptions);
      results.push({
        fileName: file.name,
        status: 'done',
        transactions,
        error: null,
      });
      onFileProgress?.(i, 'done', file.name);
    } catch (e) {
      const code = e.code || IMPORT_ERRORS.NO_TEXT;
      results.push({
        fileName: file.name,
        status: 'error',
        transactions: [],
        error: getImportErrorMessage(code),
        errorCode: code,
      });
      onFileProgress?.(i, 'error', file.name, getImportErrorMessage(code));
    }

    await new Promise((r) => setTimeout(r, 0));
  }

  return results;
};
