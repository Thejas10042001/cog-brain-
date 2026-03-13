
// Standard modular Firebase v9+ initialization
// Use separate imports for value and type to resolve potential "no exported member" errors in some environments.
// Fix: Use wildcard import and destructuring to resolve 'no exported member' errors for initializeApp.
import * as firebaseApp from "firebase/app";
const { initializeApp, getApp, getApps } = firebaseApp as any;

// Fix: Removed unused 'FirebaseApp' type import which was causing compilation errors.

import { 
  getFirestore, 
  initializeFirestore,
  Firestore,
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where,
  Timestamp,
  deleteDoc,
  doc,
  updateDoc,
  memoryLocalCache
} from "firebase/firestore";

// Fix: Use wildcard import and destructuring for firebase/auth to resolve "no exported member" errors.
import * as firebaseAuth from "firebase/auth";
const { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} = firebaseAuth as any;

// Define User and Auth types locally as any to bypass module export issues in this environment.
export type User = any;
export type Auth = any;

import { StoredDocument } from "../types";

// State to track if we've hit a permission error
let internalPermissionError = false;

import firebaseConfig from "../firebase-applet-config.json";

// Properly type db and auth instances instead of using any
export let db: Firestore | null = null;
export let auth: Auth | null = null;

// Initialize Firebase App, Firestore, and Auth
try {
  if (firebaseConfig.apiKey) {
    // Check if app is already initialized to avoid "already exists" errors
    const app: any = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    
    // Use initializeFirestore with experimentalForceLongPolling to bypass potential WebSocket blocks
    // Use memoryLocalCache to avoid any local persistence issues that might cause hangs
    try {
      db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: true,
        localCache: memoryLocalCache(),
      }, firebaseConfig.firestoreDatabaseId);
      console.log("Firestore initialized with long polling and memory cache.");
    } catch (e) {
      // If already initialized, just get the existing instance
      db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
      console.warn("Firestore already initialized, using existing instance.");
    }
    
    auth = getAuth(app);
  }
} catch (error) {
  console.error("Firebase Initialization Error:", error);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  if (errInfo.error.includes('permission-denied') || errInfo.error.includes('Missing or insufficient permissions')) {
    internalPermissionError = true;
  }
  
  throw new Error(JSON.stringify(errInfo));
}

const COLLECTION_NAME = "cognitive_documents";
const HISTORY_COLLECTION = "simulation_history";
const CONTEXT_COLLECTION = "meeting_contexts";

// Helper to get user-isolated collection reference
const getUserCollection = (subCollection: string) => {
  if (!db || !auth || !auth.currentUser) throw new Error("Firebase not initialized or user not authenticated");
  return collection(db, "users", auth.currentUser.uid, subCollection);
};

export const getAuthInstance = () => auth;
export const getDbInstance = () => db;

export const getFirebasePermissionError = () => internalPermissionError;
export const clearFirebasePermissionError = () => { internalPermissionError = false; };

// Auth Helper Functions
export const loginUser = (email: string, pass: string) => auth ? signInWithEmailAndPassword(auth, email, pass) : Promise.reject("Auth module not initialized");
export const registerUser = (email: string, pass: string) => auth ? createUserWithEmailAndPassword(auth, email, pass) : Promise.reject("Auth module not initialized");
export const logoutUser = () => auth && signOut(auth);
export const subscribeToAuth = (callback: (user: User | null) => void) => {
  if (auth) {
    return onAuthStateChanged(auth, callback);
  }
  // Return a no-op cleanup function if auth is not initialized
  return () => {};
};

