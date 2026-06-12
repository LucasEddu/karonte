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

const COLLECTION = 'creditCards';

/**
 * Busca todos os cartões de crédito associados ao usuário e projeto ativo.
 * @param {string} userId
 * @param {string|null} projectId
 */
export const getCreditCards = async (userId, projectId = null) => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where("userId", "==", userId),
      where("projectId", "==", projectId || 'geral')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Error fetching credit cards:', err);
    return [];
  }
};

/**
 * Registra um novo cartão de crédito.
 * @param {object} cardData { name, limit, closingDay, dueDay }
 * @param {string|null} projectId
 */
export const addCreditCard = async (cardData, projectId = null) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user");
    
    const payload = {
      ...cardData,
      userId: user.uid,
      projectId: projectId || 'geral',
      createdAt: new Date().toISOString()
    };
    const ref = await addDoc(collection(db, COLLECTION), payload);
    return { id: ref.id, ...payload };
  } catch (err) {
    console.error('Error adding credit card:', err);
    throw err;
  }
};

/**
 * Exclui um cartão de crédito cadastrado.
 * @param {string} cardId
 */
export const deleteCreditCard = async (cardId) => {
  try {
    await deleteDoc(doc(db, COLLECTION, cardId));
  } catch (err) {
    console.error('Error deleting credit card:', err);
    throw err;
  }
};
