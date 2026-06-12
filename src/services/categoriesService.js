import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const COLLECTION = 'userCategories';

/**
 * Carrega as categorias personalizadas do usuário.
 * Retorna { expense: string[], income: string[], classifications: Record<string, string> }
 */
export const getUserCategories = async (uid) => {
  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (snap.exists()) {
      const data = snap.data();
      return {
        expense: data.expense || [],
        income:  data.income  || [],
        classifications: data.classifications || {},
      };
    }
    return { expense: [], income: [], classifications: {} };
  } catch (err) {
    console.error('Error fetching user categories:', err);
    return { expense: [], income: [], classifications: {} };
  }
};

/**
 * Salva as categorias personalizadas do usuário no Firestore.
 * @param {string} uid
 * @param {{ expense: string[], income: string[], classifications?: Record<string, string> }} categories
 */
export const saveUserCategories = async (uid, categories) => {
  try {
    await setDoc(doc(db, COLLECTION, uid), categories);
  } catch (err) {
    console.error('Error saving user categories:', err);
    throw err;
  }
};

