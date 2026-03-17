import { db, auth } from '../config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc 
} from 'firebase/firestore';

export const saveUserBudgets = async (budgetsData, projectId = null, ownerId = null) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user");

    // We will save user budgets as a single document under 'budgets' collection with the ID = user.uid + _ + projectId
    // If it's the general budget, just use user.uid. Store projectId/ownerId for shared-project rules.
    const uid = ownerId || user.uid;
    const docId = projectId ? `${uid}_${projectId}` : uid;
    const payload = { ...budgetsData, ownerId: uid, projectId: projectId || null };
    await setDoc(doc(db, 'budgets', docId), payload);
    return budgetsData;
  } catch (error) {
    console.error("Error saving budgets:", error);
    throw error;
  }
};

export const getUserBudgets = async (userId, projectId = null) => {
  try {
    const docId = projectId ? `${userId}_${projectId}` : userId;
    const docRef = doc(db, 'budgets', docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const { ownerId, projectId: _p, ...budgets } = data;
      return budgets;
    } else {
      return {}; // No budgets defined yet
    }
  } catch (error) {
    console.error("Error fetching budgets:", error);
    throw error;
  }
};
