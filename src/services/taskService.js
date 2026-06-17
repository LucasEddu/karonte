import { db, auth } from '../config/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs
} from 'firebase/firestore';

const COLLECTION_NAME = 'tasks';

export const getProjectTasks = async (projectId) => {
  try {
    if (!projectId) return [];
    const q = query(
      collection(db, COLLECTION_NAME),
      where('projectId', '==', projectId)
    );
    const snapshot = await getDocs(q);
    const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    tasks.sort((a, b) => (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)));
    return tasks;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
};

export const addTask = async (projectId, payload) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    const title = typeof payload === 'string' ? payload : payload.title;
    const type = (typeof payload === 'object' && payload.type) || 'tarefa';
    const metaValue = (typeof payload === 'object' && payload.metaValue != null) ? Number(payload.metaValue) : 0;
    const parcelas = (typeof payload === 'object' && payload.parcelas != null) ? Number(payload.parcelas) : 0;
    const paidAmount = (typeof payload === 'object' && payload.paidAmount != null) ? Number(payload.paidAmount) : 0;
    const createdByName =
      (typeof payload === 'object' && payload.createdByName) ||
      user.displayName ||
      user.email ||
      user.uid;

    const ref = await addDoc(collection(db, COLLECTION_NAME), {
      projectId,
      userId: user.uid,
      createdByUid: user.uid,
      createdByName,
      title: title.trim(),
      completed: false,
      type,
      metaValue,
      parcelas,
      paidAmount,
      comments: [],
      createdAt: new Date().toISOString()
    });
    return {
      id: ref.id,
      projectId,
      userId: user.uid,
      createdByUid: user.uid,
      createdByName,
      title: title.trim(),
      completed: false,
      type,
      metaValue,
      parcelas,
      paidAmount,
      comments: [],
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error adding task:', error);
    throw error;
  }
};

export const updateTask = async (taskId, data) => {
  try {
    const ref = doc(db, COLLECTION_NAME, taskId);
    await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};

export const appendTaskComment = async (taskId, existingComments, text, authorName = null) => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Comentário vazio');

  const comment = {
    id: crypto.randomUUID(),
    text: trimmed,
    authorUid: user.uid,
    authorName: authorName || user.displayName || user.email || user.uid,
    createdAt: new Date().toISOString(),
  };

  const comments = [...(existingComments || []), comment];
  await updateTask(taskId, { comments });
  return comments;
};

export const deleteTask = async (taskId) => {
  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, COLLECTION_NAME, taskId));
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};
