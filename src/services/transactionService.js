import { db, auth } from '../config/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { logFirestoreRead, logFirestoreWrite, logFirestoreQuery } from '../utils/firestoreDebug.js';

const COLLECTION_NAME = 'transactions';
const BATCH_CHUNK_SIZE = 450;

const toIsoStart = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const toIsoEnd = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

const mapDocs = (snapshot, label) => {
  const docs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  logFirestoreRead(label, docs.length);
  return docs;
};

const filterGeralTransactions = (docs, userId) =>
  docs.filter((d) => d.userId === userId && (!d.projectId || d.projectId === 'geral'));

const buildScopedDateQuery = ({ userId, projectId, startDate, endDate, limitCount }) => {
  const start = toIsoStart(startDate);
  const end = toIsoEnd(endDate);
  const constraints = [];

  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  } else if (userId) {
    constraints.push(where('userId', '==', userId));
  }

  constraints.push(where('date', '>=', start));
  constraints.push(where('date', '<=', end));
  constraints.push(orderBy('date', 'desc'));

  if (limitCount) {
    constraints.push(limit(limitCount));
  }

  return query(collection(db, COLLECTION_NAME), ...constraints);
};

export const getTransactionsForDateWindow = async ({
  userId,
  projectId = null,
  startDate,
  endDate,
  limitCount,
}) => {
  logFirestoreQuery('getTransactionsForDateWindow', {
    userId,
    projectId,
    startDate,
    endDate,
    limitCount,
  });

  const q = buildScopedDateQuery({ userId, projectId, startDate, endDate, limitCount });
  const snapshot = await getDocs(q);
  let docs = mapDocs(snapshot, 'getTransactionsForDateWindow');

  if (!projectId && userId) {
    docs = filterGeralTransactions(docs, userId);
  }

  return docs;
};

export const getTransactionsForPeriod = (params) => getTransactionsForDateWindow(params);

export const getRecentTransactions = async ({ userId, projectId = null, limitCount = 20 }) => {
  logFirestoreQuery('getRecentTransactions', { userId, projectId, limitCount });

  let q;
  if (projectId) {
    q = query(
      collection(db, COLLECTION_NAME),
      where('projectId', '==', projectId),
      orderBy('date', 'desc'),
      limit(limitCount)
    );
  } else {
    q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      limit(limitCount * 3)
    );
  }

  const snapshot = await getDocs(q);
  let docs = mapDocs(snapshot, 'getRecentTransactions');

  if (!projectId) {
    docs = filterGeralTransactions(docs, userId).slice(0, limitCount);
  }

  return docs.slice(0, limitCount);
};

export const getTransactionsForMonths = async ({
  userId,
  projectId = null,
  monthsBack = 6,
  referenceDate = new Date(),
}) => {
  const end = new Date(referenceDate);
  const start = new Date(referenceDate);
  start.setMonth(start.getMonth() - monthsBack);
  start.setDate(1);

  return getTransactionsForDateWindow({
    userId,
    projectId,
    startDate: start,
    endDate: end,
  });
};

export const getTransactionHashesForWindow = async (params) => {
  const txs = await getTransactionsForDateWindow(params);
  return txs.map((tx) => ({
    id: tx.id,
    duplicateHash: tx.duplicateHash,
    date: tx.date,
    amount: tx.amount,
    description: tx.description,
    importBatchId: tx.importBatchId,
  }));
};

export const addTransaction = async (transactionData, projectId = null) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    const createdByName =
      transactionData?.createdByName ||
      user.displayName ||
      user.email ||
      user.uid;

    const payload = {
      ...transactionData,
      userId: user.uid,
      createdByUid: user.uid,
      createdByName,
      createdAt: new Date().toISOString(),
    };

    if (projectId) {
      payload.projectId = projectId;
    }

    const newDocRef = await addDoc(collection(db, COLLECTION_NAME), payload);
    logFirestoreWrite('addTransaction', 1);
    return { id: newDocRef.id, ...payload };
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw error;
  }
};

