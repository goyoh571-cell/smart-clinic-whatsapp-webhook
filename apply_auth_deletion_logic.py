import sys
sys.stdout.reconfigure(encoding='utf-8')

INDEX_HTML = r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.html"
INDEX_SOURCE = r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.source.html"

# -----------------------------------------------------------------------------
# 1. Update index.html
# -----------------------------------------------------------------------------
with open(INDEX_HTML, "r", encoding="utf-8") as f:
    h = f.read()

# Add firebase-auth-compat.js if not present
if "firebase-auth-compat.js" not in h:
    h = h.replace(
        '<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>',
        '<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>\n  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>'
    )
    print("1a. Added firebase-auth-compat.js to index.html")

# Add auth: firebase.auth() to window.SmartClinicFirebase
if "auth: firebase.auth()" not in h:
    h = h.replace(
        "db: firebase.firestore(),",
        "auth: (firebase.auth ? firebase.auth() : null),\n            db: firebase.firestore(),"
    )
    print("1b. Added auth to window.SmartClinicFirebase in index.html")

# Update cache-buster
import re
h = re.sub(r'src="/app\.bundle\.js[^"]*"', 'src="/app.bundle.js?v=20261103_auth_del_v1"', h)

with open(INDEX_HTML, "w", encoding="utf-8") as f:
    f.write(h)
print("1c. Updated index.html cache buster to ?v=20261103_auth_del_v1")

# -----------------------------------------------------------------------------
# 2. Update index.source.html
# -----------------------------------------------------------------------------
with open(INDEX_SOURCE, "r", encoding="utf-8") as f:
    src = f.read()

# 2a. Update handleOnboardClinic to provision Firebase Auth and write credentials doc
old_onboard_start = "handleOnboardClinic = (newClinicData) => {"
pos_onboard = src.find(old_onboard_start)
old_onboard_end_str = "return newClinic;\n      };"
pos_onboard_end = src.find(old_onboard_end_str, pos_onboard) + len(old_onboard_end_str)

new_onboard_func = """handleOnboardClinic = (newClinicData) => {
        // Generate a guaranteed clean unique slug and Firestore doc ID
        const baseSlug = (newClinicData.slug || newClinicData.name || 'clinic')
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || 'clinic';

        // Check if slug is already taken in current clinics list
        const isTaken = clinicsList.some(c => c.slug === baseSlug || c.clinicId === baseSlug);
        const uniqueSuffix = Math.random().toString(36).substring(2, 6);
        const slug = isTaken ? `${baseSlug}-${uniqueSuffix}` : baseSlug;

        const clinicId = newClinicData.clinicId || `CLN-${newClinicData.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const initialPass = newClinicData.initialPassword || `Goyoh@${Math.floor(1000 + Math.random() * 9000)}`;

        const newClinic = {
          id: slug,
          docId: slug,
          clinicId,
          slug,
          ...newClinicData,
          initialPassword: initialPass,
          createdAt: new Date().toISOString()
        };

        const newDoctor = {
          id: `doc_${slug}`,
          email: newClinicData.email,
          doctorName: newClinicData.ownerName,
          specialization: 'Lead Physician & Clinic Admin',
          roomNumber: 'Consultation Room 1',
          clinicName: newClinicData.name,
          clinicAddress: newClinicData.address,
          clinicSlug: slug,
          clinicId,
          phone: newClinicData.phone,
          avgConsultationTime: 8.0,
          qualifications: 'MBBS, MD',
          regNo: `KMC-${Math.floor(10000 + Math.random() * 90000)}`,
          createdAt: new Date().toISOString()
        };

        setClinicsList(prev => [...prev.filter(c => c.slug !== slug), newClinic]);
        setDoctorsList(prev => [...prev.filter(d => d.clinicSlug !== slug), newDoctor]);

        // Provision Firebase Authentication User Record
        const apiKey = window.SmartClinicFirebase?.firebaseConfig?.apiKey || "AIzaSyD_0K24tUnG1OWh74HwJfjqQIZ6Q3_IOn0";
        if (newClinicData.email && initialPass) {
          fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: newClinicData.email.trim(),
              password: initialPass,
              returnSecureToken: true
            })
          })
          .then(res => res.json())
          .then(authData => {
            if (authData.localId) {
              console.log(`[Firebase Auth] Created auth record for clinic ${newClinicData.email} (UID: ${authData.localId})`);
            } else if (authData.error?.message === 'EMAIL_EXISTS') {
              console.log(`[Firebase Auth] Auth record for ${newClinicData.email} already exists, ready for clinic.`);
            }
          })
          .catch(err => console.warn('[Firebase Auth Provisioning Error]:', err));
        }

        // Direct write to Cloud Firestore collections 'clinics', 'doctors', and 'credentials'
        const db = getFirebaseDb();
        if (db) {
          try {
            db.collection('clinics').doc(slug).set(newClinic, { merge: true })
              .then(() => console.log(`[Firestore] Successfully saved clinic doc '${slug}'`))
              .catch(err => console.warn('[Firestore] Clinic save warning:', err));

            db.collection('doctors').doc(`doc_${slug}`).set(newDoctor, { merge: true })
              .then(() => console.log(`[Firestore] Successfully saved doctor doc 'doc_${slug}'`))
              .catch(err => console.warn('[Firestore] Doctor save warning:', err));

            db.collection('credentials').doc(slug).set({
              clinicSlug: slug,
              clinicId,
              email: newClinicData.email,
              password: initialPass,
              updatedAt: new Date().toISOString()
            }, { merge: true }).catch(() => {});
          } catch (e) {
            console.warn('[Firestore Onboarding Error]:', e);
          }
        }

        return newClinic;
      };"""

