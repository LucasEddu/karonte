import { db, auth } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  getDoc,
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';

const COLLECTION_NAME = 'projects';

// Roles: 'view' = só ver | 'add' = ver e incluir | 'manage' = ver, incluir e excluir
export const createProject = async (name) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user");

    const newDocRef = await addDoc(collection(db, COLLECTION_NAME), {
      name,
      userId: user.uid,
      collaborators: [],
      collaboratorRoles: {},
      createdAt: new Date().toISOString()
    });
    
    return { id: newDocRef.id, name, userId: user.uid, collaborators: [], collaboratorRoles: {} };
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
};

export const getUserProjects = async (userId) => {
  try {
    const [ownedSnap, sharedSnap] = await Promise.all([
      getDocs(query(collection(db, COLLECTION_NAME), where("userId", "==", userId))),
      getDocs(query(collection(db, COLLECTION_NAME), where("collaborators", "array-contains", userId)))
    ]);
    const owned = ownedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const shared = sharedSnap.docs.map(d => ({ id: d.id, ...d.data(), isShared: true }));
    const byId = new Map();
    owned.forEach(p => byId.set(p.id, p));
    shared.forEach(p => { if (!byId.has(p.id)) byId.set(p.id, p); });
    return Array.from(byId.values());
  } catch (error) {
    console.error("Error fetching projects:", error);
    throw error;
  }
};

export const updateProject = async (id, data) => {
  try {
    const ref = doc(db, COLLECTION_NAME, id);
    await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Error updating project:", error);
    throw error;
  }
};

export const deleteProject = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    console.error("Error deleting project:", error);
    throw error;
  }
};

export const addCollaborator = async (projectId, uid, role) => {
  try {
    const ref = doc(db, COLLECTION_NAME, projectId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Project not found");
    const data = snap.data();
    const prev = data.collaborators || [];
    const collaborators = prev.includes(uid) ? prev : [...prev, uid];
    const collaboratorRoles = { ...(data.collaboratorRoles || {}), [uid]: role };
    await updateDoc(ref, { collaborators, collaboratorRoles, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Error adding collaborator:", error);
    throw error;
  }
};

export const getProjectRole = (project, uid) => {
  if (!project || !uid) return null;
  if (project.userId === uid) return 'owner';
  return (project.collaboratorRoles || {})[uid] || null;
};
