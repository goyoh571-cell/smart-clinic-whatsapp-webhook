/**
 * Smart Clinic OS - Firebase Client Service
 * 100% Serverless Direct Firestore & Firebase Storage Integration
 * Project: smart-clinic-app
 */

import { firebaseConfig } from '../firebase.js';

// Helper to access initialized Firebase instances from window or initialize on demand
export function getFirebaseInstances() {
  if (typeof window === 'undefined') return { db: null, storage: null };

  if (window.SmartClinicFirebase && window.SmartClinicFirebase.db) {
    return {
      db: window.SmartClinicFirebase.db,
      storage: window.SmartClinicFirebase.storage
    };
  }

  if (window.firebase) {
    if (!window.firebase.apps || !window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }
    const db = window.firebase.firestore();
    const storage = window.firebase.storage();
    window.SmartClinicFirebase = { db, storage, firebaseConfig, isInitialized: true };
    return { db, storage };
  }

  return { db: null, storage: null };
}

/**
 * 1. PATIENT RECORD MANAGEMENT (Cloud Firestore)
 */

/**
 * Add a new patient check-in token directly to Firestore
 */
export async function addPatientToFirestore(tokenData, clinicSlug) {
  const { db } = getFirebaseInstances();
  const slug = clinicSlug || tokenData.clinicSlug || 'ankitha-clinic';
  const cleanId = String(tokenData.id || Date.now());

  // Keep token document structured
  const docPayload = {
    ...tokenData,
    id: cleanId,
    clinicSlug: slug,
    updatedAt: new Date().toISOString()
  };

  if (db) {
    try {
      // Write to Firestore collection 'queues' using cleanId as docId
      await db.collection('queues').doc(cleanId).set(docPayload, { merge: true });
      console.log(`[Firestore] Successfully written patient token #${tokenData.tokenNumber} to Firestore.`);
    } catch (err) {
      console.warn('[Firestore] Failed to write token directly, falling back to local persistence:', err);
    }
  }

  // Dual-write to localStorage for instant client rendering & resilience
  try {
    const key = `goyoh_queue_${slug}`;
    const raw = localStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter(t => String(t.id) !== cleanId);
    filtered.push(docPayload);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (e) {}

  return docPayload;
}

/**
 * Update an existing token directly in Firestore
 */
export async function updatePatientInFirestore(tokenId, updates, clinicSlug) {
  const { db } = getFirebaseInstances();
  const cleanId = String(tokenId);
  const slug = clinicSlug || 'ankitha-clinic';

  const updatePayload = {
    ...updates,
    updatedAt: new Date().toISOString()
  };

  if (db) {
    try {
      await db.collection('queues').doc(cleanId).set(updatePayload, { merge: true });
      console.log(`[Firestore] Updated token ${cleanId} in Firestore.`);
    } catch (err) {
      console.warn('[Firestore] Update token warning:', err);
    }
  }

  // Update in localStorage
  try {
    const key = `goyoh_queue_${slug}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const list = JSON.parse(raw);
      const updated = list.map(t => String(t.id) === cleanId ? { ...t, ...updatePayload } : t);
      localStorage.setItem(key, JSON.stringify(updated));
    }
  } catch (e) {}

  return updatePayload;
}

/**
 * Subscribe in real-time to queue updates via Firestore onSnapshot
 */
/**
 * Fetch queue documents from Firestore using getDocs / .get()
 */
export async function fetchQueueFromFirestore(clinicSlug) {
  const { db } = getFirebaseInstances();
  const slug = clinicSlug || 'ankitha-clinic';

  if (!db) {
    console.warn('[Firestore] DB not available for getDocs polling.');
    return [];
  }

  try {
    let snapshot;
    if (typeof db.collection === 'function') {
      // Compat SDK get()
      snapshot = await db.collection('queues').where('clinicSlug', '==', slug).get();
    } else if (typeof window.getDocs === 'function') {
      // Modular SDK getDocs
      snapshot = await window.getDocs(window.query(window.collection(db, 'queues'), window.where('clinicSlug', '==', slug)));
    }
    const tokens = [];
    if (snapshot && snapshot.forEach) {
      snapshot.forEach((doc) => {
        tokens.push({ id: doc.id, ...doc.data() });
      });
    }
    tokens.sort((a, b) => {
      const numA = parseInt(String(a.tokenNumber || a.id).replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(String(b.tokenNumber || b.id).replace(/[^0-9]/g, '')) || 0;
      if (numA !== numB) return numA - numB;
      const timeA = a.timestamp || new Date(a.createdAt || 0).getTime();
      const timeB = b.timestamp || new Date(b.createdAt || 0).getTime();
      return timeA - timeB;
    });
    return tokens;
  } catch (err) {
    console.warn('[Firestore getDocs Polling Error]:', err);
    return [];
  }
}

export function subscribeToQueueInFirestore(clinicSlug, onUpdate) {
  const { db } = getFirebaseInstances();
  const slug = clinicSlug || 'ankitha-clinic';

  if (!db) {
    console.warn('[Firestore] DB not available for real-time listener.');
    return () => {};
  }

  try {
    const unsubscribe = db
      .collection('queues')
      .where('clinicSlug', '==', slug)
      .onSnapshot(
        (snapshot) => {
          const tokens = [];
          snapshot.forEach((doc) => {
            tokens.push({ id: doc.id, ...doc.data() });
          });
          // Sort by timestamp or createdAt
          tokens.sort((a, b) => {
            const timeA = a.timestamp || new Date(a.createdAt || 0).getTime();
            const timeB = b.timestamp || new Date(b.createdAt || 0).getTime();
            return timeA - timeB;
          });
          onUpdate(tokens);
        },
        (error) => {
          console.warn('[Firestore Snapshot Error]:', error);
        }
      );
    return unsubscribe;
  } catch (err) {
    console.warn('[Firestore Subscription Error]:', err);
    return () => {};
  }
}

/**
 * 2. PRESCRIPTION PDF UPLOAD (Firebase Storage)
 */

/**
 * Upload a generated jsPDF blob directly to Firebase Storage bucket
 */
export async function uploadPrescriptionPdfToFirebaseStorage({
  blob,
  filename,
  clinicSlug,
  tokenNumber,
  patientName
}) {
  const { storage } = getFirebaseInstances();
  const slug = clinicSlug || 'general';
  const cleanFilename = filename || `Rx_${(patientName || 'Patient').replace(/\s+/g, '_')}_${String(tokenNumber).replace('#', '')}.pdf`;
  const storagePath = `prescriptions/${slug}/${Date.now()}_${cleanFilename}`;

  if (!storage) {
    console.warn('[Storage] Firebase Storage not initialized. Using browser blob fallback.');
    return null;
  }

  try {
    const storageRef = storage.ref(storagePath);
    const metadata = {
      contentType: 'application/pdf',
      customMetadata: {
        clinicSlug: slug,
        tokenNumber: String(tokenNumber),
        patientName: patientName || 'Patient',
        uploadedAt: new Date().toISOString()
      }
    };

    console.log(`[Storage] Uploading prescription PDF to Firebase Storage: ${storagePath}`);
    const uploadTaskSnapshot = await storageRef.put(blob, metadata);
    const downloadUrl = await uploadTaskSnapshot.ref.getDownloadURL();
    console.log(`[Storage] Upload complete! Download URL: ${downloadUrl}`);

    return {
      downloadUrl,
      storagePath,
      filename: cleanFilename
    };
  } catch (err) {
    console.error('[Firebase Storage Upload Error]:', err);
    return null;
  }
}

// Expose globally for instant inline bundle consumption
if (typeof window !== 'undefined') {
  window.SmartClinicFirebaseService = {
    getFirebaseInstances,
    addPatientToFirestore,
    updatePatientInFirestore,
    subscribeToQueueInFirestore,
    uploadPrescriptionPdfToFirebaseStorage
  };
}
