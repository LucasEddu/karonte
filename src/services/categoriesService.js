import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const COLLECTION = 'userCategories';

/** Converte entrada legada ({ name, id }) ou string em nome de categoria. */
export const normalizeCategoryName = (entry) => {
  if (typeof entry === 'string') return entry.trim();
  if (entry && typeof entry === 'object' && typeof entry.name === 'string') return entry.name.trim();
  return null;
};

/** Garante lista de nomes únicos (strings). */
export const normalizeCategoryList = (list) => {
  const names = (list || []).map(normalizeCategoryName).filter(Boolean);
  return [...new Set(names)];
};

const normalizeClassifications = (classifications) => {
  const result = {};
  if (!classifications || typeof classifications !== 'object') return result;
  for (const [key, val] of Object.entries(classifications)) {
    const name = normalizeCategoryName(key) || (typeof key === 'string' ? key.trim() : null);
    if (name && val) result[name] = val;
  }
  return result;
};

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
        expense: normalizeCategoryList(data.expense),
        income: normalizeCategoryList(data.income),
        classifications: normalizeClassifications(data.classifications),
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
    const payload = {
      expense: normalizeCategoryList(categories.expense),
      income: normalizeCategoryList(categories.income),
      classifications: normalizeClassifications(categories.classifications),
    };
    await setDoc(doc(db, COLLECTION, uid), payload);
  } catch (err) {
    console.error('Error saving user categories:', err);
    throw err;
  }
};

