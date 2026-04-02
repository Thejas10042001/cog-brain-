
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
  GoogleAuthProvider
} = firebaseAuth as any;

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Define User and Auth types locally as any to bypass module export issues in this environment.
export type User = any;
export type Auth = any;

import { StoredDocument } from "../types";

// State to track if we've hit a permission error
let internalPermissionError = false;

// Properly type db and auth instances instead of using any
let db: Firestore | null = null;
let auth: Auth | null = null;

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

// Connection test
async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();

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

// Helper to get user-isolated collection reference
const getUserCollection = (subCollection: string) => {
  if (!db) throw new Error("Firebase not initialized");
  const uid = auth?.currentUser?.uid || "default-user";
  return collection(db, "users", uid, subCollection);
};

export const getAuthInstance = () => auth;
export const getDbInstance = () => db;

export const getFirebasePermissionError = () => internalPermissionError;
export const clearFirebasePermissionError = () => { internalPermissionError = false; };

// User Profile Functions
export const saveUserProfile = async (user: any) => {
  if (!db || !user) return;
  const path = `users/${user.uid}`;
  try {
    const { setDoc } = await import("firebase/firestore");
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      photoURL: user.photoURL || "",
      updatedAt: Timestamp.now()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const findUserByEmail = async (email: string): Promise<any | null> => {
  if (!db) return null;
  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "users");
    return null;
  }
};

// SalesGPT History Functions
export const saveSalesGPTSession = async (session: { id?: string, title: string, messages: any[], isGroup?: boolean, members?: string[], ownerId?: string }): Promise<string | null> => {
  if (!db) return null;
  const isGroup = session.isGroup || false;
  const path = isGroup ? "sales_gpt_sessions" : SALES_GPT_COLLECTION;
  
  try {
    const userId = auth?.currentUser?.uid || "default-user";
    const { id, ...rest } = session;
    const sessionData = {
      ...rest,
      userId,
      timestamp: Timestamp.now(),
      isGroup,
      members: session.members || [userId],
      ownerId: session.ownerId || userId
    };

    if (isGroup) {
      if (id) {
        await updateDoc(doc(db, "sales_gpt_sessions", id), sessionData);
        return id;
      } else {
        const docRef = await addDoc(collection(db, "sales_gpt_sessions"), sessionData);
        return docRef.id;
      }
    } else {
      if (id) {
        await updateDoc(doc(getUserCollection(SALES_GPT_COLLECTION), id), sessionData);
        return id;
      } else {
        const docRef = await addDoc(getUserCollection(SALES_GPT_COLLECTION), sessionData);
        return docRef.id;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return null;
  }
};

export const fetchSalesGPTSessions = async (): Promise<any[]> => {
  if (!db) return [];
  const userId = auth?.currentUser?.uid || "default-user";
  
  try {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    
    // Fetch private sessions
    const qPrivate = query(
      getUserCollection(SALES_GPT_COLLECTION),
      where("timestamp", ">=", Timestamp.fromDate(fifteenDaysAgo))
    );
    const privateSnapshot = await getDocs(qPrivate);
    const privateSessions = privateSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toMillis() || Date.now()
    }));

    // Fetch group sessions
    let groupSessions: any[] = [];
    if (userId !== "default-user") {
      const qGroup = query(
        collection(db, "sales_gpt_sessions"),
        where("members", "array-contains", userId)
      );
      const groupSnapshot = await getDocs(qGroup);
      const fifteenDaysAgoTime = fifteenDaysAgo.getTime();
      
      groupSessions = groupSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: (doc.data() as any).timestamp?.toMillis() || Date.now()
        }))
        .filter(session => session.timestamp >= fifteenDaysAgoTime);
    }
    
    return [...privateSessions, ...groupSessions].sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "sessions");
    return [];
  }
};

