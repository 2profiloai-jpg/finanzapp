import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Inlined config to avoid import issues in production
const firebaseConfig = {
  "projectId": "gen-lang-client-0555455354",
  "appId": "1:592334238219:web:b513e07380e73b2646cd0e",
  "apiKey": "AIzaSyDylDZHriWbqsDX3DGgFLzhJct2xe4zmNE",
  "authDomain": "gen-lang-client-0555455354.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-9ffeb691-6f2a-4924-8fce-9b42ac37b222",
  "storageBucket": "gen-lang-client-0555455354.firebasestorage.app",
  "messagingSenderId": "592334238219",
  "measurementId": ""
};

let app;
let db;
let auth;

try {
  console.log("Initializing Firebase with inlined config...");
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  
  // Use the specific database ID
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  auth = getAuth(app);
  
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("CRITICAL: Firebase initialization failed:", error);
  // We don't throw here to allow the app to at least render a UI
}

export { db, auth };
