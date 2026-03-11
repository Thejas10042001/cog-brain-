
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
  signOut,
  updatePassword
} = firebaseAuth as any;

// Define User and Auth types locally as any to bypass module export issues in this environment.
export type User = any;
export type Auth = any;

import { StoredDocument } from "../types";

// State to track if we've hit a permission error
let internalPermissionError = false;

const firebaseConfig = {
  apiKey: "AIzaSyDf4CzUgSSGpRKlaLZiHTV25PHPUq4gltQ",
  authDomain: "spiked-ai-76993.firebaseapp.com",
  projectId: "spiked-ai-76993",
  storageBucket: "spiked-ai-76993.firebasestorage.app",
  messagingSenderId: "937017757020",
  appId: "1:937017757020:web:1a899a8be406844e268599"
};

// Properly type db and auth instances instead of using any
let db: Firestore | null = null;
let auth: Auth | null = null;

// Initialize Firebase App, Firestore, and Auth
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "REPLACE_WITH_YOUR_API_KEY") {
    // Check if app is already initialized to avoid "already exists" errors
    const app: any = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    
    // Use initializeFirestore with experimentalForceLongPolling to bypass potential WebSocket blocks
    // Use memoryLocalCache to avoid any local persistence issues that might cause hangs
    try {
      db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: true,
        localCache: memoryLocalCache(),
      });
      console.log("Firestore initialized with long polling and memory cache.");
    } catch (e) {
      // If already initialized, just get the existing instance
      db = getFirestore(app);
      console.warn("Firestore already initialized, using existing instance.");
    }
    
    auth = getAuth(app);
  }
} catch (error) {
  console.error("Firebase Initialization Error:", error);
}

const COLLECTION_NAME = "cognitive_documents";
const HISTORY_COLLECTION = "simulation_history";
const CONTEXT_COLLECTION = "meeting_contexts";
const SESSIONS_COLLECTION = "user_sessions";
const ACTIVITIES_COLLECTION = "user_activities";

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
export const changePassword = (newPass: string) => {
  if (!auth || !auth.currentUser) return Promise.reject("Not authenticated");
  return updatePassword(auth.currentUser, newPass);
};
export const subscribeToAuth = (callback: (user: User | null) => void) => {
  if (auth) {
    return onAuthStateChanged(auth, callback);
  }
  // Return a no-op cleanup function if auth is not initialized
  return () => {};
};

export const saveSimulationHistory = async (history: Omit<any, 'id' | 'userId' | 'timestamp'>): Promise<string | null> => {
  if (!db || !auth || !auth.currentUser) return null;
  try {
    const docRef = await addDoc(getUserCollection(HISTORY_COLLECTION), {
      ...history,
      userId: auth.currentUser.uid,
      timestamp: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error saving simulation history:", error);
    return null;
  }
};

export const fetchSimulationHistory = async (): Promise<any[]> => {
  if (!db || !auth || !auth.currentUser) return [];
  try {
    // 1. Try fetching from the new user-isolated subcollection
    const q = query(getUserCollection(HISTORY_COLLECTION));
    const querySnapshot = await getDocs(q);
    
    let docs = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: (doc.data().timestamp as Timestamp).toMillis()
    }));

    // 2. Fallback: If new collection is empty, try fetching from the legacy top-level collection
    if (docs.length === 0) {
      const qLegacy = query(
        collection(db, HISTORY_COLLECTION),
        where("userId", "==", auth.currentUser.uid)
      );
      const querySnapshotLegacy = await getDocs(qLegacy);
      docs = querySnapshotLegacy.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: (doc.data().timestamp as Timestamp).toMillis()
      }));
    }

    return docs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Error fetching simulation history:", error);
    return [];
  }
};

export const saveDocumentToFirebase = async (name: string, content: string, type: string): Promise<string | null> => {
  if (!db || !auth || !auth.currentUser) return null;

  try {
    const now = Timestamp.now();
    const docRef = await addDoc(getUserCollection(COLLECTION_NAME), {
      userId: auth.currentUser.uid, // Tie document to unique user
      name,
      content,
      type,
      timestamp: now,
      updatedAt: now
    });
    internalPermissionError = false;
    return docRef.id;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      internalPermissionError = true;
      console.error("CRITICAL: Firestore Permission Denied. Ensure rules are updated to check request.auth.uid.");
    }
    return null;
  }
};

export const updateDocumentInFirebase = async (id: string, newContent: string): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  try {
    const docRef = doc(getUserCollection(COLLECTION_NAME), id);
    // Note: Firestore rules should prevent updating if userId doesn't match
    await updateDoc(docRef, {
      content: newContent,
      updatedAt: Timestamp.now()
    });
    return true;
  } catch (error: any) {
    console.error("Error updating document:", error);
    return false;
  }
};

