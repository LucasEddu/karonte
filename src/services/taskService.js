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

export const getProjectTasks = async (userId, projectId) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
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

    const ref = await addDoc(collection(db, COLLECTION_NAME), {
      projectId,
      userId: user.uid,
      title: title.trim(),
      completed: false,
      type,
      metaValue,
      parcelas,
      paidAmount,
      createdAt: new Date().toISOString()
    });
    return {
      id: ref.id,
      projectId,
      userId: user.uid,
      title: title.trim(),
      completed: false,
      type,
      metaValue,
      parcelas,
      paidAmount,
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

export const deleteTask = async (taskId) => {
  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, COLLECTION_NAME, taskId));
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};
