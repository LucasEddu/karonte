import { db, auth } from '../config/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { addCollaborator } from './projectService';

const COLLECTION_NAME = 'invites';

export const createInvite = async (projectId, projectName, toEmail, role) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const email = (toEmail || '').trim().toLowerCase();
    if (!email) throw new Error('E-mail é obrigatório');

    const ref = await addDoc(collection(db, COLLECTION_NAME), {
      fromUid: user.uid,
      toEmail: email,
      projectId,
      projectName,
      role,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    return { id: ref.id };
  } catch (error) {
    console.error('Error creating invite:', error);
    throw error;
  }
};

export const getInvitesByEmail = async (email) => {
  try {
    if (!email) return [];
    const q = query(
      collection(db, COLLECTION_NAME),
      where('toEmail', '==', email.trim().toLowerCase())
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return list.filter(i => i.status === 'pending');
  } catch (error) {
    console.error('Error fetching invites:', error);
    throw error;
  }
};

export const acceptInvite = async (inviteId) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    const ref = doc(db, COLLECTION_NAME, inviteId);
    const { getDoc } = await import('firebase/firestore');
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Convite não encontrado');
    const invite = snap.data();
    if (invite.status !== 'pending') throw new Error('Convite já foi processado');
    if (invite.toEmail.toLowerCase() !== (user.email || '').toLowerCase()) throw new Error('Convite não é para este usuário');

    await addCollaborator(invite.projectId, user.uid, invite.role);
    await updateDoc(ref, { status: 'accepted', toUid: user.uid, respondedAt: new Date().toISOString() });
    return { projectId: invite.projectId };
  } catch (error) {
    console.error('Error accepting invite:', error);
    throw error;
  }
};

export const rejectInvite = async (inviteId) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    const ref = doc(db, COLLECTION_NAME, inviteId);
    const { getDoc } = await import('firebase/firestore');
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Convite não encontrado');
    const invite = snap.data();
    if (invite.status !== 'pending') return;
    if (invite.toEmail.toLowerCase() !== (user.email || '').toLowerCase()) throw new Error('Convite não é para este usuário');

    await updateDoc(ref, { status: 'rejected', toUid: user.uid, respondedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error rejecting invite:', error);
    throw error;
  }
};