export const fetchDocumentsFromFirebase = async (): Promise<StoredDocument[]> => {
  if (!db || !auth || !auth.currentUser) return [];

  try {
    // 1. Try fetching from the new user-isolated subcollection
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

    // 2. Fallback: If new collection is empty, try fetching from the legacy top-level collection
    if (docs.length === 0) {
      const qLegacy = query(
        collection(db, COLLECTION_NAME),
        where("userId", "==", auth.currentUser.uid)
      );
      const querySnapshotLegacy = await getDocs(qLegacy);
      docs = querySnapshotLegacy.docs.map(doc => {
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
    }

    // Client-side sort by timestamp descending
    return docs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      internalPermissionError = true;
    }
    console.error("Fetch documents failed:", error);
    return [];
  }
};

export const deleteDocumentFromFirebase = async (id: string): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  try {
    await deleteDoc(doc(getUserCollection(COLLECTION_NAME), id));
    internalPermissionError = false;
    return true;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      internalPermissionError = true;
    }
    return false;
  }
};

export const saveMeetingContext = async (data: { meetingContext: any, selectedLibraryDocIds: string[], analysis?: any }): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
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
      // Update existing
      const docId = querySnapshot.docs[0].id;
      await updateDoc(doc(userContextCol, docId), contextData);
    } else {
      // Create new
      await addDoc(userContextCol, contextData);
    }
    return true;
  } catch (error) {
    console.error("Error saving meeting context:", error);
    return false;
  }
};

export const fetchMeetingContext = async (): Promise<any | null> => {
  if (!db || !auth || !auth.currentUser) return null;
  try {
    // 1. Try fetching from the new user-isolated subcollection
    const querySnapshot = await getDocs(getUserCollection(CONTEXT_COLLECTION));
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }

    // 2. Fallback: If new collection is empty, try fetching from the legacy top-level collection
    const qLegacy = query(
      collection(db, CONTEXT_COLLECTION),
      where("userId", "==", auth.currentUser.uid)
    );
    const querySnapshotLegacy = await getDocs(qLegacy);
    if (!querySnapshotLegacy.empty) {
      return querySnapshotLegacy.docs[0].data();
    }

    return null;
  } catch (error) {
    console.error("Error fetching meeting context:", error);
    return null;
  }
};

export const deleteMeetingContext = async (): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  try {
    const userContextCol = getUserCollection(CONTEXT_COLLECTION);
    const querySnapshot = await getDocs(userContextCol);
    if (!querySnapshot.empty) {
      await deleteDoc(doc(userContextCol, querySnapshot.docs[0].id));
    }
    return true;
  } catch (error) {
    console.error("Error deleting meeting context:", error);
    return false;
  }
};

// Activity & Session Tracking
export const logActivity = async (type: string, details: any, node?: string): Promise<void> => {
  if (!db || !auth || !auth.currentUser) return;
  try {
    await addDoc(getUserCollection(ACTIVITIES_COLLECTION), {
      userId: auth.currentUser.uid,
      type,
      details: JSON.stringify(details),
      node: node || 'unknown',
      timestamp: Timestamp.now()
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};

export const startSession = async (): Promise<string | null> => {
  if (!db || !auth || !auth.currentUser) return null;
  try {
    const userAgent = navigator.userAgent;
    let deviceName = "Unknown Device";
    
    if (/android/i.test(userAgent)) deviceName = "Android Device";
    else if (/iPad|iPhone|iPod/.test(userAgent)) deviceName = "iOS Device";
    else if (/Windows/i.test(userAgent)) deviceName = "Windows PC";
    else if (/Mac/i.test(userAgent)) deviceName = "Macintosh";
    else if (/Linux/i.test(userAgent)) deviceName = "Linux PC";

    const docRef = await addDoc(getUserCollection(SESSIONS_COLLECTION), {
      userId: auth.currentUser.uid,
      startTime: Timestamp.now(),
      endTime: null,
      duration: 0,
      deviceName,
      userAgent,
      status: 'active'
    });
    return docRef.id;
  } catch (error) {
    console.error("Error starting session:", error);
    return null;
  }
};

export const endSession = async (sessionId: string): Promise<void> => {
  if (!db || !auth || !auth.currentUser || !sessionId) return;
  try {
    const sessionRef = doc(getUserCollection(SESSIONS_COLLECTION), sessionId);
    const endTime = Timestamp.now();
    
    await updateDoc(sessionRef, {
      endTime: endTime,
      status: 'ended'
    });
  } catch (error) {
    console.error("Error ending session:", error);
  }
};

export const fetchUserActivities = async (): Promise<any[]> => {
  if (!db || !auth || !auth.currentUser) return [];
  try {
    const q = query(getUserCollection(ACTIVITIES_COLLECTION));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: (doc.data().timestamp as Timestamp).toMillis()
    })).sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Error fetching activities:", error);
    return [];
  }
};

export const fetchUserSessions = async (): Promise<any[]> => {
  if (!db || !auth || !auth.currentUser) return [];
  try {
    const q = query(getUserCollection(SESSIONS_COLLECTION));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      const startTime = (data.startTime as Timestamp).toMillis();
      const endTime = data.endTime ? (data.endTime as Timestamp).toMillis() : null;
      return {
        id: doc.id,
        ...data,
        startTime,
        endTime,
        duration: endTime ? endTime - startTime : 0
      };
    }).sort((a, b) => b.startTime - a.startTime);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return [];
  }
};
