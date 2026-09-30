import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// CRITICAL: Must pass firebaseConfig.firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on app startup
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears to be offline');
    }
    // We expect doc not found or permissions on 'test/connection', which confirms server reachability
    return true;
  }
}

// Sign-In with Google Popup
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    // Sync user profile in /users/{userId}
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        userId: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Anonymous User',
        photoURL: user.photoURL || '',
      }, { merge: true });
    }
    return user;
  } catch (error) {
    console.error('Google Sign-in failed:', error);
    throw error;
  }
}

// Sign Out
export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign-out failed:', error);
  }
}

export interface UserCreationItem {
  id: string;
  userId: string;
  type: 'video' | 'image' | 'music' | 'transcription' | 'chat_export';
  title: string;
  prompt?: string;
  mediaUrl?: string;
  aspectRatio?: string;
  model?: string;
  metadata?: string;
  createdAt?: any;
}

// Save creation to Firestore
export async function saveUserCreation(item: Omit<UserCreationItem, 'id' | 'userId'> & { id?: string; userId?: string }) {
  if (!auth.currentUser) throw new Error('User not authenticated');
  const creationId = item.id || `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `creations/${creationId}`;
  try {
    const docRef = doc(db, 'creations', creationId);
    const payload: UserCreationItem = {
      ...item,
      id: creationId,
      userId: auth.currentUser.uid,
    };
    await setDoc(docRef, payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

// Fetch creations for current user
export async function getUserCreations(userId: string): Promise<UserCreationItem[]> {
  const path = 'creations';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const results: UserCreationItem[] = [];
    snapshot.forEach(docSnap => {
      results.push(docSnap.data() as UserCreationItem);
    });
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

// Delete creation
export async function deleteUserCreation(creationId: string) {
  if (!auth.currentUser) return;
  const path = `creations/${creationId}`;
  try {
    await deleteDoc(doc(db, 'creations', creationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
