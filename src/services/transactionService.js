import { db, auth } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs,
  orderBy 
} from 'firebase/firestore';

const COLLECTION_NAME = 'transactions';

export const addTransaction = async (transactionData, projectId = null) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user");

    const payload = {
      ...transactionData,
      userId: user.uid, // Ensure it's tied to current user
      createdAt: new Date().toISOString()
    };
    
    if (projectId) {
       payload.projectId = projectId;
    }

    const newDocRef = await addDoc(collection(db, COLLECTION_NAME), payload);
    
    return { id: newDocRef.id, ...payload };
  } catch (error) {
    console.error("Error adding transaction:", error);
    throw error;
  }
};

export const getUserTransactions = async (userId, projectId = null) => {
  try {
    // Note: To use orderBy with where, Firebase requires a composite index.
    // For simplicity right now, we will fetch and sort in memory, or just rely on the React state.
    
    let q;
    if (projectId) {
       q = query(
         collection(db, COLLECTION_NAME), 
         where("userId", "==", userId),
         where("projectId", "==", projectId)
       );
    } else {
       // Se projectId for nulo, apenas buscar as que NAO tem projectId associado (projeto Geral)
       // Firestore doesn't easily support querying "where key does not exist" without complex indexing/null values.
       // The easiest approach for this simple setup is to fetch all for user and filter in memory for "general", 
       // or always attach projectId = 'geral'.
       // Since existing transactions have no projectId, we'll fetch all and filter in memory to find those without it.
       q = query(
         collection(db, COLLECTION_NAME), 
         where("userId", "==", userId)
       );
    }

    
    const querySnapshot = await getDocs(q);
    const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (projectId === null) {
        // Return only transactions that BELONG TO NO PROJECT (General budget)
        return docs.filter(d => !d.projectId || d.projectId === 'geral');
    }
    
    return docs;
  } catch (error) {
    console.error("Error fetching transactions:", error);
    throw error;
  }
};

/** All transactions in a project (for shared projects). Caller must be project member. */
export const getProjectTransactions = async (projectId) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("projectId", "==", projectId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error fetching project transactions:", error);
    throw error;
  }
};

export const deleteTransaction = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    console.error("Error deleting transaction:", error);
    throw error;
  }
};
