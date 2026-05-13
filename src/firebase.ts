import { auth, db, googleProvider } from './firebase-init';
import { doc, getDocFromServer } from 'firebase/firestore';

export { auth, db, googleProvider };

export { handleFirestoreError, OperationType } from './lib/errorHandlers';
export type { FirestoreErrorInfo } from './lib/errorHandlers';

// Connection health check
async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("🔥 Firestore connection established");
  } catch (error) {
    console.warn("⚠️ Firestore connection status:", error);
  }
}

// testConnection();
