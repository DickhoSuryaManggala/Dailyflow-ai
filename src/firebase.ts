import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
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
  };
}

// Check if a real firebase config lies in the file
const isFirebaseReal = !!(firebaseConfig.apiKey && firebaseConfig.apiKey !== "");

let firebaseApp;
let dbInstance: any = null;
let authInstance: any = null;

if (isFirebaseReal) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    dbInstance = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || "(default)");
    authInstance = getAuth(firebaseApp);
    console.log("[FIREBASE] Initialized with database ID:", firebaseConfig.firestoreDatabaseId);
  } catch (error) {
    console.error("[FIREBASE] Initialization error, falling back:", error);
  }
} else {
  console.log("[FIREBASE] Config is empty. Standing by or working in E2E Encrypted Local / Offline Mode.");
}

export const app = firebaseApp;
export const db = dbInstance;
export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();

export const isFirebaseConfigured = () => {
  return isFirebaseReal && !!dbInstance && !!authInstance;
};

// Security-hardened error handler required by Firebase guidelines
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = authInstance?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
    },
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Log connection test as mandated by guidelines
export async function testConnection() {
  if (!isFirebaseConfigured()) return;
  const { doc, getDocFromServer } = await import("firebase/firestore");
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error: any) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("[FIREBASE] Firestore connection status: client is offline.");
    }
  }
}

testConnection();
