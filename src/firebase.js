/**
 * Smart Clinic OS - 100% Serverless Firebase Configuration
 * Direct connection to Firebase project: smart-clinic-app-cf39b
 * Provides Cloud Firestore and Firebase Storage for frontend client
 */

// Official Firebase Web SDK Configuration for project 'smart-clinic-app-cf39b'
export const firebaseConfig = {
  apiKey: "AIzaSyD_0K24tUnG1OWh74HwJfjqQIZ6Q3_IOn0",
  authDomain: "smart-clinic-app-cf39b.firebaseapp.com",
  projectId: "smart-clinic-app-cf39b",
  storageBucket: "smart-clinic-app-cf39b.firebasestorage.app",
  messagingSenderId: "111535735393",
  appId: "1:111535735393:web:87efa9d334494cd017a020",
  measurementId: "G-02HPCJPC5F"
};

/**
 * Initialize Firebase services using either the global browser SDK (Compat / CDN)
 * or modular imports.
 */
let app;
let db;
let storage;

// Check if running in browser with global firebase SDK
if (typeof window !== "undefined" && window.firebase) {
  if (!window.firebase.apps || !window.firebase.apps.length) {
    app = window.firebase.initializeApp(firebaseConfig);
  } else {
    app = window.firebase.app();
  }
  db = window.firebase.firestore();
  storage = window.firebase.storage();
} else {
  // Graceful fallback / placeholder for pure node or headless environments
  app = { name: "[DEFAULT]", options: firebaseConfig };
  db = null;
  storage = null;
}

// Attach to window for global access across all frontend modules and bundle
if (typeof window !== "undefined") {
  window.SmartClinicFirebase = {
    app,
    db,
    storage,
    firebaseConfig,
    isInitialized: true
  };
}

export { app, db, storage };
export default { app, db, storage, firebaseConfig };
