import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const COLLECTION = 'userCategories';

/** Converte entrada legada ({ name, id }, mapa, etc.) em nome de categoria. */
export const normalizeCategoryName = (entry) => {
  if (typeof entry === 'string') return entry.trim();
  if (entry == null) return null;
  if (typeof entry === 'object') {
    if (typeof entry.name === 'string') return entry.name.trim();
    if (typeof entry.label === 'string') return entry.label.trim();
    if (typeof entry.title === 'string') return entry.title.trim();
  }
  return null;
};

/** Texto seguro para renderizar categoria na UI. */
export const getCategoryLabel = (entry, fallback = 'Outros') => {
  return normalizeCategoryName(entry) || fallback;
};

/** Garante lista de nomes únicos (strings). Aceita array, objeto único ou mapa. */
export const normalizeCategoryList = (list) => {
  if (list == null) return [];

  let items;
  if (Array.isArray(list)) {
    items = list;
  } else if (typeof list === 'object') {
    // Documento legado: expense como objeto único { name, id }
    if ('name' in list || 'label' in list || 'title' in list) {
      items = [list];
    } else {
      items = Object.values(list);
    }
  } else {
    items = [list];
  }

  const names = items.map(normalizeCategoryName).filter(Boolean);
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
