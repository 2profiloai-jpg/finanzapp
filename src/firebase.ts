import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app;
let db;
let auth;

try {
  console.log("Initializing Firebase...");
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
  auth = getAuth(app);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Fallback or re-throw to be caught by main.tsx
  throw error;
}

export { db, auth };
