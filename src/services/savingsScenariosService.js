import { db, auth } from '../config/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

const COLLECTION = 'savingsScenarios';

export const saveSavingsScenario = async (data) => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');

  const payload = {
    ...data,
    userId: user.uid,
    projectId: data.projectId || null,
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(collection(db, COLLECTION), payload);
  return { id: ref.id, ...payload };
};

export const getUserSavingsScenarios = async (userId, projectId = null, max = 20) => {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q);
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (projectId === null) {
    items = items.filter((i) => !i.projectId);
  } else {
    items = items.filter((i) => i.projectId === projectId);
  }
  return items;
};
