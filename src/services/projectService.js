import { db, auth } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  query, 
  where, 
  getDocs,
  arrayUnion 
} from 'firebase/firestore';
import { DEFAULT_FAMILY_CONFIG } from '../constants/projectTypes.js';

const COLLECTION_NAME = 'projects';

// Roles: 'view' = só ver | 'add' = ver e incluir | 'manage' = ver, incluir e excluir
export const createProject = async (name, projectType = 'default') => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user");

    const payload = {
      name,
      userId: user.uid,
      projectType: projectType || 'default',
      collaborators: [],
      collaboratorRoles: {},
      createdAt: new Date().toISOString(),
    };

    if (projectType === 'family') {
      payload.familyConfig = { ...DEFAULT_FAMILY_CONFIG };
    }

    const newDocRef = await addDoc(collection(db, COLLECTION_NAME), payload);
    
    return { id: newDocRef.id, ...payload };
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

export const addCollaborator = async (projectId, uid, role, displayName = null) => {
  try {
    const ref = doc(db, COLLECTION_NAME, projectId);
    // Important: não fazemos getDoc aqui, porque o convidado ainda não tem read no projeto.
    // updateDoc com arrayUnion permite o "self-join" permitido pelas rules.
    const safeName = (displayName || '').trim();
    await updateDoc(ref, {
      collaborators: arrayUnion(uid),
      [`collaboratorRoles.${uid}`]: role,
      ...(safeName ? { [`collaboratorNames.${uid}`]: safeName } : {}),
      updatedAt: new Date().toISOString()
    });
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
