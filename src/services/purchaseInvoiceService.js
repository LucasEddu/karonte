import { db, auth } from '../config/firebase';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { logFirestoreRead, logFirestoreQuery } from '../utils/firestoreDebug.js';

const COLLECTION = 'purchaseInvoices';

export const savePurchaseInvoice = async (invoiceData, projectId = null) => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');

  const payload = {
    ...invoiceData,
    userId: user.uid,
    createdByUid: user.uid,
    createdByName:
      invoiceData.createdByName || user.displayName || user.email || user.uid,
    createdAt: new Date().toISOString(),
  };

  if (projectId) payload.projectId = projectId;

  const ref = await addDoc(collection(db, COLLECTION), payload);
  return { id: ref.id, ...payload };
};

export const getPurchaseInvoicesForScope = async (userId, projectId = null, max = 100) => {
  try {
    const q = projectId
      ? query(collection(db, COLLECTION), where('projectId', '==', projectId))
      : query(collection(db, COLLECTION), where('userId', '==', userId));

    const snap = await getDocs(q);
    let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (!projectId) {
      rows = rows.filter((r) => !r.projectId || r.projectId === 'geral');
    }

    return rows
      .sort((a, b) => new Date(b.issueDate || b.createdAt) - new Date(a.issueDate || a.createdAt))
      .slice(0, max);
  } catch (error) {
    console.error('Error fetching purchase invoices:', error);
    return [];
  }
};

export const deletePurchaseInvoice = async (id) => {
  await deleteDoc(doc(db, COLLECTION, id));
};
