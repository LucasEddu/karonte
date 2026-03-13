import { auth, db } from '../config/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updatePassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

// Login
export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Fetch user role/details from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (!userData.active) {
        await signOut(auth); // Force logout if blocked
        throw new Error('access-denied');
      }
      return { ...user, ...userData };
    }
    
    return user;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

// Register
export const register = async (email, password, fullName, role = 'user') => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userData = {
      uid: user.uid,
      email: email,
      fullName: fullName,
      username: fullName.split(' ')[0] || email.split('@')[0], // Generate simple username
      role: role,
      active: true,
      createdAt: new Date().toISOString()
    };

    // Save user details to Firestore
    await setDoc(doc(db, 'users', user.uid), userData);

    return { ...user, ...userData };
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
};

// Logout
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
};

// Get all users (Admin only ideally, but handled mostly client-side for now)
export const getAllUsers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
};

// Toggle user status (Admin only)
export const toggleUserStatus = async (uid, currentStatus) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      active: !currentStatus
    });
  } catch (error) {
    console.error("Error toggling status:", error);
    throw error;
  }
};

// Update username
export const updateUsername = async (uid, newUsername) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      username: newUsername
    });
  } catch (error) {
    console.error("Error updating username:", error);
    throw error;
  }
};

// Change own password (for the currently logged-in user only)
export const changeOwnPassword = async (user, newPassword) => {
   try {
     await updatePassword(user, newPassword);
   } catch(error) {
     console.error("Error changing password:", error);
     throw error;
   }
};

// Send password reset email to any user (Admin action — no backend needed)
export const sendPasswordReset = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch(error) {
    console.error("Error sending password reset:", error);
    throw error;
  }
};

// Create an admin user (can be called from browser console to bootstrap first admin)
export const createAdminUser = async (email, password, fullName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const userData = {
      uid: user.uid,
      email: email,
      fullName: fullName,
      username: fullName.split(' ')[0] || email.split('@')[0],
      role: 'admin',
      active: true,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', user.uid), userData);
    return { ...user, ...userData };
  } catch(error) {
    console.error("Error creating admin user:", error);
    throw error;
  }
};
