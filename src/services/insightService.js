import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const buildInsightCacheId = (userId, month, year, projectId = null) => {
  const scope = projectId || 'geral';
  return `${userId}_${scope}_${month}_${year}`;
};

/**
 * Busca um insight cacheado para um determinado mês/ano e escopo (geral ou projeto).
 */
export const getCachedInsight = async (userId, month, year, projectId = null) => {
  try {
    const id = buildInsightCacheId(userId, month, year, projectId);
    const docRef = doc(db, 'insights', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().text;
    }
    return null;
  } catch (error) {
    console.error('Error getting cached insight:', error);
    return null;
  }
};

/**
 * Salva um insight no cache.
 */
export const saveInsightToCache = async (userId, month, year, text, projectId = null) => {
  try {
    const id = buildInsightCacheId(userId, month, year, projectId);
    const docRef = doc(db, 'insights', id);
    await setDoc(docRef, {
      userId,
      month,
      year,
      projectId: projectId || null,
      text,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error saving insight to cache:', error);
  }
};