export const deleteSalesGPTSession = async (id: string, isGroup: boolean = false): Promise<boolean> => {
  if (!db) return false;
  const path = isGroup ? "sales_gpt_sessions" : SALES_GPT_COLLECTION;
  try {
    if (isGroup) {
      await deleteDoc(doc(db, "sales_gpt_sessions", id));
    } else {
      await deleteDoc(doc(getUserCollection(SALES_GPT_COLLECTION), id));
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
};

// Invitation Functions
export const createInvitation = async (chatId: string, chatTitle: string, toEmail: string) => {
  if (!db || !auth?.currentUser) return null;
  try {
    const invitationData = {
      chatId,
      chatTitle,
      fromUid: auth.currentUser.uid,
      fromEmail: auth.currentUser.email,
      toEmail,
      status: 'waiting',
      timestamp: Timestamp.now()
    };
    const docRef = await addDoc(collection(db, "invitations"), invitationData);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "invitations");
    return null;
  }
};

export const fetchInvitations = async (type: 'incoming' | 'outgoing') => {
  if (!db || !auth?.currentUser) return [];
  try {
    const q = type === 'incoming' 
      ? query(collection(db, "invitations"), where("toEmail", "==", auth.currentUser.email))
      : query(collection(db, "invitations"), where("fromUid", "==", auth.currentUser.uid));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "invitations");
    return [];
  }
};

export const updateInvitationStatus = async (invitationId: string, status: 'accepted' | 'denied') => {
  if (!db) return false;
  try {
    const invRef = doc(db, "invitations", invitationId);
    const invDoc = await getDoc(invRef);
    if (!invDoc.exists()) return false;
    
    const data = invDoc.data();
    await updateDoc(invRef, { status, updatedAt: Timestamp.now() });

    if (status === 'accepted') {
      // Add user to chat members
      const chatRef = doc(db, "sales_gpt_sessions", data.chatId);
      const chatDoc = await getDoc(chatRef);
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        const members = [...(chatData.members || []), auth?.currentUser?.uid];
        await updateDoc(chatRef, { members: Array.from(new Set(members)) });
      }
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, "invitations");
    return false;
  }
};

// Shared Chat Functions
export const shareChat = async (chatId: string, title: string, messages: any[]) => {
  if (!db || !auth?.currentUser) return null;
  try {
    const sharedData = {
      originalChatId: chatId,
      sharedBy: auth.currentUser.uid,
      timestamp: Timestamp.now(),
      title,
      messages
    };
    const docRef = await addDoc(collection(db, "shared_chats"), sharedData);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "shared_chats");
    return null;
  }
};

export const fetchSharedChat = async (id: string) => {
  if (!db) return null;
  try {
    const docRef = doc(db, "shared_chats", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "shared_chats");
    return null;
  }
};

// Folder Helper Functions
export const saveFolderToFirebase = async (
  name: string, 
  isCustom: boolean = true, 
  type: 'main' | 'sub' = 'main', 
  parentId: string | null = null
): Promise<string | null> => {
  if (!db) return null;
  const path = FOLDERS_COLLECTION;
  try {
    const docRef = await addDoc(getUserCollection(path), {
      userId: "default-user",
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
  if (!db) return [];
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
  if (!db) return false;
  const path = FOLDERS_COLLECTION;
  try {
    await deleteDoc(doc(getUserCollection(path), id));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
};

export const moveDocumentToFolder = async (docId: string, folderId: string | null): Promise<boolean> => {
  if (!db) return false;
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
export const loginUser = (email: string, pass: string) => auth ? signInWithEmailAndPassword(auth, email, pass) : Promise.reject("Auth module not initialized");
export const loginWithGoogle = () => {
  if (!auth) return Promise.reject("Auth module not initialized");
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};
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
  if (!db) return null;
  const path = HISTORY_COLLECTION;
  try {
    const docRef = await addDoc(getUserCollection(path), {
      ...history,
      userId: "default-user",
      timestamp: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return null;
  }
};

export const fetchSimulationHistory = async (): Promise<any[]> => {
  if (!db) return [];
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
        where("userId", "==", "default-user")
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
  if (!db) return null;
  const path = COLLECTION_NAME;
  try {
    const now = Timestamp.now();
    const docRef = await addDoc(getUserCollection(path), {
      userId: "default-user", // Tie document to unique user
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
  if (!db) return false;
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
  if (!db) return [];
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
        where("userId", "==", "default-user")
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
  if (!db) return false;
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
  if (!db) return false;
  const path = CONTEXT_COLLECTION;
  try {
    const userId = "default-user";
    const userContextCol = getUserCollection(path);
    const querySnapshot = await getDocs(userContextCol);
    
    const contextData: any = {
      meetingContext: data.meetingContext,
      selectedLibraryDocIds: data.selectedLibraryDocIds,
      userId,
      updatedAt: Timestamp.now()
    };
    if (data.analysis) contextData.analysis = data.analysis;

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
  if (!db) return null;
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
      where("userId", "==", "default-user")
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
  if (!db) return false;
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
