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
} from 'firebase/firestore';

const COLLECTION = 'importBatches';

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
  return payload;
};

export const getImportBatch = async (batchId) => {
  if (!batchId) return null;
  const snap = await getDoc(doc(db, COLLECTION, batchId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getImportBatchesForScope = async (userId, projectId = null, max = 50) => {
  try {
    const q = projectId
      ? query(collection(db, COLLECTION), where('projectId', '==', projectId))
      : query(collection(db, COLLECTION), where('userId', '==', userId));

    const snap = await getDocs(q);
    let batches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (!projectId) {
      batches = batches.filter((b) => !b.projectId || b.projectId === 'geral');
    }

    return batches
      .sort((a, b) => new Date(b.importedAt || b.createdAt) - new Date(a.importedAt || a.createdAt))
      .slice(0, max);
  } catch (error) {
    console.error('Error fetching import batches:', error);
    return [];
  }
};

export const markImportBatchUndone = async (batchId) => {
  await updateDoc(doc(db, COLLECTION, batchId), {
    status: 'undone',
    undoneAt: new Date().toISOString(),
  });
};
