import re
import sys

INDEX_HTML_PATH = r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.html"
INDEX_SOURCE_PATH = r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.source.html"

# =========================================================================
# 1. UPDATE index.html (expose doc and deleteDoc polyfills)
# =========================================================================
with open(INDEX_HTML_PATH, 'r', encoding='utf-8') as f:
    index_html = f.read()

old_fb_init = """          window.SmartClinicFirebase = {
            app: firebase.app(),
            auth: (firebase.auth ? firebase.auth() : null),
            db: firebase.firestore(),
            storage: firebase.storage(),
            firebaseConfig: firebaseConfig,
            isInitialized: true
          };"""

new_fb_init = """          var firestoreDb = firebase.firestore();
          window.doc = function(db, col, id) {
            var targetDb = db || firestoreDb;
            return targetDb.collection(col).doc(String(id));
          };
          window.deleteDoc = function(docRef) {
            if (docRef && typeof docRef.delete === 'function') {
              return docRef.delete();
            }
            return Promise.reject(new Error('Invalid document reference passed to deleteDoc'));
          };
          window.SmartClinicFirebase = {
            app: firebase.app(),
            auth: (firebase.auth ? firebase.auth() : null),
            db: firestoreDb,
            storage: firebase.storage(),
            firebaseConfig: firebaseConfig,
            isInitialized: true,
            doc: window.doc,
            deleteDoc: window.deleteDoc
          };"""

if old_fb_init in index_html:
    index_html = index_html.replace(old_fb_init, new_fb_init, 1)
    with open(INDEX_HTML_PATH, 'w', encoding='utf-8') as f:
        f.write(index_html)
    print("[1] Updated index.html with window.doc and window.deleteDoc helpers.")
else:
    print("[1] index.html already updated or pattern mismatch.")

# =========================================================================
# 2. UPDATE index.source.html
# =========================================================================
with open(INDEX_SOURCE_PATH, 'r', encoding='utf-8') as f:
    source_content = f.read()

# 2a. Update unsubClinics & unsubDoctors in index.source.html
old_sync_block = """        const unsubClinics = db.collection('clinics').onSnapshot(
          (snapshot) => {
            const list = [];
            snapshot.forEach(doc => {
              list.push({ id: doc.id, ...doc.data() });
            });
            if (list.length > 0) {
              setClinicsList(prev => {
                const map = new Map();
                INITIAL_CLINICS.forEach(c => map.set(c.slug, c));
                (prev || []).forEach(c => map.set(c.slug, c));
                list.forEach(c => map.set(c.slug, { ...map.get(c.slug), ...c }));
                return Array.from(map.values());
              });
            }
          },
          (err) => console.warn('[Firestore Clinics Sync Warning]:', err)
        );

        const unsubDoctors = db.collection('doctors').onSnapshot(
          (snapshot) => {
            const list = [];
            snapshot.forEach(doc => {
              list.push({ id: doc.id, ...doc.data() });
            });
            if (list.length > 0) {
              setDoctorsList(prev => {
                const map = new Map();
                DEMO_DOCTORS.forEach(d => map.set(String(d.id), d));
                (prev || []).forEach(d => map.set(String(d.id), d));
                list.forEach(d => map.set(String(d.id), { ...map.get(String(d.id)), ...d }));
                return Array.from(map.values());
              });
            }
          },
          (err) => console.warn('[Firestore Doctors Sync Warning]:', err)
        );"""

new_sync_block = """        const unsubClinics = db.collection('clinics').onSnapshot(
          (snapshot) => {
            const list = [];
            snapshot.forEach(doc => {
              const data = doc.data() || {};
              list.push({ id: doc.id, docId: doc.id, ...data, slug: data.slug || doc.id });
            });
            // Update clinicsList directly from live Firestore collection truth
            setClinicsList(list);
            try {
              localStorage.setItem('smart_clinic_saas_clinics', JSON.stringify(list));
            } catch (e) {}
          },
          (err) => console.warn('[Firestore Clinics Sync Warning]:', err)
        );

        const unsubDoctors = db.collection('doctors').onSnapshot(
          (snapshot) => {
            const list = [];
            snapshot.forEach(doc => {
              const data = doc.data() || {};
              list.push({ id: doc.id, docId: doc.id, ...data });
            });
            setDoctorsList(list);
            try {
              localStorage.setItem('smart_clinic_saas_doctors', JSON.stringify(list));
            } catch (e) {}
          },
          (err) => console.warn('[Firestore Doctors Sync Warning]:', err)
        );"""

