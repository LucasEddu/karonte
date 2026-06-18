import { db, auth } from '../config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { logFirestoreRead, logFirestoreQuery } from '../utils/firestoreDebug.js';
import {
  normalizeBudgets,
  needsBudgetMigration,
  serializeBudgetsForSave,
  EMPTY_BUDGETS,
} from '../utils/budgetModel';

export const saveUserBudgets = async (budgetsData, projectId = null, ownerId = null) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    const uid = ownerId || user.uid;
    const docId = projectId ? `${uid}_${projectId}` : uid;
    const serialized = serializeBudgetsForSave(budgetsData);
    const payload = { ...serialized, ownerId: uid, projectId: projectId || null };
    await setDoc(doc(db, 'budgets', docId), payload);
    return normalizeBudgets(payload);
  } catch (error) {
    console.error('Error saving budgets:', error);
    throw error;
  }
};

export const getUserBudgets = async (userId, projectId = null) => {
  try {
    const docId = projectId ? `${userId}_${projectId}` : userId;
    logFirestoreQuery('getUserBudgets', { userId, projectId });
    const docRef = doc(db, 'budgets', docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { ...EMPTY_BUDGETS };
    }

    logFirestoreRead('getUserBudgets', 1);

    const raw = docSnap.data();
    const normalized = normalizeBudgets(raw);

    if (needsBudgetMigration(raw)) {
      await setDoc(docRef, {
        ...serializeBudgetsForSave(normalized),
        ownerId: raw.ownerId || userId,
        projectId: raw.projectId ?? projectId ?? null,
      });
    }

    return normalized;
  } catch (error) {
    console.error('Error fetching budgets:', error);
    throw error;
  }
};
