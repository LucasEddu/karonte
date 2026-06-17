import { db } from '../config/firebase';
import { collection, addDoc, getDocs, query, where, limit } from 'firebase/firestore';

const COLLECTION = 'activityLogs';

export const createActivityLog = async (payload) => {
  const doc = {
    ...payload,
    projectId: payload.projectId || null,
    createdAt: payload.createdAt || new Date().toISOString(),
  };
  const ref = await addDoc(collection(db, COLLECTION), doc);
  return { id: ref.id, ...doc };
};

export const getActivityLogsByScope = async (userId, projectId = null, max = 100) => {
  try {
    const q = projectId
      ? query(collection(db, COLLECTION), where('projectId', '==', projectId), limit(250))
      : query(collection(db, COLLECTION), where('userId', '==', userId), limit(250));

    const snap = await getDocs(q);
    let logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!projectId) logs = logs.filter((l) => !l.projectId);
    return logs
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, max);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return [];
  }
};

export const getUserActivityLogs = (userId, max) => getActivityLogsByScope(userId, null, max);
export const getProjectActivityLogs = (projectId, max) => getActivityLogsByScope(null, projectId, max);
