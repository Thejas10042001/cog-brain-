
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
  setDoc,
  memoryLocalCache,
  getDocFromServer,
  getDoc,
  onSnapshot
} from "firebase/firestore";

// Fix: Use wildcard import and destructuring for firebase/auth to resolve "no exported member" errors.
import * as firebaseAuth from "firebase/auth";
const { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendEmailVerification
} = firebaseAuth as any;

import * as firebaseStorage from "firebase/storage";
const { getStorage, ref, uploadBytes, getDownloadURL } = firebaseStorage as any;

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Define User and Auth types locally as any to bypass module export issues in this environment.
export type User = any;
export type Auth = any;

import { StoredDocument, SalesGPTSession, UserSettings, ActivityLog } from "../types";

// State to track if we've hit a permission error
let internalPermissionError = false;

// Properly type db and auth instances instead of using any
export let db: Firestore | null = null;
export let auth: Auth | null = null;
export let storage: any = null;

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
    storage = getStorage(app);
  }
} catch (error) {
  console.error("Firebase Initialization Error:", error);
}

// Connection test (Commented out to stop offline warnings when Firebase setup is declined)
// async function testConnection() {
//   if (!db) return;
//   try {
//     await getDocFromServer(doc(db, 'test', 'connection'));
//   } catch (error) {
//     if(error instanceof Error && error.message.includes('the client is offline')) {
//       console.error("Please check your Firebase configuration. The client is offline.");
//     }
//   }
// }
// testConnection();

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
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const COLLECTION_NAME = "cognitive_documents";
const HISTORY_COLLECTION = "simulation_history";
const CONTEXT_COLLECTION = "meeting_contexts";
const FOLDERS_COLLECTION = "folders";
const SALES_GPT_COLLECTION = "sales_gpt_history";
const GROUPS_COLLECTION = "groups";
const INVITES_COLLECTION = "group_invites";
const MESSAGES_COLLECTION = "group_messages";
const USERS_COLLECTION = "users";
const UPDATES_COLLECTION = "app_updates";
const ACTIVITY_LOGS_COLLECTION = "activity_logs";