export const saveSimulationHistory = async (history: Omit<any, 'id' | 'userId' | 'timestamp'>): Promise<string | null> => {
  if (!db || !auth || !auth.currentUser) return null;
  const path = `users/${auth.currentUser.uid}/${HISTORY_COLLECTION}`;
  try {
    const docRef = await addDoc(getUserCollection(HISTORY_COLLECTION), {
      ...history,
      userId: auth.currentUser.uid,
      timestamp: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return null;
  }
};

export const fetchSimulationHistory = async (): Promise<any[]> => {
  if (!db || !auth || !auth.currentUser) return [];
  const path = `users/${auth.currentUser.uid}/${HISTORY_COLLECTION}`;
  try {
    const q = query(getUserCollection(HISTORY_COLLECTION));
    const querySnapshot = await getDocs(q);
    
    let docs = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: (doc.data().timestamp as Timestamp).toMillis()
    }));

    return docs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const saveDocumentToFirebase = async (name: string, content: string, type: string): Promise<string | null> => {
  if (!db || !auth || !auth.currentUser) return null;
  const path = `users/${auth.currentUser.uid}/${COLLECTION_NAME}`;

  try {
    const now = Timestamp.now();
    const docRef = await addDoc(getUserCollection(COLLECTION_NAME), {
      userId: auth.currentUser.uid,
      name,
      content,
      type,
      timestamp: now,
      updatedAt: now
    });
    internalPermissionError = false;
    return docRef.id;
  } catch (error: any) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return null;
  }
};

export const updateDocumentInFirebase = async (id: string, newContent: string): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  const path = `users/${auth.currentUser.uid}/${COLLECTION_NAME}/${id}`;
  try {
    const docRef = doc(getUserCollection(COLLECTION_NAME), id);
    await updateDoc(docRef, {
      content: newContent,
      updatedAt: Timestamp.now()
    });
    return true;
  } catch (error: any) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return false;
  }
};

export const fetchDocumentsFromFirebase = async (): Promise<StoredDocument[]> => {
  if (!db || !auth || !auth.currentUser) return [];
  const path = `users/${auth.currentUser.uid}/${COLLECTION_NAME}`;

  try {
    const q = query(getUserCollection(COLLECTION_NAME));
    const querySnapshot = await getDocs(q);
    internalPermissionError = false;
    
    let docs = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        content: data.content,
        type: data.type,
        timestamp: data.timestamp?.toMillis() || Date.now(),
        updatedAt: data.updatedAt?.toMillis() || data.timestamp?.toMillis() || Date.now()
      };
    });

    return docs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error: any) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const deleteDocumentFromFirebase = async (id: string): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  const path = `users/${auth.currentUser.uid}/${COLLECTION_NAME}/${id}`;
  try {
    await deleteDoc(doc(getUserCollection(COLLECTION_NAME), id));
    internalPermissionError = false;
    return true;
  } catch (error: any) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
};

export const saveMeetingContext = async (data: { meetingContext: any, selectedLibraryDocIds: string[], analysis?: any }): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  const path = `users/${auth.currentUser.uid}/${CONTEXT_COLLECTION}`;
  try {
    const userId = auth.currentUser.uid;
    const userContextCol = getUserCollection(CONTEXT_COLLECTION);
    const querySnapshot = await getDocs(userContextCol);
    
    const contextData = {
      ...data,
      userId,
      updatedAt: Timestamp.now()
    };

    if (!querySnapshot.empty) {
      const docId = querySnapshot.docs[0].id;
      await updateDoc(doc(userContextCol, docId), contextData);
    } else {
      await addDoc(userContextCol, contextData);
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
};

export const fetchMeetingContext = async (): Promise<any | null> => {
  if (!db || !auth || !auth.currentUser) return null;
  const path = `users/${auth.currentUser.uid}/${CONTEXT_COLLECTION}`;
  try {
    const querySnapshot = await getDocs(getUserCollection(CONTEXT_COLLECTION));
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
};

export const deleteMeetingContext = async (): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  const path = `users/${auth.currentUser.uid}/${CONTEXT_COLLECTION}`;
  try {
    const userContextCol = getUserCollection(CONTEXT_COLLECTION);
    const querySnapshot = await getDocs(userContextCol);
    if (!querySnapshot.empty) {
      await deleteDoc(doc(userContextCol, querySnapshot.docs[0].id));
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
};

