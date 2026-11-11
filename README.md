# 🏥 Smart Clinic OS - Frontend Application

A production-grade, real-time React + Tailwind CSS frontend application for Smart Clinic management, equipped with 3 synchronized responsive views, automated hospital audio announcements, WhatsApp message triggers, and dynamic rolling-average wait time calculations.

---

## 🌟 Key Features & Updates

1. **🩺 Editable Doctor & Clinic Details**
   - Click **"⚙️ Settings"** in the top bar or **"Edit Profile"** on the Doctor Console.
   - Customize:
     - **Doctor Name** (e.g. `Dr. Arvind Deshmukh`)
     - **Specialization** (e.g. `MD (Gen Med)`)
     - **Room / Counter** (e.g. `Consultation Room 1`)
     - **Clinic Name** (e.g. `Apollo Cradle Clinic, Indiranagar`)
   - Persists automatically in browser `localStorage` across reloads and syncs across all 3 views.

2. **🧹 Patient Registration & Queue Cleanup**
   - Zero dummy patients: The queue starts clean/empty.
   - Walk-in patients scan the QR code to self-register their Name and Mobile number via the Patient QR View.
   - Tokens auto-increment cleanly: `A-01`, `A-02`, etc.

3. **🔊 "Audio Ready" Text-to-Speech Engine**
   - Click **"⚡ Click: Enable Audio"** / **"🔊 Audio Ready"** on the top bar.
   - Initializes the browser's Web Speech API (`window.speechSynthesis`) and Web Audio API (`AudioContext`) to bypass browser auto-play restrictions.
   - When the doctor taps **"CALL NEXT"**, plays a 2-tone hospital chime (*587Hz -> 440Hz*) and announces:
     > *"Token A-04, John Doe, please proceed to Consultation Room 1."*

4. **💬 WhatsApp Message Triggers**
   - **Trigger 1 (On Patient Registration)**:
     > *"Hello [Patient Name], your Token number is [Token No] at [Clinic Name]. Estimated wait time: [X] mins ([Y] patients ahead of you)."*
   - **Trigger 2 (On "CALL NEXT")**:
     > *"Token [Token No]: Dr. [Doctor Name] is ready for you now. Please step inside [Room Number]."*
   - Includes real-time floating notification toasts and 1-click **"Open in WhatsApp Web ↗"** direct links (`https://wa.me/...`).

5. **⏱️ Dynamic Duration Tracker & Rolling Average Queue Calculation**
   - **Timestamp Tracking**: When a patient enters consultation (CALL NEXT), records `consultation_start_time`. When completed, records `consultation_end_time` and logs `duration = (end_time - start_time)` in minutes.
   - **Rolling Average**: Computes `(Sum of all completed durations today) / (Total completed today)`. Defaults to **8.0 minutes** if 0 completed today.
   - **Live Wait Time Output**:
     - Displayed on the Doctor Console header (e.g. `"Avg Consult Time: 8.4 mins"`).
     - Individual patient wait calculated as `(Patient Queue Position) * (Dynamic Average Consultation Time)`.
     - Displayed live on patient cards (e.g. `"Est. Wait: ~17 mins"` for 2nd in line at 8.4 mins/patient) and included in the registration WhatsApp message!

---

## 🚀 How to Run

### Option 1: Instant Launch (Zero dependencies)
Run the included Python launcher:
```powershell
python C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\serve.py
```
Then open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Option 2: Open Directly
Double-click:
`C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.html`
in your browser.