// Helper to remove undefined values from objects recursively for Firestore
const sanitizeData = (data: any): any => {
  if (data === undefined) return null;
  if (data === null) return null;
  if (Array.isArray(data)) return data.map(sanitizeData);
  if (typeof data === 'object' && data !== null && !(data instanceof Timestamp)) {
    const sanitized: any = {};
    for (const key in data) {
      const value = sanitizeData(data[key]);
      if (value !== undefined) {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  return data;
};

// Helper to get user-isolated collection reference
const getUserCollection = (subCollection: string) => {
  if (!db || !auth || !auth.currentUser) throw new Error("Firebase not initialized or user not authenticated");
  return collection(db, "users", auth.currentUser.uid, subCollection);
};

export const getAuthInstance = () => auth;
export const getDbInstance = () => db;

export const getFirebasePermissionError = () => internalPermissionError;
export const clearFirebasePermissionError = () => { internalPermissionError = false; };

// SalesGPT History Functions
export const saveSalesGPTSession = async (session: Partial<SalesGPTSession>): Promise<string | null> => {
  if (!db || !auth || !auth.currentUser) return null;
  const path = SALES_GPT_COLLECTION;
  try {
    const userId = auth.currentUser.uid;
    const { id, ...rest } = session;
    const sessionData = sanitizeData({
      ...rest,
      userId,
      timestamp: Timestamp.now()
    });

    if (id) {
      await updateDoc(doc(getUserCollection(path), id), sessionData);
      return id;
    } else {
      const docRef = await addDoc(getUserCollection(path), sessionData);
      return docRef.id;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return null;
  }
};

export const fetchSalesGPTSessions = async (): Promise<any[]> => {
  if (!db || !auth || !auth.currentUser) return [];
  const path = SALES_GPT_COLLECTION;
  try {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    
    const q = query(
      getUserCollection(path),
      where("timestamp", ">=", Timestamp.fromDate(fifteenDaysAgo))
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toMillis() || Date.now()
      };
    }).sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export const deleteSalesGPTSession = async (id: string): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  const path = SALES_GPT_COLLECTION;
  try {
    await deleteDoc(doc(getUserCollection(path), id));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
};

// Folder Helper Functions
export const saveFolderToFirebase = async (
  name: string, 
  isCustom: boolean = true, 
  type: 'main' | 'sub' = 'main', 
  parentId: string | null = null
): Promise<string | null> => {
  if (!db || !auth || !auth.currentUser) return null;
  const path = FOLDERS_COLLECTION;
  try {
    const docRef = await addDoc(getUserCollection(path), {
      userId: auth.currentUser.uid,
      name,
      isCustom,
      type,
      parentId,
      timestamp: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return null;
  }
};

export const fetchFoldersFromFirebase = async (): Promise<any[]> => {
  if (!db || !auth || !auth.currentUser) return [];
  const path = FOLDERS_COLLECTION;
  try {
    const querySnapshot = await getDocs(getUserCollection(path));
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toMillis() || Date.now()
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export const deleteFolderFromFirebase = async (id: string): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  const path = FOLDERS_COLLECTION;
  try {
    await deleteDoc(doc(getUserCollection(path), id));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
};

export const renameFolderInFirebase = async (id: string, newName: string): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  const path = FOLDERS_COLLECTION;
  try {
    const docRef = doc(getUserCollection(path), id);
    await updateDoc(docRef, {
      name: newName,
      updatedAt: Timestamp.now()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return false;
  }
};

export const moveDocumentToFolder = async (docId: string, folderId: string | null): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  const path = COLLECTION_NAME;
  try {
    const docRef = doc(getUserCollection(path), docId);
    await updateDoc(docRef, {
      folderId: folderId,
      updatedAt: Timestamp.now()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return false;
  }
};

// Auth Helper Functions
export const saveUserProfile = async (user: any) => {
  if (!db || !user) return;
  const path = USERS_COLLECTION;
  try {
    const userRef = doc(db, path, user.uid);
    await updateDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: Timestamp.now()
    }).catch(async (err) => {
      // If doc doesn't exist, create it
      if (err.code === 'not-found') {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: Timestamp.now(),
          lastLogin: Timestamp.now()
        });
      }
    });
  } catch (error) {
    console.error("Error saving user profile:", error);
  }
};

export const loginUser = async (email: string, pass: string) => {
  if (!auth) return Promise.reject("Auth module not initialized");
  const result = await signInWithEmailAndPassword(auth, email, pass);
  await saveUserProfile(result.user);
  await initializeBackendSession(result.user);
  return result;
};

export const loginWithGoogle = async () => {
  if (!auth) return Promise.reject("Auth module not initialized");
  const provider = new GoogleAuthProvider();
  // Google handles its own MFA (Prompts, SMS, TOTP, Passkeys) during the popup flow.
  const result = await signInWithPopup(auth, provider);
  await saveUserProfile(result.user);
  await initializeBackendSession(result.user);
  return result;
};

export const registerUser = async (email: string, pass: string) => {
  if (!auth) return Promise.reject("Auth module not initialized");
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  await saveUserProfile(result.user);
  await initializeBackendSession(result.user);
  return result;
};
export const logoutUser = () => auth && signOut(auth);

// Session Helper Functions
export const initializeBackendSession = async (user: any) => {
  if (!user) return;
  try {
    const idToken = await user.getIdToken();
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('deviceId', deviceId);
    }
    
    const res = await fetch('/api/auth/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, deviceId })
    });
    
    if (res.status === 401) {
      // If backend says auth failed, log out
      await logoutUser();
    }
  } catch (error) {
    console.error("Failed to initialize backend session:", error);
  }
};

export const syncHeartbeat = async () => {
  try {
    await fetch('/api/auth/heartbeat', { method: 'POST' });
  } catch (e) {}
};

export const updateUserProfile = async (displayName: string, photoURL: string) => {
  if (!auth || !auth.currentUser || !db) return false;
  try {
    await updateProfile(auth.currentUser, {
      displayName,
      photoURL
    });
    // Also update Firestore
    const userRef = doc(db, USERS_COLLECTION, auth.currentUser.uid);
    await updateDoc(userRef, {
      displayName,
      photoURL,
      updatedAt: Timestamp.now()
    });
    return true;
  } catch (error) {
    console.error("Error updating user profile:", error);
    return false;
  }
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  if (auth) {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        await initializeBackendSession(user);
      }
      callback(user);
    });
  }
  // Return a no-op cleanup function if auth is not initialized
  return () => {};
};

export const saveSimulationHistory = async (history: Omit<any, 'id' | 'userId' | 'timestamp'>): Promise<string | null> => {
  if (!db || !auth || !auth.currentUser) return null;
  const path = HISTORY_COLLECTION;
  try {
    const docRef = await addDoc(getUserCollection(path), sanitizeData({
      ...history,
      userId: auth.currentUser.uid,
      timestamp: Timestamp.now()
    }));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return null;
  }
};

export const fetchSimulationHistory = async (): Promise<any[]> => {
  if (!db || !auth || !auth.currentUser) return [];
  const path = HISTORY_COLLECTION;
  try {
    // 1. Try fetching from the new user-isolated subcollection
    const q = query(getUserCollection(path));
    const querySnapshot = await getDocs(q);
    
    let docs = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toMillis() || Date.now()
      };
    });

    // 2. Fallback: If new collection is empty, try fetching from the legacy top-level collection
    if (docs.length === 0) {
      const qLegacy = query(
        collection(db, path),
        where("userId", "==", auth.currentUser.uid)
      );
      const querySnapshotLegacy = await getDocs(qLegacy);
      docs = querySnapshotLegacy.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toMillis() || Date.now()
        };
      });
    }

    return docs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export const saveDocumentToFirebase = async (
  name: string, 
  content: string, 
  type: string, 
  folderId?: string, 
  category?: string,
  reasoning?: string
): Promise<string | null> => {
  if (!db || !auth || !auth.currentUser) return null;
  const path = COLLECTION_NAME;
  try {
    const now = Timestamp.now();
    const docRef = await addDoc(getUserCollection(path), {
      userId: auth.currentUser.uid, // Tie document to unique user
      name,
      content,
      type,
      folderId: folderId || null,
      category: category || null,
      categorizationReasoning: reasoning || null,
      timestamp: now,
      updatedAt: now
    });
    internalPermissionError = false;
    return docRef.id;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      internalPermissionError = true;
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    return null;
  }
};

