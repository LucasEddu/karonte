import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { normalizeCategories, serializeCategoriesForSave } from '../utils/categoryModel';

const COLLECTION = 'userCategories';

export const getUserCategories = async (uid) => {
  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (snap.exists()) {
      const raw = snap.data();
      const normalized = normalizeCategories(raw);
      const needsMigration = !raw.schemaVersion || raw.schemaVersion < 2;
      if (needsMigration) {
        await setDoc(doc(db, COLLECTION, uid), serializeCategoriesForSave(normalized));
      }
      return normalized;
    }
    return normalizeCategories({});
  } catch (err) {
    console.error('Error fetching user categories:', err);
    return normalizeCategories({});
  }
};

export const saveUserCategories = async (uid, categories) => {
  try {
    await setDoc(doc(db, COLLECTION, uid), serializeCategoriesForSave(categories));
  } catch (err) {
    console.error('Error saving user categories:', err);
    throw err;
  }
};
