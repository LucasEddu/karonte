import { parseStatementText, parseMultipleStatementTexts } from '../utils/statementParser';
import {
  parseCsvText,
  parseOfxText,
  parseSpreadsheetRows,
} from '../utils/structuredStatementParser';

let pdfjsReady;
let xlsxReady;

const getPdfJs = async () => {
  if (pdfjsReady) return pdfjsReady;

  if (typeof window === 'undefined') {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      import.meta.url
    ).href;
    pdfjsReady = pdfjsLib;
    return pdfjsReady;
  }

  const pdfjsLib = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker;
  pdfjsReady = pdfjsLib;
  return pdfjsReady;
};

const getXlsx = async () => {
  if (xlsxReady) return xlsxReady;
  xlsxReady = await import('xlsx');
  return xlsxReady;
};

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_SIZE_BYTES = MAX_FILE_SIZE_BYTES;
export const MIN_CHARS_PER_PAGE = 25;

export const STATEMENT_FORMATS = {
  PDF: 'pdf',
  CSV: 'csv',
  XLS: 'xls',
  OFX: 'ofx',
};

export const IMPORT_ERRORS = {
  UNSUPPORTED: 'UNSUPPORTED',
  NOT_PDF: 'NOT_PDF',
  TOO_LARGE: 'TOO_LARGE',
  PASSWORD: 'PASSWORD',
  SCANNED: 'SCANNED',
  NO_TEXT: 'NO_TEXT',
  NO_TRANSACTIONS: 'NO_TRANSACTIONS',
  PARSE_FAILED: 'PARSE_FAILED',
};

export const ACCEPTED_EXTENSIONS = ['.pdf', '.csv', '.xls', '.xlsx', '.ofx', '.qfx'];

export const getImportErrorMessage = (code) => {
  switch (code) {
    case IMPORT_ERRORS.UNSUPPORTED:
    case IMPORT_ERRORS.NOT_PDF:
      return 'Formato não suportado. Use PDF, CSV, XLS, XLSX ou OFX.';
    case IMPORT_ERRORS.TOO_LARGE:
      return 'O arquivo excede o limite de 5 MB.';
    case IMPORT_ERRORS.PASSWORD:
      return 'Este PDF está protegido por senha e não pode ser lido.';
    case IMPORT_ERRORS.SCANNED:
      return 'PDF sem texto extraível. OCR não suportado nesta versão.';
    case IMPORT_ERRORS.NO_TEXT:
      return 'Não foi possível ler o conteúdo do arquivo.';
    case IMPORT_ERRORS.NO_TRANSACTIONS:
      return 'Nenhuma transação foi detectada neste extrato.';
    case IMPORT_ERRORS.PARSE_FAILED:
      return 'Erro ao interpretar o arquivo. Verifique se o formato está correto.';
    default:
      return 'Erro ao processar o arquivo.';
  }
};

export const detectStatementFormat = (file) => {
  if (!file?.name) return null;
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf') || file.type === 'application/pdf') return STATEMENT_FORMATS.PDF;
  if (name.endsWith('.csv') || file.type === 'text/csv') return STATEMENT_FORMATS.CSV;
  if (
    name.endsWith('.xls') ||
    name.endsWith('.xlsx') ||
    file.type === 'application/vnd.ms-excel' ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return STATEMENT_FORMATS.XLS;
  }
  if (name.endsWith('.ofx') || name.endsWith('.qfx')) return STATEMENT_FORMATS.OFX;

  return null;
};

export const validateStatementFile = (file) => {
  if (!file) return { valid: false, error: IMPORT_ERRORS.UNSUPPORTED };

  const format = detectStatementFormat(file);
  if (!format) return { valid: false, error: IMPORT_ERRORS.UNSUPPORTED };
  if (file.size > MAX_FILE_SIZE_BYTES) return { valid: false, error: IMPORT_ERRORS.TOO_LARGE };

  return { valid: true, format };
};

/** @deprecated use validateStatementFile */
export const validatePdfFile = (file) => {
  const result = validateStatementFile(file);
  if (!result.valid && result.error === IMPORT_ERRORS.UNSUPPORTED) {
    return { valid: false, error: IMPORT_ERRORS.NOT_PDF };
  }
  if (result.valid && result.format !== STATEMENT_FORMATS.PDF) {
    return { valid: false, error: IMPORT_ERRORS.NOT_PDF };
  }
  return result.valid ? { valid: true } : { valid: false, error: result.error };
};

