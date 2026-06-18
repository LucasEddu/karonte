import { db, auth } from '../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { logFirestoreRead, logFirestoreWrite, logFirestoreQuery } from '../utils/firestoreDebug.js';

const COLLECTION = 'importBatches';
const DEFAULT_LIMIT = 20;

export const saveImportBatch = async (batchId, data) => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');

  const payload = {
    id: batchId,
    userId: user.uid,
    projectId: data.projectId || null,
    type: data.type || 'statement',
    fileNames: data.fileNames || [],
    importedAt: data.importedAt || new Date().toISOString(),
    status: data.status || 'completed',
    importFingerprint: data.importFingerprint || null,
    periodStart: data.periodStart || null,
    periodEnd: data.periodEnd || null,
    counts: {
      detected: data.counts?.detected ?? 0,
      imported: data.counts?.imported ?? 0,
      failed: data.counts?.failed ?? 0,
      ignored: data.counts?.ignored ?? 0,
      duplicates: data.counts?.duplicates ?? 0,
    },
    importedTransactionIds: data.importedTransactionIds || [],
    importedInvoiceIds: data.importedInvoiceIds || [],
    failedRows: data.failedRows || [],
    skippedRows: data.skippedRows || [],
    createdByUid: user.uid,
    createdByName: data.createdByName || user.displayName || user.email || user.uid,
    createdAt: data.createdAt || new Date().toISOString(),
    metadata: data.metadata || {},
  };

  await setDoc(doc(db, COLLECTION, batchId), payload);
  logFirestoreWrite('saveImportBatch', 1);
  return payload;
};

export const getImportBatch = async (batchId) => {
  if (!batchId) return null;
  logFirestoreQuery('getImportBatch', { batchId });
  const snap = await getDoc(doc(db, COLLECTION, batchId));
  if (!snap.exists()) return null;
  logFirestoreRead('getImportBatch', 1);
  return { id: snap.id, ...snap.data() };
};

export const getImportBatchDetails = (batchId) => getImportBatch(batchId);

export const getImportBatchTransactionIds = async (batchId) => {
  const batch = await getImportBatch(batchId);
  return batch?.importedTransactionIds || [];
};

const sortAndSliceBatches = (batches, max) =>
  batches
    .sort((a, b) => new Date(b.importedAt || b.createdAt) - new Date(a.importedAt || a.createdAt))
    .slice(0, max);

export const getImportBatchesForScope = async (userId, projectId = null, options = {}) => {
  const limitCount = options.limitCount ?? DEFAULT_LIMIT;

  logFirestoreQuery('getImportBatchesForScope', { userId, projectId, limitCount });

  let q;
  if (projectId) {
    q = query(
      collection(db, COLLECTION),
      where('projectId', '==', projectId),
      orderBy('importedAt', 'desc'),
      limit(limitCount)
    );
  } else {
    q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      orderBy('importedAt', 'desc'),
      limit(limitCount * 2)
    );
  }

  try {
    const snap = await getDocs(q);
    let batches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    logFirestoreRead('getImportBatchesForScope', batches.length);

    if (!projectId) {
      batches = batches.filter((b) => !b.projectId || b.projectId === 'geral');
    }

    return sortAndSliceBatches(batches, limitCount);
  } catch (error) {
    const fallbackQ = projectId
      ? query(collection(db, COLLECTION), where('projectId', '==', projectId))
      : query(collection(db, COLLECTION), where('userId', '==', userId));

    const snap = await getDocs(fallbackQ);
    let batches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    logFirestoreRead('getImportBatchesForScope:fallback', batches.length);

    if (!projectId) {
      batches = batches.filter((b) => !b.projectId || b.projectId === 'geral');
    }

    return sortAndSliceBatches(batches, limitCount);
  }
};

export const getAllUserImportBatches = async (userId, options = {}) => {
  const limitCount = options.limitCount ?? DEFAULT_LIMIT;
  logFirestoreQuery('getAllUserImportBatches', { userId, limitCount });

  try {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      orderBy('importedAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const batches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    logFirestoreRead('getAllUserImportBatches', batches.length);
    return batches;
  } catch (error) {
    const q = query(collection(db, COLLECTION), where('userId', '==', userId));
    const snap = await getDocs(q);
    const batches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    logFirestoreRead('getAllUserImportBatches:fallback', batches.length);
    return sortAndSliceBatches(batches, limitCount);
  }
};

export const markImportBatchUndone = async (batchId) => {
  await updateDoc(doc(db, COLLECTION, batchId), {
    status: 'undone',
    undoneAt: new Date().toISOString(),
  });
  logFirestoreWrite('markImportBatchUndone', 1);
};
