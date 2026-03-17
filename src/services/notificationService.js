import { db, auth } from '../config/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  limit
} from 'firebase/firestore';

const COLLECTION_NAME = 'notifications';

export const getNotifications = async (userId) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      limit(50)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)));
    return list;
  } catch (e) {
    console.error('Error fetching notifications:', e);
    return [];
  }
};

export const markNotificationRead = async (notificationId) => {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, notificationId), { read: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    throw error;
  }
};

export const createNotification = async (userId, type, data) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    await addDoc(collection(db, COLLECTION_NAME), {
      userId,
      type,
      data: data || {},
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};
