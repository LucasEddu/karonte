import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const COLLECTION = 'userCategories';

/** Aceita string ou objeto legado { id, name } do Firestore. */
export const normalizeCategoryName = (cat) => {
  if (cat == null || cat === '') return '';
  if (typeof cat === 'string') return cat;
  if (typeof cat === 'object' && typeof cat.name === 'string') return cat.name;
  if (typeof cat === 'object' && typeof cat.id === 'string') return cat.id;
  return String(cat);
};

export const normalizeCategoryList = (list) => {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map(normalizeCategoryName).filter(Boolean))];
};

export const categoriesMatch = (a, b) => normalizeCategoryName(a) === normalizeCategoryName(b);

const normalizeClassifications = (raw) => {
  const classifications = {};
  if (!raw || typeof raw !== 'object') return classifications;
  for (const [key, val] of Object.entries(raw)) {
    const name = normalizeCategoryName(key);
    if (name) classifications[name] = val;
  }
  return classifications;
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
    await setDoc(doc(db, COLLECTION, uid), categories);
  } catch (err) {
    console.error('Error saving user categories:', err);
    throw err;
  }
};

