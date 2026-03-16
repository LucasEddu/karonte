import { db, auth } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';

const COLLECTION_NAME = 'projects';

export const createProject = async (name) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user");

    const newDocRef = await addDoc(collection(db, COLLECTION_NAME), {
      name,
      userId: user.uid,
      createdAt: new Date().toISOString()
    });
    
    return { id: newDocRef.id, name, userId: user.uid };
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
};

export const getUserProjects = async (userId) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME), 
      where("userId", "==", userId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching projects:", error);
    throw error;
  }
};

export const deleteProject = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    // Note: In a production app with strict consistency needs, we'd also delete or re-assign 
    // all transactions and budgets associated with this projectId here via a batch deletion.
  } catch (error) {
    console.error("Error deleting project:", error);
    throw error;
  }
};