export const updateDocumentInFirebase = async (id: string, newContent: string): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  const path = COLLECTION_NAME;
  try {
    const docRef = doc(getUserCollection(path), id);
    // Note: Firestore rules should prevent updating if userId doesn't match
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
  const path = COLLECTION_NAME;
  try {
    // 1. Try fetching from the new user-isolated subcollection
    const q = query(getUserCollection(path));
    const querySnapshot = await getDocs(q);
    internalPermissionError = false;
    
    let docs = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        content: data.content,
        type: data.type,
        folderId: data.folderId || null,
        category: data.category || null,
        categorizationReasoning: data.categorizationReasoning || null,
        timestamp: data.timestamp?.toMillis() || Date.now(),
        updatedAt: data.updatedAt?.toMillis() || data.timestamp?.toMillis() || Date.now()
      };
    });

    // 2. Fallback: If new collection is empty, try fetching from the legacy top-level collection
    if (docs.length === 0) {
      const qLegacy = query(
        collection(db, path),
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
          folderId: data.folderId || null,
          category: data.category || null,
          categorizationReasoning: data.categorizationReasoning || null,
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
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export const deleteDocumentFromFirebase = async (id: string): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  const path = COLLECTION_NAME;
  try {
    await deleteDoc(doc(getUserCollection(path), id));
    internalPermissionError = false;
    return true;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      internalPermissionError = true;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
};

export const saveMeetingContext = async (data: { meetingContext: any, selectedLibraryDocIds: string[], analysis?: any }): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  const path = CONTEXT_COLLECTION;
  try {
    const userId = auth.currentUser.uid;
    const userContextCol = getUserCollection(path);
    const querySnapshot = await getDocs(userContextCol);
    
    const contextData: any = sanitizeData({
      meetingContext: data.meetingContext,
      selectedLibraryDocIds: data.selectedLibraryDocIds,
      userId,
      updatedAt: Timestamp.now(),
      analysis: data.analysis || null
    });

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
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
};

export const fetchMeetingContext = async (): Promise<any | null> => {
  if (!db || !auth || !auth.currentUser) return null;
  const path = CONTEXT_COLLECTION;
  try {
    // 1. Try fetching from the new user-isolated subcollection
    const querySnapshot = await getDocs(getUserCollection(path));
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }

    // 2. Fallback: If new collection is empty, try fetching from the legacy top-level collection
    const qLegacy = query(
      collection(db, path),
      where("userId", "==", auth.currentUser.uid)
    );
    const querySnapshotLegacy = await getDocs(qLegacy);
    if (!querySnapshotLegacy.empty) {
      return querySnapshotLegacy.docs[0].data();
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const deleteMeetingContext = async (): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  const path = CONTEXT_COLLECTION;
  try {
    const userContextCol = getUserCollection(path);
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

// Sharing Functions
export const fetchSharedGPTSession = async (userId: string, sessionId: string): Promise<any | null> => {
  if (!db) return null;
  const path = `users/${userId}/${SALES_GPT_COLLECTION}/${sessionId}`;
  try {
    const docRef = doc(db, "users", userId, SALES_GPT_COLLECTION, sessionId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.isShared) {
        return {
          id: docSnap.id,
          ...data,
          timestamp: data.timestamp?.toMillis() || Date.now()
        };
      }
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

// App Updates & Notifications
export const fetchAppUpdates = async (): Promise<any[]> => {
  if (!db || !auth || !auth.currentUser) return [];
  const path = UPDATES_COLLECTION;
  try {
    const q = query(getUserCollection(path));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toMillis() || Date.now()
      };
    }).sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export const markUpdateAsRead = async (updateId: string): Promise<boolean> => {
  if (!db || !auth || !auth.currentUser) return false;
  const path = UPDATES_COLLECTION;
  try {
    const docRef = doc(getUserCollection(path), updateId);
    await updateDoc(docRef, {
      isRead: true,
      readAt: Timestamp.now()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return false;
  }
};

// User Settings & Profile Functions
export const fetchUserSettings = async (): Promise<UserSettings | null> => {
  try {
    const response = await fetch('/api/settings');
    const data = await response.json();
    if (data.settings) return data.settings;
    
    // Fallback if no settings exist yet
    if (auth?.currentUser) {
      return {
        profile: { name: '', email: auth.currentUser.email, phone: '', photoURL: auth.currentUser.photoURL, role: '' },
        security: { mfaEnabled: false, lastLogin: Date.now(), sessions: [] },
        pin: { hashedPin: '', recoveryQuestion: '', recoveryAnswerHash: '', failedAttempts: 0, isLocked: false },
        integrations: { googleDrive: { connected: false }, googleCalendar: { connected: false } },
        preferences: { notifications: { email: true, inApp: true, onSimulationComplete: true, onNewRecommendations: true, onErrors: true }, defaultWorkspace: 'simulation', experimentalFeatures: false },
        privacy: { dataSharing: true, consentTimestamp: Date.now(), acceptedTerms: false, acceptedPrivacyPolicy: false, neuralPrivacyAccepted: false }
      } as UserSettings;
    }
    return null;
  } catch (error) {
    console.error("Error fetching settings from API:", error);
    return null;
  }
};

export const updateUserSettings = async (settings: Partial<UserSettings>): Promise<boolean> => {
  try {
    const currentSettings = await fetchUserSettings();
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { ...currentSettings, ...settings } })
    });
    return response.ok;
  } catch (error) {
    console.error("Error updating settings via API:", error);
    return false;
  }
};

export const uploadProfilePicture = async (file: File): Promise<string | null> => {
  if (!storage || !auth || !auth.currentUser) return null;
  try {
    const storageRef = ref(storage, `users/${auth.currentUser.uid}/profile_pic_${Date.now()}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    return null;
  }
};

export const logActivity = async (activity: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<void> => {
  try {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity)
    });
  } catch (error) {
    console.error("Error logging activity via API:", error);
  }
};

export const fetchActivityLogs = async (limitCount: number = 20): Promise<ActivityLog[]> => {
  try {
    const response = await fetch(`/api/activity?limit=${limitCount}`);
    const data = await response.json();
    return (data.logs || []).map((l: any) => ({
      ...l,
      timestamp: new Date(l.timestamp).getTime()
    }));
  } catch (error) {
    console.error("Error fetching activity logs via API:", error);
    return [];
  }
};

export const changeUserPassword = async (currentPass: string, newPass: string): Promise<boolean> => {
  if (!auth || !auth.currentUser) return false;
  try {
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPass);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPass);
    return true;
  } catch (error) {
    console.error("Error changing password:", error);
    throw error;
  }
};

export const verifyUserEmail = async (): Promise<boolean> => {
  if (!auth || !auth.currentUser) return false;
  try {
    await sendEmailVerification(auth.currentUser);
    return true;
  } catch (error: any) {
    if (error.code === 'auth/too-many-requests') {
      console.warn("Rate limit hit for email verification:", error.message);
    } else {
      console.error("Error sending verification email:", error);
    }
    return false;
  }
};

export const deleteUserAccount = async (): Promise<boolean> => {
  if (!auth || !auth.currentUser || !db) return false;
  try {
    const userId = auth.currentUser.uid;
    // Delete user data from Firestore first (optional, depends on your policy)
    // await deleteDoc(doc(db, USERS_COLLECTION, userId));
    
    await auth.currentUser.delete();
    return true;
  } catch (error) {
    console.error("Error deleting account:", error);
    throw error;
  }
};

export const seedInitialUpdates = async (): Promise<void> => {
  if (!db || !auth || !auth.currentUser) return;
  const path = UPDATES_COLLECTION;
  try {
    const existing = await fetchAppUpdates();
    if (existing.length > 0) return;

    const initialUpdates = [
      {
        title: "Google Drive Integration",
        description: "Directly import documents from your Google Drive.",
        detailedInfo: "You can now connect your Google Drive account to SPIKED AI. This allows you to seamlessly import sales playbooks, product specs, and customer data directly into your cognitive library without manual uploads.",
        isRead: false,
        version: "v3.2.0"
      },
      {
        title: "Enhanced Folder UI",
        description: "New contextual icons and document counts for folders.",
        detailedInfo: "We've overhauled the Document Gallery sidebar. Folders now feature intelligent icons that adapt to your category names (Sales, Product, Legal, etc.), and you can see exactly how many intelligence nodes are stored in each folder at a glance.",
        isRead: false,
        version: "v3.1.5"
      },
      {
        title: "Cognitive Magnifier v3",
        description: "New viewport and text-only scaling modes.",
        detailedInfo: "The Cognitive Magnifier has been upgraded. You can now choose between 'Simulation Scale' (full viewport zoom) and 'Text Intelligence' (typography-only zoom) to optimize your focus during intense deal analysis.",
        isRead: false,
        version: "v3.1.0"
      },
      {
        title: "Neural Onboarding Tour",
        description: "Interactive guide through the SPIKED AI protocol.",
        detailedInfo: "New users (and veterans!) can now take a guided tour of the neural architecture. Learn how to navigate from Strategic Priming to Avatar Simulation with our interactive spotlight system.",
        isRead: false,
        version: "v3.0.0"
      },
      {
        title: "Avatar Simulation Staged",
        description: "Practice specific deal stages like Pricing and Legal.",
        detailedInfo: "Beyond general roleplay, you can now target specific inflection points in the sales cycle. The Staged Simulation module allows you to focus on Ice Breakers, Technical deep-dives, or high-stakes Closing dialogues.",
        isRead: false,
        version: "v2.9.0"
      },
      {
        title: "Spiked GPT Cognitive Pro",
        description: "Advanced reasoning mode for complex deal inquiries.",
        detailedInfo: "Spiked GPT now features 'Cognitive Pro' mode. This uses enhanced neural synthesis to provide deeper evidence-based responses, perfect for complex technical objections or ROI justifications.",
        isRead: false,
        version: "v2.8.5"
      }
    ];

    for (const update of initialUpdates) {
      await addDoc(getUserCollection(path), {
        ...update,
        timestamp: Timestamp.now()
      });
    }
  } catch (error) {
    console.error("Error seeding updates:", error);
  }
};