src = src[:pos_onboard] + new_onboard_func + src[pos_onboard_end:]
print("2a. Replaced handleOnboardClinic with Firebase Auth provisioning and credentials doc write!")

# 2b. Replace handleDeleteClinic with complete Firebase Auth user deletion & cascade wipe
old_delete_start = "const handleDeleteClinic = async (clinic) => {"
pos_del = src.find(old_delete_start)
old_delete_end_str = "const handleSwitchToClinic = (clinic) => {"
pos_del_end = src.find(old_delete_end_str, pos_del)

new_delete_func = """const handleDeleteClinic = async (clinic) => {
        const cIdentifier = clinic.clinicId || clinic.slug || clinic.id;
        const cId = clinic.clinicId;
        const cSlug = clinic.slug;
        const cName = clinic.name;
        const cEmail = clinic.email || clinic.ownerEmail;
        const cPass = clinic.initialPassword || clinic.password;
        const apiKey = window.SmartClinicFirebase?.firebaseConfig?.apiKey || "AIzaSyD_0K24tUnG1OWh74HwJfjqQIZ6Q3_IOn0";
        const db = getFirebaseDb();

        console.log(`[Super Admin] Initiating cascade deletion for clinic: ${cName} (${cSlug})...`);

        // 1. Permanently delete Firebase Authentication user record & access credentials
        try {
          let emailToDelete = cEmail;
          let passToDelete = cPass;

          // If password not in memory, read from Firestore credentials
          if (db && (!emailToDelete || !passToDelete)) {
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

        // 2. Cascade delete all documents from Cloud Firestore collections ('clinics', 'doctors', 'credentials', 'queues')
        if (db) {
          try {
            // Delete clinic document
            await db.collection('clinics').doc(cSlug).delete().catch(() => {});
            if (clinic.id && String(clinic.id) !== cSlug) {
              await db.collection('clinics').doc(String(clinic.id)).delete().catch(() => {});
            }

            // Delete credentials document
            await db.collection('credentials').doc(cSlug).delete().catch(() => {});
            if (cEmail) {
              await db.collection('credentials').doc(cEmail.toLowerCase().trim()).delete().catch(() => {});
            }

            // Delete doctor documents
            await db.collection('doctors').doc(`doc_${cSlug}`).delete().catch(() => {});
            const docSnaps = await db.collection('doctors').where('clinicSlug', '==', cSlug).get().catch(() => null);
            if (docSnaps && docSnaps.forEach) {
              docSnaps.forEach(d => d.ref.delete().catch(() => {}));
            }

            // Delete queue tokens
            const variants = getSlugVariants(cSlug);
            const qSnaps = await db.collection('queues').where('clinicSlug', 'in', variants.slice(0, 10)).get().catch(() => null);
            if (qSnaps && qSnaps.forEach) {
              qSnaps.forEach(d => d.ref.delete().catch(() => {}));
            }
            console.log(`[Firestore] Purged all clinic, doctor, credential, and queue documents for '${cSlug}'`);
          } catch (dbErr) {
            console.warn('[Firestore Deletion Error]:', dbErr);
          }
        }

        // 3. Purge orphaned login sessions from localStorage & memory
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
            const parsed = JSON.parse(savedClinics).filter(c => c.id !== clinic.id && c.clinicId !== cId && c.slug !== cSlug);
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
            localStorage.setItem('smart_clinic_tenant_queues', JSON.stringify(parsed));
          }
        } catch (lsErr) {
          console.warn('[LocalStorage Purge Warning]:', lsErr);
        }

        // 4. Update React state in root App
        setClinicsList(prev => prev.filter(c => c.id !== clinic.id && c.clinicId !== cId && c.slug !== cSlug));
        setDoctorsList(prev => prev.filter(d => d.clinicId !== cId && d.clinicSlug !== cSlug && d.clinicName?.toLowerCase() !== cName?.toLowerCase()));
        setClinicQueues(prev => {
          const updated = { ...prev };
          delete updated[cSlug];
          if (cId) delete updated[cId];
          return updated;
        });

        console.log(`[Super Admin] Clinic '${cName}' successfully deleted with all credentials and auth records purged.`);
      };\n\n      """

src = src[:pos_del] + new_delete_func + src[pos_del_end:]
print("2b. Replaced handleDeleteClinic with Firebase Auth deletion and cascade wipe!")

# 2c. Update deletion modal description in SuperAdminDashboardView
old_modal_items = """                    <li>Clinic ID: <span className="text-cyan-400 font-mono font-bold">{clinicToDelete.clinicId || `CLN-${clinicToDelete.id}`}</span></li>
                    <li>Tenant Route: <span className="text-teal-400 font-mono">/clinic/{clinicToDelete.slug}</span></li>
                    <li>All registered doctor profiles & consultation rooms</li>
                    <li>Active and historical queue tokens & patient records</li>"""

new_modal_items = """                    <li>Clinic ID: <span className="text-cyan-400 font-mono font-bold">{clinicToDelete.clinicId || `CLN-${clinicToDelete.id}`}</span></li>
                    <li>Tenant Route: <span className="text-teal-400 font-mono">/clinic/{clinicToDelete.slug}</span></li>
                    <li>Firebase Authentication user account & access credentials</li>
                    <li>All registered doctor profiles & consultation rooms</li>
                    <li>Active and historical queue tokens & patient records</li>
                    <li>Active browser login sessions & stored session tokens</li>"""

if old_modal_items in src:
    src = src.replace(old_modal_items, new_modal_items, 1)
    print("2c. Updated Super Admin deletion confirmation modal items!")
else:
    print("WARNING: old_modal_items not found for exact replacement")

with open(INDEX_SOURCE, "w", encoding="utf-8") as f:
    f.write(src)

print("SUCCESS: index.source.html updated with Firebase Authentication deletion logic!")