export const addTransactionsBatch = async (transactionsList = [], projectId = null) => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  if (!transactionsList.length) return { created: [], failed: [] };

  const created = [];
  const failed = [];

  for (let offset = 0; offset < transactionsList.length; offset += BATCH_CHUNK_SIZE) {
    const chunk = transactionsList.slice(offset, offset + BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);

    const chunkCreated = chunk.map((transactionData) => {
      const createdByName =
        transactionData?.createdByName ||
        user.displayName ||
        user.email ||
        user.uid;

      const payload = {
        ...transactionData,
        userId: user.uid,
        createdByUid: user.uid,
        createdByName,
        createdAt: new Date().toISOString(),
      };

      if (projectId) payload.projectId = projectId;

      const ref = doc(collection(db, COLLECTION_NAME));
      batch.set(ref, payload);
      return { id: ref.id, ...payload };
    });

    try {
      await batch.commit();
      logFirestoreWrite('addTransactionsBatch', chunkCreated.length);
      created.push(...chunkCreated);
    } catch (error) {
      chunkCreated.forEach((item) => {
        failed.push({
          description: item.description,
          amount: item.amount,
          reason: error.message || 'erro no batch',
        });
      });
    }
  }

  return { created, failed };
};

/** @deprecated Prefer getTransactionsForDateWindow or getTransactionsForMonths */
export const getUserTransactions = async (userId, projectId = null, options = {}) => {
  if (options.startDate && options.endDate) {
    return getTransactionsForDateWindow({
      userId,
      projectId: null,
      startDate: options.startDate,
      endDate: options.endDate,
      limitCount: options.limitCount,
    });
  }

  logFirestoreQuery('getUserTransactions', { userId, projectId, legacy: true });
  const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  let docs = mapDocs(querySnapshot, 'getUserTransactions');

  if (projectId === null) {
    docs = filterGeralTransactions(docs, userId);
  }

  return docs;
};

/** @deprecated Prefer getTransactionsForDateWindow with projectId */
export const getProjectTransactions = async (projectId, options = {}) => {
  if (options.startDate && options.endDate) {
    return getTransactionsForDateWindow({
      projectId,
      startDate: options.startDate,
      endDate: options.endDate,
      limitCount: options.limitCount,
    });
  }

  logFirestoreQuery('getProjectTransactions', { projectId, legacy: true });
  const q = query(collection(db, COLLECTION_NAME), where('projectId', '==', projectId));
  const snapshot = await getDocs(q);
  return mapDocs(snapshot, 'getProjectTransactions');
};

export const deleteTransaction = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    logFirestoreWrite('deleteTransaction', 1);
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw error;
  }
};

export const updateTransaction = async (id, transactionData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    const payload = {
      ...transactionData,
      updatedAt: new Date().toISOString(),
      updatedByUid: user.uid,
    };

    delete payload.id;
    delete payload.createdAt;
    delete payload.createdByUid;
    delete payload.createdByName;
    delete payload.userId;

    await updateDoc(doc(db, COLLECTION_NAME, id), payload);
    logFirestoreWrite('updateTransaction', 1);
    return { id, ...transactionData, ...payload };
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw error;
  }
};

export const deleteTransactionsByIds = async (ids) => {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return { deleted: 0 };

  let deleted = 0;

  for (let offset = 0; offset < unique.length; offset += BATCH_CHUNK_SIZE) {
    const chunk = unique.slice(offset, offset + BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((id) => batch.delete(doc(db, COLLECTION_NAME, id)));
    await batch.commit();
    deleted += chunk.length;
  }

  logFirestoreWrite('deleteTransactionsByIds', deleted);
  return { deleted };
};

export const getTransactionsByImportBatchId = async (importBatchId) => {
  if (!importBatchId) return [];

  logFirestoreQuery('getTransactionsByImportBatchId', { importBatchId });
  const q = query(
    collection(db, COLLECTION_NAME),
    where('importBatchId', '==', importBatchId)
  );
  const snap = await getDocs(q);
  const user = auth.currentUser;
  const docs = mapDocs(snap, 'getTransactionsByImportBatchId');
  if (!user) return [];
  return docs.filter((t) => t.userId === user.uid);
};

export const getTransactionsByImportBatchIds = async (importBatchIds = []) => {
  const unique = [...new Set((importBatchIds || []).filter(Boolean))];
  if (!unique.length) return [];

  const results = await Promise.all(unique.map((batchId) => getTransactionsByImportBatchId(batchId)));
  const byId = new Map();
  results.flat().forEach((tx) => {
    if (tx?.id) byId.set(tx.id, tx);
  });
  return [...byId.values()];
};

export const getImportBatchTransactionIds = async (importBatchId) => {
  const txs = await getTransactionsByImportBatchId(importBatchId);
  return txs.map((tx) => tx.id);
};