const throwImportError = (code) => {
  const err = new Error(code);
  err.code = code;
  throw err;
};

export const extractTextFromPdf = async (file) => {
  const validation = validateStatementFile(file);
  if (!validation.valid || validation.format !== STATEMENT_FORMATS.PDF) {
    throwImportError(validation.error || IMPORT_ERRORS.NOT_PDF);
  }

  const pdfjsLib = await getPdfJs();

  let buffer;
  try {
    const raw = await file.arrayBuffer();
    buffer = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  } catch {
    throwImportError(IMPORT_ERRORS.NO_TEXT);
  }

  let pdf;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: buffer, useWorkerFetch: false, isEvalSupported: false });
    pdf = await loadingTask.promise;
  } catch (e) {
    const msg = String(e?.message || e || '').toLowerCase();
    if (msg.includes('password') || e?.name === 'PasswordException') {
      throwImportError(IMPORT_ERRORS.PASSWORD);
    }
    throwImportError(IMPORT_ERRORS.NO_TEXT);
  } finally {
    buffer = null;
  }

  const pageTexts = [];
  let totalChars = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    let lastY = null;
    const parts = [];
    for (const item of textContent.items) {
      const y = item.transform?.[5];
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 4) {
        parts.push('\n');
      }
      parts.push(item.str);
      if (y !== undefined) lastY = y;
    }
    const pageText = parts.join(' ');
    pageTexts.push(pageText);
    totalChars += pageText.replace(/\s/g, '').length;
  }

  const fullText = pageTexts.join('\n');

  if (totalChars < pdf.numPages * MIN_CHARS_PER_PAGE) {
    throwImportError(IMPORT_ERRORS.SCANNED);
  }

  if (!fullText.trim()) {
    throwImportError(IMPORT_ERRORS.NO_TEXT);
  }

  return fullText;
};

const parsePdfTransactions = async (file, options) => {
  const text = await extractTextFromPdf(file);
  return parseStatementText(text, options);
};

const parseCsvTransactions = async (file, options) => {
  const text = await file.text();
  return parseCsvText(text, options);
};

const parseXlsTransactions = async (file, options) => {
  const XLSX = await getXlsx();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: false,
  });

  return parseSpreadsheetRows(rows, options);
};

const parseOfxTransactions = async (file, options) => {
  const text = await file.text();
  return parseOfxText(text, options);
};

export const parseStatementFile = async (file, options = {}) => {
  const validation = validateStatementFile(file);
  if (!validation.valid) throwImportError(validation.error);

  let transactions;
  switch (validation.format) {
    case STATEMENT_FORMATS.PDF:
      transactions = await parsePdfTransactions(file, options);
      break;
    case STATEMENT_FORMATS.CSV:
      transactions = await parseCsvTransactions(file, options);
      break;
    case STATEMENT_FORMATS.XLS:
      transactions = await parseXlsTransactions(file, options);
      break;
    case STATEMENT_FORMATS.OFX:
      transactions = await parseOfxTransactions(file, options);
      break;
    default:
      throwImportError(IMPORT_ERRORS.UNSUPPORTED);
  }

  if (!transactions?.length) throwImportError(IMPORT_ERRORS.NO_TRANSACTIONS);
  return transactions;
};

/** @deprecated use parseStatementFile */
export const parsePdfFile = async (file, options = {}) => parseStatementFile(file, options);

export const processStatementFiles = async (files, { onFileProgress, parseOptions } = {}) => {
  const results = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    onFileProgress?.(i, 'processing', file.name);

    try {
      const transactions = await parseStatementFile(file, parseOptions);
      results.push({
        fileName: file.name,
        status: 'done',
        transactions,
        error: null,
      });
      onFileProgress?.(i, 'done', file.name);
    } catch (e) {
      const code = e.code || IMPORT_ERRORS.PARSE_FAILED;
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

/** @deprecated use processStatementFiles */
export const extractTextFromMultiplePdfs = processStatementFiles;

export { parseMultipleStatementTexts };
