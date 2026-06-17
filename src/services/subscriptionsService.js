import { db, auth } from '../config/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

const COLLECTION = 'userSubscriptions';

const itemsRef = (uid) => collection(db, COLLECTION, uid, 'items');

export const getUserSubscriptions = async (uid, projectId = null) => {
  const q = query(itemsRef(uid), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (projectId === null) {
    items = items.filter((i) => !i.projectId || i.projectId === 'geral');
  } else {
    items = items.filter((i) => i.projectId === projectId);
  }
  return items;
};

export const saveSubscription = async (uid, data, itemId = null) => {
  const payload = {
    ...data,
    userId: uid,
    updatedAt: new Date().toISOString(),
    createdAt: data.createdAt || new Date().toISOString(),
  };
  if (itemId) {
    await updateDoc(doc(db, COLLECTION, uid, 'items', itemId), payload);
    return { id: itemId, ...payload };
  }
  const ref = await addDoc(itemsRef(uid), payload);
  return { id: ref.id, ...payload };
};

export const deleteSubscription = async (uid, itemId) => {
  await deleteDoc(doc(db, COLLECTION, uid, 'items', itemId));
};

export const ensureSubscriptionParent = async (uid) => {
  await setDoc(doc(db, COLLECTION, uid), { userId: uid, updatedAt: new Date().toISOString() }, { merge: true });
};

export const getCurrentUid = () => auth.currentUser?.uid || null;
