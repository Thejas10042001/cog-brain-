import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  updateDoc, 
  serverTimestamp,
  addDoc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { Folder, StoredDocument } from '../../types';
export type { Folder, StoredDocument };
import { db, auth } from '../lib/firebase';

const DEFAULT_FOLDERS = [
  "Sales",
  "Product",
  "Security, Compliance & Legal",
  "Financial & Company Information",
  "Procurement & Customer Onboarding",
  "Partnerships & Ecosystem",
  "Events & Community",
  "Customer Materials",
  "Research & Thought Leadership",
  "Customers & Use Cases",
  "Miscellaneous"
];

const DOCUMENTS_COLLECTION = 'cognitive_documents';
const FOLDERS_COLLECTION = 'folders';

export const initializeDefaultFolders = async (userId: string) => {
  const foldersRef = collection(db, 'users', userId, FOLDERS_COLLECTION);
  const existingFolders = await getDocs(foldersRef);
  
  if (existingFolders.empty) {
    for (const name of DEFAULT_FOLDERS) {
      await addDoc(foldersRef, {
        name,
        parentId: null,
        createdAt: serverTimestamp(),
        isDefault: true
      });
    }
  }
};

export const getFolders = (userId: string, callback: (folders: Folder[]) => void) => {
  const foldersRef = collection(db, 'users', userId, FOLDERS_COLLECTION);
  return onSnapshot(foldersRef, (snapshot) => {
    const folders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Folder[];
    callback(folders);
  }, (error) => {
    console.error("Error fetching folders:", error);
  });
};

export const getDocuments = (userId: string, folderId: string | null, callback: (docs: StoredDocument[]) => void) => {
  const docsRef = collection(db, 'users', userId, DOCUMENTS_COLLECTION);
  let q = query(docsRef);
  
  if (folderId) {
    q = query(docsRef, where('folderId', '==', folderId));
  } else {
    // If folderId is null, we might want to show "unsorted" or "all"
    // For now, let's assume null means unsorted
    q = query(docsRef, where('folderId', '==', null));
  }

  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as StoredDocument[];
    callback(docs);
  }, (error) => {
    console.error("Error fetching documents:", error);
  });
};

export const getAllDocuments = (userId: string, callback: (docs: StoredDocument[]) => void) => {
  const docsRef = collection(db, 'users', userId, DOCUMENTS_COLLECTION);
  return onSnapshot(docsRef, (snapshot) => {
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as StoredDocument[];
    callback(docs);
  }, (error) => {
    console.error("Error fetching all documents:", error);
  });
};

export const createFolder = async (userId: string, name: string, parentId: string | null = null) => {
  const foldersRef = collection(db, 'users', userId, FOLDERS_COLLECTION);
  return await addDoc(foldersRef, {
    name,
    parentId,
    createdAt: serverTimestamp(),
    isDefault: false
  });
};

export const deleteFolder = async (userId: string, folderId: string) => {
  const folderRef = doc(db, 'users', userId, FOLDERS_COLLECTION, folderId);
  // Note: In a real app, you'd want to handle recursive deletion or moving files
  return await deleteDoc(folderRef);
};

export const uploadDocument = async (userId: string, docData: Omit<StoredDocument, 'id' | 'timestamp'>) => {
  const docsRef = collection(db, 'users', userId, DOCUMENTS_COLLECTION);
  return await addDoc(docsRef, {
    ...docData,
    uploadedAt: serverTimestamp()
  });
};

export const moveDocument = async (userId: string, docId: string, newFolderId: string | null) => {
  const docRef = doc(db, 'users', userId, DOCUMENTS_COLLECTION, docId);
  return await updateDoc(docRef, {
    folderId: newFolderId
  });
};

export const deleteDocument = async (userId: string, docId: string) => {
  const docRef = doc(db, 'users', userId, DOCUMENTS_COLLECTION, docId);
  return await deleteDoc(docRef);
};
