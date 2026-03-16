import { db, auth } from '../config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc 
} from 'firebase/firestore';

export const saveUserBudgets = async (budgetsData, projectId = null) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user");

    // We will save user budgets as a single document under 'budgets' collection with the ID = user.uid + _ + projectId
    // If it's the general budget, just use user.uid
    const docId = projectId ? `${user.uid}_${projectId}` : user.uid;
    
    await setDoc(doc(db, 'budgets', docId), budgetsData);
    
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
      return docSnap.data();
    } else {
      return {}; // No budgets defined yet
    }
  } catch (error) {
    console.error("Error fetching budgets:", error);
    throw error;
  }
};