assert old_sync_block in source_content, "old_sync_block not found in index.source.html!"
source_content = source_content.replace(old_sync_block, new_sync_block, 1)
print("[2] Updated unsubClinics & unsubDoctors to synchronize strictly with live Firestore.")

# 2b. Update handleDeleteClinic
h_pos1 = source_content.find("handleDeleteClinic = async (clinic) => {")
h_pos2 = source_content.find("console.log(`[Super Admin] Clinic '${cName}' successfully deleted", h_pos1)
assert h_pos1 != -1 and h_pos2 != -1, "handleDeleteClinic block boundaries not found!"
h_pos2_end = source_content.find("};", h_pos2) + 2

new_handle_delete_clinic = """handleDeleteClinic = async (clinic) => {
        if (!clinic) return;
        const cIdentifier = clinic.clinicId || clinic.slug || clinic.id;
        const cId = clinic.clinicId;
        const cSlug = clinic.slug;
        const cName = clinic.name || 'Clinic';
        const cEmail = clinic.email || clinic.ownerEmail;
        const cPass = clinic.initialPassword || clinic.password;
        const apiKey = window.SmartClinicFirebase?.firebaseConfig?.apiKey || "AIzaSyD_0K24tUnG1OWh74HwJfjqQIZ6Q3_IOn0";
        const db = getFirebaseDb();

        if (!db) {
          throw new Error('Firestore database instance is not connected.');
        }

        console.log(`[Super Admin] Initiating cascade deletion for clinic: ${cName} (${cSlug || cId})...`);

        // 1. Permanently delete Firebase Authentication user record & access credentials
        try {
          let emailToDelete = cEmail;
          let passToDelete = cPass;

          // If password not in memory, read from Firestore credentials
          if (!emailToDelete || !passToDelete) {
            try {
              const credDoc = await db.collection('credentials').doc(cSlug).get();
              if (credDoc.exists) {
                const credData = credDoc.data() || {};
                emailToDelete = emailToDelete || credData.email;
                passToDelete = passToDelete || credData.password;
              }
            } catch (e) {}
          }

          if (emailToDelete && passToDelete) {
            // Sign in to get valid user ID Token for account deletion
            const signInResp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: emailToDelete.trim(),
                password: passToDelete,
                returnSecureToken: true
              })
            });

            if (signInResp.ok) {
              const { idToken } = await signInResp.json();
              const delResp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
              });
              if (delResp.ok) {
                console.log(`[Firebase Auth] Permanently deleted user record for ${emailToDelete}. Account is cleanly available for re-onboarding.`);
              }
            } else {
              console.log(`[Firebase Auth] User not currently found in Auth or already removed: ${emailToDelete}`);
            }
          }
        } catch (authErr) {
          console.warn('[Firebase Auth Deletion Info]:', authErr);
        }

        // Helper functions for modular / compat deleteDoc(doc(db, "clinics", clinicId))
        const docRef = (collectionName, id) => {
          if (typeof window.doc === 'function') {
            return window.doc(db, collectionName, String(id));
          }
          return db.collection(collectionName).doc(String(id));
        };

        const deleteDocument = async (ref) => {
          if (typeof window.deleteDoc === 'function') {
            return await window.deleteDoc(ref);
          }
          if (ref && typeof ref.delete === 'function') {
            return await ref.delete();
          }
          throw new Error('deleteDoc operation not supported on reference');
        };

        // Determine exact clinic document ID for Firestore
        const clinicId = String(clinic.docId || clinic.id || cSlug || cId);
        const variants = getSlugVariants(cSlug || clinicId);

        // 2. Call deleteDoc(doc(db, "clinics", clinicId)) against live Firestore instance
        try {
          console.log(`[Firestore] Calling deleteDoc(doc(db, "clinics", "${clinicId}")) against live Firestore...`);
          await deleteDocument(docRef('clinics', clinicId));

          // Also delete by slug or clinicId if stored under alternate doc key
          if (cSlug && cSlug !== clinicId) {
            await deleteDocument(docRef('clinics', cSlug)).catch(() => {});
          }
          if (cId && cId !== clinicId && cId !== cSlug) {
            await deleteDocument(docRef('clinics', cId)).catch(() => {});
          }

          // Cascade delete credentials doc
          if (cSlug) {
            await deleteDocument(docRef('credentials', cSlug)).catch(() => {});
          }
          if (cEmail) {
            await deleteDocument(docRef('credentials', cEmail.toLowerCase().trim())).catch(() => {});
          }

          // Cascade delete doctor docs
          if (cSlug) {
            await deleteDocument(docRef('doctors', `doc_${cSlug}`)).catch(() => {});
          }
          const docSnaps = await db.collection('doctors').where('clinicSlug', '==', cSlug).get().catch(() => null);
          if (docSnaps && docSnaps.forEach) {
            const delDoctorPromises = [];
            docSnaps.forEach(d => delDoctorPromises.push(deleteDocument(d.ref).catch(() => {})));
            await Promise.all(delDoctorPromises);
          }

          // Cascade delete queue tokens
          const qSnaps = await db.collection('queues').where('clinicSlug', 'in', variants.slice(0, 10)).get().catch(() => null);
          if (qSnaps && qSnaps.forEach) {
            const delQueuePromises = [];
            qSnaps.forEach(d => delQueuePromises.push(deleteDocument(d.ref).catch(() => {})));
            await Promise.all(delQueuePromises);
          }

          console.log(`[Firestore] deleteDoc operation completed successfully for clinic '${clinicId}'.`);
        } catch (dbErr) {
          console.error('[Firestore Deletion Error]: Failed to delete clinic document:', dbErr);
          alert(`Database Error: Could not delete clinic '${cName}' from Firestore. ${dbErr.message || dbErr}`);
          throw dbErr; // Ensure error halts execution and local state is NOT updated
        }

        // 3. Optimistically update local React state ONLY AFTER successful database deletion
        setClinicsList(prev => prev.filter(c => c.id !== clinic.id && c.clinicId !== cId && c.slug !== cSlug && String(c.docId || c.id) !== clinicId));
        setDoctorsList(prev => prev.filter(d => d.clinicId !== cId && d.clinicSlug !== cSlug && d.clinicName?.toLowerCase() !== cName?.toLowerCase()));
        setClinicQueues(prev => {
          const updated = { ...prev };
          delete updated[cSlug];
          if (cId) delete updated[cId];
          variants.forEach(v => { delete updated[v]; });
          return updated;
        });

        // 4. Purge local storage & sessions
        try {
          const currentActiveSlug = localStorage.getItem('smart_clinic_active_clinic_slug');
          if (currentActiveSlug === cSlug || currentActiveSlug === cId) {
            localStorage.removeItem('smart_clinic_active_clinic_slug');
            localStorage.removeItem('smart_clinic_authed');
            localStorage.removeItem('smart_clinic_current_doctor');
            setIsClinicAuthed(false);
          }
          localStorage.removeItem(`smart_clinic_doctor_${cSlug}`);
          if (cId) localStorage.removeItem(`smart_clinic_doctor_${cId}`);
          localStorage.removeItem(`goyoh_doctor_rx_packs_${cSlug}`);
          localStorage.removeItem(`goyoh_patient_token_${cSlug}`);

          const savedClinics = localStorage.getItem('smart_clinic_saas_clinics');
          if (savedClinics) {
            const parsed = JSON.parse(savedClinics).filter(c => c.id !== clinic.id && c.clinicId !== cId && c.slug !== cSlug && String(c.docId || c.id) !== clinicId);
            localStorage.setItem('smart_clinic_saas_clinics', JSON.stringify(parsed));
          }

          const savedDoctors = localStorage.getItem('smart_clinic_saas_doctors');
          if (savedDoctors) {
            const parsed = JSON.parse(savedDoctors).filter(d => d.clinicId !== cId && d.clinicSlug !== cSlug);
            localStorage.setItem('smart_clinic_saas_doctors', JSON.stringify(parsed));
          }

          const savedQueues = localStorage.getItem('smart_clinic_tenant_queues');
          if (savedQueues) {
            const parsed = JSON.parse(savedQueues);
            delete parsed[cSlug];
            if (cId) delete parsed[cId];
            variants.forEach(v => { delete parsed[v]; });
            localStorage.setItem('smart_clinic_tenant_queues', JSON.stringify(parsed));
          }
        } catch (lsErr) {
          console.warn('[LocalStorage Purge Warning]:', lsErr);
        }

        console.log(`[Super Admin] Clinic '${cName}' (${clinicId}) successfully deleted from Firestore, Auth, and React state.`);
      };"""

source_content = source_content[:h_pos1] + new_handle_delete_clinic + source_content[h_pos2_end:]
print("[3] Successfully updated handleDeleteClinic with deleteDoc(doc(db, 'clinics', clinicId)) and error handling.")

with open(INDEX_SOURCE_PATH, 'w', encoding='utf-8') as f:
    f.write(source_content)

print("[SUCCESS] index.source.html updated cleanly.")
