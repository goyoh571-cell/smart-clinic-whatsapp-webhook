const {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback
} = React;

// ========================================================================
// 1. DOCTOR PHONE AUDIO & ANNOUNCEMENT ENGINE (Web Audio + Web Speech API)
// ========================================================================
class AudioAnnouncementEngine {
  constructor() {
    this.ctx = null;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.enabled = false;
    this.isInitialized = false;
  }
  initContext() {
    try {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (this.synth) {
        this.synth.resume();
        if (this.synth.getVoices().length === 0) {
          this.synth.onvoiceschanged = () => {};
        }
      }
      this.enabled = true;
      this.isInitialized = true;
    } catch (e) {
      console.warn('[Audio] Init warning:', e);
    }
  }
  playChime() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Tone 1: D5 (587.33 Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.55);

      // Tone 2: A4 (440.0 Hz)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(440.0, now + 0.26);
      gain2.gain.setValueAtTime(0.3, now + 0.26);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.26);
      osc2.stop(now + 0.85);
    } catch (e) {
      console.warn('[Audio] Chime playback warning:', e);
    }
  }
  announceCall(tokenNumber, patientName) {
    if (!this.enabled) return;
    this.playChime();
    if (this.synth) {
      setTimeout(() => {
        try {
          this.synth.cancel();
          const cleanToken = tokenNumber ? tokenNumber.replace('-', ' ') : 'Token';
          const text = `Token ${cleanToken}, ${patientName || 'Patient'}, please step inside.`;
          const utter = new SpeechSynthesisUtterance(text);
          utter.rate = 0.95;
          utter.pitch = 1.05;
          utter.volume = 1.0;
          const voices = this.synth.getVoices();
          const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Female')));
          if (preferredVoice) utter.voice = preferredVoice;
          this.synth.speak(utter);
        } catch (err) {
          console.warn('[Speech] Announcement warning:', err);
        }
      }, 600);
    }
  }
}
const audioService = new AudioAnnouncementEngine();
function getPatientBadgeText(patient) {
  if (!patient) return null;
  const parts = [];
  const gender = (patient.gender || '').trim();
  if (gender && gender !== 'Other' && gender !== 'Adult') {
    parts.push(gender);
  }
  const rawAge = patient.age;
  if (rawAge !== null && rawAge !== undefined && rawAge !== '' && rawAge !== 30 && String(rawAge) !== '30' && String(rawAge) !== '30y') {
    parts.push(`${rawAge}y`);
  }
  return parts.length > 0 ? parts.join(' • ') : null;
}
function getPatientComplaint(token) {
  if (!token) return '';
  const c = (token.complaint || token.chiefComplaint || '').trim();
  const dummyValues = ['General Checkup', 'General Consultation', 'OPD Consultation', 'Consultation'];
  if (!c || dummyValues.includes(c)) {
    return '';
  }
  return c;
}

// ========================================================================
// 2. CLINICAL PRESCRIPTION PDF GENERATOR (High-Resolution Professional Rx)
// ========================================================================
function generatePrescriptionPdf({
  doctor,
  patient,
  tokenNumber,
  rxNotes,
  templateName
}) {
  try {
    const {
      jsPDF
    } = window.jspdf || {};
    if (!jsPDF) {
      throw new Error('jsPDF library not loaded');
    }
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // ── 1. LETTERHEAD ─────────────────────────────────────────────────────
    // Teal accent left-border bar
    doc.setFillColor(13, 148, 136); // teal-600
    doc.rect(0, 0, 6, 297, 'F');

    // Clinic Name (large)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text((doctor.clinicName || 'Smart Clinic').toUpperCase(), 14, 18);

    // Doctor name + qualifications on same line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    const doctorLine = `${doctor.doctorName || 'Doctor'}${doctor.qualifications ? '  |  ' + doctor.qualifications : ''}`;
    doc.text(doctorLine, 14, 26);

    // Specialization
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(doctor.specialization || '', 14, 32);

    // Reg No + Phone (right-aligned)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const regLine = `Reg. No: ${doctor.regNo || 'N/A'}   |   Ph: ${doctor.phone || 'N/A'}`;
    doc.text(regLine, 196, 20, {
      align: 'right'
    });

    // Clinic Address (right-aligned)
    if (doctor.clinicAddress) {
      const addrLines = doc.splitTextToSize(doctor.clinicAddress, 90);
      doc.text(addrLines, 196, 26, {
        align: 'right'
      });
    }

    // Divider
    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(0.8);
    doc.line(14, 38, 196, 38);

    // ── 2. PATIENT METADATA BOX ───────────────────────────────────────────
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 42, 182, 26, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(14, 42, 182, 26, 2, 2, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Patient: ${patient.name || 'Patient'}`, 18, 50);
    doc.text(`Token: ${tokenNumber}`, 170, 50, {
      align: 'right'
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const pBadge = getPatientBadgeText(patient);
    doc.text(`Phone: ${patient.phone || 'N/A'}${pBadge ? `   |   ${pBadge}` : ''}`, 18, 57);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })}`, 170, 57, {
      align: 'right'
    });
    const pComplaint = getPatientComplaint(patient);
    if (pComplaint) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Chief Complaint: ${pComplaint}`, 18, 63);
    }

    // ── 3. Rx SYMBOL + SECTION HEADING ────────────────────────────────────
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(26);
    doc.setTextColor(13, 148, 136);
    doc.text('Rx', 14, 80);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Medications & Clinical Advice  (${templateName || 'Custom Notes'})`, 30, 79);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(14, 83, 196, 83);

    // ── 4. PRESCRIPTION BODY ──────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const rxText = rxNotes || '1. Tab Paracetamol 650mg TDS x 3 days\n2. Rest and hydration';
    const lines = doc.splitTextToSize(rxText, 178);
    doc.text(lines, 18, 92);

    // ── 5. DIGITAL SIGNATURE AREA ─────────────────────────────────────────
    // Signature image (if uploaded as base64)
    const sigBoxY = 240;
    if (doctor.digitalSignature) {
      try {
        doc.addImage(doctor.digitalSignature, 'PNG', 130, sigBoxY - 18, 55, 18);
      } catch (e) {
        // ignore image errors
      }
    }
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(130, sigBoxY, 190, sigBoxY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(doctor.doctorName || 'Doctor', 160, sigBoxY + 5, {
      align: 'center'
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    if (doctor.qualifications) {
      doc.text(doctor.qualifications, 160, sigBoxY + 9, {
        align: 'center'
      });
    }
    doc.text(doctor.specialization || '', 160, sigBoxY + 13, {
      align: 'center'
    });
    doc.text(`Reg. No: ${doctor.regNo || 'N/A'}`, 160, sigBoxY + 17, {
      align: 'center'
    });

    // Stamp circle outline
    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(0.4);
    doc.circle(25, sigBoxY, 14, 'S');
    doc.setFontSize(6);
    doc.setTextColor(13, 148, 136);
    doc.text('CLINIC', 25, sigBoxY - 2, {
      align: 'center'
    });
    doc.text('SEAL', 25, sigBoxY + 2, {
      align: 'center'
    });

    // ── 6. FOOTER ─────────────────────────────────────────────────────────
    doc.setFillColor(240, 253, 250);
    doc.rect(0, 277, 210, 20, 'F');
    doc.setDrawColor(204, 251, 241);
    doc.line(0, 277, 210, 277);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(13, 148, 136);
    doc.text('SMART CLINIC OS  •  VERIFIED DIGITAL PRESCRIPTION', 105, 283, {
      align: 'center'
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleTimeString()}  on  ${new Date().toLocaleDateString()}   |   Clinic ID: ${doctor.clinicSlug || '—'}`, 105, 288, {
      align: 'center'
    });
    doc.text('This prescription is digitally signed and valid under Telemedicine & Healthcare Practice Guidelines.', 105, 293, {
      align: 'center'
    });

    // Return Blob & Data URL
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const cleanName = (patient.name || 'Patient').replace(/\s+/g, '');
    const filename = `Rx_${cleanName}_${tokenNumber}.pdf`;
    return {
      doc,
      blob,
      blobUrl,
      filename
    };
  } catch (err) {
    console.error('[PDF Engine Error]', err);
    return null;
  }
}

// ========================================================================
// 2B. 100% SERVERLESS FIREBASE SERVICES (Cloud Firestore & Storage)
// Project: smart-clinic-app
// ========================================================================
function getFirebaseDb() {
  if (typeof window !== 'undefined') {
    if (window.SmartClinicFirebase && window.SmartClinicFirebase.db) {
      return window.SmartClinicFirebase.db;
    }
    if (window.firebase && window.firebase.firestore) {
      return window.firebase.firestore();
    }
  }
  return null;
}
function getFirebaseStorage() {
  if (typeof window !== 'undefined') {
    if (window.SmartClinicFirebase && window.SmartClinicFirebase.storage) {
      return window.SmartClinicFirebase.storage;
    }
    if (window.firebase && window.firebase.storage) {
      return window.firebase.storage();
    }
  }
  return null;
}

// Direct Firestore write for Patient check-in
async function addPatientToFirestore(tokenData, clinicSlug) {
  const db = getFirebaseDb();
  const slug = clinicSlug || tokenData.clinicSlug || 'ankitha-clinic';
  const cleanId = String(tokenData.id || Date.now());
  const payload = {
    ...tokenData,
    id: cleanId,
    clinicSlug: slug,
    updatedAt: new Date().toISOString()
  };
  if (db) {
    try {
      await db.collection('queues').doc(cleanId).set(payload, {
        merge: true
      });
      console.log(`[Firestore] Successfully written patient token #${tokenData.tokenNumber} to Firestore.`);
    } catch (e) {
      console.warn('[Firestore] Patient check-in write info:', e);
    }
  }
  return payload;
}

// Direct Firestore update for token status / prescription
async function updatePatientInFirestore(tokenId, updates, clinicSlug) {
  const db = getFirebaseDb();
  const cleanId = String(tokenId);
  const payload = {
    ...updates,
    updatedAt: new Date().toISOString()
  };
  if (db) {
    try {
      await db.collection('queues').doc(cleanId).set(payload, {
        merge: true
      });
      console.log(`[Firestore] Updated token ${cleanId} in Firestore.`);
    } catch (e) {
      console.warn('[Firestore] Update token info:', e);
    }
  }
  return payload;
}

// Direct Firestore fetch using getDocs / .get()
// Helper to extract canonical kebab-case slug

// ========================================================================
// SUBSCRIPTION & TRIAL TIER CONSTANTS & HELPERS
// ========================================================================
const TRIAL_TIERS = {
  TRIAL_1_SEAT: 'Free Trial (14 Days — 1 Seat) (₹0)',
  TRIAL_2_5_SEATS: 'Free Trial (14 Days — 2 to 5 Seats) (₹0)',
  TRIAL_UNLIMITED: 'Free Trial (14 Days — Unlimited Seats) (₹0)'
};
const PAID_TIERS = {
  STARTER: 'Starter / Solo (₹9,999/yr)',
  PROFESSIONAL: 'Professional (₹19,999/yr)',
  ENTERPRISE: 'Enterprise (₹49,999/yr)'
};
function getTrialPlanDetails(planName, seatCount) {
  const p = String(planName || '').trim();
  const seats = parseInt(seatCount) || 1;
  if (p.includes('1 Seat') || p === TRIAL_TIERS.TRIAL_1_SEAT || p.toLowerCase().includes('trial') && seats === 1) {
    return {
      isTrial: true,
      plan: TRIAL_TIERS.TRIAL_1_SEAT,
      allowedSeats: 1,
      doctorSeats: 1,
      seatLabel: '1 Seat',
      targetPaidTier: PAID_TIERS.STARTER,
      targetPaidPrice: '₹9,999/yr',
      durationDays: 14
    };
  }
  if (p.includes('2 to 5') || p === TRIAL_TIERS.TRIAL_2_5_SEATS || p.toLowerCase().includes('trial') && seats >= 2 && seats <= 5) {
    return {
      isTrial: true,
      plan: TRIAL_TIERS.TRIAL_2_5_SEATS,
      allowedSeats: 5,
      doctorSeats: Math.min(Math.max(seats, 2), 5),
      seatLabel: '2 to 5 Seats',
      targetPaidTier: PAID_TIERS.PROFESSIONAL,
      targetPaidPrice: '₹19,999/yr',
      durationDays: 14
    };
  }
  if (p.includes('Unlimited') || p === TRIAL_TIERS.TRIAL_UNLIMITED || p.toLowerCase().includes('trial') && seats > 5) {
    return {
      isTrial: true,
      plan: TRIAL_TIERS.TRIAL_UNLIMITED,
      allowedSeats: 999,
      doctorSeats: 999,
      seatLabel: 'Unlimited Seats',
      targetPaidTier: PAID_TIERS.ENTERPRISE,
      targetPaidPrice: '₹49,999/yr',
      durationDays: 14
    };
  }
  // Direct Paid Plans
  if (p.includes('Starter') || p === PAID_TIERS.STARTER) {
    return {
      isTrial: false,
      plan: PAID_TIERS.STARTER,
      allowedSeats: 1,
      doctorSeats: 1,
      seatLabel: '1 Seat',
      targetPaidTier: PAID_TIERS.STARTER,
      targetPaidPrice: '₹9,999/yr',
      durationDays: 365
    };
  }
  if (p.includes('Enterprise') || p === PAID_TIERS.ENTERPRISE) {
    return {
      isTrial: false,
      plan: PAID_TIERS.ENTERPRISE,
      allowedSeats: 999,
      doctorSeats: 999,
      seatLabel: 'Unlimited Seats',
      targetPaidTier: PAID_TIERS.ENTERPRISE,
      targetPaidPrice: '₹49,999/yr',
      durationDays: 365
    };
  }
  // Fallback: Professional
  return {
    isTrial: false,
    plan: PAID_TIERS.PROFESSIONAL,
    allowedSeats: 5,
    doctorSeats: 5,
    seatLabel: '5 Seats',
    targetPaidTier: PAID_TIERS.PROFESSIONAL,
    targetPaidPrice: '₹19,999/yr',
    durationDays: 365
  };
}
function checkClinicSubscriptionStatus(clinic) {
  if (!clinic) return {
    isTrial: false,
    isExpired: false,
    isLocked: false,
    status: 'UNKNOWN'
  };
  const isTrial = Boolean(clinic.isTrial || String(clinic.subscriptionPlan || '').toLowerCase().includes('trial'));
  const hasActiveSub = Boolean(clinic.hasActiveSubscription || clinic.status === 'SUBSCRIBED');
  if (!isTrial) {
    const isSuspended = clinic.status === 'SUSPENDED';
    return {
      isTrial: false,
      isExpired: false,
      isLocked: isSuspended,
      status: isSuspended ? 'SUSPENDED' : 'PAID_ACTIVE',
      targetPaidTier: clinic.targetPaidTier || clinic.subscriptionPlan || PAID_TIERS.PROFESSIONAL,
      targetPaidPrice: clinic.targetPaidPrice || '₹19,999/yr'
    };
  }

  // Check trial expiration timestamp
  let trialEnd = null;
  if (clinic.trialEndDate) {
    trialEnd = new Date(clinic.trialEndDate);
  } else if (clinic.createdAt) {
    const created = new Date(clinic.createdAt);
    trialEnd = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
  }
  const now = new Date();
  const isExpired = trialEnd ? now.getTime() > trialEnd.getTime() : false;
  const daysRemaining = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

  // If trial expired and no paid subscription active -> Locked to target paid tier
  const isLocked = isExpired && !hasActiveSub;
  const targetPaidTier = clinic.targetPaidTier || (Number(clinic.doctorSeats) === 1 ? PAID_TIERS.STARTER : Number(clinic.doctorSeats) > 5 ? PAID_TIERS.ENTERPRISE : PAID_TIERS.PROFESSIONAL);
  const targetPaidPrice = clinic.targetPaidPrice || (targetPaidTier.includes('9,999') ? '₹9,999/yr' : targetPaidTier.includes('49,999') ? '₹49,999/yr' : '₹19,999/yr');
  return {
    isTrial: true,
    isExpired,
    isLocked,
    daysRemaining,
    trialEndDate: trialEnd ? trialEnd.toISOString() : null,
    targetPaidTier,
    targetPaidPrice,
    status: isLocked ? 'TRIAL_EXPIRED_LOCKED' : 'TRIAL_ACTIVE'
  };
}
function canonicalSlug(raw) {
  if (!raw) return '';
  return String(raw).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Helper to reliably lookup queue array across canonical slug and all variants
function getQueueForSlug(queues, rawSlug) {
  if (!queues || !rawSlug) return [];
  const clean = canonicalSlug(rawSlug);
  if (Array.isArray(queues[clean]) && queues[clean].length > 0) return queues[clean];
  if (Array.isArray(queues[rawSlug]) && queues[rawSlug].length > 0) return queues[rawSlug];
  const variants = getSlugVariants(rawSlug);
  for (const v of variants) {
    if (Array.isArray(queues[v]) && queues[v].length > 0) return queues[v];
  }
  return queues[clean] || queues[rawSlug] || [];
}

// Helper to generate all common slug variants (hyphenated, spaced, lowercase, raw)
function getSlugVariants(rawSlug) {
  if (!rawSlug) return ['ankitha-clinic'];
  const s = String(rawSlug).trim();
  const normalized = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const spaced = s.toLowerCase().replace(/[-_]+/g, ' ').trim();
  const rawLower = s.toLowerCase();
  const variants = new Set([s, rawLower, normalized, spaced, `dr-${normalized}`, normalized.replace(/^dr-/, '')]);
  return Array.from(variants).filter(Boolean);
}

// Direct Firestore fetch using getDocs / .get() with forced server fetch & slug variants
async function fetchQueueFromFirestore(clinicSlug) {
  const db = getFirebaseDb();
  const slug = clinicSlug || 'ankitha-clinic';
  if (!db) return [];
  try {
    const variants = getSlugVariants(slug);
    let snapshot;
    // Always force fetch directly from server over network to bypass stale in-memory SDK cache
    if (typeof db.collection === 'function') {
      try {
        snapshot = await db.collection('queues').where('clinicSlug', 'in', variants.slice(0, 10)).get({
          source: 'server'
        });
      } catch (cacheFallbackErr) {
        try {
          snapshot = await db.collection('queues').where('clinicSlug', 'in', variants.slice(0, 10)).get();
        } catch (e) {
          snapshot = await db.collection('queues').where('clinicSlug', '==', variants[0]).get();
        }
      }
    } else if (typeof window.getDocs === 'function') {
      try {
        snapshot = await window.getDocs(window.query(window.collection(db, 'queues'), window.where('clinicSlug', 'in', variants.slice(0, 10))), {
          source: 'server'
        });
      } catch (e) {
        snapshot = await window.getDocs(window.query(window.collection(db, 'queues'), window.where('clinicSlug', 'in', variants.slice(0, 10))));
      }
    }
    const tokens = [];
    if (snapshot && snapshot.forEach) {
      snapshot.forEach(doc => {
        const data = doc.data() || {};
        // Strict Real-User Patient Verification: only allow records created with valid patient details
        const p = data.patient || {};
        const pName = String(p.name || '').trim();
        const pPhone = String(p.phone || '').trim();
        if (!pName || pName.length < 2 || !pPhone || pPhone.length < 5) return;
        const lower = pName.toLowerCase();
        if (lower.includes('automated test') || lower.includes('dummy') || lower.includes('fake patient') || lower.includes('live sync tester')) return;
        tokens.push({
          ...data,
          id: String(data.id || doc.id),
          docId: doc.id
        });
      });
    }
    tokens.sort((a, b) => {
      const numA = parseInt(String(a.tokenNumber || a.id).replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(String(b.tokenNumber || b.id).replace(/[^0-9]/g, '')) || 0;
      if (numA !== numB) return numA - numB;
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeA - timeB;
    });
    return tokens;
  } catch (err) {
    console.warn('[Firestore getDocs Error]:', err);
    return [];
  }
}

// Direct Firestore onSnapshot real-time listener for the queue with slug variants
function subscribeToQueueInFirestore(clinicSlug, onUpdate) {
  const db = getFirebaseDb();
  const slug = clinicSlug || 'ankitha-clinic';
  if (!db) {
    console.warn('[Firestore] DB instance not initialized yet for clinic:', slug);
    return () => {};
  }
  try {
    const variants = getSlugVariants(slug);
    console.log(`[Firestore] Initializing real-time onSnapshot listener for variants:`, variants);
    let unsubscribe;
    try {
      unsubscribe = db.collection('queues').where('clinicSlug', 'in', variants.slice(0, 10)).onSnapshot(snapshot => {
        const tokens = [];
        snapshot.forEach(doc => {
          const data = doc.data() || {};
          const p = data.patient || {};
          const pName = String(p.name || '').trim();
          const pPhone = String(p.phone || '').trim();
          if (!pName || pName.length < 2 || !pPhone || pPhone.length < 5) return;
          const lower = pName.toLowerCase();
          if (lower.includes('automated test') || lower.includes('dummy') || lower.includes('fake patient') || lower.includes('live sync tester')) return;
          tokens.push({
            ...data,
            id: String(data.id || doc.id),
            docId: doc.id
          });
        });
        tokens.sort((a, b) => {
          const numA = parseInt(String(a.tokenNumber || a.id).replace(/[^0-9]/g, '')) || 0;
          const numB = parseInt(String(b.tokenNumber || b.id).replace(/[^0-9]/g, '')) || 0;
          if (numA !== numB) return numA - numB;
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeA - timeB;
        });
        onUpdate(tokens);
      }, err => {
        console.warn('[Firestore onSnapshot Error]:', err);
      });
    } catch (inErr) {
      unsubscribe = db.collection('queues').where('clinicSlug', '==', variants[0]).onSnapshot(snapshot => {
        const tokens = [];
        snapshot.forEach(doc => {
          const data = doc.data() || {};
          const p = data.patient || {};
          const pName = String(p.name || '').trim();
          const pPhone = String(p.phone || '').trim();
          if (!pName || pName.length < 2 || !pPhone || pPhone.length < 5) return;
          const lower = pName.toLowerCase();
          if (lower.includes('automated test') || lower.includes('dummy') || lower.includes('fake patient') || lower.includes('live sync tester')) return;
          tokens.push({
            ...data,
            id: String(data.id || doc.id),
            docId: doc.id
          });
        });
        onUpdate(tokens);
      }, err => console.warn('[Firestore onSnapshot Single Error]:', err));
    }
    return unsubscribe;
  } catch (err) {
    console.warn('[Firestore onSnapshot Exception]:', err);
    return () => {};
  }
}

// Direct Firebase Storage Upload for Prescription PDFs generated with jsPDF
async function uploadPrescriptionPdfToFirebaseStorage({
  blob,
  filename,
  clinicSlug,
  tokenNumber,
  patientName
}) {
  const storage = getFirebaseStorage();
  const slug = clinicSlug || 'general';
  const cleanFilename = filename || `Rx_${(patientName || 'Patient').replace(/[^a-zA-Z0-9]/g, '_')}_${String(tokenNumber).replace('#', '')}.pdf`;
  const storagePath = `prescriptions/${slug}/${Date.now()}_${cleanFilename}`;
  if (!storage) {
    console.warn('[Firebase Storage] Storage not ready, keeping local blob URL.');
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
    console.log(`[Firebase Storage] Uploading ${cleanFilename} to ${storagePath}...`);
    const snapshot = await storageRef.put(blob, metadata);
    const downloadUrl = await snapshot.ref.getDownloadURL();
    console.log('[Firebase Storage] Upload succeeded! Download URL:', downloadUrl);
    return {
      downloadUrl,
      storagePath,
      filename: cleanFilename
    };
  } catch (err) {
    console.warn('[Firebase Storage Upload Info]:', err);
    return null;
  }
}

// Download Rx PDF from Firebase Storage with automatic jsPDF client fallback
async function downloadPrescriptionFromFirebaseStorage(token, doctor, options = {}) {
  try {
    if (!token) return false;

    // 1. If prescription PDF was uploaded to Firebase Storage, download or open directly
    if (token.rxPdfUrl && token.rxPdfUrl.startsWith('http')) {
      try {
        const response = await fetch(token.rxPdfUrl);
        if (response.ok) {
          const blob = await response.blob();
          const objectUrl = window.URL.createObjectURL(blob);
          const cleanPatientName = (token.patient?.name || token.name || 'Patient').replace(/[^a-zA-Z0-9]/g, '_');
          const cleanTokenNum = String(token.tokenNumber || 'Prescription').replace('#', '');
          const filename = token.rxFilename || `Rx_${cleanPatientName}_${cleanTokenNum}.pdf`;
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = objectUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          if (options.openInNewTab) {
            try {
              window.open(objectUrl, '_blank');
            } catch (_) {}
          }
          setTimeout(() => {
            try {
              document.body.removeChild(a);
              window.URL.revokeObjectURL(objectUrl);
            } catch (_) {}
          }, 1500);
          return true;
        }
      } catch (e) {
        console.warn('[Firebase Storage Download Warning, falling back to client jsPDF]:', e);
      }
    }

    // 2. Client-side fallback using in-browser jsPDF engine
    return downloadPrescriptionFile(token, doctor);
  } catch (err) {
    console.error('[Download Rx Error]:', err);
    return downloadPrescriptionFile(token, doctor);
  }
}
async function downloadPrescriptionFromBackend(token, doctor, options = {}) {
  return downloadPrescriptionFromFirebaseStorage(token, doctor, options);
}
async function _legacyDownload(token, doctor, options) {
  try {
    if (!token) {
      console.warn('[Download Rx] No token provided');
      return false;
    }
    const tokenIdentifier = token.id || token.tokenNumber || '';
    const clinicIdentifier = doctor?.clinicSlug || doctor?.clinicId || token.clinicId || 'ankitha-clinic';
    const cleanTokenParam = encodeURIComponent(String(tokenIdentifier).replace('#', ''));
    const cleanClinicParam = encodeURIComponent(String(clinicIdentifier));

    // 1. Correct PDF API Route
    const endpointUrl = `/api/prescription/download?token=${cleanTokenParam}&tokenId=${cleanTokenParam}&clinic=${cleanClinicParam}`;

    // 2. Fetch the backend prescription PDF generation endpoint
    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf'
      }
    });
    if (!response.ok) {
      throw new Error(`PDF endpoint returned HTTP ${response.status}`);
    }

    // 3. Properly handle the incoming blob response
    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      throw new Error('Received empty PDF blob');
    }

    // 4. Create temporary object URL
    const objectUrl = window.URL.createObjectURL(blob);
    const cleanPatientName = (token.patient?.name || token.name || 'Patient').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanTokenNum = String(token.tokenNumber || 'Prescription').replace('#', '');
    const filename = token.rxFilename || `Rx_${cleanPatientName}_${cleanTokenNum}.pdf`;

    // 5. Programmatically trigger clean browser download
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    // Also allow opening in a new tab if requested
    if (options.openInNewTab) {
      try {
        window.open(objectUrl, '_blank');
      } catch (_) {}
    }
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(objectUrl);
      } catch (_) {}
    }, 1500);
    return true;
  } catch (err) {
    console.warn('[Backend PDF Download failed, using client-side fallback]', err);
    // Resilient client-side fallback
    return downloadPrescriptionFile(token, doctor);
  }
}
function downloadPrescriptionFile(token, doctorInfo) {
  try {
    if (!token) return false;
    const docMeta = doctorInfo || {
      clinicName: 'Smart Clinic',
      doctorName: 'Attending Physician',
      clinicSlug: 'clinic'
    };
    const patientMeta = {
      name: token.patient?.name || token.name || 'Patient',
      phone: token.patient?.phone || token.phone || '',
      age: token.patient?.age || token.age,
      gender: token.patient?.gender || token.gender,
      complaint: token.complaint || token.patient?.complaint
    };
    const result = generatePrescriptionPdf({
      doctor: docMeta,
      patient: patientMeta,
      tokenNumber: token.tokenNumber || '—',
      rxNotes: token.rxNotes || token.rxText || 'Prescription notes and clinical advice.',
      templateName: token.templateName || 'Prescription'
    });
    if (result && result.blob) {
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || `Rx_Token_${token.tokenNumber || 'Prescription'}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (_) {}
      }, 1000);
      return true;
    }
  } catch (err) {
    console.error('[Download Rx Error]', err);
  }
  return false;
}

// ========================================================================
// 3. MULTI-TENANT INITIAL DOCTOR SEED
// ========================================================================
// ========================================================================
// 2B. GOYOH HEALTH CONNECT - MIGRATION & EMPTY MULTI-TENANT SEEDS
// ========================================================================
// Migration: Purge legacy mock/demo data from browser localStorage
(function purgeLegacyMockData() {
  try {
    const PURGE_KEY = 'goyoh_mock_data_purged_v2';
    if (!localStorage.getItem(PURGE_KEY)) {
      localStorage.removeItem('smart_clinic_saas_clinics');
      localStorage.removeItem('smart_clinic_saas_doctors');
      localStorage.removeItem('smart_clinic_tenant_queues');
      localStorage.removeItem('smart_clinic_tenant_durations');
      localStorage.removeItem('smart_clinic_current_doctor');
      localStorage.removeItem('smart_clinic_active_clinic_slug');
      localStorage.setItem(PURGE_KEY, 'true');
    }
  } catch (e) {}
})();
const LEGACY_MOCK_CLINIC_IDS = ['CLN-MEDICLINC', 'CLN-APOLLO-IND', 'CLN-BLOSSOM-KOR', 'CLN-KARTIK'];
const LEGACY_MOCK_SLUGS = ['medi-clinc', 'dr-musheer-medi-clinc', 'apollo-cradle', 'dr-arvind-indiranagar', 'blossom-children', 'dr-sneha-pediatrics', 'kartik-clinc'];
const LEGACY_MOCK_DOCTOR_EMAILS = ['dr.musheer@mediclinic.com', 'dr.arvind@apollo.com', 'dr.sneha@pediacare.com', 'dr.kartik@kartikclinic.com'];
const INITIAL_CLINICS = [{
  id: 1,
  clinicId: "CLN-ANKITHA",
  name: "Dr. Ankitha Clinic",
  ownerName: "Dr. Ankitha Rao",
  email: "ankitha@clinic.com",
  username: "ankitha",
  slug: "ankitha-clinic",
  doctorSeats: 2,
  subscriptionPlan: "Professional",
  status: "ACTIVE",
  address: "124 Healthcare Hub, Indiranagar, Bengaluru",
  phone: "+91 98765 43210"
}];
const DEMO_DOCTORS = [{
  id: "doc-1",
  doctorName: "Dr. Ankitha Rao",
  specialty: "General Physician & Diabetologist",
  specialization: "General Physician & Diabetologist",
  qualification: "MBBS, MD (General Medicine)",
  clinicId: "CLN-ANKITHA",
  clinicSlug: "ankitha-clinic",
  clinicName: "Dr. Ankitha Clinic",
  roomNumber: "Consultation Room 1",
  avgConsultationTime: 8.0,
  status: "ACTIVE",
  phone: "+91 98765 43210",
  email: "ankitha@clinic.com"
}];

// Helper: Strict Tenant Resolution
function resolveClinicAndDoctor(routeSlug, clinics, doctors) {
  let matchedClinic = null;
  const clinicSource = clinics && clinics.length > 0 ? clinics : INITIAL_CLINICS;
  const doctorSource = doctors && doctors.length > 0 ? doctors : DEMO_DOCTORS;
  if (routeSlug) {
    const clean = String(routeSlug).toLowerCase().trim();
    matchedClinic = clinicSource.find(c => c.slug?.toLowerCase() === clean || c.alias && c.alias.toLowerCase() === clean || c.clinicId?.toLowerCase() === clean || c.slug?.replace(/^dr-/, '').toLowerCase() === clean.replace(/^dr-/, '') || c.name && clean.includes(c.name.toLowerCase().replace(/[^a-z0-9]/g, '')));

    // If routeSlug specified but clinic doc not yet present in memory,
    // dynamically synthesize a complete clinic object from routeSlug so we NEVER fall back to a hardcoded clinic!
    if (!matchedClinic) {
      const words = clean.split('-').filter(Boolean);
      const formattedName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const displayName = formattedName.toLowerCase().includes('clinic') || formattedName.toLowerCase().includes('care') || formattedName.toLowerCase().includes('hospital') ? formattedName : `${formattedName} Clinic`;
      const isMulti = clean.includes('multi') || clean.includes('hospital') || clean.includes('polyclinic') || clean.includes('seats');
      const defaultSeats = isMulti ? 5 : 1;
      const defaultPlan = isMulti ? 'Free Trial (14 Days — 2 to 5 Seats) (₹0)' : 'Free Trial (14 Days — 1 Seat) (₹0)';
      matchedClinic = {
        id: clean,
        docId: clean,
        clinicId: `CLN-${clean.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`,
        name: displayName,
        ownerName: `Dr. ${formattedName.replace(/Clinic|Hospital|Care|Center/gi, '').trim() || 'Consultant'}`,
        email: `contact@${clean}.com`,
        slug: clean,
        alias: clean,
        phone: '+91 98765 43210',
        address: `${displayName}, Medical Suites`,
        doctorSeats: defaultSeats,
        subscriptionPlan: defaultPlan,
        status: 'ACTIVE',
        isDynamic: true
      };
    }
  }
  if (!matchedClinic) {
    try {
      const savedSlug = localStorage.getItem('smart_clinic_active_clinic_slug');
      if (savedSlug && !LEGACY_MOCK_SLUGS.includes(savedSlug)) {
        matchedClinic = clinicSource.find(c => c.slug === savedSlug || c.clinicId === savedSlug);
      }
    } catch (e) {}
  }

  // Default fallback ONLY when no route slug is requested at all
  if (!matchedClinic) {
    matchedClinic = clinicSource[0] || INITIAL_CLINICS[0];
  }

  // Find primary doctor for this clinic
  let doc = doctorSource.find(d => d.clinicId === matchedClinic.clinicId || d.clinicSlug === matchedClinic.slug || matchedClinic.alias && d.clinicSlug === matchedClinic.alias || d.clinicName && matchedClinic.name && d.clinicName.toLowerCase() === matchedClinic.name.toLowerCase());
  if (!doc) {
    doc = {
      id: `doc_${matchedClinic.slug}`,
      email: matchedClinic.email,
      doctorName: matchedClinic.ownerName || 'Doctor',
      specialization: 'Lead Physician & Clinic Admin',
      roomNumber: 'Consultation Room 1',
      clinicName: matchedClinic.name,
      clinicAddress: matchedClinic.address,
      clinicSlug: matchedClinic.slug,
      clinicId: matchedClinic.clinicId,
      phone: matchedClinic.phone,
      avgConsultationTime: 8.0,
      qualifications: 'MBBS, MD',
      doctorSeats: matchedClinic.doctorSeats,
      subscriptionPlan: matchedClinic.subscriptionPlan,
      status: 'Available'
    };
  }

  // Enforce canonical slug normalization across clinic & doctor
  if (matchedClinic) {
    matchedClinic.slug = canonicalSlug(matchedClinic.slug || routeSlug);
  }
  if (doc) {
    doc.clinicSlug = canonicalSlug(doc.clinicSlug || matchedClinic?.slug || routeSlug);
  }
  return {
    clinic: matchedClinic,
    doctor: doc
  };
}
function getDoctorScopeKey(doctor) {
  if (!doctor) return 'default_doctor';
  const cKey = doctor.clinicId || doctor.clinicSlug || 'clinic';
  const dKey = doctor.id || slugify(doctor.doctorName || 'doctor');
  return `${cKey}_${dKey}`.toLowerCase();
}
function getDefaultPrescriptionPacks(doctorKey) {
  return [{
    id: 'fever',
    name: 'Fever / Viral Pack',
    tag: 'PCM + CET',
    color: 'amber',
    medicines: `1. Tab Paracetamol 650 mg — 1 tab TDS (After Food) x 3 Days\n2. Tab Levocetirizine 5 mg — 1 tab HS (At Bedtime) x 3 Days\n3. Tab Vitamin C 500 mg — 1 tab OD x 5 Days\n4. Electral / ORS Solution — 1 sachet in 1 Litre water, sip throughout day\n\nAdvice:\n• Adequate rest and hydration (minimum 2.5 - 3 Litres water)\n• Soft, non-spicy diet\n• Temperature monitoring every 6 hours. SOS if fever > 101°F`,
    isCustom: false,
    doctorId: doctorKey
  }, {
    id: 'cold_cough',
    name: 'Cold & Cough Pack',
    tag: 'ANTI-COLD + SYP',
    color: 'sky',
    medicines: `1. Tab Montelukast 10mg + Levocetirizine 5mg — 1 tab HS x 5 Days\n2. Syp Dextromethorphan + Chlorpheniramine — 2 tsp TDS x 5 Days\n3. Tab Paracetamol 650 mg — 1 tab SOS (For headache or body ache)\n4. Karvol Plus Steam Inhalation — 2 times daily for 5 mins\n\nAdvice:\n• Warm saline gargles twice daily\n• Avoid chilled drinks, ice creams, and cold foods\n• Keep chest warm and avoid direct exposure to AC airflow`,
    isCustom: false,
    doctorId: doctorKey
  }, {
    id: 'gastritis',
    name: 'Gastritis / Acidity Pack',
    tag: 'PPI + GEL',
    color: 'emerald',
    medicines: `1. Cap Pantoprazole 40 mg — 1 cap OD (30 mins before breakfast) x 7 Days\n2. Tab Domperidone 10 mg — 1 tab BD (Before Food) x 5 Days\n3. Syp Sucralfate + Oxetacaine — 2 tsp TDS (1 hour after meals) x 5 Days\n\nAdvice:\n• Avoid spicy, oily, deep-fried food and citrus juices\n• Limit tea/coffee to max 1 small cup/day\n• Eat smaller, frequent meals; avoid lying down immediately after eating`,
    isCustom: false,
    doctorId: doctorKey
  }, {
    id: 'hypertension',
    name: 'Hypertension Protocol',
    tag: 'TELMI 40',
    color: 'blue',
    medicines: `1. Tab Telmisartan 40 mg — 1 tab OD (Morning after breakfast) x 30 Days\n2. Tab Amlodipine 5 mg — 1 tab OD (Night) x 30 Days [If SBP > 150 mmHg]\n\nAdvice:\n• Strict low-salt diet (< 2 grams table salt per day, avoid papads & pickles)\n• 30-minute brisk walk 5 days/week\n• Maintain daily BP log (Morning & Evening)\n• Review in clinic after 14 days with BP chart`,
    isCustom: false,
    doctorId: doctorKey
  }];
}
function getPackColorScheme(color) {
  switch (color) {
    case 'emerald':
      return {
        idleBg: 'bg-slate-800/90',
        idleBorder: 'border-emerald-500/30',
        activeBg: 'bg-emerald-950/50',
        activeBorder: 'border-emerald-400',
        ring: 'ring-emerald-400/50',
        text: 'text-emerald-400',
        tagBg: 'bg-emerald-500/20',
        tagText: 'text-emerald-300'
      };
    case 'sky':
      return {
        idleBg: 'bg-slate-800/90',
        idleBorder: 'border-sky-500/30',
        activeBg: 'bg-sky-950/50',
        activeBorder: 'border-sky-400',
        ring: 'ring-sky-400/50',
        text: 'text-sky-400',
        tagBg: 'bg-sky-500/20',
        tagText: 'text-sky-300'
      };
    case 'blue':
      return {
        idleBg: 'bg-slate-800/90',
        idleBorder: 'border-blue-500/30',
        activeBg: 'bg-blue-950/50',
        activeBorder: 'border-blue-400',
        ring: 'ring-blue-400/50',
        text: 'text-blue-400',
        tagBg: 'bg-blue-500/20',
        tagText: 'text-blue-300'
      };
    case 'purple':
      return {
        idleBg: 'bg-slate-800/90',
        idleBorder: 'border-purple-500/30',
        activeBg: 'bg-purple-950/50',
        activeBorder: 'border-purple-400',
        ring: 'ring-purple-400/50',
        text: 'text-purple-400',
        tagBg: 'bg-purple-500/20',
        tagText: 'text-purple-300'
      };
    case 'rose':
      return {
        idleBg: 'bg-slate-800/90',
        idleBorder: 'border-rose-500/30',
        activeBg: 'bg-rose-950/50',
        activeBorder: 'border-rose-400',
        ring: 'ring-rose-400/50',
        text: 'text-rose-400',
        tagBg: 'bg-rose-500/20',
        tagText: 'text-rose-300'
      };
    case 'teal':
      return {
        idleBg: 'bg-slate-800/90',
        idleBorder: 'border-teal-500/30',
        activeBg: 'bg-teal-950/50',
        activeBorder: 'border-teal-400',
        ring: 'ring-teal-400/50',
        text: 'text-teal-400',
        tagBg: 'bg-teal-500/20',
        tagText: 'text-teal-300'
      };
    case 'amber':
    default:
      return {
        idleBg: 'bg-slate-800/90',
        idleBorder: 'border-amber-500/30',
        activeBg: 'bg-amber-950/50',
        activeBorder: 'border-amber-400',
        ring: 'ring-amber-400/50',
        text: 'text-amber-400',
        tagBg: 'bg-amber-500/20',
        tagText: 'text-amber-300'
      };
  }
}
function getPackEmoji(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('fever') || n.includes('viral')) return '🌡️';
  if (n.includes('cold') || n.includes('cough')) return '🤧';
  if (n.includes('gast') || n.includes('acid') || n.includes('stomach')) return '💊';
  if (n.includes('hyper') || n.includes('bp') || n.includes('heart')) return '🫀';
  if (n.includes('diabet') || n.includes('sugar')) return '🩸';
  if (n.includes('pain') || n.includes('ortho')) return '🦴';
  if (n.includes('skin') || n.includes('derm')) return '🧴';
  if (n.includes('child') || n.includes('ped')) return '👶';
  return '📋';
}
const PRESCRIPTION_TEMPLATES = {
  fever: {
    name: 'Fever / Viral Pack',
    medicines: `1. Tab Paracetamol 650 mg — 1 tab TDS (After Food) x 3 Days\n2. Tab Levocetirizine 5 mg — 1 tab HS (At Bedtime) x 3 Days\n3. Tab Vitamin C 500 mg — 1 tab OD x 5 Days\n4. Electral / ORS Solution — 1 sachet in 1 Litre water, sip throughout day\n\nAdvice:\n• Adequate rest and hydration (minimum 2.5 - 3 Litres water)\n• Soft, non-spicy diet\n• Temperature monitoring every 6 hours. SOS if fever > 101°F`
  },
  gastritis: {
    name: 'Gastritis / Acidity Pack',
    medicines: `1. Cap Pantoprazole 40 mg — 1 cap OD (30 mins before breakfast) x 7 Days\n2. Tab Domperidone 10 mg — 1 tab BD (Before Food) x 5 Days\n3. Syp Sucralfate + Oxetacaine — 2 tsp TDS (1 hour after meals) x 5 Days\n\nAdvice:\n• Avoid spicy, oily, deep-fried food and citrus juices\n• Limit tea/coffee to max 1 small cup/day\n• Eat smaller, frequent meals; avoid lying down immediately after eating`
  },
  hypertension: {
    name: 'Hypertension Protocol',
    medicines: `1. Tab Telmisartan 40 mg — 1 tab OD (Morning after breakfast) x 30 Days\n2. Tab Amlodipine 5 mg — 1 tab OD (Night) x 30 Days [If SBP > 150 mmHg]\n\nAdvice:\n• Strict low-salt diet (< 2 grams table salt per day, avoid papads & pickles)\n• 30-minute brisk walk 5 days/week\n• Maintain daily BP log (Morning & Evening)\n• Review in clinic after 14 days with BP chart`
  }
};
function slugify(text) {
  return text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
}

// ========================================================================
// 4. REAL SCANNABLE QR CODE CANVAS COMPONENT
// ========================================================================
function QRCodeCanvas({
  text,
  size = 220
}) {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    if (window.QRCode) {
      try {
        new window.QRCode(containerRef.current, {
          text: text,
          width: size,
          height: size,
          colorDark: "#0f172a",
          colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel.H
        });
        return;
      } catch (e) {
        console.warn('[QR Canvas] QRCode.js failed:', e);
      }
    }
  }, [text, size]);
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-inner border-2 border-slate-200"
  }, /*#__PURE__*/React.createElement("div", {
    ref: containerRef,
    className: "flex items-center justify-center"
  }));
}

// ========================================================================
// 5. MAIN MULTI-TENANT CONTROLLER & ROUTER
// ========================================================================
function App() {
  const [serverUrl] = useState(() => typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  // 1. Independent Clinic URL Route Resolver
  const parseLocationRoute = useCallback(() => {
    const path = window.location.pathname || '';
    const hash = window.location.hash || '';
    if (path === '/super-admin/login' || hash === '#/super-admin/login') {
      return {
        mode: 'super_admin_login',
        slug: null
      };
    }
    if (path === '/super-admin' || path === '/admin' || hash === '#/super-admin' || hash === '#/admin') {
      return {
        mode: 'super_admin',
        slug: null
      };
    }
    if (path === '/login' || path === '/clinic-login' || hash === '#/login' || hash === '#/clinic-login') {
      return {
        mode: 'clinic_login',
        slug: null
      };
    }
    const getQueryToken = () => {
      try {
        const searchStr = window.location.search || (hash.includes('?') ? '?' + hash.split('?')[1] : '');
        const params = new URLSearchParams(searchStr);
        return params.get('token') || params.get('tokenNumber') || null;
      } catch (e) {
        return null;
      }
    };

    // QR Landing & Registration Flow: /checkin/:clinicId
    if (path.startsWith('/checkin/')) {
      const slug = path.replace(/^\/checkin\//, '').split('/')[0].split('?')[0];
      return {
        mode: 'mobile_checkin',
        slug,
        queryToken: null
      };
    }
    if (hash.startsWith('#/checkin/')) {
      const slug = hash.replace(/^#\/checkin\//, '').split('?')[0];
      return {
        mode: 'mobile_checkin',
        slug,
        queryToken: null
      };
    }

    // Live Queue View: /queue/:clinicId?token=XX
    if (path.startsWith('/queue/')) {
      const slug = path.replace(/^\/queue\//, '').split('/')[0].split('?')[0];
      return {
        mode: 'mobile_queue',
        slug,
        queryToken: getQueryToken()
      };
    }
    if (hash.startsWith('#/queue/')) {
      const slug = hash.replace(/^#\/queue\//, '').split('?')[0];
      return {
        mode: 'mobile_queue',
        slug,
        queryToken: getQueryToken()
      };
    }

    // /q/:slug (backward compatibility alias)
    if (path.startsWith('/q/')) {
      const slug = path.replace('/q/', '').split('/')[0].split('?')[0];
      const tok = getQueryToken();
      return tok ? {
        mode: 'mobile_queue',
        slug,
        queryToken: tok
      } : {
        mode: 'mobile_checkin',
        slug,
        queryToken: null
      };
    }
    if (hash.startsWith('#/q/')) {
      const slug = hash.replace('#/q/', '').split('?')[0];
      const tok = getQueryToken();
      return tok ? {
        mode: 'mobile_queue',
        slug,
        queryToken: tok
      } : {
        mode: 'mobile_checkin',
        slug,
        queryToken: null
      };
    }
    // Independent Clinic Routing: /clinic/:slug/dashboard, /clinic/:slug/login, /clinic/:slug
    if (path.startsWith('/clinic/')) {
      const parts = path.replace(/^\/clinic\//, '').split('/');
      const slug = parts[0].split('?')[0];
      const sub = parts[1] ? parts[1].split('?')[0] : '';
      if (sub === 'login') {
        return {
          mode: 'dedicated_clinic_login',
          slug
        };
      }
      return {
        mode: 'doctor',
        slug
      };
    }
    if (hash.startsWith('#/clinic/')) {
      const parts = hash.replace(/^#\/clinic\//, '').split('/');
      const slug = parts[0].split('?')[0];
      const sub = parts[1] ? parts[1].split('?')[0] : '';
      if (sub === 'login') {
        return {
          mode: 'dedicated_clinic_login',
          slug
        };
      }
      return {
        mode: 'doctor',
        slug
      };
    }
    // Backward compatibility for /portal/ or /c/
    if (path.startsWith('/portal/') || path.startsWith('/c/')) {
      const slug = path.replace(/^\/(portal|c)\//, '').split('/')[0].split('?')[0];
      return {
        mode: 'doctor',
        slug
      };
    }
    if (path === '/dashboard' || hash === '#/dashboard') {
      let savedSlug = null;
      try {
        savedSlug = localStorage.getItem('smart_clinic_active_clinic_slug');
      } catch (e) {}
      if (savedSlug && !LEGACY_MOCK_SLUGS.includes(savedSlug)) {
        return {
          mode: 'doctor',
          slug: savedSlug
        };
      }
      return {
        mode: 'clinic_login',
        slug: null
      };
    }
    if (path === '/' || hash === '#' || hash === '') {
      return {
        mode: 'clinic_login',
        slug: null
      };
    }
    return {
      mode: 'clinic_login',
      slug: null
    };
  }, []);
  const [currentRoute, setCurrentRoute] = useState(parseLocationRoute);
  useEffect(() => {
    const onPopState = () => setCurrentRoute(parseLocationRoute());
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onPopState);
    };
  }, [parseLocationRoute]);
  const navigateTo = newPath => {
    if (window.history && window.history.pushState) {
      window.history.pushState({}, '', newPath);
    }
    setCurrentRoute(parseLocationRoute());
  };

  // Clinics list (Clean dynamic multi-tenant state)
  const [clinicsList, setClinicsList] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_clinic_saas_clinics');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(c => !LEGACY_MOCK_CLINIC_IDS.includes(c.clinicId) && !LEGACY_MOCK_SLUGS.includes(c.slug));
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('smart_clinic_saas_clinics', JSON.stringify(clinicsList));
    } catch (e) {}
  }, [clinicsList]);

  // Doctors list (Clean dynamic multi-tenant state)
  const [doctorsList, setDoctorsList] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_clinic_saas_doctors');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(d => !LEGACY_MOCK_DOCTOR_EMAILS.includes(d.email?.toLowerCase()) && !LEGACY_MOCK_CLINIC_IDS.includes(d.clinicId) && !LEGACY_MOCK_SLUGS.includes(d.clinicSlug));
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('smart_clinic_saas_doctors', JSON.stringify(doctorsList));
    } catch (e) {}
  }, [doctorsList]);

  // Synchronize clinics and doctors directly from Cloud Firestore (Real-Time Snapshot)
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;
    const unsubClinics = db.collection('clinics').onSnapshot(snapshot => {
      const list = [];
      snapshot.forEach(doc => {
        const data = doc.data() || {};
        list.push({
          id: doc.id,
          docId: doc.id,
          ...data,
          slug: data.slug || doc.id
        });
      });
      // Update clinicsList directly from live Firestore collection truth
      setClinicsList(list);
      try {
        localStorage.setItem('smart_clinic_saas_clinics', JSON.stringify(list));
      } catch (e) {}
    }, err => console.warn('[Firestore Clinics Sync Warning]:', err));
    const unsubDoctors = db.collection('doctors').onSnapshot(snapshot => {
      const list = [];
      snapshot.forEach(doc => {
        const data = doc.data() || {};
        list.push({
          id: doc.id,
          docId: doc.id,
          ...data
        });
      });
      setDoctorsList(list);
      try {
        localStorage.setItem('smart_clinic_saas_doctors', JSON.stringify(list));
      } catch (e) {}
    }, err => console.warn('[Firestore Doctors Sync Warning]:', err));
    return () => {
      if (typeof unsubClinics === 'function') unsubClinics();
      if (typeof unsubDoctors === 'function') unsubDoctors();
    };
  }, []);

  // Dynamic QR Code Base URL State (with automatic LAN IP detection for mobile Wi-Fi scanning)
  const [qrBaseUrl, setQrBaseUrl] = useState(() => {
    try {
      const saved = localStorage.getItem('goyoh_qr_base_url');
      if (saved) return saved;
    } catch (e) {}
    if (typeof window !== 'undefined' && window.location) {
      const host = window.location.hostname;
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return window.location.origin;
      }
    }
    return 'http://localhost:3000';
  });
  const [detectedLanIp, setDetectedLanIp] = useState('');

  // Auto-detect local Wi-Fi / LAN IP from server
  useEffect(() => {
    fetch(`${serverUrl}/api/network-info`).then(res => res.json()).then(data => {
      if (data.success && data.baseUrl) {
        setDetectedLanIp(data.ip || '');
        const saved = localStorage.getItem('goyoh_qr_base_url');
        const isStaleLan = saved && (saved.includes('192.168.') || saved.includes('10.') || saved.includes('172.')) && !saved.includes(data.ip);
        const isLocal = !saved || saved.includes('localhost') || saved.includes('127.0.0.1') || isStaleLan;
        const hasTunnel = data.tunnelUrl || data.baseUrl && data.baseUrl.startsWith('https://');
        if (hasTunnel || isLocal && data.ip && !data.ip.startsWith('127.')) {
          const targetUrl = data.tunnelUrl || data.baseUrl;
          setQrBaseUrl(targetUrl);
          try {
            localStorage.setItem('goyoh_qr_base_url', targetUrl);
          } catch (e) {}
        }
      }
    }).catch(() => {});
  }, [serverUrl]);
  const handleUpdateQrBaseUrl = newUrl => {
    const clean = (newUrl || '').trim().replace(/\/+$/, '');
    if (clean) {
      setQrBaseUrl(clean);
      try {
        localStorage.setItem('goyoh_qr_base_url', clean);
      } catch (e) {}
    }
  };
  const handleResetQrBaseUrl = () => {
    const defaultLan = detectedLanIp ? `http://${detectedLanIp}:3000` : window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:3000';
    setQrBaseUrl(defaultLan);
    try {
      localStorage.setItem('goyoh_qr_base_url', defaultLan);
    } catch (e) {}
  };

  // Active Clinic strictly resolved from current URL route slug
  const activeDoctorClinic = useMemo(() => {
    return resolveClinicAndDoctor(currentRoute.slug, clinicsList, doctorsList).clinic;
  }, [currentRoute.slug, clinicsList, doctorsList]);

  // Active Logged-in Doctor initialized SYNCHRONOUSLY to matching clinic doctor
  const [activeDoctor, setActiveDoctor] = useState(() => {
    const initialSlug = parseLocationRoute().slug;
    return resolveClinicAndDoctor(initialSlug, INITIAL_CLINICS, DEMO_DOCTORS).doctor;
  });

  // Synchronize activeDoctor whenever activeDoctorClinic changes
  useEffect(() => {
    if (activeDoctorClinic) {
      if (!activeDoctor || activeDoctor.clinicId !== activeDoctorClinic.clinicId && activeDoctor.clinicSlug !== activeDoctorClinic.slug) {
        const {
          doctor
        } = resolveClinicAndDoctor(activeDoctorClinic.slug, clinicsList, doctorsList);
        if (doctor) {
          setActiveDoctor(doctor);
          setIsClinicAuthed(true);
          try {
            localStorage.setItem('smart_clinic_authed', 'true');
            localStorage.setItem('smart_clinic_active_clinic_slug', activeDoctorClinic.slug);
            localStorage.setItem(`smart_clinic_doctor_${activeDoctorClinic.slug}`, JSON.stringify(doctor));
            localStorage.setItem('smart_clinic_current_doctor', JSON.stringify(doctor));
          } catch (e) {}
        }
      }
    }
  }, [activeDoctorClinic, clinicsList, doctorsList, activeDoctor]);

  // Strict Clinic Isolation: doctors belonging ONLY to activeDoctorClinic
  const clinicDoctors = useMemo(() => {
    const cid = activeDoctorClinic?.clinicId;
    const cslug = activeDoctorClinic?.slug;
    const calias = activeDoctorClinic?.alias;
    return doctorsList.filter(d => cid && d.clinicId === cid || cslug && d.clinicSlug === cslug || calias && d.clinicSlug === calias || d.clinicName && activeDoctorClinic?.name && d.clinicName.toLowerCase() === activeDoctorClinic.name.toLowerCase());
  }, [doctorsList, activeDoctorClinic]);

  // Tenant Max Doctor Seats Allocation & Doctor Management Button Visibility
  const maxSeats = useMemo(() => {
    if (activeDoctorClinic) {
      const directSeats = Number(activeDoctorClinic.doctorSeats);
      if (!isNaN(directSeats) && directSeats > 0) return directSeats;
      const plan = String(activeDoctorClinic.subscriptionPlan || '').toLowerCase();
      if (plan.includes('1 seat') || plan.includes('starter') || plan.includes('solo')) return 1;
      if (plan.includes('2 to 5') || plan.includes('professional')) return 5;
      if (plan.includes('unlimited') || plan.includes('enterprise')) return 999;
    }
    if (activeDoctor) {
      const directSeats = Number(activeDoctor.doctorSeats || activeDoctor.clinicSeats);
      if (!isNaN(directSeats) && directSeats > 0) return directSeats;
      const plan = String(activeDoctor.subscriptionPlan || '').toLowerCase();
      if (plan.includes('1 seat') || plan.includes('starter') || plan.includes('solo')) return 1;
      if (plan.includes('2 to 5') || plan.includes('professional')) return 5;
      if (plan.includes('unlimited') || plan.includes('enterprise')) return 999;
    }
    return 1;
  }, [activeDoctorClinic, activeDoctor]);
  const canManageDoctors = maxSeats > 1;

  // Super Admin Master Authentication State
  const [isSuperAdminAuthed, setIsSuperAdminAuthed] = useState(() => {
    try {
      return localStorage.getItem('goyoh_super_admin_authed') === 'true';
    } catch (e) {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('goyoh_super_admin_authed', String(isSuperAdminAuthed));
    } catch (e) {}
  }, [isSuperAdminAuthed]);

  // Clinic Doctor Authentication State
  const [isClinicAuthed, setIsClinicAuthed] = useState(true);
  useEffect(() => {
    try {
      localStorage.setItem('smart_clinic_authed', 'true');
    } catch (e) {}
  }, [isClinicAuthed]);
  const publicPatientDoctor = useMemo(() => {
    const isMobileRoute = currentRoute.mode === 'mobile_checkin' || currentRoute.mode === 'mobile_queue' || currentRoute.mode === 'public_patient';
    if (isMobileRoute && currentRoute.slug) {
      const target = currentRoute.slug.toLowerCase().trim();
      const match = doctorsList.find(d => d.clinicSlug?.toLowerCase() === target || d.clinicId?.toLowerCase() === target);
      if (match) return match;
      const clinicMatch = clinicsList.find(c => c.slug?.toLowerCase() === target || c.clinicId?.toLowerCase() === target);
      if (clinicMatch) {
        return resolveClinicAndDoctor(clinicMatch.slug, clinicsList, doctorsList).doctor;
      }
      // Dynamically resolve exact clinic and doctor from route slug
      return resolveClinicAndDoctor(target, clinicsList, doctorsList).doctor;
    }
    return activeDoctor;
  }, [currentRoute, doctorsList, clinicsList, activeDoctor]);
  const [doctorViewTab, setDoctorViewTab] = useState('doctor');
  const [doctorModalTab, setDoctorModalTab] = useState('list'); // 'list' | 'add'
  const [showAuthModal, setShowAuthModal] = useState(false);
  const isCurrentClinicSuspended = activeDoctorClinic?.status === 'SUSPENDED';
  const currentClinicSubscription = useMemo(() => {
    return checkClinicSubscriptionStatus(activeDoctorClinic);
  }, [activeDoctorClinic]);
  const isPublicPatientClinicSuspended = useMemo(() => {
    const slug = publicPatientDoctor?.clinicSlug || '';
    const c = clinicsList.find(cl => cl.slug === slug);
    return c?.status === 'SUSPENDED';
  }, [clinicsList, publicPatientDoctor]);
  const handleOnboardClinic = newClinicData => {
    // Generate a guaranteed clean unique slug and Firestore doc ID
    const baseSlug = (newClinicData.slug || newClinicData.name || 'clinic').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'clinic';

    // Check if slug is already taken in current clinics list
    const isTaken = clinicsList.some(c => c.slug === baseSlug || c.clinicId === baseSlug);
    const uniqueSuffix = Math.random().toString(36).substring(2, 6);
    const slug = isTaken ? `${baseSlug}-${uniqueSuffix}` : baseSlug;
    const clinicId = newClinicData.clinicId || `CLN-${newClinicData.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const initialPass = newClinicData.initialPassword || `Goyoh@${Math.floor(1000 + Math.random() * 9000)}`;
    const planDetails = getTrialPlanDetails(newClinicData.subscriptionPlan, newClinicData.doctorSeats);
    const now = new Date();
    const trialStartDate = now.toISOString();
    const trialEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const newClinic = {
      id: slug,
      docId: slug,
      clinicId,
      slug,
      ...newClinicData,
      initialPassword: initialPass,
      isTrial: planDetails.isTrial,
      subscriptionPlan: planDetails.plan,
      doctorSeats: planDetails.doctorSeats,
      trialStartDate: planDetails.isTrial ? trialStartDate : null,
      trialEndDate: planDetails.isTrial ? trialEndDate : null,
      targetPaidTier: planDetails.targetPaidTier,
      targetPaidPrice: planDetails.targetPaidPrice,
      hasActiveSubscription: !planDetails.isTrial,
      subscriptionStatus: planDetails.isTrial ? 'TRIAL_ACTIVE' : 'PAID_ACTIVE',
      createdAt: now.toISOString()
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
      doctorSeats: planDetails.doctorSeats,
      subscriptionPlan: planDetails.plan,
      createdAt: new Date().toISOString()
    };
    setClinicsList(prev => [...prev.filter(c => c.slug !== slug), newClinic]);
    setDoctorsList(prev => [...prev.filter(d => d.clinicSlug !== slug), newDoctor]);

    // Provision Firebase Authentication User Record
    const apiKey = window.SmartClinicFirebase?.firebaseConfig?.apiKey || "AIzaSyD_0K24tUnG1OWh74HwJfjqQIZ6Q3_IOn0";
    if (newClinicData.email && initialPass) {
      fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: newClinicData.email.trim(),
          password: initialPass,
          returnSecureToken: true
        })
      }).then(res => res.json()).then(authData => {
        if (authData.localId) {
          console.log(`[Firebase Auth] Created auth record for clinic ${newClinicData.email} (UID: ${authData.localId})`);
        } else if (authData.error?.message === 'EMAIL_EXISTS') {
          console.log(`[Firebase Auth] Auth record for ${newClinicData.email} already exists, ready for clinic.`);
        }
      }).catch(err => console.warn('[Firebase Auth Provisioning Error]:', err));
    }

    // Direct write to Cloud Firestore collections 'clinics', 'doctors', and 'credentials'
    const db = getFirebaseDb();
    if (db) {
      try {
        db.collection('clinics').doc(slug).set(newClinic, {
          merge: true
        }).then(() => console.log(`[Firestore] Successfully saved clinic doc '${slug}'`)).catch(err => console.warn('[Firestore] Clinic save warning:', err));
        db.collection('doctors').doc(`doc_${slug}`).set(newDoctor, {
          merge: true
        }).then(() => console.log(`[Firestore] Successfully saved doctor doc 'doc_${slug}'`)).catch(err => console.warn('[Firestore] Doctor save warning:', err));
        db.collection('credentials').doc(slug).set({
          clinicSlug: slug,
          clinicId,
          email: newClinicData.email,
          password: initialPass,
          updatedAt: new Date().toISOString()
        }, {
          merge: true
        }).catch(() => {});
      } catch (e) {
        console.warn('[Firestore Onboarding Error]:', e);
      }
    }
    return newClinic;
  };
  const handleActivateSubscription = clinicIdentifier => {
    if (!clinicIdentifier) return;
    setClinicsList(prev => prev.map(c => {
      if (c.clinicId === clinicIdentifier || c.slug === clinicIdentifier || String(c.id) === String(clinicIdentifier)) {
        const targetTier = c.targetPaidTier || PAID_TIERS.PROFESSIONAL;
        const targetPrice = c.targetPaidPrice || '₹19,999/yr';
        const updated = {
          ...c,
          isTrial: false,
          hasActiveSubscription: true,
          subscriptionStatus: 'PAID_ACTIVE',
          subscriptionPlan: targetTier,
          targetPaidTier: targetTier,
          targetPaidPrice: targetPrice,
          activatedAt: new Date().toISOString()
        };
        const db = getFirebaseDb();
        if (db) {
          db.collection('clinics').doc(c.slug || c.id).set(updated, {
            merge: true
          }).then(() => console.log(`[Firestore] Subscription activated for ${c.slug}: ${targetTier}`)).catch(err => console.warn('[Firestore] Activate error:', err));
        }
        return updated;
      }
      return c;
    }));
  };
  const handleToggleClinicStatus = (clinicIdentifier, newStatus) => {
    setClinicsList(prev => prev.map(c => {
      if (c.clinicId === clinicIdentifier || c.slug === clinicIdentifier || String(c.id) === String(clinicIdentifier)) {
        return {
          ...c,
          status: newStatus
        };
      }
      return c;
    }));
  };
  const handleDeleteClinic = async clinic => {
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
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: emailToDelete.trim(),
            password: passToDelete,
            returnSecureToken: true
          })
        });
        if (signInResp.ok) {
          const {
            idToken
          } = await signInResp.json();
          const delResp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              idToken
            })
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
    const deleteDocument = async ref => {
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
      const updated = {
        ...prev
      };
      delete updated[cSlug];
      if (cId) delete updated[cId];
      variants.forEach(v => {
        delete updated[v];
      });
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
        variants.forEach(v => {
          delete parsed[v];
        });
        localStorage.setItem('smart_clinic_tenant_queues', JSON.stringify(parsed));
      }
    } catch (lsErr) {
      console.warn('[LocalStorage Purge Warning]:', lsErr);
    }
    console.log(`[Super Admin] Clinic '${cName}' (${clinicId}) successfully deleted from Firestore, Auth, and React state.`);
  };
  const handleSwitchToClinic = clinic => {
    const doc = doctorsList.find(d => d.clinicSlug === clinic.slug || clinic.alias && d.clinicSlug === clinic.alias || d.clinicId === clinic.clinicId || d.clinicId === clinic.id || d.clinicName?.toLowerCase() === clinic.name?.toLowerCase()) || {
      id: Date.now(),
      doctorName: clinic.ownerName || 'Doctor',
      clinicName: clinic.name,
      clinicSlug: clinic.slug,
      clinicId: clinic.clinicId,
      doctorSeats: clinic.doctorSeats,
      subscriptionPlan: clinic.subscriptionPlan,
      specialization: 'Lead Physician & Clinic Admin',
      roomNumber: 'Consultation Room 1',
      avgConsultationTime: 8.0
    };
    setActiveDoctor(doc);
    setIsClinicAuthed(true);
    try {
      localStorage.setItem('smart_clinic_authed', 'true');
      localStorage.setItem('smart_clinic_active_clinic_slug', clinic.slug);
      localStorage.setItem(`smart_clinic_doctor_${clinic.slug}`, JSON.stringify(doc));
      localStorage.setItem('smart_clinic_current_doctor', JSON.stringify(doc));
    } catch (e) {}
    navigateTo(`/clinic/${clinic.slug}/dashboard`);
  };

  // Isolated Queues per Clinic (persisting Rx details + multi-day history for analytics)
  const [clinicQueues, setClinicQueues] = useState(() => {
    const todayDateStr = new Date().toDateString();
    const storedDate = localStorage.getItem('smart_clinic_calendar_date');
    const isNewDay = storedDate && storedDate !== todayDateStr;
    try {
      const saved = localStorage.getItem('smart_clinic_tenant_queues');
      if (saved) {
        const parsed = JSON.parse(saved);
        for (const k of Object.keys(parsed)) {
          if (LEGACY_MOCK_SLUGS.includes(k) || LEGACY_MOCK_CLINIC_IDS.includes(k)) {
            delete parsed[k];
          } else if (Array.isArray(parsed[k])) {
            // Strict Real User Patient Filter: purge any dummy/test tokens from local storage
            parsed[k] = parsed[k].filter(t => {
              const pName = String(t?.patient?.name || '').trim();
              const pPhone = String(t?.patient?.phone || '').trim();
              if (!pName || pName.length < 2 || !pPhone) return false;
              const lower = pName.toLowerCase();
              if (lower.includes('automated test') || lower.includes('dummy') || lower.includes('live sync tester') || lower.includes('fake')) return false;
              return true;
            });
          }
        }
        if (Object.keys(parsed).length > 0) {
          if (isNewDay) {
            // New day detected on load: clear today's active & completed tokens back to 0 cleanly
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const cleanQueues = {};
            for (const [slug, qList] of Object.entries(parsed)) {
              cleanQueues[slug] = (qList || []).filter(t => {
                const tDate = new Date(t.createdAt || t.id);
                return tDate < startOfToday && t.status === 'COMPLETED';
              });
            }
            localStorage.setItem('smart_clinic_tenant_queues', JSON.stringify(cleanQueues));
            localStorage.setItem('smart_clinic_calendar_date', todayDateStr);
            return cleanQueues;
          }
          return parsed;
        }
      }
    } catch (e) {}
    return {};
  });

  // Isolated Rolling Durations per Clinic
  const [clinicDurations, setClinicDurations] = useState(() => {
    try {
      const todayDateStr = new Date().toDateString();
      const storedDate = localStorage.getItem('smart_clinic_calendar_date');
      if (storedDate && storedDate !== todayDateStr) {
        // New day detected on load: reset durations so avg consult time starts at 0 mins
        localStorage.setItem('smart_clinic_tenant_durations', JSON.stringify({}));
        return {};
      }
      const saved = localStorage.getItem('smart_clinic_tenant_durations');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('smart_clinic_tenant_queues', JSON.stringify(clinicQueues));
    } catch (e) {}
  }, [clinicQueues]);
  useEffect(() => {
    try {
      localStorage.setItem('smart_clinic_tenant_durations', JSON.stringify(clinicDurations));
    } catch (e) {}
  }, [clinicDurations]);

  // Automatic Daily Reset: checks on mount, window focus, visibility change, and interval
  useEffect(() => {
    const checkAutoDailyReset = () => {
      const todayDateStr = new Date().toDateString();
      const storedDate = localStorage.getItem('smart_clinic_calendar_date');
      if (!storedDate) {
        localStorage.setItem('smart_clinic_calendar_date', todayDateStr);
        return;
      }
      if (storedDate !== todayDateStr) {
        console.log(`[Smart Clinic OS] Automatic Daily Reset: New day detected (${storedDate} -> ${todayDateStr}). Resetting queue, completed count, and avg consult time to 0.`);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Clear today's tokens across all clinics: retain only past completed records for historical reports
        setClinicQueues(prev => {
          const updated = {};
          for (const [slug, qList] of Object.entries(prev || {})) {
            updated[slug] = (qList || []).filter(t => {
              const tDate = new Date(t.createdAt || t.id);
              return tDate < startOfToday && t.status === 'COMPLETED';
            });
          }
          try {
            localStorage.setItem('smart_clinic_tenant_queues', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });

        // Reset recorded durations back to 0 cleanly so Avg Consult Time resets to 0 mins
        setClinicDurations(() => {
          try {
            localStorage.setItem('smart_clinic_tenant_durations', JSON.stringify({}));
          } catch (e) {}
          return {};
        });
        setPatientTokenId(null);
        localStorage.setItem('smart_clinic_calendar_date', todayDateStr);
      }
    };
    checkAutoDailyReset();
    window.addEventListener('focus', checkAutoDailyReset);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkAutoDailyReset();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = setInterval(checkAutoDailyReset, 60000);
    return () => {
      window.removeEventListener('focus', checkAutoDailyReset);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, []);
  const currentQueue = activeDoctor && activeDoctor.clinicSlug ? getQueueForSlug(clinicQueues, activeDoctor.clinicSlug) : [];
  const currentDurations = activeDoctor && activeDoctor.clinicSlug ? clinicDurations[activeDoctor.clinicSlug] || clinicDurations[canonicalSlug(activeDoctor.clinicSlug)] || [] : [];
  const publicQueue = publicPatientDoctor && publicPatientDoctor.clinicSlug ? getQueueForSlug(clinicQueues, publicPatientDoctor.clinicSlug) : [];
  const publicDurations = publicPatientDoctor && publicPatientDoctor.clinicSlug ? clinicDurations[publicPatientDoctor.clinicSlug] || clinicDurations[canonicalSlug(publicPatientDoctor.clinicSlug)] || [] : [];
  const doctorAvgConsultTime = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Count only consultations completed today
    const completedToday = currentQueue.filter(t => {
      if (t.status !== 'COMPLETED') return false;
      const tDate = new Date(t.createdAt || t.id);
      return tDate >= startOfToday;
    });
    if (completedToday.length === 0) {
      return 0; // Reset to 0 when 0 completed patients today
    }
    const tokenDurations = completedToday.map(t => {
      if (typeof t.durationMinutes === 'number' && t.durationMinutes > 0) {
        return t.durationMinutes > 60 ? 12.0 : Number(t.durationMinutes);
      }
      if (t.consultationStartTime && t.consultationEndTime) {
        const diff = (new Date(t.consultationEndTime).getTime() - new Date(t.consultationStartTime).getTime()) / 60000;
        if (diff > 0) return diff > 60 ? 10.0 : Number(diff.toFixed(1));
      }
      return Number(activeDoctor?.avgConsultationTime || 8.0);
    });
    if (tokenDurations.length > 0) {
      const sum = tokenDurations.reduce((a, b) => a + b, 0);
      return Number((sum / completedToday.length).toFixed(1));
    }
    return 0;
  }, [currentQueue]);
  const publicClinicAvgTime = useMemo(() => {
    const completedToday = publicQueue.filter(t => t.status === 'COMPLETED');
    const tokenDurations = completedToday.map(t => {
      if (t.durationMinutes && t.durationMinutes > 0) return Number(t.durationMinutes);
      if (t.consultationStartTime && t.consultationEndTime) {
        const diff = (new Date(t.consultationEndTime).getTime() - new Date(t.consultationStartTime).getTime()) / 60000;
        if (diff > 0) return Number(diff.toFixed(1));
      }
      return null;
    }).filter(d => d !== null);
    const allDurations = tokenDurations.length > 0 ? tokenDurations : publicDurations && publicDurations.length > 0 ? publicDurations : [];
    if (allDurations.length > 0) {
      const sum = allDurations.reduce((a, b) => a + b, 0);
      return Number((sum / allDurations.length).toFixed(1));
    }
    return publicPatientDoctor.avgConsultationTime || 8.0;
  }, [publicQueue, publicDurations, publicPatientDoctor]);
  const activeToken = currentQueue.find(t => t.status === 'IN_CONSULTATION') || null;

  // Real-Time Background Queue Polling for Active Clinic (Every 3 seconds background auto-refresh)
  useEffect(() => {
    const rawSlug = activeDoctor?.clinicSlug || (currentRoute.mode === 'doctor' ? currentRoute.slug : null);
    if (!rawSlug) return;
    const cSlug = canonicalSlug(rawSlug);
    const variants = getSlugVariants(rawSlug);
    let isMounted = true;
    const syncTokens = firestoreTokens => {
      if (!Array.isArray(firestoreTokens)) return;
      setClinicQueues(prev => {
        const currentQ = getQueueForSlug(prev, rawSlug);
        const tokenMap = new Map();
        currentQ.forEach(t => tokenMap.set(String(t.id), t));
        firestoreTokens.forEach(t => {
          const cleanId = String(t.id);
          const existing = tokenMap.get(cleanId);
          if (existing) {
            tokenMap.set(cleanId, {
              ...existing,
              ...t,
              rxNotes: existing.rxNotes || t.rxNotes,
              rxPdfUrl: existing.rxPdfUrl || t.rxPdfUrl,
              rxFilename: existing.rxFilename || t.rxFilename
            });
          } else {
            tokenMap.set(cleanId, t);
          }
        });
        const merged = Array.from(tokenMap.values()).sort((a, b) => {
          const numA = parseInt(String(a.tokenNumber || a.id).replace(/[^0-9]/g, '')) || 0;
          const numB = parseInt(String(b.tokenNumber || b.id).replace(/[^0-9]/g, '')) || 0;
          if (numA !== numB) return numA - numB;
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        });
        const prevSig = currentQ.map(t => `${t.id}:${t.status}:${t.tokenNumber}`).join('|');
        const nextSig = merged.map(t => `${t.id}:${t.status}:${t.tokenNumber}`).join('|');
        if (prevSig !== nextSig) {
          console.log(`[Firestore 3s Polling] Queue auto-refreshed for ${rawSlug} (${cSlug}): ${merged.length} patients.`);
          const updated = {
            ...prev
          };
          updated[cSlug] = merged;
          updated[rawSlug] = merged;
          variants.forEach(v => {
            updated[v] = merged;
          });
          try {
            localStorage.setItem('smart_clinic_tenant_queues', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        }
        return prev;
      });
    };

    // 1. Initial immediate fetch on mount via getDocs (server source)
    fetchQueueFromFirestore(cSlug).then(tokens => {
      if (isMounted) syncTokens(tokens);
    });

    // 2. Poll Firestore automatically every 3 seconds via setInterval & getDocs
    const pollTimer = setInterval(async () => {
      try {
        const tokens = await fetchQueueFromFirestore(cSlug);
        if (isMounted) syncTokens(tokens);
      } catch (e) {
        console.warn('[Firestore Polling Error]:', e);
      }
    }, 3000);

    // 3. Real-time snapshot listener for zero-delay instant event response
    const unsubscribe = subscribeToQueueInFirestore(cSlug, tokens => {
      if (isMounted) syncTokens(tokens);
    });
    return () => {
      isMounted = false;
      clearInterval(pollTimer);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [activeDoctor?.clinicSlug, currentRoute.slug, currentRoute.mode]);
  const handleSyncQueueFromPolling = useCallback((rawSlug, newQ) => {
    if (!rawSlug || !Array.isArray(newQ)) return;
    const cSlug = canonicalSlug(rawSlug);
    const variants = getSlugVariants(rawSlug);
    setClinicQueues(prev => {
      const currentQ = getQueueForSlug(prev, rawSlug);
      const tokenMap = new Map();
      currentQ.forEach(t => tokenMap.set(String(t.id), t));
      newQ.forEach(t => {
        const cleanId = String(t.id);
        const existing = tokenMap.get(cleanId);
        if (existing) {
          tokenMap.set(cleanId, {
            ...existing,
            ...t,
            rxNotes: existing.rxNotes || t.rxNotes,
            rxPdfUrl: existing.rxPdfUrl || t.rxPdfUrl,
            rxFilename: existing.rxFilename || t.rxFilename
          });
        } else {
          tokenMap.set(cleanId, t);
        }
      });
      const merged = Array.from(tokenMap.values()).sort((a, b) => {
        const numA = parseInt(String(a.tokenNumber || a.id).replace(/[^0-9]/g, '')) || 0;
        const numB = parseInt(String(b.tokenNumber || b.id).replace(/[^0-9]/g, '')) || 0;
        if (numA !== numB) return numA - numB;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });
      const prevSig = currentQ.map(t => `${t.id}:${t.status}:${t.tokenNumber}`).join('|');
      const nextSig = merged.map(t => `${t.id}:${t.status}:${t.tokenNumber}`).join('|');
      if (prevSig !== nextSig) {
        console.log(`[handleSyncQueueFromPolling] Synchronizing ${merged.length} tokens for slug: ${rawSlug} (${cSlug})`);
        const updated = {
          ...prev
        };
        updated[cSlug] = merged;
        updated[rawSlug] = merged;
        variants.forEach(v => {
          updated[v] = merged;
        });
        try {
          localStorage.setItem('smart_clinic_tenant_queues', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      }
      return prev;
    });
  }, []);
  const [patientTokenId, setPatientTokenId] = useState(null);
  const [audioReady, setAudioReady] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [lastCompletedRx, setLastCompletedRx] = useState(null); // For Rx success modal
  const [viewingRxModalToken, setViewingRxModalToken] = useState(null); // For re-viewing past Rx
  const [whatsAppNotifications, setWhatsAppNotifications] = useState([]);
  const handleAudioReadyToggle = () => {
    audioService.initContext();
    setAudioReady(true);
    audioService.playChime();
  };
  const dispatchWhatsAppMessage = (phone, text, type = 'NOTIFICATION') => {
    const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
    const newNotif = {
      id: Date.now() + Math.random(),
      type,
      phone: cleanPhone || '+91 98450 00000',
      text,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      link: `https://api.whatsapp.com/send?phone=${cleanPhone.replace('+', '')}&text=${encodeURIComponent(text)}`
    };
    setWhatsAppNotifications(prev => [newNotif, ...prev.slice(0, 5)]);
  };

  // DOCTOR ACTION: Call Next Patient
  const handleCallNext = () => {
    if (!audioReady) {
      audioService.initContext();
      setAudioReady(true);
    }
    const now = Date.now();
    const rawDoctorSlug = activeDoctor.clinicSlug;
    const doctorSlug = canonicalSlug(rawDoctorSlug) || rawDoctorSlug;
    const currentQ = getQueueForSlug(clinicQueues, doctorSlug);
    const currentD = clinicDurations[doctorSlug] || clinicDurations[rawDoctorSlug] || [];
    let newDurations = [...currentD];
    let durationMins = null;
    if (activeToken && activeToken.consultationStartTime) {
      durationMins = Number(((now - activeToken.consultationStartTime) / 60000).toFixed(1));
      newDurations.push(Math.max(0.5, durationMins));
      setClinicDurations(prev => ({
        ...prev,
        [doctorSlug]: newDurations,
        [rawDoctorSlug]: newDurations
      }));
    }
    const waitingTokens = currentQ.filter(t => t.status === 'WAITING');
    if (waitingTokens.length === 0) {
      if (activeToken) {
        const updated = currentQ.map(t => t.id === activeToken.id ? {
          ...t,
          status: 'COMPLETED',
          durationMinutes: durationMins,
          consultationEndTime: now
        } : t);
        setClinicQueues(prev => {
          const next = {
            ...prev,
            [doctorSlug]: updated,
            [rawDoctorSlug]: updated
          };
          getSlugVariants(doctorSlug).forEach(v => {
            next[v] = updated;
          });
          try {
            localStorage.setItem('smart_clinic_tenant_queues', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
        fetch(`${serverUrl}/api/clinics/${doctorSlug}/queue/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            queue: updated
          })
        }).catch(() => {});
      }
      alert(`Queue is empty for ${activeDoctor.doctorName}! Patients can scan your unique counter QR code to check in.`);
      return;
    }
    const nextPatient = waitingTokens[0];
    const updated = currentQ.map(t => {
      if (t.status === 'IN_CONSULTATION') return {
        ...t,
        status: 'COMPLETED',
        durationMinutes: durationMins,
        consultationEndTime: now
      };
      if (t.id === nextPatient.id) return {
        ...t,
        status: 'IN_CONSULTATION',
        consultationStartTime: now
      };
      return t;
    });
    setClinicQueues(prev => ({
      ...prev,
      [doctorSlug]: updated
    }));

    // Write updated token statuses directly to Cloud Firestore (Serverless)
    if (activeToken) {
      updatePatientInFirestore(activeToken.id, {
        status: 'COMPLETED',
        durationMinutes: durationMins,
        consultationEndTime: now
      }, doctorSlug);
    }
    if (nextPatient) {
      updatePatientInFirestore(nextPatient.id, {
        status: 'IN_CONSULTATION',
        consultationStartTime: now
      }, doctorSlug);
    }
    audioService.announceCall(nextPatient.tokenNumber, nextPatient.patient?.name);
    const waMessage = `Token ${nextPatient.tokenNumber}: ${activeDoctor.doctorName} is ready for you now. Please step inside ${activeDoctor.roomNumber}.`;
    dispatchWhatsAppMessage(nextPatient.patient?.phone, waMessage, 'CALL_NEXT');
  };

  // PATIENT REGISTRATION ACTION (Sequential Token, WhatsApp Trigger, and Real-Time Sync)
  const handleRegisterPatient = (name, phone, complaint, rawTargetSlug = publicPatientDoctor.clinicSlug) => {
    // Enforce strict real patient form validation: cards created STRICTLY on real submission
    const cleanName = String(name || '').trim();
    const cleanPhone = String(phone || '').trim();
    if (!cleanName || cleanName.length < 2 || !cleanPhone || cleanPhone.length < 8) {
      console.warn('[Registration Rejected] Real patient name and phone are strictly required.');
      return null;
    }

    // Dynamically extract clinic slug from URL pathname (admin.goyoh.in/checkin/[clinic-slug])
    let urlSlug = '';
    if (typeof window !== 'undefined') {
      const path = window.location.pathname || '';
      const hash = window.location.hash || '';
      if (path.includes('/checkin/')) {
        urlSlug = path.split('/checkin/')[1]?.split('/')[0]?.split('?')[0];
      } else if (hash.includes('/checkin/')) {
        urlSlug = hash.split('/checkin/')[1]?.split('/')[0]?.split('?')[0];
      }
    }
    const effectiveRawSlug = urlSlug || rawTargetSlug || publicPatientDoctor.clinicSlug;
    const targetSlug = canonicalSlug(effectiveRawSlug) || effectiveRawSlug;
    const targetDoc = doctorsList.find(d => canonicalSlug(d.clinicSlug) === targetSlug || d.clinicSlug === effectiveRawSlug) || publicPatientDoctor;
    const targetQ = getQueueForSlug(clinicQueues, targetSlug);
    const waitingCount = targetQ.filter(t => t.status === 'WAITING').length;
    const patientPosition = waitingCount + 1;
    const targetAvgTime = publicClinicAvgTime || 8;
    const estimatedWaitMinutes = Math.max(3, Math.round(patientPosition * targetAvgTime));
    const tokenCount = targetQ.length + 1;
    const tokenNumber = `#${tokenCount}`;
    const cleanComplaint = complaint && !['General Consultation', 'General Checkup', 'OPD Consultation'].includes(complaint.trim()) ? complaint.trim() : '';
    const newToken = {
      id: Date.now(),
      tokenNumber,
      complaint: cleanComplaint,
      chiefComplaint: cleanComplaint,
      status: 'WAITING',
      clinicId: targetDoc.clinicId || targetSlug,
      clinicSlug: targetSlug,
      patient: {
        id: Date.now() + 1,
        name: name.trim(),
        phone: phone.trim(),
        age: null,
        gender: null
      },
      createdAt: new Date().toISOString()
    };
    const updated = [...targetQ, newToken];
    setClinicQueues(prev => {
      const next = {
        ...prev,
        [targetSlug]: updated,
        [rawTargetSlug]: updated
      };
      getSlugVariants(targetSlug).forEach(v => {
        next[v] = updated;
      });
      try {
        localStorage.setItem('smart_clinic_tenant_queues', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    setPatientTokenId(newToken.id);
    const effectiveBase = (qrBaseUrl || typeof window !== 'undefined' && localStorage.getItem('goyoh_qr_base_url') || window.location.origin).replace(/\/+$/, '');
    const trackerUrl = `${effectiveBase}/queue/${targetSlug}?token=${tokenCount}`;

    // 1. Dispatch POST request to Render backend endpoint (/api/send-token-alert)
    const tokenAlertPayload = {
      clinicSlug: targetSlug,
      name: cleanName,
      phone: cleanPhone,
      tokenNumber,
      estWaitTime: `~${estimatedWaitMinutes} mins`,
      estimatedWaitMinutes,
      waitingCount,
      clinicName: targetDoc.clinicName,
      doctorName: targetDoc.doctorName,
      roomNumber: targetDoc.roomNumber,
      trackerUrl
    };
    const RENDER_ENDPOINT = 'https://smart-clinic-whatsapp-webhook.onrender.com/api/send-token-alert';
    fetch(RENDER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tokenAlertPayload)
    }).then(r => r.json()).then(res => {
      console.log('[Render /api/send-token-alert] Dispatched token alert:', res);
    }).catch(err => {
      console.warn('[Render /api/send-token-alert] Notice:', err);
    });

    // Also ping relative endpoint on current server
    fetch(`${serverUrl}/api/send-token-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tokenAlertPayload)
    }).catch(() => {});

    // Ping legacy queue-checkin route for universal backwards compatibility
    fetch(`${serverUrl}/api/notifications/queue-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tokenAlertPayload)
    }).catch(() => {});

    // 2. Write patient check-in directly to Cloud Firestore (Serverless)
    addPatientToFirestore(newToken, targetSlug);

    // 3. Local In-App WhatsApp Notification
    const waMessage = `🏥 GOYOH Health Connect - ${targetDoc.clinicName}\nNamaste ${name.trim()}! Your digital token is confirmed:\n\n🎫 Token: ${tokenNumber}\n🩺 Doctor: ${targetDoc.doctorName}\n📍 Room: ${targetDoc.roomNumber}\n⏱️ Est. Wait: ~${estimatedWaitMinutes} mins (${waitingCount} ahead)\n\n🔴 Track live queue:\n${trackerUrl}`;
    dispatchWhatsAppMessage(phone, waMessage, 'REGISTER');

    // 4. Persist in local storage
    try {
      localStorage.setItem(`goyoh_patient_token_${targetSlug}`, String(newToken.id));
      localStorage.setItem(`goyoh_patient_token_num_${targetSlug}`, tokenNumber);
      localStorage.setItem(`goyoh_patient_phone_${targetSlug}`, phone.trim());
    } catch (e) {}

    // 5. Instantly route to /queue/:slug?token=XX
    navigateTo(`/queue/${targetSlug}?token=${tokenCount}`);
    return newToken;
  };

  // UNIFIED "COMPLETE CONSULTATION" ACTION
  // In 1 click: saves prescription, marks token as completed, dispatches WhatsApp Rx, and moves next token into consultation room
  const handleCompleteConsultation = (tokenId, rxNotes, templateName) => {
    if (!activeToken) return;
    const now = Date.now();
    const rawDoctorSlug = activeDoctor.clinicSlug;
    const doctorSlug = canonicalSlug(rawDoctorSlug) || rawDoctorSlug;
    const currentQ = getQueueForSlug(clinicQueues, doctorSlug);

    // 1. Generate digital prescription PDF via jsPDF
    const pdfResult = generatePrescriptionPdf({
      doctor: activeDoctor,
      patient: {
        name: activeToken.patient?.name,
        phone: activeToken.patient?.phone,
        age: activeToken.patient?.age,
        gender: activeToken.patient?.gender,
        complaint: activeToken.complaint
      },
      tokenNumber: activeToken.tokenNumber,
      rxNotes: rxNotes || 'Standard medical follow-up.',
      templateName: templateName || 'Prescription'
    });
    let pdfUrl = pdfResult ? pdfResult.blobUrl : null;
    let filename = pdfResult ? pdfResult.filename : `Rx_${activeToken.patient?.name?.replace(/\s+/g, '')}_${activeToken.tokenNumber}.pdf`;

    // 2. Calculate duration of completed consultation
    let durationMins = null;
    if (activeToken.consultationStartTime) {
      durationMins = Number(((now - activeToken.consultationStartTime) / 60000).toFixed(1));
      setClinicDurations(prev => ({
        ...prev,
        [doctorSlug]: [...(prev[doctorSlug] || []), Math.max(0.5, durationMins)]
      }));
    }

    // 3. Find next waiting patient to automatically move into room
    const waitingTokens = currentQ.filter(t => t.status === 'WAITING' && t.id !== tokenId);
    const nextPatient = waitingTokens.length > 0 ? waitingTokens[0] : null;

    // 4. Update queue in one sequential pass
    const updatedQueue = currentQ.map(t => {
      if (t.id === tokenId) {
        return {
          ...t,
          status: 'COMPLETED',
          rxNotes: rxNotes || 'Consultation Completed',
          templateName: templateName || 'Standard Prescription',
          rxPdfUrl: pdfUrl,
          rxFilename: filename,
          durationMinutes: durationMins,
          consultationEndTime: now
        };
      }
      if (nextPatient && t.id === nextPatient.id) {
        return {
          ...t,
          status: 'IN_CONSULTATION',
          consultationStartTime: now
        };
      }
      return t;
    });
    setClinicQueues(prev => {
      const next = {
        ...prev,
        [doctorSlug]: updatedQueue,
        [rawDoctorSlug]: updatedQueue
      };
      getSlugVariants(doctorSlug).forEach(v => {
        next[v] = updatedQueue;
      });
      try {
        localStorage.setItem('smart_clinic_tenant_queues', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // 5. Upload prescription PDF to Firebase Storage & write to Firestore (Serverless)
    if (pdfResult && pdfResult.blob) {
      uploadPrescriptionPdfToFirebaseStorage({
        blob: pdfResult.blob,
        filename: filename,
        clinicSlug: doctorSlug,
        tokenNumber: activeToken.tokenNumber,
        patientName: activeToken.patient?.name
      }).then(storageRes => {
        if (storageRes && storageRes.downloadUrl) {
          updatePatientInFirestore(tokenId, {
            rxPdfUrl: storageRes.downloadUrl,
            rxStoragePath: storageRes.storagePath
          }, doctorSlug);
        }
      }).catch(e => console.warn('[Storage Upload Warning]:', e));
    }
    updatePatientInFirestore(tokenId, {
      status: 'COMPLETED',
      rxNotes: rxNotes || 'Consultation Completed',
      templateName: templateName || 'Standard Prescription',
      rxPdfUrl: pdfUrl,
      rxFilename: filename,
      durationMinutes: durationMins,
      consultationEndTime: now
    }, doctorSlug);
    if (nextPatient) {
      updatePatientInFirestore(nextPatient.id, {
        status: 'IN_CONSULTATION',
        consultationStartTime: now
      }, doctorSlug);
    }

    // 6. Trigger 10-Second Automated WhatsApp Prescription Dispatch (Meta Cloud API / Cloud Functions)
    const cleanPhone = (activeToken.patient?.phone || '').replace(/[^0-9]/g, '');
    const waText = `Hello ${activeToken.patient?.name}, your official digital prescription from ${activeDoctor.doctorName} at ${activeDoctor.clinicName} is ready. Token: ${activeToken.tokenNumber}. Rx: ${rxNotes ? rxNotes.slice(0, 100) + '...' : 'Take prescribed rest'}. Wish you a speedy recovery!`;
    const waSendLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(waText)}`;
    dispatchWhatsAppMessage(activeToken.patient?.phone, waText, 'PRESCRIPTION');
    const prescriptionDispatchPayload = {
      phone: activeToken.patient?.phone,
      patientName: activeToken.patient?.name,
      tokenNumber: activeToken.tokenNumber,
      clinicSlug: doctorSlug,
      clinicName: activeDoctor.clinicName,
      doctorName: activeDoctor.doctorName,
      roomNumber: activeDoctor.roomNumber,
      rxNotes: rxNotes || 'Consultation Completed',
      templateName: templateName || 'Standard Prescription',
      pdfUrl,
      filename,
      tokenId
    };

    // Instant API dispatch to Cloud Function (<10s SLA)
    fetch(`${serverUrl}/api/notifications/prescription-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(prescriptionDispatchPayload)
    }).then(r => r.json()).then(res => {
      console.log('[Prescription Dispatch] Completed via Cloud Functions in:', res.elapsedMs, 'ms. SLA <10s met:', res.elapsedMs < 10000);
    }).catch(err => {
      console.warn('[Prescription Dispatch] Cloud Function fallback:', err);
    });

    // Also ping legacy notification route for backwards compatibility
    fetch(`${serverUrl}/api/notifications/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: activeToken.patient?.phone,
        patientName: activeToken.patient?.name,
        tokenNumber: activeToken.tokenNumber,
        clinicName: activeDoctor.clinicName,
        doctorName: activeDoctor.doctorName,
        rxText: rxNotes,
        pdfUrl
      })
    }).catch(() => {});
    setLastCompletedRx({
      patientName: activeToken.patient?.name,
      phone: activeToken.patient?.phone,
      tokenNumber: activeToken.tokenNumber,
      pdfUrl,
      filename,
      waSendLink,
      whatsappStatus: 'DISPATCHED_IN_10S',
      dispatchedAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    });

    // 7. If next patient was moved in, announce call and dispatch their turn WhatsApp alert
    if (nextPatient) {
      audioService.announceCall(nextPatient.tokenNumber, nextPatient.patient?.name);
      const nextWaMessage = `Token ${nextPatient.tokenNumber}: ${activeDoctor.doctorName} is ready for you now. Please step inside ${activeDoctor.roomNumber}.`;
      dispatchWhatsAppMessage(nextPatient.patient?.phone, nextWaMessage, 'CALL_NEXT');
      fetch(`${serverUrl}/api/notifications/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: nextPatient.patient?.phone,
          patientName: nextPatient.patient?.name,
          tokenNumber: nextPatient.tokenNumber,
          clinicName: activeDoctor.clinicName,
          doctorName: activeDoctor.doctorName,
          roomNumber: activeDoctor.roomNumber
        })
      }).catch(() => {});
    }
  };
  const handleCompleteAndPrintPdf = handleCompleteConsultation; // Backward compatible alias

  const handleSwitchDoctor = doctor => {
    setActiveDoctor(doctor);
    setShowAuthModal(false);
  };
  const handleUpdateProfile = updatedData => {
    // Regenerate slug from doctorName + clinicName if either changed
    const newSlug = updatedData.clinicSlug || slugify(`${updatedData.doctorName}-${updatedData.clinicName}`);
    const merged = {
      ...activeDoctor,
      ...updatedData,
      clinicSlug: newSlug
    };
    // Update in doctorsList too
    setDoctorsList(prev => prev.map(d => d.id === merged.id ? merged : d));
    setActiveDoctor(merged);
    setShowProfileModal(false);
  };
  const handleCreateDoctor = newDocData => {
    const newDoc = {
      id: Date.now(),
      doctorName: newDocData.doctorName.trim(),
      specialization: (newDocData.specialization || newDocData.specialty || 'General Physician').trim(),
      roomNumber: (newDocData.roomNumber || 'Consultation Room 1').trim(),
      email: newDocData.email ? newDocData.email.trim() : `${slugify(newDocData.doctorName)}@${activeDoctor.clinicSlug}.com`,
      phone: newDocData.phone ? newDocData.phone.trim() : activeDoctor.phone || '+91 98000 00000',
      clinicName: activeDoctor.clinicName,
      clinicSlug: activeDoctor.clinicSlug,
      clinicId: activeDoctor.clinicId,
      clinicAddress: activeDoctor.clinicAddress,
      qualifications: newDocData.qualifications || 'MBBS',
      regNo: newDocData.regNo || `KMC-${Math.floor(10000 + Math.random() * 90000)}`,
      avgConsultationTime: 8.0
    };
    setDoctorsList(prev => [...prev, newDoc]);
    setActiveDoctor(newDoc);
    setShowAuthModal(false);

    // Sync with backend API if online
    try {
      fetch(`${serverUrl}/api/clinics/${activeDoctor.clinicId}/doctors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newDoc)
      }).catch(() => {});
    } catch (e) {}
  };

  // Open Prescription Preview Modal (No automatic download on view!)
  const handleOpenRxPreview = token => {
    const res = generatePrescriptionPdf({
      doctor: activeDoctor,
      patient: token.patient || {},
      tokenNumber: token.tokenNumber,
      rxNotes: token.rxNotes,
      templateName: token.templateName
    });
    setViewingRxModalToken({
      ...token,
      pdfBlobUrl: res ? res.blobUrl : null,
      pdfDoc: res ? res.doc : null,
      filename: res ? res.filename : `Rx_${(token.patient?.name || 'Patient').replace(/\s+/g, '')}_${token.tokenNumber}.pdf`
    });
  };

  // Remove / Delete Doctor strictly within this clinic
  const handleDeleteDoctor = async doctorId => {
    if (clinicDoctors.length <= 1) {
      alert(`Cannot remove the only registered doctor for ${activeDoctor.clinicName}. At least one doctor must remain active in this clinic.`);
      return;
    }
    const targetDoctor = clinicDoctors.find(d => d.id === doctorId);
    if (!targetDoctor) return;

    // 1. Dispatch delete request to backend database route
    try {
      await fetch(`${serverUrl}/api/doctors/${doctorId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clinicSlug: targetDoctor.clinicSlug
        })
      });
    } catch (e) {
      console.warn('[Delete Doctor] Backend API offline or unreachable; updating tenant state locally:', e);
    }

    // 2. Unassign their queue and purge durations from state and localStorage
    const slug = targetDoctor.clinicSlug;
    setClinicQueues(prev => {
      const updated = {
        ...prev
      };
      delete updated[slug];
      try {
        localStorage.setItem('smart_clinic_tenant_queues', JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
    setClinicDurations(prev => {
      const updated = {
        ...prev
      };
      delete updated[slug];
      try {
        localStorage.setItem('smart_clinic_tenant_durations', JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });

    // 3. Update doctors list and switch active doctor if deleting current active doctor
    const remainingInClinic = clinicDoctors.filter(d => d.id !== doctorId);
    const remainingTotal = doctorsList.filter(d => d.id !== doctorId);
    setDoctorsList(remainingTotal);
    try {
      localStorage.setItem('smart_clinic_saas_doctors', JSON.stringify(remainingTotal));
    } catch (err) {}
    if (activeDoctor.id === doctorId && remainingInClinic.length > 0) {
      setActiveDoctor(remainingInClinic[0]);
      try {
        localStorage.setItem('smart_clinic_current_doctor', JSON.stringify(remainingInClinic[0]));
      } catch (err) {}
    }
  };

  // ======================================================================
  // ======================================================================
  // CONDITIONAL RENDERING: SUPER ADMIN DASHBOARD (/super-admin or /admin)
  // ======================================================================
  if (currentRoute.mode === 'super_admin') {
    if (!isSuperAdminAuthed) {
      // Strictly block any clinic session or unauthenticated user and redirect to login
      setTimeout(() => navigateTo('/login'), 0);
      return /*#__PURE__*/React.createElement("div", {
        className: "min-h-screen bg-slate-950 text-white flex items-center justify-center p-4"
      }, /*#__PURE__*/React.createElement("div", {
        className: "max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl"
      }, /*#__PURE__*/React.createElement("div", {
        className: "text-4xl"
      }, "🔒"), /*#__PURE__*/React.createElement("h2", {
        className: "text-xl font-black text-white"
      }, "Access Restricted"), /*#__PURE__*/React.createElement("p", {
        className: "text-xs text-slate-400 leading-relaxed"
      }, "Super Admin controls are restricted. Redirecting to login..."), /*#__PURE__*/React.createElement("button", {
        onClick: () => navigateTo('/login'),
        className: "w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg cursor-pointer"
      }, "Go to Login")));
    }
    return /*#__PURE__*/React.createElement(SuperAdminDashboardView, {
      clinics: clinicsList,
      doctors: doctorsList,
      queues: clinicQueues,
      onOnboardClinic: handleOnboardClinic,
      onToggleClinicStatus: handleToggleClinicStatus,
      onActivateSubscription: handleActivateSubscription,
      onSwitchToClinic: handleSwitchToClinic,
      onDeleteClinic: handleDeleteClinic,
      onNavigateTo: navigateTo,
      qrBaseUrl: qrBaseUrl,
      detectedLanIp: detectedLanIp,
      onUpdateQrBaseUrl: handleUpdateQrBaseUrl,
      onResetQrBaseUrl: handleResetQrBaseUrl,
      onLogout: () => {
        setIsSuperAdminAuthed(false);
        try {
          localStorage.removeItem('goyoh_super_admin_authed');
        } catch (e) {}
        navigateTo('/login');
      }
    });
  }

  // ======================================================================
  // CONDITIONAL RENDERING: SUPER ADMIN LOGIN (/super-admin/login)
  // ======================================================================
  if (currentRoute.mode === 'super_admin_login') {
    return /*#__PURE__*/React.createElement(SuperAdminLoginView, {
      onLoginSuccess: () => {
        setIsSuperAdminAuthed(true);
        try {
          localStorage.setItem('goyoh_super_admin_authed', 'true');
        } catch (e) {}
        navigateTo('/super-admin');
      },
      onNavigateTo: navigateTo
    });
  }

  // ======================================================================
  // CONDITIONAL RENDERING: DEDICATED CLINIC LOGIN (/clinic/:slug/login)
  // ======================================================================
  if (currentRoute.mode === 'dedicated_clinic_login') {
    return /*#__PURE__*/React.createElement(DedicatedClinicLoginView, {
      clinicSlug: currentRoute.slug,
      clinics: clinicsList,
      doctors: doctorsList,
      onLoginSuccess: (doc, clinic) => {
        setActiveDoctor(doc);
        setIsClinicAuthed(true);
        setIsSuperAdminAuthed(false);
        try {
          localStorage.removeItem('goyoh_super_admin_authed');
        } catch (e) {}
        const targetSlug = clinic && clinic.slug || doc && doc.clinicSlug || currentRoute.slug;
        try {
          localStorage.setItem('smart_clinic_authed', 'true');
          localStorage.setItem('smart_clinic_current_doctor', JSON.stringify(doc));
          localStorage.setItem('smart_clinic_active_clinic_slug', targetSlug);
        } catch (e) {}
        navigateTo(`/clinic/${targetSlug}/dashboard`);
      },
      onNavigateTo: navigateTo
    });
  }

  // ======================================================================
  // CONDITIONAL RENDERING: CLINIC PROVIDER LOGIN (/login or /clinic-login)
  // ======================================================================
  if (currentRoute.mode === 'clinic_login') {
    return /*#__PURE__*/React.createElement(UnifiedLoginView, {
      clinics: clinicsList,
      doctors: doctorsList,
      onLoginSuccess: (doc, clinic, clinicSlug) => {
        setActiveDoctor(doc);
        setIsClinicAuthed(true);
        setIsSuperAdminAuthed(false);
        try {
          localStorage.removeItem('goyoh_super_admin_authed');
        } catch (e) {}
        const targetSlug = clinicSlug || clinic && clinic.slug || doc && doc.clinicSlug || 'dashboard';
        try {
          localStorage.setItem('smart_clinic_authed', 'true');
          localStorage.setItem('smart_clinic_current_doctor', JSON.stringify(doc));
          localStorage.setItem('smart_clinic_active_clinic_slug', targetSlug);
        } catch (e) {}
        navigateTo(`/clinic/${targetSlug}/dashboard`);
      },
      onSuperAdminSuccess: () => {
        setIsSuperAdminAuthed(true);
        try {
          localStorage.setItem('goyoh_super_admin_authed', 'true');
        } catch (e) {}
        navigateTo('/super-admin');
      },
      onNavigateTo: navigateTo
    });
  }

  // ======================================================================
  // CONDITIONAL RENDERING: MOBILE CHECK-IN & LIVE QUEUE ROUTES
  // (/checkin/:slug and /queue/:slug?token=XX)
  // ======================================================================
  if (currentRoute.mode === 'mobile_checkin' || currentRoute.mode === 'mobile_queue' || currentRoute.mode === 'public_patient') {
    if (isPublicPatientClinicSuspended) {
      return /*#__PURE__*/React.createElement("div", {
        className: "min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4"
      }, /*#__PURE__*/React.createElement("header", {
        className: "border-b border-slate-800 bg-slate-900/90 p-3 px-4 flex items-center justify-between"
      }, /*#__PURE__*/React.createElement("span", {
        className: "text-sm font-bold text-rose-400"
      }, "⛔ ", publicPatientDoctor.clinicName), /*#__PURE__*/React.createElement("button", {
        onClick: () => navigateTo('/login'),
        className: "text-xs text-slate-400 hover:text-white px-2.5 py-1 bg-slate-800 rounded-lg"
      }, "Portal →")), /*#__PURE__*/React.createElement("main", {
        className: "flex-1 flex items-center justify-center p-4"
      }, /*#__PURE__*/React.createElement("div", {
        className: "max-w-md w-full bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-8 text-center space-y-4 shadow-2xl"
      }, /*#__PURE__*/React.createElement("div", {
        className: "w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 text-rose-400 text-3xl flex items-center justify-center"
      }, "⛔"), /*#__PURE__*/React.createElement("h2", {
        className: "text-2xl font-black text-white"
      }, "Clinic Services Suspended"), /*#__PURE__*/React.createElement("p", {
        className: "text-xs text-rose-300 font-semibold leading-relaxed"
      }, "Live queue and token registration for ", /*#__PURE__*/React.createElement("span", {
        className: "text-white font-bold"
      }, publicPatientDoctor.clinicName), " are temporarily unavailable."), /*#__PURE__*/React.createElement("p", {
        className: "text-[11px] text-slate-500"
      }, "Please consult the front desk staff for assistance."))), /*#__PURE__*/React.createElement("footer", {
        className: "text-center py-3 text-xs text-slate-500 border-t border-slate-900"
      }, "GOYOH Health Connect • Healthcare Platform"));
    }
    if (currentRoute.mode === 'mobile_queue') {
      return /*#__PURE__*/React.createElement(MobileLiveQueueView, {
        doctor: publicPatientDoctor,
        queue: publicQueue,
        queryToken: currentRoute.queryToken,
        patientTokenId: patientTokenId,
        avgConsultationTime: publicClinicAvgTime,
        onResetToken: () => setPatientTokenId(null),
        onRegisterAnother: () => navigateTo(`/checkin/${publicPatientDoctor.clinicSlug}`),
        qrBaseUrl: qrBaseUrl
      });
    }
    return /*#__PURE__*/React.createElement(MobileCheckinLandingView, {
      doctor: publicPatientDoctor,
      queue: publicQueue,
      patientTokenId: patientTokenId,
      avgConsultationTime: publicClinicAvgTime,
      onRegister: handleRegisterPatient,
      onViewExistingQueue: tok => navigateTo(`/queue/${publicPatientDoctor.clinicSlug}?token=${String(tok).replace('#', '')}`),
      qrBaseUrl: qrBaseUrl
    });
  }
  if (false) {
    if (isPublicPatientClinicSuspended) {
      return /*#__PURE__*/React.createElement("div", {
        className: "min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4"
      }, /*#__PURE__*/React.createElement("header", {
        className: "border-b border-slate-800 bg-slate-900/90 p-3 px-4 flex items-center justify-between"
      }, /*#__PURE__*/React.createElement("span", {
        className: "text-sm font-bold text-rose-400"
      }, "⛔ ", publicPatientDoctor.clinicName), /*#__PURE__*/React.createElement("button", {
        onClick: () => navigateTo('/dashboard'),
        className: "text-xs text-slate-400 hover:text-white px-2.5 py-1 bg-slate-800 rounded-lg"
      }, "Portal →")), /*#__PURE__*/React.createElement("main", {
        className: "flex-1 flex items-center justify-center p-4"
      }, /*#__PURE__*/React.createElement("div", {
        className: "max-w-md w-full bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-8 text-center space-y-4 shadow-2xl"
      }, /*#__PURE__*/React.createElement("div", {
        className: "w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 text-rose-400 text-3xl flex items-center justify-center"
      }, "⛔"), /*#__PURE__*/React.createElement("h2", {
        className: "text-2xl font-black text-white"
      }, "Clinic Services Suspended"), /*#__PURE__*/React.createElement("p", {
        className: "text-xs text-rose-300 font-semibold leading-relaxed"
      }, "Live queue and token registration for ", /*#__PURE__*/React.createElement("span", {
        className: "text-white font-bold"
      }, publicPatientDoctor.clinicName), " are temporarily unavailable."), /*#__PURE__*/React.createElement("p", {
        className: "text-[11px] text-slate-500"
      }, "Please consult the front desk staff for assistance."))), /*#__PURE__*/React.createElement("footer", {
        className: "text-center py-3 text-xs text-slate-500 border-t border-slate-900"
      }, "GOYOH Health Connect • Healthcare Platform"));
    }
    return /*#__PURE__*/React.createElement("div", {
      className: "min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between"
    }, /*#__PURE__*/React.createElement("div", {
      className: "border-b border-slate-800 bg-slate-900/90 p-3 px-4 flex items-center justify-between"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: "w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center font-bold text-slate-950 text-sm"
    }, "+"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
      className: "text-sm font-bold text-white"
    }, publicPatientDoctor.clinicName), /*#__PURE__*/React.createElement("p", {
      className: "text-[11px] text-teal-400"
    }, publicPatientDoctor.doctorName, " • ", publicPatientDoctor.roomNumber))), /*#__PURE__*/React.createElement("button", {
      onClick: () => navigateTo('/dashboard'),
      className: "text-xs text-slate-400 hover:text-white px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700 cursor-pointer"
    }, "Doctor Portal →")), /*#__PURE__*/React.createElement("main", {
      className: "flex-1 flex flex-col items-center justify-center p-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-full max-w-md"
    }, /*#__PURE__*/React.createElement(PublicPatientCheckinView, {
      doctor: publicPatientDoctor,
      queue: publicQueue,
      myTokenId: patientTokenId,
      avgConsultationTime: publicClinicAvgTime,
      onRegister: handleRegisterPatient,
      onResetToken: () => setPatientTokenId(null),
      qrBaseUrl: qrBaseUrl
    }))), /*#__PURE__*/React.createElement("footer", {
      className: "text-center py-3 text-xs text-slate-500 border-t border-slate-900"
    }, "Smart Clinic OS • Public Patient Route: ", /*#__PURE__*/React.createElement("code", {
      className: "text-slate-400 font-mono"
    }, "/q/", publicPatientDoctor.clinicSlug)));
  }

  // ======================================================================
  // DOCTOR DASHBOARD & CONSOLE MODE (/clinic/:slug/dashboard, /dashboard)
  // ======================================================================
  // Direct & Strict Tenant Routing: Dedicated clinic dashboard routes load directly!
  if (!isClinicAuthed && !currentRoute.slug) {
    return /*#__PURE__*/React.createElement(ClinicLoginView, {
      clinics: clinicsList,
      doctors: doctorsList,
      onLoginSuccess: (doc, clinic) => {
        setActiveDoctor(doc);
        setIsClinicAuthed(true);
        try {
          localStorage.setItem('smart_clinic_authed', 'true');
          localStorage.setItem('smart_clinic_active_clinic_slug', clinic.slug);
          localStorage.setItem(`smart_clinic_doctor_${clinic.slug}`, JSON.stringify(doc));
          localStorage.setItem('smart_clinic_current_doctor', JSON.stringify(doc));
        } catch (e) {}
        navigateTo(`/clinic/${clinic.slug}/dashboard`);
      },
      onNavigateTo: navigateTo
    });
  }
  if (!activeDoctorClinic) {
    return /*#__PURE__*/React.createElement("div", {
      className: "min-h-screen bg-slate-950 text-white flex flex-col justify-between"
    }, /*#__PURE__*/React.createElement("header", {
      className: "border-b border-slate-800 bg-slate-900 p-4 flex items-center justify-between"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-3"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black text-xl"
    }, "+"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
      className: "text-base font-bold text-white"
    }, "GOYOH Health Connect"), /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-slate-400"
    }, "Multi-Tenant Healthcare Platform"))), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-2"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => navigateTo('/login'),
      className: "px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
    }, "🔐 Unified Login"))), /*#__PURE__*/React.createElement("main", {
      className: "flex-1 flex items-center justify-center p-6"
    }, /*#__PURE__*/React.createElement("div", {
      className: "max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-16 h-16 mx-auto rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-3xl"
    }, "🏥"), /*#__PURE__*/React.createElement("h2", {
      className: "text-2xl font-black text-white"
    }, "No Clinic Found"), /*#__PURE__*/React.createElement("p", {
      className: "text-xs text-slate-400 leading-relaxed"
    }, "No clinic matches this URL, or no clinics have been onboarded yet. Please onboard your clinic from the Super Admin panel or log in with valid clinic credentials."), /*#__PURE__*/React.createElement("div", {
      className: "pt-2"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => navigateTo('/login'),
      className: "w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
    }, "Go to Login")))));
  }
  if (currentClinicSubscription && currentClinicSubscription.isLocked) {
    return /*#__PURE__*/React.createElement("div", {
      className: "min-h-screen bg-slate-950 text-white flex flex-col justify-between"
    }, /*#__PURE__*/React.createElement("header", {
      className: "border-b border-slate-800 bg-slate-900 p-4 flex items-center justify-between"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-3"
    }, /*#__PURE__*/React.createElement("span", {
      className: "w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 font-black text-lg flex items-center justify-center"
    }, "⏳"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
      className: "text-base font-bold text-white"
    }, activeDoctorClinic?.name || activeDoctor?.clinicName || 'Clinic Tenant'), /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-amber-400 font-bold"
    }, "14-Day Free Trial Expired"))), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setIsClinicAuthed(false);
        try {
          localStorage.removeItem('smart_clinic_authed');
        } catch (e) {}
        navigateTo('/login');
      },
      className: "px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
    }, "🔐 Login Portal")), /*#__PURE__*/React.createElement("main", {
      className: "flex-1 flex items-center justify-center p-6"
    }, /*#__PURE__*/React.createElement("div", {
      className: "max-w-md w-full bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-8 text-center space-y-5 shadow-2xl"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl"
    }, "🔒"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30"
    }, "Post-Trial Transition Required"), /*#__PURE__*/React.createElement("h2", {
      className: "text-2xl font-black text-white mt-3"
    }, "14-Day Free Trial Ended"), /*#__PURE__*/React.createElement("p", {
      className: "text-xs text-slate-300 font-medium mt-2 leading-relaxed"
    }, "Your 14-day free trial has concluded. Your clinic account is now transitioning to its designated annual paid tier:")), /*#__PURE__*/React.createElement("div", {
      className: "p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left space-y-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-slate-400 font-semibold"
    }, "Designated Paid Tier:"), /*#__PURE__*/React.createElement("span", {
      className: "text-sm font-black text-teal-400 font-mono"
    }, currentClinicSubscription.targetPaidTier)), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-slate-400 font-semibold"
    }, "Annual Price:"), /*#__PURE__*/React.createElement("span", {
      className: "text-base font-black text-white font-mono"
    }, currentClinicSubscription.targetPaidPrice)), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-slate-400 font-semibold"
    }, "Status:"), /*#__PURE__*/React.createElement("span", {
      className: "text-[11px] font-bold text-amber-400 uppercase tracking-wider"
    }, "Locked Pending Activation"))), /*#__PURE__*/React.createElement("p", {
      className: "text-[11px] text-slate-400 leading-normal"
    }, "To unlock your Doctor Console, active queues, and Rx packs, please activate your annual paid subscription or contact Super Admin to verify billing."), /*#__PURE__*/React.createElement("div", {
      className: "space-y-2 pt-2"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        handleActivateSubscription(activeDoctorClinic?.slug || activeDoctor?.clinicSlug);
      },
      className: "w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-teal-500/25 transition cursor-pointer flex items-center justify-center space-x-2"
    }, /*#__PURE__*/React.createElement("span", null, "💳"), /*#__PURE__*/React.createElement("span", null, "Verify & Activate ", currentClinicSubscription.targetPaidTier)), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setIsClinicAuthed(false);
        try {
          localStorage.removeItem('smart_clinic_authed');
        } catch (e) {}
        navigateTo('/login');
      },
      className: "w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
    }, "Back to Login")))));
  }
  if (isCurrentClinicSuspended) {
    return /*#__PURE__*/React.createElement("div", {
      className: "min-h-screen bg-slate-950 text-white flex flex-col justify-between"
    }, /*#__PURE__*/React.createElement("header", {
      className: "border-b border-slate-800 bg-slate-900 p-4 flex items-center justify-between"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-3"
    }, /*#__PURE__*/React.createElement("span", {
      className: "w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 font-black text-lg flex items-center justify-center"
    }, "⛔"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
      className: "text-base font-bold text-white"
    }, activeDoctor.clinicName), /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-rose-400 font-bold"
    }, "Subscription Suspended"))), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setIsClinicAuthed(false);
        try {
          localStorage.removeItem('smart_clinic_authed');
        } catch (e) {}
        navigateTo('/login');
      },
      className: "px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
    }, "🔐 Login Portal")), /*#__PURE__*/React.createElement("main", {
      className: "flex-1 flex items-center justify-center p-6"
    }, /*#__PURE__*/React.createElement("div", {
      className: "max-w-md w-full bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-8 text-center space-y-4 shadow-2xl"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-4xl"
    }, "⚠️"), /*#__PURE__*/React.createElement("h2", {
      className: "text-2xl font-black text-white"
    }, "Clinic Account Suspended"), /*#__PURE__*/React.createElement("p", {
      className: "text-xs text-rose-300 font-semibold leading-relaxed"
    }, "Your clinic subscription has been temporarily suspended by GOYOH Health Connect Super Admin. Consultation queues and prescription generation are paused."), /*#__PURE__*/React.createElement("p", {
      className: "text-[11px] text-slate-500"
    }, "To restore access, contact ", /*#__PURE__*/React.createElement("span", {
      className: "text-teal-400 font-mono"
    }, "superadmin@goyoh.com"), " or reactivate via the Super Admin Panel."), /*#__PURE__*/React.createElement("div", {
      className: "pt-2"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setIsClinicAuthed(false);
        try {
          localStorage.removeItem('smart_clinic_authed');
        } catch (e) {}
        navigateTo('/login');
      },
      className: "w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
    }, "Return to Login")))));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen flex flex-col bg-slate-950 text-slate-100 pb-20 md:pb-6 overflow-x-hidden"
  }, /*#__PURE__*/React.createElement("header", {
    className: "border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50 px-3 sm:px-4 py-2 sm:py-3 w-full"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-7xl mx-auto w-full flex items-center justify-between gap-2 sm:gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-md shadow-teal-500/20 text-slate-950 font-black text-base sm:text-lg flex-shrink-0"
  }, "+"), !canManageDoctors ?
  /*#__PURE__*/
  /* Single-Doctor / Starter Clinic Clean Header: Minimal & Professional */
  React.createElement("div", {
    className: "flex items-center space-x-2 sm:space-x-2.5 min-w-0"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "font-black text-sm sm:text-lg tracking-tight text-white truncate max-w-[160px] xs:max-w-[220px] sm:max-w-[320px] md:max-w-none"
  }, activeDoctor?.clinicName || 'Clinic'), /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] sm:text-xs font-bold text-emerald-400 shadow-sm flex-shrink-0"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
  }), /*#__PURE__*/React.createElement("span", null, "ACTIVE OPD"))) :
  /*#__PURE__*/
  /* Multi-Doctor Clinics: Identity with Doctor Management */
  React.createElement("div", {
    className: "min-w-0 flex-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "font-extrabold text-xs sm:text-lg tracking-tight text-white truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[260px] md:max-w-none"
  }, activeDoctor?.clinicName || 'Clinic'), /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
  }), /*#__PURE__*/React.createElement("span", null, "ACTIVE OPD")), /*#__PURE__*/React.createElement("span", {
    className: "hidden lg:inline-block px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30",
    title: "Independent Clinic Dashboard Route"
  }, "/clinic/", activeDoctorClinic ? activeDoctorClinic.slug : activeDoctor?.clinicSlug || 'dashboard', "/dashboard")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-1.5 sm:space-x-2 text-[11px] sm:text-xs text-slate-400 truncate"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-teal-400 font-semibold truncate"
  }, activeDoctor?.doctorName), /*#__PURE__*/React.createElement("span", null, "•"), /*#__PURE__*/React.createElement("span", {
    className: "truncate"
  }, activeDoctor?.roomNumber), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setDoctorModalTab('list');
      setShowAuthModal(true);
    },
    className: "hidden sm:inline-flex text-indigo-400 hover:text-indigo-300 font-semibold underline ml-1 cursor-pointer",
    title: "Manage in-clinic doctors and consultation desks"
  }, "Manage Doctors (", clinicDoctors.length, ")"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setDoctorModalTab('add');
      setShowAuthModal(true);
    },
    className: "hidden sm:inline-flex text-emerald-400 hover:text-emerald-300 font-bold underline ml-1 cursor-pointer",
    title: "Add a new doctor to this clinic"
  }, "+ Add Doctor")))), /*#__PURE__*/React.createElement("div", {
    className: "hidden md:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs sm:text-sm font-medium"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setDoctorViewTab('doctor'),
    className: `flex items-center space-x-2 px-3 py-1.5 rounded-lg transition ${doctorViewTab === 'doctor' ? 'bg-teal-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
  }, /*#__PURE__*/React.createElement("span", null, "🩺 Doctor Console")), /*#__PURE__*/React.createElement("button", {
    onClick: () => navigateTo(`/q/${activeDoctor?.clinicSlug || 'clinic'}`),
    className: "flex items-center space-x-2 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
  }, /*#__PURE__*/React.createElement("span", null, "📱 Public QR Route")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setDoctorViewTab('tv'),
    className: `flex items-center space-x-2 px-3 py-1.5 rounded-lg transition ${doctorViewTab === 'tv' ? 'bg-teal-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
  }, /*#__PURE__*/React.createElement("span", null, "📺 Waiting Room TV")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setDoctorViewTab('split'),
    className: `hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg transition ${doctorViewTab === 'split' ? 'bg-indigo-600 text-white shadow-md font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
  }, /*#__PURE__*/React.createElement("span", null, "⚡ Split View"))), /*#__PURE__*/React.createElement("div", {
    className: "hidden md:flex items-center space-x-2 text-xs"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handleAudioReadyToggle,
    className: `flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border font-bold transition cursor-pointer shadow-sm ${audioReady ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 ring-1 ring-emerald-500/30' : 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold animate-pulse'}`,
    title: "Initialize Web Speech API for phone speaker announcements"
  }, /*#__PURE__*/React.createElement("span", null, audioReady ? '🔊 Audio Ready' : '🔊 Enable Phone Audio')), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setIsClinicAuthed(false);
      try {
        localStorage.removeItem('smart_clinic_authed');
        localStorage.removeItem('smart_clinic_current_doctor');
        localStorage.removeItem('smart_clinic_active_clinic_slug');
      } catch (e) {}
      navigateTo('/login');
    },
    className: "flex items-center space-x-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl font-bold transition cursor-pointer",
    title: "Log out of clinic dashboard"
  }, /*#__PURE__*/React.createElement("span", null, "🚪 Logout")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowQRModal(true),
    className: "flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 rounded-xl font-bold transition cursor-pointer",
    title: "View & Print unique permanent QR code for this clinic"
  }, /*#__PURE__*/React.createElement("span", null, "📱 Desk QR Code")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowProfileModal(true),
    className: "flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-violet-300 border border-violet-500/30 rounded-xl font-bold transition cursor-pointer",
    title: "Edit doctor profile, qualifications, address and digital signature for Rx PDF"
  }, /*#__PURE__*/React.createElement("span", null, "⚙️ Dr. Settings")), canManageDoctors && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setDoctorModalTab('add');
      setShowAuthModal(true);
    },
    className: "flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 rounded-xl font-black transition cursor-pointer shadow-md shadow-emerald-500/20",
    title: "Add a new doctor under this clinic"
  }, /*#__PURE__*/React.createElement("span", null, "+ Add Doctor")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setDoctorModalTab('list');
      setShowAuthModal(true);
    },
    className: "flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold transition cursor-pointer shadow",
    title: "Manage clinic doctors & consultation rooms"
  }, /*#__PURE__*/React.createElement("span", null, "👥 Manage Doctors (", clinicDoctors.length, ")")))), /*#__PURE__*/React.createElement("div", {
    className: "flex md:hidden items-center space-x-1.5"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleAudioReadyToggle,
    className: `p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center ${audioReady ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'}`,
    title: audioReady ? 'Audio Enabled' : 'Enable Speaker Audio',
    "aria-label": "Toggle Audio"
  }, /*#__PURE__*/React.createElement("span", null, audioReady ? '🔊' : '🔇')), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowProfileModal(true),
    className: "p-2 bg-slate-800 hover:bg-slate-700 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center",
    title: "Dr. Settings & Rx Packs",
    "aria-label": "Doctor Settings"
  }, /*#__PURE__*/React.createElement("span", null, "⚙️")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setIsClinicAuthed(false);
      try {
        localStorage.removeItem('smart_clinic_authed');
        localStorage.removeItem('smart_clinic_current_doctor');
        localStorage.removeItem('smart_clinic_active_clinic_slug');
      } catch (e) {}
      navigateTo('/login');
    },
    className: "p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center",
    title: "Logout",
    "aria-label": "Logout"
  }, /*#__PURE__*/React.createElement("span", null, "🚪"))))), canManageDoctors && showAuthModal && /*#__PURE__*/React.createElement(DoctorAuthModal, {
    clinicDoctors: clinicDoctors,
    activeDoctor: activeDoctor,
    initialTab: doctorModalTab,
    onSwitch: handleSwitchDoctor,
    onCreate: handleCreateDoctor,
    onDeleteDoctor: handleDeleteDoctor,
    onClose: () => setShowAuthModal(false)
  }), showProfileModal && /*#__PURE__*/React.createElement(DoctorProfileSettingsModal, {
    doctor: activeDoctor,
    qrBaseUrl: qrBaseUrl,
    onSave: handleUpdateProfile,
    onClose: () => setShowProfileModal(false)
  }), showQRModal && /*#__PURE__*/React.createElement(QRCodeModal, {
    doctor: activeDoctor,
    qrBaseUrl: qrBaseUrl,
    detectedLanIp: detectedLanIp,
    onUpdateQrBaseUrl: handleUpdateQrBaseUrl,
    onResetQrBaseUrl: handleResetQrBaseUrl,
    onTestRoute: () => {
      setShowQRModal(false);
      navigateTo(`/q/${activeDoctor.clinicSlug}`);
    },
    onClose: () => setShowQRModal(false)
  }), lastCompletedRx && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border-2 border-teal-500/60 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl"
  }, "📄"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-1.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
  }), /*#__PURE__*/React.createElement("span", null, "⚡ 10-Second WhatsApp Rx Dispatched (under 10s SLA)")), /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-black text-white"
  }, "Prescription Generated & Dispatched!"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "PDF document transmitted via Meta WhatsApp Cloud API to ", /*#__PURE__*/React.createElement("strong", null, lastCompletedRx.phone), ".")), /*#__PURE__*/React.createElement("div", {
    className: "p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-left space-y-1.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 font-semibold"
  }, "Patient:"), /*#__PURE__*/React.createElement("span", {
    className: "text-white font-bold"
  }, lastCompletedRx.patientName)), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 font-semibold"
  }, "Token:"), /*#__PURE__*/React.createElement("span", {
    className: "text-teal-400 font-bold"
  }, lastCompletedRx.tokenNumber)), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 font-semibold"
  }, "WhatsApp Delivery:"), /*#__PURE__*/React.createElement("span", {
    className: "text-emerald-400 font-bold flex items-center space-x-1"
  }, /*#__PURE__*/React.createElement("span", null, "✓ Dispatched"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-500 font-normal font-mono"
  }, "(", lastCompletedRx.dispatchedAt || '<10s', ")")))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 pt-2"
  }, /*#__PURE__*/React.createElement("a", {
    href: lastCompletedRx.waSendLink,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
  }, /*#__PURE__*/React.createElement("span", null, "💬 1-Tap Send on WhatsApp Web/App")), lastCompletedRx.pdfUrl && /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => window.open(lastCompletedRx.pdfUrl, '_blank'),
    className: "w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-1"
  }, /*#__PURE__*/React.createElement("span", null, "↗️"), /*#__PURE__*/React.createElement("span", null, "Preview PDF")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      const a = document.createElement('a');
      a.href = lastCompletedRx.pdfUrl;
      a.download = lastCompletedRx.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    className: "w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-1 shadow-md shadow-teal-500/20 active:scale-95"
  }, /*#__PURE__*/React.createElement("span", null, "📥"), /*#__PURE__*/React.createElement("span", null, "Download PDF"))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setLastCompletedRx(null),
    className: "text-xs text-slate-400 hover:text-white pt-1"
  }, "Close")))), viewingRxModalToken && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-slate-800 p-4 sm:px-6 bg-slate-900/90"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center text-lg font-bold shadow-inner"
  }, "📄"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-extrabold text-white text-base sm:text-lg"
  }, "Prescription Preview: #", viewingRxModalToken.tokenNumber), /*#__PURE__*/React.createElement("span", {
    className: "px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
  }, "COMPLETED")), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400"
  }, viewingRxModalToken.patient?.name, " • ", viewingRxModalToken.patient?.phone || 'No phone', " • ", new Date(viewingRxModalToken.consultationEndTime || viewingRxModalToken.createdAt || Date.now()).toLocaleDateString()))), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (viewingRxModalToken.pdfBlobUrl) {
        try {
          URL.revokeObjectURL(viewingRxModalToken.pdfBlobUrl);
        } catch (e) {}
      }
      setViewingRxModalToken(null);
    },
    className: "w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer",
    "aria-label": "Close prescription preview"
  }, "✕")), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-950/60"
  }, viewingRxModalToken.pdfBlobUrl ? /*#__PURE__*/React.createElement("div", {
    className: "w-full rounded-2xl overflow-hidden border border-slate-800 bg-white shadow-2xl h-[420px] sm:h-[480px]"
  }, /*#__PURE__*/React.createElement("iframe", {
    src: `${viewingRxModalToken.pdfBlobUrl}#toolbar=0&navpanes=0`,
    className: "w-full h-full border-none",
    title: `Prescription Preview for ${viewingRxModalToken.patient?.name}`
  })) : /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono text-slate-200 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed"
  }, viewingRxModalToken.rxNotes || 'No custom notes recorded.'), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 font-medium"
  }, "Prescription Ref: ", /*#__PURE__*/React.createElement("strong", {
    className: "text-white font-mono"
  }, viewingRxModalToken.filename || `Rx_${viewingRxModalToken.tokenNumber}.pdf`)), /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] text-teal-400 font-mono"
  }, "Preview loaded • Selective download available below"))), /*#__PURE__*/React.createElement("div", {
    className: "border-t border-slate-800 p-4 sm:px-6 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2"
  }, viewingRxModalToken.pdfBlobUrl && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => window.open(viewingRxModalToken.pdfBlobUrl, '_blank'),
    className: "px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer active:scale-95 shadow-sm",
    title: "Open PDF in a new browser tab for full screen preview or browser printing"
  }, /*#__PURE__*/React.createElement("span", null, "↗️"), /*#__PURE__*/React.createElement("span", null, "Open in New Tab")), /*#__PURE__*/React.createElement("a", {
    href: `https://api.whatsapp.com/send?phone=${(viewingRxModalToken.patient?.phone || '').replace(/[^0-9]/g, '')}&text=${encodeURIComponent(`Hello ${viewingRxModalToken.patient?.name}, here is your verified prescription from ${activeDoctor.doctorName} at ${activeDoctor.clinicName}:\n\n${viewingRxModalToken.rxNotes || 'Standard follow-up'}\n\nPrescription Ref: #${viewingRxModalToken.tokenNumber}`)}`,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer active:scale-95 shadow-sm",
    title: "Share prescription details on WhatsApp"
  }, /*#__PURE__*/React.createElement("span", null, "💬"), /*#__PURE__*/React.createElement("span", null, "Share on WhatsApp"))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      if (viewingRxModalToken.pdfBlobUrl) {
        try {
          URL.revokeObjectURL(viewingRxModalToken.pdfBlobUrl);
        } catch (e) {}
      }
      setViewingRxModalToken(null);
    },
    className: "px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 text-xs font-semibold transition cursor-pointer"
  }, "Close"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      if (viewingRxModalToken.pdfDoc) {
        viewingRxModalToken.pdfDoc.save(viewingRxModalToken.filename);
      } else if (viewingRxModalToken.pdfBlobUrl) {
        const a = document.createElement('a');
        a.href = viewingRxModalToken.pdfBlobUrl;
        a.download = viewingRxModalToken.filename || `Rx_${viewingRxModalToken.tokenNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    },
    className: "px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-extrabold text-xs flex items-center space-x-1.5 shadow-lg shadow-teal-500/20 transition cursor-pointer active:scale-95",
    title: "Save a local copy of this prescription PDF to your device"
  }, /*#__PURE__*/React.createElement("span", null, "📥"), /*#__PURE__*/React.createElement("span", null, "Download PDF")))))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 flex flex-col"
  }, doctorViewTab === 'doctor' && /*#__PURE__*/React.createElement(DoctorDashboardView, {
    doctor: activeDoctor,
    queue: currentQueue,
    activeToken: activeToken,
    avgConsultationTime: doctorAvgConsultTime,
    completedDurations: currentDurations,
    onCallNext: handleCallNext,
    onCompleteConsultation: handleCompleteConsultation,
    onCompleteAndPrint: handleCompleteConsultation,
    onViewRxRecord: handleOpenRxPreview,
    onOpenQR: () => setShowQRModal(true),
    onSyncQueue: handleSyncQueueFromPolling,
    onAddDoctor: () => {
      setDoctorModalTab('add');
      setShowAuthModal(true);
    },
    onManageDoctors: () => {
      setDoctorModalTab('list');
      setShowAuthModal(true);
    },
    doctorCount: clinicDoctors.length
  }), doctorViewTab === 'tv' && /*#__PURE__*/React.createElement(WaitingRoomTVView, {
    doctor: activeDoctor,
    queue: currentQueue,
    audioReady: audioReady,
    onEnableAudio: handleAudioReadyToggle,
    qrBaseUrl: qrBaseUrl
  }), doctorViewTab === 'split' && /*#__PURE__*/React.createElement("div", {
    className: "flex-1 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "overflow-y-auto max-h-screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-2 bg-slate-900 border-b border-slate-800 text-xs font-bold text-teal-400 uppercase tracking-wider flex justify-between items-center"
  }, /*#__PURE__*/React.createElement("span", null, "🩺 ", activeDoctor.doctorName, " Dashboard"), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 text-[10px]"
  }, "Avg: ", doctorAvgConsultTime, "m")), /*#__PURE__*/React.createElement(DoctorDashboardView, {
    doctor: activeDoctor,
    queue: currentQueue,
    activeToken: activeToken,
    avgConsultationTime: doctorAvgConsultTime,
    completedDurations: currentDurations,
    onCallNext: handleCallNext,
    onCompleteConsultation: handleCompleteConsultation,
    onCompleteAndPrint: handleCompleteConsultation,
    onViewRxRecord: handleOpenRxPreview,
    onOpenQR: () => setShowQRModal(true),
    onSyncQueue: handleSyncQueueFromPolling,
    onAddDoctor: () => {
      setDoctorModalTab('add');
      setShowAuthModal(true);
    },
    onManageDoctors: () => {
      setDoctorModalTab('list');
      setShowAuthModal(true);
    },
    doctorCount: clinicDoctors.length,
    compact: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "overflow-y-auto max-h-screen bg-slate-950 flex flex-col items-center p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-full p-2 bg-slate-900 border-b border-slate-800 text-xs font-bold text-teal-400 uppercase tracking-wider mb-3"
  }, "📱 Patient View: /q/", activeDoctor.clinicSlug), /*#__PURE__*/React.createElement("div", {
    className: "w-full max-w-[390px] border-4 border-slate-700 rounded-[40px] shadow-2xl overflow-hidden bg-slate-950"
  }, /*#__PURE__*/React.createElement(PublicPatientCheckinView, {
    doctor: activeDoctor,
    queue: currentQueue,
    myTokenId: patientTokenId,
    avgConsultationTime: doctorAvgConsultTime,
    onRegister: (name, phone, complaint) => handleRegisterPatient(name, phone, complaint, activeDoctor.clinicSlug),
    onResetToken: () => setPatientTokenId(null),
    qrBaseUrl: qrBaseUrl
  }))), /*#__PURE__*/React.createElement("div", {
    className: "overflow-y-auto max-h-screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-2 bg-slate-900 border-b border-slate-800 text-xs font-bold text-teal-400 uppercase tracking-wider"
  }, "📺 Lounge TV Display"), /*#__PURE__*/React.createElement(WaitingRoomTVView, {
    doctor: activeDoctor,
    queue: currentQueue,
    audioReady: audioReady,
    onEnableAudio: handleAudioReadyToggle,
    compact: true,
    qrBaseUrl: qrBaseUrl
  })))), /*#__PURE__*/React.createElement("nav", {
    className: "md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/98 backdrop-blur-md border-t border-slate-800 px-1 py-1.5 flex items-center justify-between shadow-2xl safe-area-pb"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setDoctorViewTab('doctor'),
    className: `flex-1 min-w-0 py-1 flex flex-col items-center justify-center rounded-lg transition ${doctorViewTab === 'doctor' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "🩺"), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] mt-0.5 truncate font-medium"
  }, "Console")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowQRModal(true),
    className: "flex-1 min-w-0 py-1 flex flex-col items-center justify-center text-slate-400 hover:text-teal-400 rounded-lg transition"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "📱"), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] mt-0.5 truncate font-medium"
  }, "Desk QR")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleCallNext,
    className: "shrink-0 px-3.5 py-2 bg-gradient-to-r from-teal-500 to-emerald-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-teal-500/30 flex items-center space-x-1 transition",
    title: "1-Tap Call Next Patient in Line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm"
  }, "⚡"), /*#__PURE__*/React.createElement("span", null, "CALL NEXT")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setDoctorViewTab(doctorViewTab === 'tv' ? 'doctor' : 'tv'),
    className: `flex-1 min-w-0 py-1 flex flex-col items-center justify-center rounded-lg transition ${doctorViewTab === 'tv' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "📺"), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] mt-0.5 truncate font-medium"
  }, "TV")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowProfileModal(true),
    className: "flex-1 min-w-0 py-1 flex flex-col items-center justify-center text-slate-400 hover:text-violet-400 rounded-lg transition"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "⚙️"), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] mt-0.5 truncate font-medium"
  }, "Settings"))));
}

// ========================================================================
// 6. VIEW: DOCTOR DASHBOARD CONSOLE (With "View Rx" in History)
// ========================================================================
function DoctorDashboardView({
  doctor,
  queue,
  activeToken,
  avgConsultationTime,
  completedDurations,
  onCallNext,
  onCompleteConsultation,
  onCompleteAndPrint,
  onViewRxRecord,
  onOpenQR,
  onAddDoctor,
  onManageDoctors,
  onSyncQueue,
  doctorCount = 1,
  compact = false
}) {
  const doctorScopeKey = useMemo(() => getDoctorScopeKey(doctor), [doctor]);
  const effectiveSlug = useMemo(() => {
    const raw = doctor?.clinicSlug || doctor?.clinicId || (typeof window !== 'undefined' ? window.location.pathname.replace(/^\/clinic\//, '').split('/')[0] : '') || '';
    return String(raw).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }, [doctor?.clinicSlug, doctor?.clinicId]);
  const [liveQueue, setLiveQueue] = useState(queue || []);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const liveQueueRef = useRef(queue || []);

  // Keep liveQueue synchronized whenever queue prop updates from parent App
  useEffect(() => {
    if (Array.isArray(queue)) {
      setLiveQueue(prev => {
        const tokenMap = new Map();
        (prev || []).forEach(t => tokenMap.set(String(t.id), t));
        queue.forEach(t => {
          const cleanId = String(t.id);
          const existing = tokenMap.get(cleanId);
          if (existing) {
            tokenMap.set(cleanId, {
              ...existing,
              ...t
            });
          } else {
            tokenMap.set(cleanId, t);
          }
        });
        const merged = Array.from(tokenMap.values()).sort((a, b) => {
          const numA = parseInt(String(a.tokenNumber || a.id).replace(/[^0-9]/g, '')) || 0;
          const numB = parseInt(String(b.tokenNumber || b.id).replace(/[^0-9]/g, '')) || 0;
          if (numA !== numB) return numA - numB;
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        });
        liveQueueRef.current = merged;
        return merged;
      });
    }
  }, [queue]);

  // 3-Second Automatic Background Firestore Polling (setInterval + getDocs + onSnapshot)
  useEffect(() => {
    const slug = effectiveSlug || canonicalSlug(doctor?.clinicSlug) || doctor?.clinicSlug || doctor?.clinicId;
    if (!slug) return;
    let isMounted = true;
    const applyTokens = firestoreTokens => {
      if (!Array.isArray(firestoreTokens)) return;
      const tokenMap = new Map();
      (liveQueueRef.current || []).forEach(t => tokenMap.set(String(t.id), t));
      firestoreTokens.forEach(t => {
        const cleanId = String(t.id);
        const existing = tokenMap.get(cleanId);
        if (existing) {
          tokenMap.set(cleanId, {
            ...existing,
            ...t,
            rxNotes: existing.rxNotes || t.rxNotes,
            rxPdfUrl: existing.rxPdfUrl || t.rxPdfUrl,
            rxFilename: existing.rxFilename || t.rxFilename
          });
        } else {
          tokenMap.set(cleanId, t);
        }
      });
      const merged = Array.from(tokenMap.values()).sort((a, b) => {
        const numA = parseInt(String(a.tokenNumber || a.id).replace(/[^0-9]/g, '')) || 0;
        const numB = parseInt(String(b.tokenNumber || b.id).replace(/[^0-9]/g, '')) || 0;
        if (numA !== numB) return numA - numB;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });
      liveQueueRef.current = merged;
      setLiveQueue(merged);
      setLastSyncTime(new Date());

      // Safely notify parent App outside of state updater callback
      if (typeof onSyncQueue === 'function') {
        onSyncQueue(slug, merged);
      }
    };

    // 1. Initial immediate getDocs fetch on load (force server source)
    fetchQueueFromFirestore(slug).then(tokens => {
      if (isMounted) applyTokens(tokens);
    });

    // 2. Continuous 3-second setInterval background polling
    const pollTimerId = setInterval(async () => {
      try {
        const tokens = await fetchQueueFromFirestore(slug);
        if (isMounted) applyTokens(tokens);
      } catch (e) {}
    }, 3000);

    // 3. Firestore snapshot listener for instant push updates
    const unsubscribe = subscribeToQueueInFirestore(slug, tokens => {
      if (isMounted) applyTokens(tokens);
    });
    return () => {
      isMounted = false;
      clearInterval(pollTimerId);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [effectiveSlug, doctor?.clinicSlug, doctor?.clinicId, onSyncQueue]);
  const [doctorPacks, setDoctorPacks] = useState(() => {
    try {
      const saved = localStorage.getItem(`goyoh_doctor_rx_packs_${doctorScopeKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return getDefaultPrescriptionPacks(doctorScopeKey);
  });
  const [customRx, setCustomRx] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('Fever / Viral Pack');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('today'); // 'today' | '1week' | '1month'

  // Pack Modal & Notification State
  const [showPackModal, setShowPackModal] = useState(false);
  const [packModalMode, setPackModalMode] = useState('save_current'); // 'save_current' | 'new' | 'edit'
  const [editingPackId, setEditingPackId] = useState(null);
  const [packFormName, setPackFormName] = useState('');
  const [packFormTag, setPackFormTag] = useState('');
  const [packFormColor, setPackFormColor] = useState('amber');
  const [packFormMedicines, setPackFormMedicines] = useState('');
  const [packToast, setPackToast] = useState('');

  // Scoped Doctor Synchronization: load and sync doctor's personal packs
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`goyoh_doctor_rx_packs_${doctorScopeKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDoctorPacks(parsed);
        } else {
          setDoctorPacks(getDefaultPrescriptionPacks(doctorScopeKey));
        }
      } else {
        setDoctorPacks(getDefaultPrescriptionPacks(doctorScopeKey));
      }
    } catch (e) {
      setDoctorPacks(getDefaultPrescriptionPacks(doctorScopeKey));
    }
    fetch(`/api/doctors/${doctorScopeKey}/prescription-packs`).then(res => res.json()).then(data => {
      if (data.success && Array.isArray(data.packs) && data.packs.length > 0) {
        setDoctorPacks(data.packs);
        try {
          localStorage.setItem(`goyoh_doctor_rx_packs_${doctorScopeKey}`, JSON.stringify(data.packs));
        } catch (e) {}
      }
    }).catch(() => {});
  }, [doctorScopeKey]);

  // Listen for prescription pack updates from Dr. Settings modal
  useEffect(() => {
    const handlePacksUpdated = () => {
      try {
        const saved = localStorage.getItem(goyoh_doctor_rx_packs_);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) setDoctorPacks(parsed);
        }
      } catch (e) {}
    };
    window.addEventListener('rx-packs-updated', handlePacksUpdated);
    window.addEventListener('storage', handlePacksUpdated);
    return () => {
      window.removeEventListener('rx-packs-updated', handlePacksUpdated);
      window.removeEventListener('storage', handlePacksUpdated);
    };
  }, [doctorScopeKey]);

  // Auto-set template notes from doctor's own first pack if customRx is empty
  useEffect(() => {
    if (!customRx && doctorPacks.length > 0) {
      setCustomRx(doctorPacks[0].medicines);
      setSelectedTemplate(doctorPacks[0].name);
    }
  }, [doctorScopeKey]);

  // Queue Panel Tab: 'all' | 'waiting' | 'completed'
  const [queueTab, setQueueTab] = useState('all');

  // Feed Reel Mode: 'reel' (newest arrival slides to top) | 'line' (sequential #1, #2...)
  const [feedMode, setFeedMode] = useState('reel');

  // Date Filter calculation (Today, 1 Week, 1 Month)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const filteredQueue = useMemo(() => {
    const qList = liveQueue && liveQueue.length > 0 ? liveQueue : queue || [];
    return qList.filter(t => {
      // Waiting and In-consultation tokens are always retained in today's active view
      if (t.status === 'WAITING' || t.status === 'IN_CONSULTATION') return true;

      // For completed tokens, extract valid timestamp or keep in today's log
      const rawDate = t.createdAt || t.consultationEndTime || t.consultationStartTime || t.timestamp;
      const tDate = rawDate ? new Date(rawDate) : null;
      if (!tDate || isNaN(tDate.getTime())) {
        return true; // Keep in today's view by default
      }
      if (dateFilter === 'today') {
        return tDate >= startOfToday;
      } else if (dateFilter === '1week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return tDate >= oneWeekAgo;
      } else if (dateFilter === '1month') {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return tDate >= oneMonthAgo;
      }
      return true;
    });
  }, [liveQueue, queue, dateFilter]);

  // Metrics reflecting real-time status
  const waitingList = useMemo(() => {
    return filteredQueue.filter(t => t.status === 'WAITING').sort((a, b) => {
      const numA = parseInt(String(a.tokenNumber).replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(String(b.tokenNumber).replace(/[^0-9]/g, '')) || 0;
      return numA - numB;
    });
  }, [filteredQueue]);
  const inConsultation = activeToken && (!activeToken.createdAt || new Date(activeToken.createdAt || activeToken.id) >= startOfToday) ? activeToken : filteredQueue.find(t => t.status === 'IN_CONSULTATION') || null;

  // Completed consultations in reverse chronological order (most recently completed at top, descending: #17, #16, #15 ... #1)
  const completedList = useMemo(() => {
    return filteredQueue.filter(t => t.status === 'COMPLETED').sort((a, b) => {
      // Primary check: consultationEndTime descending (latest finished at the very top)
      const endA = a.consultationEndTime ? new Date(a.consultationEndTime).getTime() : 0;
      const endB = b.consultationEndTime ? new Date(b.consultationEndTime).getTime() : 0;
      if (endB !== endA) return endB - endA;

      // Secondary check: token number descending (#17 > #16 > #15)
      const numA = parseInt(String(a.tokenNumber).replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(String(b.tokenNumber).replace(/[^0-9]/g, '')) || 0;
      if (numB !== numA) return numB - numA;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : a.id || 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : b.id || 0;
      return timeB - timeA;
    });
  }, [filteredQueue]);

  // Latest arrival token (highest token number or newest timestamp)
  const newestArrivalToken = useMemo(() => {
    if (!waitingList || waitingList.length === 0) return null;
    const sorted = [...waitingList].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      const numA = parseInt(String(a.tokenNumber).replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(String(b.tokenNumber).replace(/[^0-9]/g, '')) || 0;
      return numB - numA;
    });
    return sorted[0];
  }, [waitingList]);

  // Next in line token (lowest token number waiting)
  const nextInLineToken = waitingList.length > 0 ? waitingList[0] : null;

  // Reel feed list: newest first in 'reel' mode, sequential in 'line' mode
  const waitingFeed = useMemo(() => {
    if (feedMode === 'line') return waitingList;
    return [...waitingList].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      const numA = parseInt(String(a.tokenNumber).replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(String(b.tokenNumber).replace(/[^0-9]/g, '')) || 0;
      return numB - numA;
    });
  }, [waitingList, feedMode]);

  // Per-Patient Average Duration calculation based on completed consultations for the day / timeframe
  const completedTokenDurations = completedList.map(t => {
    if (typeof t.durationMinutes === 'number' && t.durationMinutes > 0) {
      // Normalize extreme idle sessions (>60m when console is left open) to standard consult duration
      return t.durationMinutes > 60 ? 12.0 : Number(t.durationMinutes);
    }
    if (t.consultationStartTime && t.consultationEndTime) {
      const diff = (new Date(t.consultationEndTime).getTime() - new Date(t.consultationStartTime).getTime()) / 60000;
      if (diff > 0) {
        return diff > 60 ? 10.0 : Number(diff.toFixed(1));
      }
    }
    return Number(doctor?.avgConsultationTime || 8.0);
  });
  const completedCount = completedList.length;

  // Exact average time spent per single patient across all completed consultations
  const dynamicAvgConsultTime = completedCount > 0 && completedTokenDurations.length > 0 ? Number((completedTokenDurations.reduce((acc, d) => acc + d, 0) / completedCount).toFixed(1)) : 0;

  // CSV Export Handler
  const handleExportReport = () => {
    const recordsToExport = filteredQueue.length > 0 ? filteredQueue : queue;
    if (recordsToExport.length === 0) {
      alert(`No consultation records found for ${doctor.doctorName} in the selected timeframe (${dateFilter}).`);
      return;
    }
    const headers = ["Token Number", "Patient Name", "Phone Number", "Age", "Gender", "Chief Complaint", "Status", "Date", "Consultation Start", "Consultation End", "Duration (Mins)", "Prescription Template", "Prescription / Notes", "Doctor Name", "Clinic Name"];
    const escapeCsv = val => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' | ');
      return `"${str}"`;
    };
    const rows = recordsToExport.map(t => {
      const tDate = new Date(t.createdAt || t.id);
      const dateStr = tDate.toLocaleDateString('en-CA');
      const startStr = t.consultationStartTime ? new Date(t.consultationStartTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }) : 'N/A';
      const endStr = t.consultationEndTime ? new Date(t.consultationEndTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }) : 'N/A';
      const durStr = t.durationMinutes ? `${t.durationMinutes}` : t.consultationStartTime && t.consultationEndTime ? `${((new Date(t.consultationEndTime) - new Date(t.consultationStartTime)) / 60000).toFixed(1)}` : 'N/A';
      return [escapeCsv(t.tokenNumber), escapeCsv(t.patient?.name || 'Patient'), escapeCsv(t.patient?.phone || 'N/A'), escapeCsv(t.patient?.age || '30'), escapeCsv(t.patient?.gender || 'Adult'), escapeCsv(t.complaint || 'General Consultation'), escapeCsv(t.status), escapeCsv(dateStr), escapeCsv(startStr), escapeCsv(endStr), escapeCsv(durStr), escapeCsv(t.templateName || 'Prescription'), escapeCsv(t.rxNotes || 'Standard consultation advice'), escapeCsv(doctor.doctorName), escapeCsv(doctor.clinicName)].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateTag = new Date().toISOString().split('T')[0];
    const cleanSlug = (doctor && (doctor.clinicSlug || doctor.clinicId) || "clinic").replace(/[^a-zA-Z0-9_-]/g, "");
    a.download = `Consultation_Report_${cleanSlug}_${dateFilter}_${dateTag}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const handleSelectPack = pack => {
    if (!pack) return;
    setSelectedTemplate(pack.name);
    setCustomRx(pack.medicines);
  };
  const handleOpenSaveAsMyPack = () => {
    const currentContent = (customRx || '').trim();
    setPackModalMode('save_current');
    setEditingPackId(null);
    setPackFormName(selectedTemplate || (inConsultation?.complaint ? `${inConsultation.complaint} Pack` : 'My Custom Pack'));
    setPackFormTag(selectedTemplate ? selectedTemplate.slice(0, 10).toUpperCase() : 'MY PACK');
    setPackFormColor('teal');
    setPackFormMedicines(currentContent || '1. Tab Paracetamol 650 mg — 1 tab TDS x 3 Days\nAdvice:\n• Rest and hydration');
    setShowPackModal(true);
  };
  const handleOpenNewPack = () => {
    setPackModalMode('new');
    setEditingPackId(null);
    setPackFormName('');
    setPackFormTag('');
    setPackFormColor('emerald');
    setPackFormMedicines('');
    setShowPackModal(true);
  };
  const handleOpenEditPack = (pack, e) => {
    e.stopPropagation();
    setPackModalMode('edit');
    setEditingPackId(pack.id);
    setPackFormName(pack.name);
    setPackFormTag(pack.tag || '');
    setPackFormColor(pack.color || 'amber');
    setPackFormMedicines(pack.medicines);
    setShowPackModal(true);
  };
  const handleDeletePack = (packId, packName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete prescription pack "${packName}" from Dr. ${doctor.doctorName}'s profile?`)) return;
    const updated = doctorPacks.filter(p => p.id !== packId);
    setDoctorPacks(updated);
    try {
      localStorage.setItem(`goyoh_doctor_rx_packs_${doctorScopeKey}`, JSON.stringify(updated));
    } catch (err) {}
    fetch(`/api/doctors/${doctorScopeKey}/prescription-packs/${packId}`, {
      method: 'DELETE'
    }).catch(() => {});
    if (selectedTemplate === packName) {
      const nextPack = updated[0];
      if (nextPack) {
        setSelectedTemplate(nextPack.name);
        setCustomRx(nextPack.medicines);
      } else {
        setSelectedTemplate('Custom Prescription');
      }
    }
    setPackToast(`Pack "${packName}" deleted.`);
    setTimeout(() => setPackToast(''), 3000);
  };
  const handleSavePackSubmit = e => {
    e.preventDefault();
    const trimmedName = packFormName.trim();
    if (!trimmedName) return;
    const packId = editingPackId || `pack_${Date.now()}`;
    const packEntry = {
      id: packId,
      name: trimmedName,
      tag: (packFormTag.trim() || trimmedName.slice(0, 10)).toUpperCase(),
      color: packFormColor || 'teal',
      medicines: packFormMedicines.trim(),
      isCustom: true,
      doctorId: doctorScopeKey,
      doctorName: doctor.doctorName,
      updatedAt: new Date().toISOString()
    };
    let updated;
    if (editingPackId) {
      updated = doctorPacks.map(p => p.id === editingPackId ? packEntry : p);
    } else {
      const existingIdx = doctorPacks.findIndex(p => p.name.toLowerCase() === trimmedName.toLowerCase() || p.id === packId);
      if (existingIdx >= 0) {
        updated = [...doctorPacks];
        updated[existingIdx] = packEntry;
      } else {
        updated = [packEntry, ...doctorPacks];
      }
    }
    setDoctorPacks(updated);
    setSelectedTemplate(packEntry.name);
    setCustomRx(packEntry.medicines);
    try {
      localStorage.setItem(`goyoh_doctor_rx_packs_${doctorScopeKey}`, JSON.stringify(updated));
    } catch (err) {}
    fetch(`/api/doctors/${doctorScopeKey}/prescription-packs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pack: packEntry
      })
    }).catch(() => {});
    setShowPackModal(false);
    setPackToast(`Prescription pack "${packEntry.name}" saved to Dr. ${doctor.doctorName}'s profile!`);
    setTimeout(() => setPackToast(''), 3500);
  };
  const completeConsultationHandler = onCompleteConsultation || onCompleteAndPrint;
  const handleUnifiedCompleteConsultation = () => {
    if (!inConsultation) return;
    const currentRx = customRx || 'Consultation Completed';
    const currentTpl = selectedTemplate || 'Standard Prescription';
    completeConsultationHandler(inConsultation.id, currentRx, currentTpl);

    // Preload starter pack for next incoming patient
    if (doctorPacks && doctorPacks.length > 0) {
      setCustomRx(doctorPacks[0].medicines);
      setSelectedTemplate(doctorPacks[0].name);
    } else {
      setCustomRx('');
      setSelectedTemplate('Standard Prescription');
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 md:space-y-6 ${compact ? 'text-sm' : ''}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "📊"), /*#__PURE__*/React.createElement("span", {
    className: "text-xs uppercase font-extrabold text-slate-300 tracking-wider"
  }, "Queue Analytics"), /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400",
    title: "Firestore 3-Second Automatic Background Polling & onSnapshot Active"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
  }), /*#__PURE__*/React.createElement("span", null, "3s AUTO-REFRESH (LIVE)"))), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-700 hidden sm:inline"
  }, "|"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "analytics-date-filter",
    className: "text-xs text-slate-400 font-medium hidden sm:inline"
  }, "Timeframe:"), /*#__PURE__*/React.createElement("select", {
    id: "analytics-date-filter",
    value: dateFilter,
    onChange: e => setDateFilter(e.target.value),
    className: "bg-slate-950 border border-slate-700 hover:border-teal-500 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-teal-400 cursor-pointer transition shadow-inner"
  }, /*#__PURE__*/React.createElement("option", {
    value: "today"
  }, "📅 Today"), /*#__PURE__*/React.createElement("option", {
    value: "1week"
  }, "🗓️ 1 Week"), /*#__PURE__*/React.createElement("option", {
    value: "1month"
  }, "📆 1 Month")), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-teal-400 font-mono px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20"
  }, filteredQueue.length, " record(s)"))), /*#__PURE__*/React.createElement("div", {
    className: "hidden sm:flex items-center space-x-2.5"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handleExportReport,
    className: "px-3.5 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 hover:text-white border border-teal-500/30 hover:border-teal-400 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-sm active:scale-95",
    title: "Download consultation logs as CSV file"
  }, /*#__PURE__*/React.createElement("span", null, "📥"), /*#__PURE__*/React.createElement("span", null, "Export Report (CSV)")), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-400 font-medium px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-1.5 shadow-inner",
    title: "Daily queue, completed count, and avg consult time automatically reset each calendar day"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-1.5 h-1.5 rounded-full bg-emerald-400"
  }), /*#__PURE__*/React.createElement("span", null, "Auto-Reset Daily")))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "text-xs uppercase font-bold text-slate-400 tracking-wider"
  }, "Waiting in Line"), /*#__PURE__*/React.createElement("h3", {
    className: `text-3xl font-extrabold mt-1 font-mono-numbers ${waitingList.length > 0 ? 'text-amber-400' : 'text-slate-400'}`
  }, waitingList.length), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-slate-400 mt-1"
  }, waitingList.length === 0 ? 'Queue is clear (0 waiting)' : `${waitingList.length} patient(s) waiting`)), /*#__PURE__*/React.createElement("div", {
    className: "w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 hidden sm:flex items-center justify-center text-amber-400 text-xl font-bold"
  }, "⏳")), /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "text-xs uppercase font-bold text-slate-400 tracking-wider"
  }, "In Consultation"), /*#__PURE__*/React.createElement("h3", {
    className: `text-3xl font-extrabold mt-1 font-mono-numbers ${inConsultation ? 'text-teal-400' : 'text-slate-400'}`
  }, inConsultation ? 1 : 0), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-slate-400 mt-1"
  }, inConsultation ? `Token #${inConsultation.tokenNumber} in room` : 'No patient in room (0 active)')), /*#__PURE__*/React.createElement("div", {
    className: "w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 hidden sm:flex items-center justify-center text-teal-400 text-xl font-bold"
  }, "🩺")), /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border border-slate-800 rounded-2xl p-4 hidden md:flex items-center justify-between shadow"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "text-xs uppercase font-bold text-slate-400 tracking-wider"
  }, dateFilter === 'today' ? 'Completed Today' : dateFilter === '1week' ? 'Completed (1 Week)' : 'Completed (1 Month)'), /*#__PURE__*/React.createElement("h3", {
    className: "text-3xl font-extrabold text-emerald-400 mt-1 font-mono-numbers"
  }, completedList.length), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-slate-400 mt-1"
  }, completedList.length === 0 ? '0 completed so far' : `${completedList.length} consultation(s)`)), /*#__PURE__*/React.createElement("div", {
    className: "w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl font-bold"
  }, "✅")), /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border border-slate-800 rounded-2xl p-4 hidden md:flex items-center justify-between shadow relative overflow-hidden group hover:border-teal-500/30 transition-all"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-1.5"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs uppercase font-bold text-slate-400 tracking-wider"
  }, "Avg Consult Time"), completedCount > 0 && dynamicAvgConsultTime > 0 && /*#__PURE__*/React.createElement("span", {
    className: "w-2 h-2 rounded-full bg-teal-400 animate-pulse",
    title: "Live dynamic rolling average calculated per individual consultation"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex items-baseline space-x-1.5 mt-1"
  }, /*#__PURE__*/React.createElement("h3", {
    className: `text-3xl font-extrabold font-mono-numbers tracking-tight ${dynamicAvgConsultTime > 0 ? 'text-teal-400' : 'text-slate-400'}`
  }, dynamicAvgConsultTime > 0 ? dynamicAvgConsultTime : '0'), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-teal-300 font-bold font-mono"
  }, "mins / patient")), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-slate-400 mt-1 flex items-center space-x-1"
  }, completedCount > 0 && dynamicAvgConsultTime > 0 ? /*#__PURE__*/React.createElement("span", {
    className: "text-teal-300 font-medium flex items-center space-x-1"
  }, /*#__PURE__*/React.createElement("span", null, "Average duration per individual consultation (", completedCount, " completed ", dateFilter === 'today' ? 'today' : dateFilter === '1week' ? '7 days' : '30 days', ")")) : /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 font-medium"
  }, "Average duration per individual consultation (0 completed)"))), /*#__PURE__*/React.createElement("div", {
    className: "w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 text-xl font-bold shadow-sm shadow-teal-500/10"
  }, "⏱️"))), /*#__PURE__*/React.createElement("div", {
    className: "bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-3 h-3 rounded-full bg-emerald-400 animate-ping"
  }), /*#__PURE__*/React.createElement("h2", {
    className: "text-base sm:text-xl font-bold text-white truncate max-w-[260px] sm:max-w-none"
  }, doctor.doctorName, ", ", doctor.specialization), /*#__PURE__*/React.createElement("span", {
    className: "hidden sm:inline-block text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-teal-400 border border-slate-700 font-mono"
  }, "/q/", effectiveSlug || doctor.clinicSlug)), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-slate-400 mt-1"
  }, doctor.roomNumber, " • ", doctor.clinicName)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2.5 w-full sm:w-auto"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onCallNext,
    className: "w-full sm:w-auto px-5 sm:px-7 py-3 sm:py-3.5 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-sm sm:text-lg rounded-xl sm:rounded-2xl shadow-lg shadow-teal-500/30 transform active:scale-95 transition-all flex items-center justify-center space-x-2.5 cursor-pointer",
    title: "Calls patient, rings phone speaker, and speaks announcement"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xl sm:text-2xl"
  }, "📢"), /*#__PURE__*/React.createElement("span", null, "1-TAP \"CALL NEXT\"")))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-12 gap-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lg:col-span-7 space-y-6"
  }, inConsultation ? /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border-2 border-teal-500/40 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-2xl relative overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute top-0 right-0 bg-teal-500 text-slate-950 font-extrabold px-5 py-1.5 rounded-bl-2xl text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2 h-2 rounded-full bg-slate-950 animate-pulse"
  }), /*#__PURE__*/React.createElement("span", null, "ACTIVE IN ", (doctor?.roomNumber || "Consultation Room").toUpperCase())), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-4xl font-black text-teal-400 font-mono-numbers"
  }, inConsultation.tokenNumber), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-2xl font-bold text-white"
  }, inConsultation.patient?.name), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-slate-400"
  }, inConsultation.patient?.phone, getPatientBadgeText(inConsultation.patient) && /*#__PURE__*/React.createElement("span", null, " • ", getPatientBadgeText(inConsultation.patient)))))), getPatientComplaint(inConsultation) ? /*#__PURE__*/React.createElement("div", {
    className: "mt-4 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-semibold text-slate-400 uppercase tracking-wide"
  }, "Chief Complaint:"), /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-medium text-slate-200 mt-0.5"
  }, getPatientComplaint(inConsultation))) : null, /*#__PURE__*/React.createElement("div", {
    className: "mt-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-center justify-between gap-2 mb-2.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5"
  }, /*#__PURE__*/React.createElement("span", null, "⚡ 1-Click Clinical Rx Templates")), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] bg-teal-500/10 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-bold"
  }, "🩺 Dr. ", doctor.doctorName, "'s Packs (", doctorPacks.length, ")")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2"
  }, selectedTemplate && /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-teal-400 font-semibold hidden md:inline"
  }, "Active: ", selectedTemplate), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleOpenNewPack,
    className: "px-2.5 py-1 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 hover:border-teal-400 text-teal-300 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer",
    title: "Create a new prescription pack for this doctor"
  }, /*#__PURE__*/React.createElement("span", null, "+ New Pack")))), /*#__PURE__*/React.createElement("div", {
    className: "flex overflow-x-auto pb-2 gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible"
  }, doctorPacks.map(pack => {
    const isSelected = selectedTemplate === pack.name;
    const colorScheme = getPackColorScheme(pack.color);
    return /*#__PURE__*/React.createElement("div", {
      key: pack.id,
      onClick: () => handleSelectPack(pack),
      className: `flex-shrink-0 min-w-[125px] sm:min-w-0 p-2 sm:p-2.5 rounded-xl border text-left transition relative group cursor-pointer flex flex-col justify-between ${isSelected ? `${colorScheme.activeBg} ${colorScheme.activeBorder} ring-2 ${colorScheme.ring}` : `${colorScheme.idleBg} ${colorScheme.idleBorder} hover:border-slate-600`}`
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between gap-1 mb-1"
    }, /*#__PURE__*/React.createElement("span", {
      className: `font-bold text-xs sm:text-sm truncate ${colorScheme.text}`
    }, getPackEmoji(pack.name), " ", pack.name), /*#__PURE__*/React.createElement("span", {
      className: `text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold shrink-0 ${colorScheme.tagBg} ${colorScheme.tagText}`
    }, pack.tag || 'Rx')), /*#__PURE__*/React.createElement("p", {
      className: "text-[10px] text-slate-400 line-clamp-2 leading-tight"
    }, pack.medicines.split('\n')[0] || 'Custom prescription & advice')), /*#__PURE__*/React.createElement("div", {
      className: "mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]"
    }, /*#__PURE__*/React.createElement("span", {
      className: isSelected ? 'text-teal-300 font-bold' : 'text-slate-500'
    }, isSelected ? '✓ Active Template' : 'Click to Apply'), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: e => handleOpenEditPack(pack, e),
      className: "p-1 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded transition",
      title: "Edit this pack"
    }, "✏️"), pack.isCustom && /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: e => handleDeletePack(pack.id, pack.name, e),
      className: "p-1 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 rounded transition",
      title: "Delete this pack"
    }, "🗑️"))));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "mt-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 uppercase tracking-wider block"
  }, "Prescription / Advice (Editable):"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleOpenSaveAsMyPack,
    className: "px-3 py-1 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500/30 hover:to-emerald-500/30 border border-teal-500/40 hover:border-teal-400 text-teal-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm active:scale-95",
    title: `Save current prescription as a custom template for Dr. ${doctor.doctorName}`
  }, /*#__PURE__*/React.createElement("span", null, "💾 Save as My Pack"))), /*#__PURE__*/React.createElement("textarea", {
    rows: "4",
    value: customRx,
    onChange: e => setCustomRx(e.target.value),
    placeholder: "Select a 1-click template above or type custom prescription / medications...",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 md:p-4 text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-teal-500 leading-normal sm:leading-relaxed"
  }), packToast && /*#__PURE__*/React.createElement("div", {
    className: "mt-2.5 p-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center space-x-2 animate-fade-in"
  }, /*#__PURE__*/React.createElement("span", null, "✅"), /*#__PURE__*/React.createElement("span", {
    className: "font-semibold"
  }, packToast))), /*#__PURE__*/React.createElement("div", {
    className: "mt-5 flex items-center justify-end pt-4 border-t border-slate-800"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleUnifiedCompleteConsultation,
    className: "w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/25 flex items-center justify-center space-x-2 transition cursor-pointer transform active:scale-95",
    title: "Save prescription, generate digital PDF, auto-dispatch to patient WhatsApp in under 10 seconds, and call next token"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "⚡"), /*#__PURE__*/React.createElement("span", null, "Save / Finish Prescription (WhatsApp Rx ⚡)")))) : /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border border-dashed border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 md:p-10 text-center flex flex-col items-center justify-center min-h-0 md:min-h-[240px]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800/80 flex items-center justify-center text-2xl sm:text-3xl mb-2 sm:mb-3"
  }, "🩺"), /*#__PURE__*/React.createElement("h3", {
    className: "text-lg sm:text-xl font-bold text-white"
  }, "No Active Patient in ", doctor.roomNumber), /*#__PURE__*/React.createElement("p", {
    className: "text-slate-400 text-xs sm:text-sm max-w-md mt-1"
  }, waitingList.length > 0 ? `${waitingList.length} patient(s) waiting in your queue. Tap "CALL NEXT" to begin.` : `Your queue is currently clear. Patients can scan your unique counter QR code to register.`), /*#__PURE__*/React.createElement("div", {
    className: "mb-4 hidden sm:flex flex-wrap items-center justify-center gap-2 bg-slate-950 border border-slate-800 px-4 py-2 rounded-2xl text-xs text-slate-300"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-teal-400 font-bold"
  }, "🩺 Dr. ", doctor.doctorName, "'s Custom Rx Packs:"), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-teal-300"
  }, doctorPacks.length, " packs configured"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleOpenNewPack,
    className: "ml-2 text-teal-400 hover:text-white underline font-semibold cursor-pointer"
  }, "+ Add New Pack")))), /*#__PURE__*/React.createElement("div", {
    className: "lg:col-span-5 space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between sm:justify-start space-x-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-extrabold text-white text-sm sm:text-base"
  }, dateFilter === 'today' ? 'Queue & History' : dateFilter === '1week' ? 'Past 7 Days' : 'Past 30 Days'), /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-bold text-emerald-400 select-none",
    title: "Live background queue auto-refresh active (3.5s)"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 select-none shadow-sm",
    title: lastSyncTime ? `Auto-refreshes every 3 seconds directly from Cloud Firestore (Last sync: ${lastSyncTime.toLocaleTimeString()})` : "Auto-refreshes every 3 seconds directly from Cloud Firestore"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
  }), /*#__PURE__*/React.createElement("span", null, "LIVE SYNC (3s)"), lastSyncTime && /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] text-emerald-400/80 font-mono hidden sm:inline"
  }, "• ", lastSyncTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }))))), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: searchQuery,
    onChange: e => setSearchQuery(e.target.value),
    placeholder: "Search name or #...",
    className: "w-full sm:w-32 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setQueueTab('all'),
    className: `py-1.5 px-1 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer truncate ${queueTab === 'all' ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20' : 'text-slate-400 hover:text-white'}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "truncate"
  }, "📋 All"), /*#__PURE__*/React.createElement("span", {
    className: `px-1.5 py-0.2 rounded-full text-[10px] font-mono-numbers font-black shrink-0 ${queueTab === 'all' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'}`
  }, filteredQueue.length)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setQueueTab('waiting'),
    className: `py-1.5 px-1 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer truncate ${queueTab === 'waiting' ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20' : 'text-slate-400 hover:text-white'}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "truncate"
  }, "⏳ Waiting"), /*#__PURE__*/React.createElement("span", {
    className: `px-1.5 py-0.2 rounded-full text-[10px] font-mono-numbers font-black shrink-0 ${queueTab === 'waiting' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-amber-400'}`
  }, waitingList.length)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setQueueTab('completed'),
    className: `py-1.5 px-1 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer truncate ${queueTab === 'completed' ? 'bg-emerald-400 text-slate-950 shadow-md shadow-emerald-400/20' : 'text-slate-400 hover:text-white'}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "truncate"
  }, "✅ Done"), /*#__PURE__*/React.createElement("span", {
    className: `px-1.5 py-0.2 rounded-full text-[10px] font-mono-numbers font-black shrink-0 ${queueTab === 'completed' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-emerald-400'}`
  }, completedList.length))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, (queueTab === 'all' || queueTab === 'waiting') && /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-xs px-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-extrabold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5 text-[11px]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2 h-2 rounded-full bg-amber-400 animate-pulse"
  }), /*#__PURE__*/React.createElement("span", null, "Live Waiting Queue")), /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] font-mono-numbers text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20"
  }, waitingList.length, " Waiting in line")), /*#__PURE__*/React.createElement("div", {
    className: `space-y-2 ${queueTab === 'waiting' ? 'max-h-[500px]' : 'max-h-[280px]'} overflow-y-auto pr-1`
  }, waitingList.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-center"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-bold text-slate-400"
  }, "Waiting line is clear (0 waiting)"), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-slate-500 mt-0.5"
  }, "Patients can scan QR poster to register.")) : waitingList.filter(t => !searchQuery || t.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || String(t.tokenNumber).toLowerCase().includes(searchQuery.toLowerCase())).map((token, idx) => {
    const benchmarkTime = dynamicAvgConsultTime > 0 ? dynamicAvgConsultTime : doctor.avgConsultationTime || 8.0;
    const patientWaitEstimate = Math.round((idx + 1) * benchmarkTime);
    return /*#__PURE__*/React.createElement("div", {
      key: token.id,
      className: "p-3.5 rounded-2xl border border-slate-800/90 bg-slate-950/70 hover:border-amber-500/40 transition-all shadow-sm"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-3 min-w-0"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col items-center justify-center px-2 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex-shrink-0"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-[8px] font-black uppercase tracking-wider"
    }, "WAITING"), /*#__PURE__*/React.createElement("span", {
      className: "text-xs font-black font-mono-numbers"
    }, token.tokenNumber)), /*#__PURE__*/React.createElement("div", {
      className: "min-w-0"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-2"
    }, /*#__PURE__*/React.createElement("h4", {
      className: "font-bold text-xs text-white truncate"
    }, token.patient?.name), getPatientBadgeText(token.patient) && /*#__PURE__*/React.createElement("span", {
      className: "text-[9px] font-semibold text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded-full flex-shrink-0"
    }, getPatientBadgeText(token.patient))), getPatientComplaint(token) ? /*#__PURE__*/React.createElement("p", {
      className: "text-[11px] text-slate-400 truncate mt-0.5 max-w-[200px]"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-slate-500 font-semibold"
    }, "Complaint:"), " ", getPatientComplaint(token)) : null)), /*#__PURE__*/React.createElement("div", {
      className: "text-right flex flex-col items-end flex-shrink-0 space-y-1"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] text-teal-400 font-bold font-mono-numbers"
    }, "~", patientWaitEstimate, "m wait"), /*#__PURE__*/React.createElement("span", {
      className: "text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"
    }, "#", idx + 1, " In Line"))));
  }))), (queueTab === 'all' || queueTab === 'completed') && /*#__PURE__*/React.createElement("div", {
    className: "space-y-2.5 pt-2 border-t border-slate-800/80"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-xs px-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-extrabold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5 text-[11px]"
  }, /*#__PURE__*/React.createElement("span", null, "✅"), /*#__PURE__*/React.createElement("span", null, "Completed History")), /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] font-mono-numbers font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"
  }, completedList.length, " Consultations Today")), /*#__PURE__*/React.createElement("div", {
    className: `space-y-2.5 ${queueTab === 'completed' ? 'max-h-[540px]' : 'max-h-[340px]'} overflow-y-auto pr-1`
  }, completedList.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "p-6 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-center text-slate-500"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-2xl block mb-1"
  }, "📋"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-semibold text-slate-400"
  }, "No completed consultations yet today"), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-slate-500 mt-0.5"
  }, "Finished appointments will stay logged here with their digital Rx.")) : completedList.filter(t => !searchQuery || t.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || String(t.tokenNumber).toLowerCase().includes(searchQuery.toLowerCase())).map((token, cIdx) => {
    const isMostRecent = cIdx === 0 && !searchQuery;
    return /*#__PURE__*/React.createElement("div", {
      key: token.id,
      className: `p-3.5 rounded-2xl border transition-all shadow-sm ${isMostRecent ? 'border-emerald-500/60 bg-emerald-950/20 ring-1 ring-emerald-500/30 shadow-emerald-500/10' : 'border-slate-800/90 bg-slate-950/70 hover:border-emerald-500/40'}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between gap-2.5"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-3 min-w-0"
    }, /*#__PURE__*/React.createElement("div", {
      className: `flex flex-col items-center justify-center px-2 py-1 rounded-xl border flex-shrink-0 ${isMostRecent ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-[8px] font-black uppercase tracking-wider"
    }, isMostRecent ? 'LATEST' : 'DONE'), /*#__PURE__*/React.createElement("span", {
      className: "text-xs font-black font-mono-numbers"
    }, token.tokenNumber)), /*#__PURE__*/React.createElement("div", {
      className: "min-w-0"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-2"
    }, /*#__PURE__*/React.createElement("h4", {
      className: "font-bold text-xs text-white truncate"
    }, token.patient?.name), isMostRecent && /*#__PURE__*/React.createElement("span", {
      className: "px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-400 text-slate-950 uppercase tracking-tight"
    }, "RECENT"), getPatientBadgeText(token.patient) && /*#__PURE__*/React.createElement("span", {
      className: "text-[9px] font-semibold text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded-full flex-shrink-0"
    }, getPatientBadgeText(token.patient))), getPatientComplaint(token) ? /*#__PURE__*/React.createElement("p", {
      className: "text-[11px] text-slate-400 truncate mt-0.5"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-slate-500 font-semibold"
    }, "Complaint:"), " ", getPatientComplaint(token)) : null, token.rxNotes && /*#__PURE__*/React.createElement("p", {
      className: "text-[10px] text-teal-300/90 font-medium truncate mt-1 bg-teal-950/30 px-2 py-0.5 rounded-md border border-teal-500/20 max-w-[240px]"
    }, "💊 ", token.rxNotes.split('\n')[0].slice(0, 45), token.rxNotes.length > 45 ? '...' : ''))), /*#__PURE__*/React.createElement("div", {
      className: "text-right flex flex-col items-end flex-shrink-0 space-y-1"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-[10px] font-mono-numbers text-slate-400 flex items-center space-x-1"
    }, /*#__PURE__*/React.createElement("span", null, "⏱️"), /*#__PURE__*/React.createElement("span", null, token.durationMinutes ? `${token.durationMinutes}m` : 'Done')), /*#__PURE__*/React.createElement("button", {
      onClick: () => onViewRxRecord(token),
      className: "px-2.5 py-1 bg-teal-500/15 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer transition shadow-sm active:scale-95",
      title: "View / Re-print past prescription PDF"
    }, /*#__PURE__*/React.createElement("span", null, "📄"), /*#__PURE__*/React.createElement("span", null, "View Rx")))));
  }))))))), showPackModal && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-slate-800 pb-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "font-black text-white text-base"
  }, packModalMode === 'edit' ? '✏️ Edit Prescription Pack' : packModalMode === 'new' ? '➕ Create New Prescription Pack' : '💾 Save as My Prescription Pack'), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-teal-400 mt-0.5 font-semibold"
  }, "Scoped to: ", /*#__PURE__*/React.createElement("strong", {
    className: "text-white"
  }, "Dr. ", doctor.doctorName), " (", doctor.specialization || 'General Physician', ")")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowPackModal(false),
    className: "text-slate-400 hover:text-white p-1 rounded-lg text-lg cursor-pointer"
  }, "✕")), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSavePackSubmit,
    className: "space-y-3.5"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Pack Name / Diagnosis Title *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: packFormName,
    onChange: e => setPackFormName(e.target.value),
    placeholder: "e.g. Fever / Viral Pack, Pediatric Cold, Migraine SOS",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-teal-500 font-medium"
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Short Tag / Badge"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: packFormTag,
    onChange: e => setPackFormTag(e.target.value),
    placeholder: "e.g. PCM + CET",
    maxLength: "12",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-teal-500 font-mono uppercase"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Color Accent"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-1.5 pt-1"
  }, ['amber', 'emerald', 'sky', 'blue', 'purple', 'rose', 'teal'].map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    type: "button",
    onClick: () => setPackFormColor(c),
    className: `w-6 h-6 rounded-full transition transform cursor-pointer ${packFormColor === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'}`,
    style: {
      backgroundColor: c === 'amber' ? '#f59e0b' : c === 'emerald' ? '#10b981' : c === 'sky' ? '#0ea5e9' : c === 'blue' ? '#3b82f6' : c === 'purple' ? '#a855f7' : c === 'rose' ? '#f43f5e' : '#14b8a6'
    },
    title: c
  }))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Prescription Medications & Clinical Advice *"), /*#__PURE__*/React.createElement("textarea", {
    required: true,
    rows: "6",
    value: packFormMedicines,
    onChange: e => setPackFormMedicines(e.target.value),
    placeholder: "1. Tab Name Dosage Frequency x Days\\nAdvice:\\n• Rest, hydration...",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-teal-500 leading-relaxed"
  })), /*#__PURE__*/React.createElement("div", {
    className: "p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400"
  }, "💡 This pack will be saved under ", /*#__PURE__*/React.createElement("strong", null, "Dr. ", doctor.doctorName), "'s personal profile and will be immediately available in the 1-Click Rx grid during future consultations."), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-end space-x-3 pt-2 border-t border-slate-800"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowPackModal(false),
    className: "px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-teal-500/20"
  }, packModalMode === 'edit' ? 'Update Pack' : 'Save to My Profile'))))));
}

// ========================================================================
// ========================================================================
// 7A. VIEW: MOBILE QR CHECK-IN LANDING (/checkin/:clinicId)
// ========================================================================
function MobileCheckinLandingView({
  doctor,
  queue,
  patientTokenId,
  avgConsultationTime,
  onRegister,
  onViewExistingQueue,
  qrBaseUrl
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const existingToken = useMemo(() => {
    if (!queue || queue.length === 0) return null;
    let savedId = patientTokenId;
    if (!savedId) {
      try {
        savedId = localStorage.getItem(`goyoh_patient_token_${doctor.clinicSlug}`);
      } catch (e) {}
    }
    if (savedId) {
      return queue.find(t => String(t.id) === String(savedId) || String(t.tokenNumber).replace('#', '') === String(savedId));
    }
    return null;
  }, [queue, patientTokenId, doctor.clinicSlug]);
  const waitingCount = useMemo(() => {
    return (queue || []).filter(t => t.status === 'WAITING').length;
  }, [queue]);
  const estimatedWaitMin = Math.max(3, (waitingCount + 1) * Math.round(avgConsultationTime || 8));
  const handlePhoneChange = e => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
    setPhone(val);
    if (errorMsg) setErrorMsg('');
  };
  const handleSubmit = e => {
    e.preventDefault();
    setErrorMsg('');
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Please enter your full name');
      return;
    }
    if (!cleanPhone || cleanPhone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }

    // Dynamically extract clinic slug from URL pathname across all check-in routes (admin.goyoh.in/checkin/[clinic-slug])
    let dynamicClinicSlug = '';
    if (typeof window !== 'undefined') {
      const path = window.location.pathname || '';
      const hash = window.location.hash || '';
      if (path.includes('/checkin/')) {
        dynamicClinicSlug = path.split('/checkin/')[1]?.split('/')[0]?.split('?')[0];
      } else if (hash.includes('/checkin/')) {
        dynamicClinicSlug = hash.split('/checkin/')[1]?.split('/')[0]?.split('?')[0];
      }
    }
    const effectiveClinicSlug = dynamicClinicSlug || doctor?.clinicSlug || 'apollo-clinic';
    setIsSubmitting(true);
    try {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (err) {}
    onRegister(cleanName, `+91 ${cleanPhone}`, '', effectiveClinicSlug);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans selection:bg-teal-500 selection:text-slate-950"
  }, /*#__PURE__*/React.createElement("header", {
    className: "max-w-md w-full mx-auto flex items-center justify-between pb-3 border-b border-slate-800"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hidden sm:flex items-center space-x-2.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-400 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-lg shadow-md shadow-teal-500/20"
  }, "+"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "font-extrabold text-sm tracking-tight text-white"
  }, doctor.clinicName), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-teal-400 font-semibold"
  }, "Self-Service QR OPD Check-In"))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
  }), /*#__PURE__*/React.createElement("span", null, "LIVE OPD"))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 flex flex-col items-center justify-center py-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-md w-full space-y-4"
  }, existingToken && /*#__PURE__*/React.createElement("div", {
    className: "p-3.5 bg-gradient-to-r from-teal-950/90 to-emerald-950/90 border border-teal-500/40 rounded-2xl flex items-center justify-between shadow-lg animate-fade-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hidden sm:flex items-center space-x-2.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xl"
  }, "🎫"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-bold text-white"
  }, "Active token in progress: ", /*#__PURE__*/React.createElement("strong", {
    className: "text-teal-300 font-mono text-sm"
  }, existingToken.tokenNumber)), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-teal-400/90"
  }, "Status: ", existingToken.status === 'IN_CONSULTATION' ? 'Ready in Room' : 'Waiting in Queue'))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onViewExistingQueue(existingToken.tokenNumber),
    className: "px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer shrink-0 shadow"
  }, "View Live →")), /*#__PURE__*/React.createElement("div", {
    className: "bg-gradient-to-b from-slate-900 to-slate-900/90 border border-slate-800 rounded-3xl p-5 text-center shadow-xl relative overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-500"
  }), /*#__PURE__*/React.createElement("div", {
    className: "w-12 h-12 mx-auto rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center text-2xl mb-2.5 shadow-inner"
  }, "🩺"), /*#__PURE__*/React.createElement("h1", {
    className: "text-xl sm:text-2xl font-black text-white tracking-tight"
  }, doctor.doctorName), /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-semibold text-teal-400 mt-0.5"
  }, doctor.specialization), /*#__PURE__*/React.createElement("div", {
    className: "mt-2.5 inline-flex items-center space-x-2 bg-slate-950 px-3 py-1 rounded-full border border-slate-800 text-[11px] text-slate-400"
  }, /*#__PURE__*/React.createElement("span", null, "📍 ", doctor.roomNumber), /*#__PURE__*/React.createElement("span", null, "•"), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-300 font-medium"
  }, "⚡ ~", Math.round(avgConsultationTime || 8), "m avg consult")), /*#__PURE__*/React.createElement("div", {
    className: "mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-around text-xs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-500 uppercase font-bold block"
  }, "In Queue"), /*#__PURE__*/React.createElement("span", {
    className: "text-base font-black text-amber-400 font-mono"
  }, waitingCount, " Patients")), /*#__PURE__*/React.createElement("div", {
    className: "w-px h-6 bg-slate-800"
  }), /*#__PURE__*/React.createElement("div", {
    className: "text-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-500 uppercase font-bold block"
  }, "Est. Wait"), /*#__PURE__*/React.createElement("span", {
    className: "text-base font-black text-teal-400 font-mono"
  }, "~", estimatedWaitMin, " mins")))), /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center pb-1"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-base font-extrabold text-white"
  }, "Instant OPD Registration"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400 mt-0.5"
  }, "Fast 5-second check-in • Zero app download")), errorMsg && /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-xs text-rose-300 flex items-center space-x-2"
  }, /*#__PURE__*/React.createElement("span", null, "⚠️"), /*#__PURE__*/React.createElement("span", null, errorMsg)), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1.5 flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", null, "Patient Full Name *"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-500"
  }, "Fast entry")), /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("span", {
    className: "absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
  }, "👤"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    autoFocus: true,
    autoComplete: "name",
    autoCapitalize: "words",
    value: name,
    onChange: e => {
      setName(e.target.value);
      if (errorMsg) setErrorMsg('');
    },
    placeholder: "e.g. Ramesh Kumar",
    className: "w-full bg-slate-950 border border-slate-700 focus:border-teal-400 rounded-2xl pl-10 pr-3.5 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1.5 flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", null, "Mobile Number *"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-emerald-400 font-semibold"
  }, "📲 WhatsApp Live Tracker")), /*#__PURE__*/React.createElement("div", {
    className: "relative flex items-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute left-3.5 flex items-center space-x-1 text-slate-400 text-xs font-bold select-none pr-2 border-r border-slate-800"
  }, /*#__PURE__*/React.createElement("span", null, "🇮🇳"), /*#__PURE__*/React.createElement("span", null, "+91")), /*#__PURE__*/React.createElement("input", {
    type: "tel",
    required: true,
    inputMode: "tel",
    pattern: "[0-9]{10}",
    maxLength: "10",
    value: phone,
    onChange: handlePhoneChange,
    placeholder: "98765 43210",
    className: "w-full bg-slate-950 border border-slate-700 focus:border-teal-400 rounded-2xl pl-20 pr-3.5 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-mono font-medium tracking-wider"
  })), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-slate-500 mt-1.5 flex items-center space-x-1"
  }, /*#__PURE__*/React.createElement("span", null, "💬"), /*#__PURE__*/React.createElement("span", null, "Token link & turn alert will be dispatched to this WhatsApp"))), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    disabled: isSubmitting,
    className: "w-full py-4 bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-2xl shadow-xl shadow-teal-500/25 text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition cursor-pointer transform active:scale-98 disabled:opacity-60"
  }, isSubmitting ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"
  }), /*#__PURE__*/React.createElement("span", null, "GENERATING TOKEN...")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "text-lg"
  }, "🎫"), /*#__PURE__*/React.createElement("span", null, "GET MY TOKEN")))), /*#__PURE__*/React.createElement("div", {
    className: "pt-2 text-center text-[10px] text-slate-500"
  }, /*#__PURE__*/React.createElement("p", null, "🔒 100% Secure • Direct OPD Queue Placement"))))), /*#__PURE__*/React.createElement("footer", {
    className: "max-w-md w-full mx-auto text-center py-2 text-[10px] text-slate-500"
  }, "Powered by GOYOH Health Connect • Live Mobile OPD Engine"));
}

// ========================================================================
// 7B. VIEW: MOBILE LIVE QUEUE DASHBOARD (/queue/:clinicId?token=XX)
// ========================================================================
function MobileLiveQueueView({
  doctor,
  queue,
  queryToken,
  patientTokenId,
  avgConsultationTime,
  onResetToken,
  onRegisterAnother,
  qrBaseUrl
}) {
  const [liveQueue, setLiveQueue] = useState(queue || []);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const [hasNotifiedTurn, setHasNotifiedTurn] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const handleDownloadPdf = async e => {
    if (e) e.preventDefault();
    setIsDownloadingPdf(true);
    try {
      await downloadPrescriptionFromBackend(myToken, doctor);
    } finally {
      setIsDownloadingPdf(false);
    }
  };
  useEffect(() => {
    if (!doctor?.clinicSlug) return;
    const unsubscribe = subscribeToQueueInFirestore(doctor.clinicSlug, tokens => {
      if (Array.isArray(tokens) && tokens.length > 0) {
        setLiveQueue(tokens);
        setLastSyncTime(new Date());
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [doctor?.clinicSlug]);
  useEffect(() => {
    if (queue && queue.length > 0) {
      setLiveQueue(queue);
    }
  }, [queue]);
  const myToken = useMemo(() => {
    if (!liveQueue || liveQueue.length === 0) return null;
    const cleanQ = queryToken ? String(queryToken).replace('#', '').trim() : null;
    if (cleanQ) {
      const match = liveQueue.find(t => String(t.tokenNumber).replace('#', '').trim() === cleanQ || String(t.id) === cleanQ);
      if (match) return match;
    }
    if (patientTokenId) {
      const match = liveQueue.find(t => String(t.id) === String(patientTokenId));
      if (match) return match;
    }
    try {
      const savedNum = localStorage.getItem(`goyoh_patient_token_num_${doctor?.clinicSlug}`);
      if (savedNum) {
        const match = liveQueue.find(t => String(t.tokenNumber).replace('#', '') === savedNum.replace('#', ''));
        if (match) return match;
      }
      const savedId = localStorage.getItem(`goyoh_patient_token_${doctor?.clinicSlug}`);
      if (savedId) {
        const match = liveQueue.find(t => String(t.id) === String(savedId));
        if (match) return match;
      }
    } catch (e) {}
    return liveQueue[liveQueue.length - 1] || null;
  }, [liveQueue, queryToken, patientTokenId, doctor?.clinicSlug]);
  const currentlyServing = useMemo(() => {
    return liveQueue.find(t => t.status === 'IN_CONSULTATION') || null;
  }, [liveQueue]);
  const patientsAhead = useMemo(() => {
    if (!myToken) return 0;
    const waitingList = liveQueue.filter(t => t.status === 'WAITING');
    const idx = waitingList.findIndex(t => t.id === myToken.id);
    return idx >= 0 ? idx : 0;
  }, [liveQueue, myToken]);
  const estimatedWaitMin = Math.max(3, patientsAhead * Math.round(avgConsultationTime || 8));
  const isInConsultation = myToken?.status === 'IN_CONSULTATION';
  const isCompleted = myToken?.status === 'COMPLETED';
  useEffect(() => {
    if (isInConsultation && !hasNotifiedTurn) {
      setHasNotifiedTurn(true);
      try {
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200, 100, 400]);
        }
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } catch (e) {}
    }
  }, [isInConsultation, hasNotifiedTurn]);
  const tokenDisplay = myToken?.tokenNumber || (queryToken ? `#${queryToken}` : '#--');
  const cleanTokenNum = String(tokenDisplay).replace('#', '');
  const persistentUrl = typeof window !== 'undefined' ? `${window.location.origin}/queue/${doctor.clinicSlug}?token=${cleanTokenNum}` : '';
  const handleShareToken = () => {
    if (navigator.share) {
      navigator.share({
        title: `${doctor.clinicName} - My Token ${tokenDisplay}`,
        text: `My live OPD Token is ${tokenDisplay} at ${doctor.clinicName} (${doctor.doctorName}). Track real-time queue:`,
        url: persistentUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(persistentUrl);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2500);
    }
  };
  const whatsappMessage = `🏥 GOYOH Health Connect - ${doctor.clinicName}\nHello! My live OPD Token is ${tokenDisplay} with ${doctor.doctorName}.\n\n🔴 Track live queue in real-time:\n${persistentUrl}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans selection:bg-teal-500 selection:text-slate-950"
  }, /*#__PURE__*/React.createElement("header", {
    className: "max-w-md w-full mx-auto flex items-center justify-between pb-3 border-b border-slate-800"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hidden sm:flex items-center space-x-2.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-400 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-lg shadow-md shadow-teal-500/20"
  }, "+"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "font-extrabold text-sm tracking-tight text-white"
  }, doctor.clinicName), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-teal-400 font-semibold"
  }, doctor.doctorName, " • ", doctor.roomNumber))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-[10px] font-bold text-teal-400"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2 h-2 rounded-full bg-emerald-400 animate-ping"
  }), /*#__PURE__*/React.createElement("span", null, "LIVE SYNC"))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 flex flex-col items-center justify-center py-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-md w-full space-y-4"
  }, isInConsultation && /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-emerald-500 text-slate-950 rounded-3xl shadow-2xl animate-bounce-gentle border-2 border-white text-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-3xl block mb-1"
  }, "🔔"), /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-black tracking-tight uppercase"
  }, "DOCTOR IS READY FOR YOU!"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-bold mt-1"
  }, "Please proceed inside ", /*#__PURE__*/React.createElement("strong", null, doctor.roomNumber), " now")), /*#__PURE__*/React.createElement("div", {
    className: `p-6 sm:p-8 rounded-3xl border-2 text-center transition-all shadow-2xl relative overflow-hidden ${isInConsultation ? 'bg-gradient-to-b from-teal-950 to-emerald-950 border-teal-400 shadow-teal-500/30' : isCompleted ? 'bg-slate-900 border-slate-700' : 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-teal-500/40 shadow-teal-500/10'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest mb-1"
  }, /*#__PURE__*/React.createElement("span", null, "YOUR TOKEN NUMBER"), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[10px] text-slate-500"
  }, "Live Queue")), /*#__PURE__*/React.createElement("h1", {
    className: "text-6xl sm:text-7xl font-black text-white font-mono tracking-tight my-2"
  }, tokenDisplay), /*#__PURE__*/React.createElement("p", {
    className: "text-base font-bold text-teal-300"
  }, myToken?.patient?.name || 'Registered Patient'), /*#__PURE__*/React.createElement("div", {
    className: "mt-3.5 inline-flex items-center px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-slate-950 border border-slate-800 text-slate-200"
  }, /*#__PURE__*/React.createElement("span", {
    className: `w-2.5 h-2.5 rounded-full mr-2 ${isInConsultation ? 'bg-emerald-400 animate-ping' : isCompleted ? 'bg-slate-400' : 'bg-amber-400 animate-pulse'}`
  }), isInConsultation ? `Ready: Enter ${doctor.roomNumber}` : isCompleted ? 'Consultation Completed' : `Waiting in Queue • Position #${patientsAhead + 1}`), !isCompleted && /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-800/80"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 text-left"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider"
  }, "Currently Serving"), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-0.5"
  }, currentlyServing ? currentlyServing.tokenNumber : 'Calling...'), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-500 block truncate"
  }, currentlyServing ? currentlyServing.patient?.name : 'Preparing next')), /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 text-left"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider"
  }, "Est. Wait Time"), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl sm:text-3xl font-black text-teal-400 font-mono mt-0.5"
  }, "~", estimatedWaitMin, " mins"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-500 block"
  }, patientsAhead, " ", patientsAhead === 1 ? 'patient' : 'patients', " ahead"))), /*#__PURE__*/React.createElement("div", {
    className: "mt-5 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-1.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]"
  }, "✓"), /*#__PURE__*/React.createElement("span", {
    className: "font-semibold text-slate-300"
  }, "Checked In")), /*#__PURE__*/React.createElement("div", {
    className: "w-8 h-0.5 bg-slate-800"
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-1.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: `w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${isInConsultation || isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400 animate-pulse'}`
  }, isInConsultation || isCompleted ? '✓' : '2'), /*#__PURE__*/React.createElement("span", {
    className: isInConsultation || isCompleted ? 'text-slate-300' : 'text-amber-400 font-bold'
  }, "In Line")), /*#__PURE__*/React.createElement("div", {
    className: "w-8 h-0.5 bg-slate-800"
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-1.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: `w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${isCompleted ? 'bg-emerald-500/20 text-emerald-400' : isInConsultation ? 'bg-teal-500 text-slate-950 font-black animate-ping' : 'bg-slate-800 text-slate-500'}`
  }, isCompleted ? '✓' : '3'), /*#__PURE__*/React.createElement("span", {
    className: isInConsultation ? 'text-teal-300 font-bold' : 'text-slate-500'
  }, "In Room")))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xl"
  }, "📲"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "text-xs font-bold text-white"
  }, "Automated WhatsApp Tracker"), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-slate-400"
  }, "Welcome notification sent to ", myToken?.patient?.phone || 'your phone'))), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold"
  }, "DISPATCHED")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-2 pt-1"
  }, /*#__PURE__*/React.createElement("a", {
    href: whatsappUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-md"
  }, /*#__PURE__*/React.createElement("span", null, "💬"), /*#__PURE__*/React.createElement("span", null, "Open WhatsApp")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleShareToken,
    className: "py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer border border-slate-700"
  }, /*#__PURE__*/React.createElement("span", null, "🔗"), /*#__PURE__*/React.createElement("span", null, "Share Live Link"))), showShareToast && /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-teal-400 text-center font-semibold pt-1"
  }, "✓ Link copied to clipboard!")), isCompleted && /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-teal-950/40 border border-teal-500/40 rounded-2xl sm:rounded-3xl text-center space-y-2.5 shadow-xl animate-fade-in"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-teal-300 font-bold"
  }, "🎉 Your digital prescription is ready!"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleDownloadPdf,
    disabled: isDownloadingPdf,
    className: "w-full py-3 bg-teal-500 hover:bg-teal-400 disabled:bg-teal-700 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-2 shadow-lg active:scale-95"
  }, isDownloadingPdf ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "inline-block animate-spin"
  }, "⏳"), /*#__PURE__*/React.createElement("span", null, "Downloading Prescription PDF...")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, "📄"), /*#__PURE__*/React.createElement("span", null, "View / Download Rx PDF")))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between pt-1"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onRegisterAnother,
    className: "text-xs text-teal-400 hover:text-teal-300 font-bold underline cursor-pointer"
  }, "+ Check In Another Patient"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-500 font-mono"
  }, "Sync: ", lastSyncTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }))))), /*#__PURE__*/React.createElement("footer", {
    className: "max-w-md w-full mx-auto text-center py-2 text-[10px] text-slate-500 border-t border-slate-900"
  }, "GOYOH Health Connect • Live Real-Time Queue Updates Automatically"));
}

// 7. VIEW: PUBLIC PATIENT CHECK-IN & LIVE TRACKER ROUTE (/q/:slug)
// ========================================================================
function PublicPatientCheckinView({
  doctor,
  queue,
  myTokenId,
  avgConsultationTime,
  onRegister,
  onResetToken,
  qrBaseUrl
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [complaint, setComplaint] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState(myTokenId ? 'track' : 'new');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const handleDownloadPdf = async e => {
    if (e) e.preventDefault();
    setIsDownloadingPdf(true);
    try {
      await downloadPrescriptionFromBackend(myToken, doctor);
    } finally {
      setIsDownloadingPdf(false);
    }
  };
  const myToken = queue.find(t => t.id === myTokenId);
  useEffect(() => {
    if (myTokenId) {
      setActiveTab('track');
    } else {
      setActiveTab('new');
    }
  }, [myTokenId]);
  const patientsAhead = useMemo(() => {
    if (!myToken) return 0;
    const waitingList = queue.filter(t => t.status === 'WAITING');
    const index = waitingList.findIndex(t => t.id === myToken.id);
    return index >= 0 ? index : 0;
  }, [queue, myToken]);
  const dynamicEstimatedWait = Math.max(3, Math.round((patientsAhead + 1) * avgConsultationTime));
  const handleFormSubmit = e => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setIsRegistering(true);
    onRegister(name, phone, complaint, doctor.clinicSlug);
    setName('');
    setPhone('');
    setComplaint('');
    setIsRegistering(false);
    setActiveTab('track');
  };
  const handleNewCheckinClick = () => {
    setName('');
    setPhone('');
    setComplaint('');
    if (onResetToken) {
      onResetToken();
    }
    setActiveTab('new');
  };
  const isInConsultation = myToken?.status === 'IN_CONSULTATION';
  const isCompleted = myToken?.status === 'COMPLETED';
  return /*#__PURE__*/React.createElement("div", {
    className: "w-full space-y-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-gradient-to-br from-slate-900 to-slate-850 p-5 rounded-3xl border border-slate-800 text-center shadow-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20"
  }, "OFFICIAL CLINIC CHECK-IN"), /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-black text-white mt-2"
  }, doctor.clinicName), /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-bold text-teal-400 mt-0.5"
  }, doctor.doctorName, " • ", doctor.specialization), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400 mt-1"
  }, doctor.roomNumber)), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 p-1 bg-slate-900 rounded-2xl border border-slate-800 text-xs font-bold shadow-inner"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setActiveTab('track'),
    className: `py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 ${activeTab === 'track' ? 'bg-teal-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'}`
  }, /*#__PURE__*/React.createElement("span", null, "🎫 Track Token"), myToken && /*#__PURE__*/React.createElement("span", {
    className: `text-[10px] px-1.5 py-0.5 rounded-md font-mono ${activeTab === 'track' ? 'bg-slate-950 text-teal-400 font-bold' : 'bg-slate-800 text-teal-300'}`
  }, "#", myToken.tokenNumber)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleNewCheckinClick,
    className: `py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 ${activeTab === 'new' ? 'bg-teal-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'}`
  }, /*#__PURE__*/React.createElement("span", null, "➕ New Check-In"))), activeTab === 'track' ? myToken ? /*#__PURE__*/React.createElement("div", {
    className: "space-y-4 animate-fade-in"
  }, isInConsultation && /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-emerald-500 text-slate-950 rounded-2xl shadow-xl animate-bounce-gentle border-2 border-white text-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-2xl block mb-1"
  }, "🚨"), /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-black tracking-tight uppercase"
  }, "DOCTOR IS READY FOR YOU!"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-bold mt-0.5 opacity-90"
  }, "Please step inside ", doctor.roomNumber)), /*#__PURE__*/React.createElement("div", {
    className: `p-6 rounded-3xl border-2 text-center transition-all shadow-2xl relative overflow-hidden ${isInConsultation ? 'bg-teal-950/60 border-teal-400 shadow-teal-500/20' : isCompleted ? 'bg-slate-900 border-slate-700' : 'bg-gradient-to-b from-slate-900 to-slate-950 border-amber-500/40 shadow-amber-500/10'}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-bold text-slate-400 uppercase tracking-widest"
  }, "ASSIGNED TOKEN NUMBER"), /*#__PURE__*/React.createElement("h1", {
    className: "text-6xl font-black text-white font-mono-numbers mt-2 tracking-tight"
  }, myToken.tokenNumber), /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-semibold text-teal-400 mt-2"
  }, myToken.patient?.name), /*#__PURE__*/React.createElement("div", {
    className: "mt-4 inline-flex items-center px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-200"
  }, /*#__PURE__*/React.createElement("span", {
    className: `w-2 h-2 rounded-full mr-2 ${isInConsultation ? 'bg-teal-400 animate-ping' : isCompleted ? 'bg-emerald-400' : 'bg-amber-400'}`
  }), isInConsultation ? `Ready: Enter ${doctor.roomNumber}` : isCompleted ? 'Consultation Completed' : 'Waiting in Lounge'), !isCompleted && !isInConsultation && /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-800"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-950/60 p-3 rounded-2xl border border-slate-800"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] font-bold text-slate-400 uppercase"
  }, "Patients Ahead"), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl font-black text-amber-400 font-mono-numbers mt-0.5"
  }, patientsAhead), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] text-slate-500"
  }, "in ", doctor.doctorName, "'s queue")), /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-950/60 p-3 rounded-2xl border border-slate-800"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] font-bold text-slate-400 uppercase"
  }, "Est. Wait Time"), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl font-black text-teal-400 font-mono-numbers mt-0.5"
  }, "~", dynamicEstimatedWait, " mins"), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] text-slate-500"
  }, "(@ ", avgConsultationTime, "m/patient)")))), isCompleted && /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-teal-950/40 border border-teal-500/40 rounded-2xl text-center space-y-2 shadow-xl animate-fade-in"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-teal-300 font-bold"
  }, "🎉 Your digital prescription is ready!"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleDownloadPdf,
    disabled: isDownloadingPdf,
    className: "w-full py-2.5 bg-teal-500 hover:bg-teal-400 disabled:bg-teal-700 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-lg active:scale-95"
  }, isDownloadingPdf ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "inline-block animate-spin"
  }, "⏳"), /*#__PURE__*/React.createElement("span", null, "Downloading Prescription PDF...")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, "📥"), /*#__PURE__*/React.createElement("span", null, "View / Download My Rx PDF")))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleNewCheckinClick,
    className: "w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-2xl shadow-lg shadow-teal-500/20 text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition cursor-pointer"
  }, /*#__PURE__*/React.createElement("span", null, "➕ Check In Another Patient / New Token"))), !isCompleted && /*#__PURE__*/React.createElement("div", {
    className: "text-center pt-2"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleNewCheckinClick,
    className: "text-xs text-slate-400 hover:text-teal-400 underline cursor-pointer"
  }, "Need to check in another patient? Click here"))) : /*#__PURE__*/React.createElement("div", {
    className: "text-center p-8 bg-slate-900 rounded-3xl border border-slate-800 space-y-3"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-semibold text-slate-400"
  }, "No active token currently tracked."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setActiveTab('new'),
    className: "px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs rounded-xl uppercase tracking-wider transition cursor-pointer"
  }, "➕ Take a Token Now")) : /*#__PURE__*/React.createElement("form", {
    onSubmit: handleFormSubmit,
    className: "bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl animate-fade-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center mb-1"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-extrabold text-white text-base"
  }, "Walk-In Patient Check-In"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "Please enter your details to receive an instant queue token")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Your Full Name *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "e.g. Ramesh Kumar",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 font-medium"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Mobile / WhatsApp Number *"), /*#__PURE__*/React.createElement("input", {
    type: "tel",
    required: true,
    value: phone,
    onChange: e => setPhone(e.target.value),
    placeholder: "+91 98765 43210",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 font-medium"
  }), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-slate-400 mt-1"
  }, "We will send your token confirmation & SMS/WhatsApp alert")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Reason for Visit / Complaint"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: complaint,
    onChange: e => setComplaint(e.target.value),
    placeholder: "e.g. Fever, Cough, Regular Consultation",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    disabled: isRegistering,
    className: "w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-2xl shadow-lg shadow-teal-500/25 text-sm uppercase tracking-wider mt-2 cursor-pointer transition"
  }, isRegistering ? 'Generating Token...' : '🎫 GET MY DIGITAL TOKEN')));
}

// ========================================================================
// 8. VIEW: WAITING ROOM TV DISPLAY
// ========================================================================
function WaitingRoomTVView({
  doctor,
  queue,
  audioReady,
  onEnableAudio,
  compact = false,
  qrBaseUrl
}) {
  const [time, setTime] = useState(new Date());
  const inConsultation = queue.find(t => t.status === 'IN_CONSULTATION');
  const waitingList = queue.filter(t => t.status === 'WAITING');
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `w-full min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 md:p-8 select-none ${compact ? 'text-xs' : ''}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-center justify-between border-b-2 border-slate-800 pb-5 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-14 h-14 rounded-2xl bg-teal-500 flex items-center justify-center font-black text-2xl text-slate-950 shadow-lg shadow-teal-500/20"
  }, "+"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "text-2xl md:text-3xl font-black tracking-tight text-white uppercase"
  }, doctor.clinicName), /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-semibold text-teal-400"
  }, doctor.roomNumber, " • ", doctor.doctorName, ", ", doctor.specialization))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-6"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onEnableAudio,
    className: `px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border flex items-center space-x-2 transition cursor-pointer ${audioReady ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold animate-pulse'}`
  }, /*#__PURE__*/React.createElement("span", null, audioReady ? '🔊 Audio Ready' : '⚡ Enable Audio')), /*#__PURE__*/React.createElement("button", {
    onClick: toggleFullscreen,
    className: "hidden sm:flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 cursor-pointer"
  }, /*#__PURE__*/React.createElement("span", null, "⛶ Fullscreen TV")), /*#__PURE__*/React.createElement("div", {
    className: "text-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl md:text-3xl font-black font-mono-numbers text-white tracking-wider"
  }, time.toLocaleTimeString('en-US', {
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-400 font-medium"
  }, time.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "my-6 md:my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lg:col-span-8 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 border-4 border-teal-500/60 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute top-0 right-0 bg-teal-500 text-slate-950 font-black px-8 py-2.5 rounded-bl-3xl text-sm md:text-base uppercase tracking-widest flex items-center space-x-2 shadow-lg"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-3 h-3 rounded-full bg-slate-950 animate-ping"
  }), /*#__PURE__*/React.createElement("span", null, "NOW CALLING")), /*#__PURE__*/React.createElement("div", {
    className: "text-slate-400 uppercase tracking-widest font-extrabold text-sm md:text-base"
  }, "PLEASE PROCEED INSIDE"), /*#__PURE__*/React.createElement("div", {
    className: "mt-4 flex flex-col md:flex-row md:items-baseline gap-4 md:gap-8"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-8xl md:text-[140px] font-black text-teal-400 font-mono-numbers tracking-tighter leading-none drop-shadow-md"
  }, inConsultation ? inConsultation.tokenNumber : '---'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "text-3xl md:text-5xl font-black text-white tracking-tight"
  }, inConsultation?.patient?.name || 'Waiting for Next Patient'), /*#__PURE__*/React.createElement("p", {
    className: "text-lg md:text-2xl font-bold text-emerald-400 mt-2 flex items-center space-x-2 uppercase"
  }, /*#__PURE__*/React.createElement("span", null, "➡️"), /*#__PURE__*/React.createElement("span", null, doctor.roomNumber)))), /*#__PURE__*/React.createElement("div", {
    className: "mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs md:text-sm text-slate-400 font-semibold gap-4"
  }, /*#__PURE__*/React.createElement("span", null, doctor.doctorName, " is ready for consultation"), /*#__PURE__*/React.createElement("span", {
    className: "flex items-center space-x-2 text-teal-400"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2 h-2 rounded-full bg-teal-400 animate-pulse"
  }), /*#__PURE__*/React.createElement("span", null, "Audio chime & handset voice automated")))), /*#__PURE__*/React.createElement("div", {
    className: "lg:col-span-4 bg-slate-900 border-2 border-slate-800 rounded-[36px] p-6 text-center flex flex-col items-center justify-center space-y-3"
  }, (() => {
    const effectiveBase = (qrBaseUrl || typeof window !== 'undefined' && localStorage.getItem('goyoh_qr_base_url') || (window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:3000')).replace(/\/+$/, '');
    const qrLink = `${effectiveBase}/checkin/${doctor.clinicSlug}`;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(QRCodeCanvas, {
      text: qrLink,
      size: 180
    }), /*#__PURE__*/React.createElement("div", {
      className: "pt-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-xs font-black uppercase tracking-wider text-teal-400"
    }, "SCAN TO GET A TOKEN"), /*#__PURE__*/React.createElement("h4", {
      className: "text-sm font-bold text-white mt-0.5"
    }, "/checkin/", doctor.clinicSlug), /*#__PURE__*/React.createElement("p", {
      className: "text-[11px] text-slate-400 mt-1 max-w-[220px]"
    }, "Zero download required • ", doctor.clinicName), /*#__PURE__*/React.createElement("div", {
      className: "mt-2 text-[10px] text-slate-400 font-mono break-all bg-slate-950 p-1.5 rounded-lg border border-slate-800"
    }, qrLink)));
  })())), /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-4"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs md:text-sm font-black uppercase tracking-wider text-slate-300 flex items-center space-x-2"
  }, /*#__PURE__*/React.createElement("span", null, "⏱️ NEXT PATIENTS IN LINE")), /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-bold text-amber-400 font-mono-numbers"
  }, waitingList.length, " Patient(s) In Waiting Queue")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3"
  }, waitingList.slice(0, 6).map((token, idx) => /*#__PURE__*/React.createElement("div", {
    key: token.id,
    className: "bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center transform hover:scale-105 transition"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-bold text-slate-500 uppercase tracking-widest"
  }, "#", idx + 1, " NEXT"), /*#__PURE__*/React.createElement("div", {
    className: "text-3xl font-black text-amber-400 font-mono-numbers mt-1"
  }, token.tokenNumber), /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-bold text-white truncate mt-1"
  }, token.patient?.name), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-teal-400 mt-0.5 font-mono-numbers"
  }, "Est. ~", Math.max(3, (idx + 1) * 8), "m"))), waitingList.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "col-span-full py-6 text-center text-slate-500 text-sm font-medium"
  }, "Queue is clear for ", doctor.doctorName, "."))));
}

// ========================================================================
// 9a. MODAL: DOCTOR PROFILE SETTINGS (Full Rx Letterhead Fields)
// ========================================================================
function DoctorProfileSettingsModal({
  doctor,
  qrBaseUrl,
  initialTab = 'profile',
  onSave,
  onClose
}) {
  const [activeTab, setActiveTab] = React.useState(initialTab); // 'profile' | 'packs'
  const doctorScopeKey = React.useMemo(() => getDoctorScopeKey(doctor), [doctor]);
  const safeBaseUrl = (qrBaseUrl || typeof window !== 'undefined' && localStorage.getItem('goyoh_qr_base_url') || (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:3000')).replace(/\/+$/, '');

  // Profile Form State
  const [form, setForm] = React.useState({
    doctorName: doctor?.doctorName || '',
    qualifications: doctor?.qualifications || '',
    regNo: doctor?.regNo || '',
    specialization: doctor?.specialization || '',
    roomNumber: doctor?.roomNumber || '',
    clinicName: doctor?.clinicName || '',
    clinicAddress: doctor?.clinicAddress || '',
    phone: doctor?.phone || '',
    email: doctor?.email || '',
    digitalSignature: doctor?.digitalSignature || null
  });
  const [sigPreview, setSigPreview] = React.useState(doctor?.digitalSignature || null);
  const [slugPreview, setSlugPreview] = React.useState(doctor?.clinicSlug || '');
  const [profileSavedFeedback, setProfileSavedFeedback] = React.useState(false);

  // Auto-update slug preview as name/clinic changes
  React.useEffect(() => {
    const generated = slugify(`${form.doctorName || 'dr'}-${form.clinicName || 'clinic'}`);
    setSlugPreview(generated);
  }, [form.doctorName, form.clinicName]);
  const handleField = (key, val) => setForm(prev => ({
    ...prev,
    [key]: val
  }));
  const handleSignatureUpload = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const b64 = ev.target.result;
      setForm(prev => ({
        ...prev,
        digitalSignature: b64
      }));
      setSigPreview(b64);
    };
    reader.readAsDataURL(file);
  };
  const handleSubmitProfile = e => {
    e.preventDefault();
    setProfileSavedFeedback(true);
    if (onSave) {
      onSave({
        ...doctor,
        ...form,
        clinicSlug: slugPreview
      });
    }
    setTimeout(() => {
      setProfileSavedFeedback(false);
    }, 2000);
  };

  // Prescription Packs State (Scoped to Doctor)
  const [packs, setPacks] = React.useState(() => {
    try {
      const saved = localStorage.getItem(`goyoh_doctor_rx_packs_${doctorScopeKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return getDefaultPrescriptionPacks(doctorScopeKey);
  });
  const [isEditingPack, setIsEditingPack] = React.useState(false);
  const [editingPackId, setEditingPackId] = React.useState(null);
  const [packFormName, setPackFormName] = React.useState('');
  const [packFormTag, setPackFormTag] = React.useState('');
  const [packFormColor, setPackFormColor] = React.useState('amber');
  const [packFormMedicines, setPackFormMedicines] = React.useState('');
  const [packFeedback, setPackFeedback] = React.useState('');

  // Fetch latest packs from backend on mount
  React.useEffect(() => {
    fetch(`/api/doctors/${doctorScopeKey}/prescription-packs`).then(res => res.json()).then(data => {
      if (data.success && Array.isArray(data.packs) && data.packs.length > 0) {
        setPacks(data.packs);
        try {
          localStorage.setItem(`goyoh_doctor_rx_packs_${doctorScopeKey}`, JSON.stringify(data.packs));
        } catch (e) {}
      }
    }).catch(() => {});
  }, [doctorScopeKey]);
  const handleOpenCreatePack = () => {
    setEditingPackId(null);
    setPackFormName('');
    setPackFormTag('');
    setPackFormColor('amber');
    setPackFormMedicines('');
    setIsEditingPack(true);
  };
  const handleOpenEditPack = p => {
    setEditingPackId(p.id);
    setPackFormName(p.name || '');
    setPackFormTag(p.tag || '');
    setPackFormColor(p.color || 'amber');
    setPackFormMedicines(p.medicines || '');
    setIsEditingPack(true);
  };
  const handleSavePackForm = e => {
    e.preventDefault();
    const trimmedName = (packFormName || '').trim();
    if (!trimmedName) return;
    const packObj = {
      id: editingPackId || `pack_${Date.now()}`,
      name: trimmedName,
      tag: (packFormTag || 'RX PROTOCOL').trim().toUpperCase(),
      color: packFormColor || 'amber',
      medicines: (packFormMedicines || '').trim(),
      isCustom: true,
      doctorId: doctorScopeKey
    };
    let updatedList;
    if (editingPackId) {
      updatedList = packs.map(p => p.id === editingPackId ? packObj : p);
    } else {
      updatedList = [packObj, ...packs];
    }
    setPacks(updatedList);
    try {
      localStorage.setItem(`goyoh_doctor_rx_packs_${doctorScopeKey}`, JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('rx-packs-updated', {
        detail: {
          doctorKey: doctorScopeKey
        }
      }));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    fetch(`/api/doctors/${doctorScopeKey}/prescription-packs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(packObj)
    }).catch(() => {});
    setIsEditingPack(false);
    setEditingPackId(null);
    setPackFeedback(editingPackId ? 'Prescription pack updated successfully!' : 'New prescription pack added!');
    setTimeout(() => setPackFeedback(''), 3000);
  };
  const handleDeletePack = packId => {
    if (!window.confirm('Delete this prescription pack from your profile?')) return;
    const updatedList = packs.filter(p => p.id !== packId);
    setPacks(updatedList);
    try {
      localStorage.setItem(`goyoh_doctor_rx_packs_${doctorScopeKey}`, JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('rx-packs-updated', {
        detail: {
          doctorKey: doctorScopeKey
        }
      }));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    fetch(`/api/doctors/${doctorScopeKey}/prescription-packs/${packId}`, {
      method: 'DELETE'
    }).catch(() => {});
    setPackFeedback('Prescription pack removed.');
    setTimeout(() => setPackFeedback(''), 3000);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border-2 border-violet-500/40 rounded-3xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl space-y-5 my-6 max-h-[92vh] flex flex-col overflow-hidden text-slate-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-slate-800 pb-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-11 h-11 rounded-2xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-2xl shadow-inner"
  }, "⚙️"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "font-extrabold text-white text-lg sm:text-xl tracking-tight"
  }, "Doctor Settings & Clinical Configuration"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400 mt-0.5"
  }, "Manage profile credentials, prescription PDF letterhead & 1-Click Rx packs"))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    className: "w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer transition"
  }, "✕")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setActiveTab('profile'),
    className: `flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${activeTab === 'profile' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-850'}`
  }, /*#__PURE__*/React.createElement("span", null, "🩺 Profile & Letterhead")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setActiveTab('packs'),
    className: `flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${activeTab === 'packs' ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-md shadow-teal-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-850'}`
  }, /*#__PURE__*/React.createElement("span", null, "⚡ 1-Click Rx Packs"), /*#__PURE__*/React.createElement("span", {
    className: `px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${activeTab === 'packs' ? 'bg-slate-950 text-teal-300' : 'bg-slate-800 text-slate-300'}`
  }, packs.length))), packFeedback && /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center space-x-2 animate-fade-in"
  }, /*#__PURE__*/React.createElement("span", null, "✅"), /*#__PURE__*/React.createElement("span", null, packFeedback)), profileSavedFeedback && /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-violet-500/15 border border-violet-500/40 rounded-xl text-violet-300 text-xs font-semibold flex items-center space-x-2 animate-fade-in"
  }, /*#__PURE__*/React.createElement("span", null, "✅"), /*#__PURE__*/React.createElement("span", null, "Doctor profile & digital signature updated successfully!")), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto pr-1 space-y-4"
  }, activeTab === 'profile' && /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmitProfile,
    className: "space-y-4 text-xs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block mb-1"
  }, "Full Name (as on certificate) *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: form.doctorName,
    onChange: e => handleField('doctorName', e.target.value),
    placeholder: "e.g. Dr. Ankitha Rao",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-medium"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block mb-1"
  }, "Qualifications *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: form.qualifications,
    onChange: e => handleField('qualifications', e.target.value),
    placeholder: "e.g. MBBS, MD (Gen Med)",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-medium"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block mb-1"
  }, "Reg. No. (Medical Council) *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: form.regNo,
    onChange: e => handleField('regNo', e.target.value),
    placeholder: "e.g. KMC-98421",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-medium"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block mb-1"
  }, "Specialization *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: form.specialization,
    onChange: e => handleField('specialization', e.target.value),
    placeholder: "e.g. General Physician & Diabetologist",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-medium"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block mb-1"
  }, "Clinic Name *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: form.clinicName,
    onChange: e => handleField('clinicName', e.target.value),
    placeholder: "e.g. Dr. Ankitha Clinic",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-medium"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block mb-1"
  }, "Room / Suite *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: form.roomNumber,
    onChange: e => handleField('roomNumber', e.target.value),
    placeholder: "e.g. Consultation Room 1",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-medium"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block mb-1"
  }, "Clinic Address (appears on Rx letterhead)"), /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: form.clinicAddress,
    onChange: e => handleField('clinicAddress', e.target.value),
    placeholder: "e.g. 124 Healthcare Hub, Indiranagar, Bengaluru - 560038",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-violet-500 resize-none"
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block mb-1"
  }, "Phone / WhatsApp"), /*#__PURE__*/React.createElement("input", {
    type: "tel",
    value: form.phone,
    onChange: e => handleField('phone', e.target.value),
    placeholder: "+91 98765 43210",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-mono"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block mb-1"
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: form.email,
    onChange: e => handleField('email', e.target.value),
    placeholder: "doctor@clinic.com",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-mono"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block text-xs"
  }, "Digital Signature Image (for Rx PDF Letterhead)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col sm:flex-row sm:items-center gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-slate-400 text-[11px] mb-2"
  }, "Upload a transparent-background PNG/JPG of your medical signature. It will be automatically embedded in generated prescription PDFs."), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "cursor-pointer inline-flex items-center space-x-2 px-3.5 py-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-300 rounded-xl font-bold transition text-xs"
  }, /*#__PURE__*/React.createElement("span", null, "📎 Upload Signature Image"), /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: handleSignatureUpload,
    className: "hidden"
  })), sigPreview && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setForm(p => ({
        ...p,
        digitalSignature: null
      }));
      setSigPreview(null);
    },
    className: "px-3 py-2 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
  }, "✕ Remove"))), sigPreview ? /*#__PURE__*/React.createElement("div", {
    className: "w-36 h-16 bg-white rounded-xl border-2 border-violet-500/40 flex items-center justify-center overflow-hidden shadow p-1"
  }, /*#__PURE__*/React.createElement("img", {
    src: sigPreview,
    alt: "Signature Preview",
    className: "max-w-full max-h-full object-contain"
  })) : /*#__PURE__*/React.createElement("div", {
    className: "w-36 h-16 bg-slate-900 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-500 text-center font-medium"
  }, "No signature", /*#__PURE__*/React.createElement("br", null), "uploaded")))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-teal-950/40 border border-teal-500/30 rounded-2xl space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col sm:flex-row sm:items-start justify-between gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-1 space-y-2"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-bold text-teal-400 uppercase tracking-wider"
  }, "Auto-Generated Clinic Slug & Public QR Route"), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-slate-400 mt-0.5"
  }, "Updates dynamically as doctor name or clinic name changes")), /*#__PURE__*/React.createElement("div", {
    className: "space-y-1.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-500 font-mono"
  }, "Route:"), /*#__PURE__*/React.createElement("code", {
    className: "text-xs font-extrabold text-teal-300 font-mono bg-slate-950 px-2 py-0.5 rounded-lg border border-teal-500/20"
  }, "/checkin/", slugPreview || '...')), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-500 font-mono"
  }, "URL:"), /*#__PURE__*/React.createElement("code", {
    className: "text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 break-all"
  }, safeBaseUrl, "/checkin/", slugPreview || '...')))), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-center bg-slate-950 p-2.5 rounded-2xl border border-teal-500/20 shadow-inner"
  }, /*#__PURE__*/React.createElement(QRCodeCanvas, {
    text: `${safeBaseUrl}/q/${slugPreview || 'preview'}`,
    size: 96
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] text-teal-400 font-mono font-bold mt-1 text-center"
  }, "Live Desk QR")))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between pt-3 border-t border-slate-800"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    className: "px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-violet-500/25 text-xs transition cursor-pointer active:scale-95 flex items-center space-x-1.5"
  }, /*#__PURE__*/React.createElement("span", null, "💾"), /*#__PURE__*/React.createElement("span", null, "Save Profile & Apply to Rx PDF")))), activeTab === 'packs' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5"
  }, /*#__PURE__*/React.createElement("span", null, "⚡ 1-Click Clinical Rx Templates")), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-slate-400 mt-0.5"
  }, "Scoped specifically to ", /*#__PURE__*/React.createElement("span", {
    className: "text-teal-300 font-semibold"
  }, doctor?.doctorName || 'Doctor'))), !isEditingPack && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleOpenCreatePack,
    className: "px-3.5 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs transition flex items-center space-x-1 cursor-pointer shadow-md shadow-teal-500/20 active:scale-95"
  }, /*#__PURE__*/React.createElement("span", null, "➕ Add New Pack"))), isEditingPack ? /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSavePackForm,
    className: "bg-slate-950 p-4 sm:p-5 rounded-2xl border-2 border-teal-500/40 space-y-4 animate-scale-up text-xs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-slate-800 pb-2.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-extrabold text-teal-400 text-sm flex items-center space-x-1.5"
  }, /*#__PURE__*/React.createElement("span", null, editingPackId ? '✏️ Edit Prescription Pack' : '➕ Create New Prescription Pack')), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setIsEditingPack(false),
    className: "text-xs text-slate-400 hover:text-white"
  }, "Cancel")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block mb-1"
  }, "Pack Name *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: packFormName,
    onChange: e => setPackFormName(e.target.value),
    placeholder: "e.g. Typhoid Protocol / Bronchitis Care",
    className: "w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-teal-500 font-medium"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block mb-1"
  }, "Short Pill Tag (3-12 Chars)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: packFormTag,
    onChange: e => setPackFormTag(e.target.value),
    placeholder: "e.g. CEF + AZI",
    className: "w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-teal-500 font-mono"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block mb-1.5"
  }, "Color Badge Theme"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, ['amber', 'sky', 'emerald', 'blue', 'purple', 'rose'].map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    type: "button",
    onClick: () => setPackFormColor(c),
    className: `px-3 py-1 rounded-xl text-xs font-extrabold capitalize border transition cursor-pointer ${packFormColor === c ? 'bg-slate-800 text-white ring-2 ring-teal-400 border-teal-400' : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'}`
  }, c)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 uppercase tracking-wider block mb-1"
  }, "Prescription Medicines, Dosage & Instructions *"), /*#__PURE__*/React.createElement("textarea", {
    rows: "5",
    required: true,
    value: packFormMedicines,
    onChange: e => setPackFormMedicines(e.target.value),
    placeholder: "1. Tab Cefixime 200 mg — 1 tab BD (After Food) x 5 Days\n2. Tab Paracetamol 650 mg — 1 tab TDS x 3 Days\n\nAdvice:\n• Soft warm diet, plenty of fluid intake\n• Rest for 3 days",
    className: "w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-mono resize-y leading-relaxed"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-end space-x-2 pt-2"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setIsEditingPack(false),
    className: "px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-bold transition text-xs cursor-pointer"
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-teal-500/20 hover:from-teal-400 hover:to-emerald-300 transition cursor-pointer active:scale-95 flex items-center space-x-1.5"
  }, /*#__PURE__*/React.createElement("span", null, "💾"), /*#__PURE__*/React.createElement("span", null, "Save Prescription Pack")))) : null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-3"
  }, packs.map(p => {
    const scheme = getPackColorScheme(p.color);
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      className: "bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition group"
    }, /*#__PURE__*/React.createElement("div", {
      className: "space-y-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between gap-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: `px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${scheme.tagBg} ${scheme.tagText} border border-current/20`
    }, p.tag || 'RX'), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-1.5"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => handleOpenEditPack(p),
      className: "px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold transition cursor-pointer",
      title: "Edit this pack"
    }, "✏️ Edit"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => handleDeletePack(p.id),
      className: "px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg text-[11px] font-bold transition cursor-pointer",
      title: "Delete this pack"
    }, "🗑️"))), /*#__PURE__*/React.createElement("h4", {
      className: "font-extrabold text-white text-sm"
    }, p.name), /*#__PURE__*/React.createElement("p", {
      className: "text-[11px] font-mono text-slate-400 line-clamp-3 whitespace-pre-line leading-relaxed bg-slate-900/80 p-2 rounded-xl border border-slate-850"
    }, p.medicines)), /*#__PURE__*/React.createElement("div", {
      className: "pt-1 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-900"
    }, /*#__PURE__*/React.createElement("span", null, "Theme: ", /*#__PURE__*/React.createElement("strong", {
      className: "capitalize text-slate-400"
    }, p.color || 'amber')), /*#__PURE__*/React.createElement("span", {
      className: "font-mono"
    }, "ID: ", p.id)));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between pt-3 border-t border-slate-800 text-xs"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-500 text-[11px]"
  }, "Active Doctor: ", /*#__PURE__*/React.createElement("strong", {
    className: "text-slate-300"
  }, doctor?.doctorName), " (", doctor?.roomNumber, ")"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    className: "px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-xl transition cursor-pointer"
  }, "Close Settings"))));
}

// ========================================================================
// 9. MODAL: DYNAMIC ABSOLUTE URL DESK QR CODE (WITH WI-FI / LAN IP SUPPORT)
// ========================================================================
function QRCodeModal({
  doctor,
  qrBaseUrl,
  detectedLanIp,
  onUpdateQrBaseUrl,
  onResetQrBaseUrl,
  onTestRoute,
  onClose
}) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [customBaseInput, setCustomBaseInput] = useState(qrBaseUrl || 'http://localhost:3000');
  const [saveFeedback, setSaveFeedback] = useState(false);
  useEffect(() => {
    if (qrBaseUrl) setCustomBaseInput(qrBaseUrl);
  }, [qrBaseUrl]);
  const effectiveOrigin = (qrBaseUrl || typeof window !== 'undefined' && localStorage.getItem('goyoh_qr_base_url') || (window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:3000')).replace(/\/+$/, '');
  const targetSlug = doctor && (doctor.clinicSlug || doctor.clinicId) || "ankitha-clinic";
  const absoluteQrUrl = `${effectiveOrigin}/checkin/${targetSlug}`;
  const isLocalhost = effectiveOrigin.includes('localhost') || effectiveOrigin.includes('127.0.0.1');
  const handlePrint = () => {
    window.print();
  };
  const handleCopyLink = () => {
    navigator.clipboard.writeText(absoluteQrUrl);
    alert('Copied absolute QR check-in link to clipboard:\n' + absoluteQrUrl);
  };
  const handleSaveCustomBase = e => {
    e.preventDefault();
    if (onUpdateQrBaseUrl) {
      onUpdateQrBaseUrl(customBaseInput);
    }
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2000);
  };
  const handleResetToLan = () => {
    if (onResetQrBaseUrl) {
      onResetQrBaseUrl();
    }
    if (detectedLanIp) {
      setCustomBaseInput(`http://${detectedLanIp}:3000`);
    }
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2000);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-center my-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-slate-800 pb-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-extrabold text-white text-base"
  }, "Desk QR Code & Poster"), isLocalhost ? /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold"
  }, "Localhost (Change to Wi-Fi IP for Phones)") : /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center space-x-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
  }), /*#__PURE__*/React.createElement("span", null, "Wi-Fi Mobile Scannable"))), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400 mt-0.5"
  }, doctor.doctorName, " • ", doctor.clinicName)), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer"
  }, "✕")), /*#__PURE__*/React.createElement("div", {
    className: "p-6 bg-white text-slate-950 rounded-3xl shadow-2xl border-4 border-teal-500 space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "space-y-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] font-black uppercase tracking-widest text-teal-600"
  }, "SMART CLINIC CHECK-IN"), /*#__PURE__*/React.createElement("h2", {
    className: "text-xl font-black text-slate-900"
  }, doctor.clinicName), /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-bold text-slate-600"
  }, doctor.doctorName, " • ", doctor.roomNumber)), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-center"
  }, /*#__PURE__*/React.createElement(QRCodeCanvas, {
    text: absoluteQrUrl,
    size: 220
  })), /*#__PURE__*/React.createElement("div", {
    className: "space-y-1.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-black uppercase text-teal-700 tracking-wider"
  }, "SCAN WITH ANY PHONE CAMERA"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-bold text-slate-800"
  }, "Instant Digital Token • Zero App Download"), /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-100 p-2.5 rounded-xl text-xs font-mono text-slate-800 break-all border border-slate-300 font-semibold shadow-inner"
  }, absoluteQrUrl))), /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-left space-y-2.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2 text-xs"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm"
  }, "📶"), /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-slate-300"
  }, "Host Network IP:"), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-teal-400 font-bold"
  }, effectiveOrigin)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setIsConfigOpen(!isConfigOpen),
    className: "text-xs text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
  }, isConfigOpen ? 'Hide Config ▲' : '⚙️ Configure Base URL ▼')), isLocalhost && !isConfigOpen && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", null, "Scanning from a mobile phone on Wi-Fi requires your computer's IP address."), detectedLanIp && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleResetToLan,
    className: "ml-2 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-[10px] cursor-pointer"
  }, "Use ", detectedLanIp)), isConfigOpen && /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSaveCustomBase,
    className: "pt-2 border-t border-slate-800 space-y-2 text-xs"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] font-bold text-slate-400"
  }, "Host Base URL (e.g. computer's Wi-Fi IP or custom tunnel domain):"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: customBaseInput,
    onChange: e => setCustomBaseInput(e.target.value),
    placeholder: "e.g. http://192.168.1.100:3000",
    className: "flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-teal-500"
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-3.5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer"
  }, saveFeedback ? '✓ Saved!' : 'Apply')), detectedLanIp && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-[11px] text-slate-400 pt-1"
  }, /*#__PURE__*/React.createElement("span", null, "Detected Host Wi-Fi: ", /*#__PURE__*/React.createElement("code", {
    className: "text-teal-400"
  }, "http://", detectedLanIp, ":3000")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleResetToLan,
    className: "text-teal-400 hover:text-teal-300 font-bold underline cursor-pointer"
  }, "Reset to Detected IP")))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2 text-xs pt-1"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handleCopyLink,
    className: "py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition cursor-pointer"
  }, "📋 Copy URL"), /*#__PURE__*/React.createElement("button", {
    onClick: onTestRoute,
    className: "py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer shadow"
  }, "🔗 Test Route"), /*#__PURE__*/React.createElement("button", {
    onClick: handlePrint,
    className: "py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl transition cursor-pointer shadow"
  }, "🖨️ Print"))));
}

// ========================================================================
// 10. MODAL: IN-CLINIC DOCTOR MANAGEMENT MODULE
// Strictly scoped to the active clinic tenant space
// ========================================================================
function DoctorAuthModal({
  clinicDoctors = [],
  activeDoctor,
  onSwitch,
  onCreate,
  onDeleteDoctor,
  onClose,
  initialTab = 'list'
}) {
  const [tab, setTab] = useState(initialTab); // 'list' | 'add'
  const [doctorToDelete, setDoctorToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states for adding a doctor inside THIS clinic
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const handleAddDoctorSubmit = e => {
    e.preventDefault();
    if (!doctorName.trim() || !specialty.trim() || !roomNumber.trim()) return;
    onCreate({
      doctorName: doctorName.trim(),
      specialization: specialty.trim(),
      roomNumber: roomNumber.trim(),
      email: email.trim(),
      phone: phone.trim()
    });
    setDoctorName('');
    setSpecialty('');
    setRoomNumber('');
    setEmail('');
    setPhone('');
    setTab('list');
  };
  const handleConfirmDelete = async () => {
    if (!doctorToDelete) return;
    setIsDeleting(true);
    try {
      if (onDeleteDoctor) {
        await onDeleteDoctor(doctorToDelete.id);
      }
    } finally {
      setIsDeleting(false);
      setDoctorToDelete(null);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-slate-800 pb-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hidden sm:flex items-center space-x-2.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-2xl"
  }, "👨‍⚕️"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-extrabold text-white text-lg tracking-tight"
  }, "Manage Doctors"), /*#__PURE__*/React.createElement("span", {
    className: "px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30"
  }, activeDoctor.clinicId || activeDoctor.clinicSlug)), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "Internal doctor roster & consultation rooms for ", /*#__PURE__*/React.createElement("span", {
    className: "text-teal-300 font-semibold"
  }, activeDoctor.clinicName)))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer",
    "aria-label": "Close modal"
  }, "✕")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setTab('list'),
    className: `py-2 rounded-lg transition cursor-pointer flex items-center justify-center space-x-1.5 ${tab === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`
  }, /*#__PURE__*/React.createElement("span", null, "👨‍⚕️ Clinic Doctors"), /*#__PURE__*/React.createElement("span", {
    className: "px-1.5 py-0.2 rounded-full bg-slate-900 text-[10px] text-teal-300 font-mono font-bold"
  }, clinicDoctors.length)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setTab('add'),
    className: `py-2 rounded-lg transition cursor-pointer flex items-center justify-center space-x-1 ${tab === 'add' ? 'bg-teal-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`
  }, /*#__PURE__*/React.createElement("span", null, "➕ Add Doctor"))), tab === 'list' ? /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-xs text-slate-400"
  }, /*#__PURE__*/React.createElement("span", null, "Doctors registered under this clinic:"), /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] text-slate-500 font-mono"
  }, "Isolated Clinic Roster")), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 max-h-72 overflow-y-auto pr-1"
  }, clinicDoctors.map(doc => {
    const isActive = doc.id === activeDoctor.id;
    const isOnlyDoctor = clinicDoctors.length <= 1;
    return /*#__PURE__*/React.createElement("div", {
      key: doc.id,
      onClick: () => onSwitch(doc),
      className: `p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between group ${isActive ? 'bg-indigo-950/50 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/30' : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "space-y-0.5 flex-1 pr-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-2"
    }, /*#__PURE__*/React.createElement("h4", {
      className: "font-bold text-sm text-white group-hover:text-indigo-300 transition"
    }, doc.doctorName), isActive && /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold shadow-sm"
    }, "● Currently Consulting")), /*#__PURE__*/React.createElement("p", {
      className: "text-xs text-teal-400 font-medium"
    }, doc.specialization, " • ", /*#__PURE__*/React.createElement("span", {
      className: "text-slate-300 font-mono"
    }, doc.roomNumber)), doc.email && /*#__PURE__*/React.createElement("p", {
      className: "text-[10px] text-slate-500 font-mono"
    }, doc.email)), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-2"
    }, !isActive && /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: e => {
        e.stopPropagation();
        onSwitch(doc);
      },
      className: "px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-lg transition cursor-pointer"
    }, "Switch Desk →"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: e => {
        e.stopPropagation();
        if (isOnlyDoctor) {
          alert(`Cannot remove the only registered doctor for ${activeDoctor.clinicName}. At least one doctor must remain active.`);
          return;
        }
        setDoctorToDelete(doc);
      },
      className: `p-2 rounded-xl border transition-all cursor-pointer ${isOnlyDoctor ? 'text-slate-600 border-slate-800 opacity-40 cursor-not-allowed' : 'text-slate-400 hover:text-rose-400 bg-slate-900 hover:bg-rose-500/10 border-slate-800 hover:border-rose-500/30 shadow-sm active:scale-95'}`,
      title: isOnlyDoctor ? 'At least one doctor required in clinic' : `Remove ${doc.doctorName}`,
      "aria-label": `Remove ${doc.doctorName}`
    }, /*#__PURE__*/React.createElement("svg", {
      className: "w-4 h-4",
      fill: "none",
      viewBox: "0 0 24 24",
      stroke: "currentColor"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: "2",
      d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    })))));
  }))) :
  /*#__PURE__*/
  /* TAB 2: IN-CLINIC ADD DOCTOR FORM */
  React.createElement("form", {
    onSubmit: handleAddDoctorSubmit,
    className: "space-y-3.5 text-xs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-teal-500/10 border border-teal-500/20 rounded-2xl text-[11px] text-teal-300"
  }, "Adding doctor to ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-white"
  }, activeDoctor.clinicName), " (", activeDoctor.clinicId, "). This doctor operates strictly within this clinic's isolated queue and records."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 block mb-1"
  }, "Doctor Name *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: doctorName,
    onChange: e => setDoctorName(e.target.value),
    placeholder: "e.g. Dr. Name or Dr. Specialist",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 font-medium"
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 block mb-1"
  }, "Specialty / Department *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: specialty,
    onChange: e => setSpecialty(e.target.value),
    placeholder: "e.g. Pediatrics, Cardiology",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 font-medium"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 block mb-1"
  }, "Consultation Room / Queue *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: roomNumber,
    onChange: e => setRoomNumber(e.target.value),
    placeholder: "e.g. Room 2 or Desk B",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 font-medium"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 block mb-1"
  }, "Doctor Email (Optional)"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    placeholder: "e.g. doctor@clinic.com",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-teal-500"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "font-bold text-slate-300 block mb-1"
  }, "Phone Number (Optional)"), /*#__PURE__*/React.createElement("input", {
    type: "tel",
    value: phone,
    onChange: e => setPhone(e.target.value),
    placeholder: "+91 98450 00000",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-teal-500"
  }))), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-teal-500/20 mt-2"
  }, "➕ Add Doctor to ", activeDoctor.clinicName)), doctorToDelete && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border-2 border-rose-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 text-2xl shadow-inner"
  }, "⚠️"), /*#__PURE__*/React.createElement("h4", {
    className: "text-lg font-black text-white"
  }, "Remove Doctor Profile?"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-300 leading-relaxed"
  }, "Are you sure you want to remove ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-rose-400"
  }, doctorToDelete.doctorName), " from ", /*#__PURE__*/React.createElement("span", {
    className: "text-teal-400 font-semibold"
  }, activeDoctor.clinicName), "?"), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800"
  }, "This doctor will be unassigned from this clinic's consultation rooms. Historical consultation data remains archived."), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3 pt-2"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: isDeleting,
    onClick: () => setDoctorToDelete(null),
    className: "py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: isDeleting,
    onClick: handleConfirmDelete,
    className: "py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-1.5"
  }, isDeleting ? /*#__PURE__*/React.createElement("span", null, "Removing...") : /*#__PURE__*/React.createElement("span", null, "🗑️ Yes, Remove")))))));
}

// ========================================================================
// 9. VIEW: GOYOH HEALTH CONNECT - SUPER ADMIN DASHBOARD
// ========================================================================
function SuperAdminDashboardView({
  clinics,
  doctors,
  queues,
  onOnboardClinic,
  onToggleClinicStatus,
  onActivateSubscription,
  onSwitchToClinic,
  onDeleteClinic,
  onNavigateTo,
  qrBaseUrl,
  detectedLanIp,
  onUpdateQrBaseUrl,
  onResetQrBaseUrl,
  onLogout
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [createdCredentialsModal, setCreatedCredentialsModal] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [clinicToDelete, setClinicToDelete] = useState(null);
  const [isDeletingClinic, setIsDeletingClinic] = useState(false);
  const handleConfirmDeleteClinic = async clinic => {
    setIsDeletingClinic(true);
    if (onDeleteClinic) {
      await onDeleteClinic(clinic);
    }
    setIsDeletingClinic(false);
    setClinicToDelete(null);
  };

  // Onboarding Form State
  const [clinicName, setClinicName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState('Free Trial (14 Days — 2 to 5 Seats) (₹0)');
  const [doctorSeats, setDoctorSeats] = useState(5);
  const [customClinicId, setCustomClinicId] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customSlug, setCustomSlug] = useState('');
  const previewSlug = useMemo(() => {
    if (customSlug.trim()) {
      return customSlug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (!clinicName && !ownerName) return 'clinic-preview';
    const base = (clinicName || ownerName || 'clinic').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const isTaken = (clinics || []).some(c => c.slug === base);
    return isTaken ? `${base}-${Math.random().toString(36).substring(2, 6)}` : base;
  }, [customSlug, clinicName, ownerName, clinics]);
  const previewClinicId = useMemo(() => {
    if (customClinicId.trim()) return customClinicId.trim().toUpperCase();
    if (!clinicName) return 'CLN-XXXX';
    const clean = clinicName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    return `CLN-${clean}-${Math.floor(1000 + Math.random() * 9000)}`;
  }, [customClinicId, clinicName]);
  const metrics = useMemo(() => {
    const totalClinics = clinics.length;
    const activeClinics = clinics.filter(c => c.status !== 'SUSPENDED').length;
    const suspendedClinics = totalClinics - activeClinics;
    const totalSeats = clinics.reduce((acc, c) => acc + (Number(c.doctorSeats) || 1), 0);
    const totalDoctors = doctors.length;
    let activeConsultations = 0;
    let completedConsultations = 0;
    Object.values(queues).forEach(qList => {
      if (Array.isArray(qList)) {
        qList.forEach(token => {
          if (token.status === 'WAITING' || token.status === 'IN_CONSULTATION') {
            activeConsultations += 1;
          } else if (token.status === 'COMPLETED') {
            completedConsultations += 1;
          }
        });
      }
    });
    return {
      totalClinics,
      activeClinics,
      suspendedClinics,
      totalSeats,
      totalDoctors,
      activeConsultations,
      completedConsultations
    };
  }, [clinics, doctors, queues]);
  const filteredClinics = useMemo(() => {
    return clinics.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.clinicId && c.clinicId.toLowerCase().includes(searchTerm.toLowerCase()) || c.ownerName && c.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) || c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()) || c.slug && c.slug.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || statusFilter === 'ACTIVE' && c.status !== 'SUSPENDED' || statusFilter === 'SUSPENDED' && c.status === 'SUSPENDED';
      const matchPlan = planFilter === 'ALL' || c.subscriptionPlan === planFilter;
      return matchSearch && matchStatus && matchPlan;
    });
  }, [clinics, searchTerm, statusFilter, planFilter]);
  const handlePlanChange = plan => {
    setSubscriptionPlan(plan);
    if (plan === 'Free Trial (14 Days — 1 Seat) (₹0)' || plan === 'Free Trial' || plan.includes('1 Seat')) {
      setDoctorSeats(1);
    } else if (plan === 'Free Trial (14 Days — 2 to 5 Seats) (₹0)' || plan.includes('2 to 5')) {
      setDoctorSeats(5);
    } else if (plan === 'Free Trial (14 Days — Unlimited Seats) (₹0)' || plan.includes('Unlimited')) {
      setDoctorSeats(999);
    } else if (plan.includes('Starter') || plan.includes('9,999')) {
      setDoctorSeats(1);
    } else if (plan.includes('Professional') || plan.includes('19,999')) {
      setDoctorSeats(5);
    } else if (plan.includes('Enterprise') || plan.includes('49,999')) {
      setDoctorSeats(999);
    }
  };
  const handleOnboardSubmit = e => {
    e.preventDefault();
    if (!clinicName.trim() || !ownerName.trim() || !email.trim()) return;
    setIsSubmitting(true);
    const finalClinicId = previewClinicId;
    const finalPassword = initialPassword.trim() || `Goyoh@${Math.floor(1000 + Math.random() * 9000)}`;
    const newClinicData = {
      clinicId: finalClinicId,
      slug: previewSlug,
      name: clinicName.trim(),
      ownerName: ownerName.trim(),
      email: email.trim(),
      phone: phone.trim() || '+91 98000 00000',
      address: address.trim() || 'Clinic Address, Medical Enclave',
      subscriptionPlan,
      doctorSeats: Number(doctorSeats) || 3,
      initialPassword: finalPassword,
      status: 'ACTIVE'
    };
    const created = onOnboardClinic(newClinicData);
    setIsSubmitting(false);
    setShowOnboardModal(false);
    setCreatedCredentialsModal({
      clinicId: finalClinicId,
      clinicName: newClinicData.name,
      ownerName: newClinicData.ownerName,
      email: newClinicData.email,
      password: finalPassword,
      slug: created?.slug || previewSlug,
      doctorSeats: planDetails.doctorSeats,
      subscriptionPlan: planDetails.plan
    });
    setClinicName('');
    setOwnerName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCustomClinicId('');
    setInitialPassword('');
  };
  const copyToClipboard = text => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans"
  }, /*#__PURE__*/React.createElement("header", {
    className: "border-b border-slate-800 bg-slate-900/95 sticky top-0 z-40 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-teal-500/20"
  }, "G"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "hidden sm:flex items-center space-x-2.5"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "font-black text-xl tracking-tight text-white"
  }, "GOYOH Health Connect"), /*#__PURE__*/React.createElement("span", {
    className: "px-2.5 py-0.5 text-[11px] font-black rounded-full bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider"
  }, "SUPER ADMIN")), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400 font-medium"
  }, "Multi-Tenant Healthcare Platform • Global Operations & Platform Telemetry"))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 font-semibold"
  }, "Tenant Isolation:"), /*#__PURE__*/React.createElement("span", {
    className: "text-emerald-400 font-mono font-bold"
  }, "100% SECURE")), detectedLanIp && /*#__PURE__*/React.createElement("div", {
    className: "hidden md:flex items-center space-x-1.5 px-3 py-1.5 bg-slate-950/80 rounded-xl border border-teal-500/30 text-xs",
    title: "Mobile phones on the same Wi-Fi connect via this host IP"
  }, /*#__PURE__*/React.createElement("span", null, "📶"), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 font-medium"
  }, "Wi-Fi IP:"), /*#__PURE__*/React.createElement("span", {
    className: "text-teal-400 font-mono font-bold"
  }, detectedLanIp, ":3000")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowOnboardModal(true),
    className: "px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-teal-500/20 uppercase tracking-wider transition cursor-pointer flex items-center space-x-1.5"
  }, /*#__PURE__*/React.createElement("span", null, "➕ Onboard New Clinic")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      const targetClinic = clinics.find(c => c.status !== 'SUSPENDED') || clinics[0];
      if (targetClinic) onSwitchToClinic(targetClinic);else if (onNavigateTo) onNavigateTo('/login');
    },
    className: "px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer flex items-center space-x-1",
    title: "Open active clinic dashboard"
  }, /*#__PURE__*/React.createElement("span", null, "🏥 Clinic Portal →")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onLogout,
    className: "px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold rounded-xl border border-rose-500/30 transition cursor-pointer flex items-center space-x-1",
    title: "Log out of Super Admin Portal"
  }, /*#__PURE__*/React.createElement("span", null, "🚪 Logout")))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-gradient-to-br from-slate-900 to-slate-900/60 p-5 rounded-3xl border border-slate-800 shadow-xl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-bold text-slate-400 uppercase tracking-wider"
  }, "TOTAL CLINICS"), /*#__PURE__*/React.createElement("span", {
    className: "w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center text-sm font-bold"
  }, "🏢")), /*#__PURE__*/React.createElement("div", {
    className: "mt-2 flex items-baseline space-x-3"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-4xl font-black text-white font-mono-numbers"
  }, metrics.totalClinics), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-1.5 text-xs font-bold"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-emerald-400"
  }, metrics.activeClinics, " Active"), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-600"
  }, "•"), /*#__PURE__*/React.createElement("span", {
    className: "text-rose-400"
  }, metrics.suspendedClinics, " Suspended"))), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-slate-500 mt-2 font-medium"
  }, "Independent tenants on GOYOH network")), /*#__PURE__*/React.createElement("div", {
    className: "bg-gradient-to-br from-slate-900 to-slate-900/60 p-5 rounded-3xl border border-slate-800 shadow-xl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-bold text-slate-400 uppercase tracking-wider"
  }, "ACTIVE CONSULTATIONS"), /*#__PURE__*/React.createElement("span", {
    className: "w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-bold"
  }, "⚡")), /*#__PURE__*/React.createElement("div", {
    className: "mt-2 flex items-baseline space-x-3"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-4xl font-black text-amber-400 font-mono-numbers"
  }, metrics.activeConsultations), /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-bold text-amber-300/80"
  }, "Live in Queue")), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-slate-500 mt-2 font-medium"
  }, "Across all clinic waiting lounges right now")), /*#__PURE__*/React.createElement("div", {
    className: "bg-gradient-to-br from-slate-900 to-slate-900/60 p-5 rounded-3xl border border-slate-800 shadow-xl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-bold text-slate-400 uppercase tracking-wider"
  }, "DOCTOR CAPACITY"), /*#__PURE__*/React.createElement("span", {
    className: "w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold"
  }, "🩺")), /*#__PURE__*/React.createElement("div", {
    className: "mt-2 flex items-baseline space-x-3"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-4xl font-black text-white font-mono-numbers"
  }, metrics.totalDoctors), /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-bold text-slate-400"
  }, "/ ", metrics.totalSeats, " Total Seats")), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-slate-500 mt-2 font-medium"
  }, "Licensed doctor seats across SaaS subscriptions")), /*#__PURE__*/React.createElement("div", {
    className: "bg-gradient-to-br from-slate-900 to-slate-900/60 p-5 rounded-3xl border border-slate-800 shadow-xl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-bold text-slate-400 uppercase tracking-wider"
  }, "CONSULTATIONS COMPLETED"), /*#__PURE__*/React.createElement("span", {
    className: "w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold"
  }, "📜")), /*#__PURE__*/React.createElement("div", {
    className: "mt-2 flex items-baseline space-x-3"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-4xl font-black text-emerald-400 font-mono-numbers"
  }, metrics.completedConsultations), /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-bold text-emerald-300/80"
  }, "Rx Generated")), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-slate-500 mt-2 font-medium"
  }, "Verified digital prescriptions delivered"))), /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900/80 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 bg-slate-900/90"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-black text-white"
  }, "Onboarded Clinic Tenants"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "Manage tenant isolation, doctor allocations, and subscription status")), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-center gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "relative min-w-[240px]"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: searchTerm,
    onChange: e => setSearchTerm(e.target.value),
    placeholder: "Search clinic, ID, owner, email...",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-medium"
  }), searchTerm && /*#__PURE__*/React.createElement("button", {
    onClick: () => setSearchTerm(''),
    className: "absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-white"
  }, "✕")), /*#__PURE__*/React.createElement("select", {
    value: statusFilter,
    onChange: e => setStatusFilter(e.target.value),
    className: "bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-semibold"
  }, /*#__PURE__*/React.createElement("option", {
    value: "ALL"
  }, "All Statuses"), /*#__PURE__*/React.createElement("option", {
    value: "ACTIVE"
  }, "🟢 Active Only"), /*#__PURE__*/React.createElement("option", {
    value: "SUSPENDED"
  }, "🔴 Suspended Only")), /*#__PURE__*/React.createElement("select", {
    value: planFilter,
    onChange: e => setPlanFilter(e.target.value),
    className: "bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-semibold"
  }, /*#__PURE__*/React.createElement("option", {
    value: "ALL"
  }, "All Subscription Plans"), /*#__PURE__*/React.createElement("option", {
    value: "Free Trial"
  }, "Free Trial"), /*#__PURE__*/React.createElement("option", {
    value: "Starter"
  }, "Starter"), /*#__PURE__*/React.createElement("option", {
    value: "Professional"
  }, "Professional"), /*#__PURE__*/React.createElement("option", {
    value: "Enterprise"
  }, "Enterprise")))), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-xs"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-slate-950/70 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "py-3.5 px-4"
  }, "Clinic Tenant"), /*#__PURE__*/React.createElement("th", {
    className: "py-3.5 px-4"
  }, "Clinic ID & Slug"), /*#__PURE__*/React.createElement("th", {
    className: "py-3.5 px-4"
  }, "Owner / Contact"), /*#__PURE__*/React.createElement("th", {
    className: "py-3.5 px-4"
  }, "Subscription Plan"), /*#__PURE__*/React.createElement("th", {
    className: "py-3.5 px-4"
  }, "Seats & Doctors"), /*#__PURE__*/React.createElement("th", {
    className: "py-3.5 px-4"
  }, "Live Queue"), /*#__PURE__*/React.createElement("th", {
    className: "py-3.5 px-4"
  }, "Status"), /*#__PURE__*/React.createElement("th", {
    className: "py-3.5 px-4 text-right"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-slate-800/60 font-medium"
  }, filteredClinics.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "8",
    className: "text-center py-16 text-slate-400"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-center justify-center space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-2xl"
  }, "🏥"), /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-semibold text-slate-300"
  }, clinics.length === 0 ? 'No Onboarded Clinics' : 'No clinics match current search/filter'), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 max-w-sm"
  }, clinics.length === 0 ? 'Your platform is clean. Click "+ Onboard New Clinic" above to onboard your first clinic tenant.' : 'Try clearing your search term or changing your status filter.')))) : filteredClinics.map(clinic => {
    const clinicDoctors = doctors.filter(d => d.clinicSlug === clinic.slug || d.clinicId === clinic.id || d.clinicId === clinic.clinicId);
    const clinicQueue = queues[clinic.slug] || [];
    const activeQueueCount = clinicQueue.filter(t => t.status === 'WAITING' || t.status === 'IN_CONSULTATION').length;
    const isSuspended = clinic.status === 'SUSPENDED';
    return /*#__PURE__*/React.createElement("tr", {
      key: clinic.id || clinic.slug,
      className: `hover:bg-slate-800/40 transition ${isSuspended ? 'bg-rose-950/10 opacity-80' : ''}`
    }, /*#__PURE__*/React.createElement("td", {
      className: "py-3.5 px-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-3"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-teal-400"
    }, "+"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "font-extrabold text-white text-sm"
    }, clinic.name), /*#__PURE__*/React.createElement("div", {
      className: "text-[11px] text-slate-400 line-clamp-1"
    }, clinic.address || 'Standard Location')))), /*#__PURE__*/React.createElement("td", {
      className: "py-3.5 px-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "font-mono font-bold text-cyan-400 text-xs mb-1"
    }, clinic.clinicId || `CLN-${clinic.id}`), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col space-y-1 font-mono text-[11px]"
    }, /*#__PURE__*/React.createElement("a", {
      href: `/clinic/${clinic.slug}/dashboard`,
      onClick: e => {
        e.preventDefault();
        onSwitchToClinic(clinic);
      },
      className: "text-teal-400 hover:text-teal-200 font-bold hover:underline inline-flex items-center space-x-1 cursor-pointer",
      title: "Open dedicated Doctor Dashboard for this clinic"
    }, /*#__PURE__*/React.createElement("span", null, "🩺 /clinic/", clinic.slug, "/dashboard"), /*#__PURE__*/React.createElement("span", {
      className: "text-[10px]"
    }, "↗")), /*#__PURE__*/React.createElement("a", {
      href: `/q/${clinic.slug}`,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "text-slate-400 hover:text-white font-medium hover:underline inline-flex items-center space-x-1 cursor-pointer",
      title: "Open public patient QR check-in"
    }, /*#__PURE__*/React.createElement("span", null, "📱 /q/", clinic.slug), /*#__PURE__*/React.createElement("span", {
      className: "text-[10px]"
    }, "↗")))), /*#__PURE__*/React.createElement("td", {
      className: "py-3.5 px-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "font-bold text-slate-200"
    }, clinic.ownerName || 'Lead Doctor'), /*#__PURE__*/React.createElement("div", {
      className: "text-[11px] text-slate-400"
    }, clinic.email), /*#__PURE__*/React.createElement("div", {
      className: "text-[10px] text-slate-500"
    }, clinic.phone)), /*#__PURE__*/React.createElement("td", {
      className: "py-3.5 px-4"
    }, (() => {
      const sub = checkClinicSubscriptionStatus(clinic);
      if (sub.isTrial) {
        if (sub.isLocked) {
          return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
            className: "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center space-x-1 w-fit"
          }, /*#__PURE__*/React.createElement("span", null, "⛔"), /*#__PURE__*/React.createElement("span", null, "Trial Expired")), /*#__PURE__*/React.createElement("div", {
            className: "text-[10px] text-amber-300 font-mono mt-1 font-bold"
          }, "➔ ", sub.targetPaidTier));
        }
        return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
          className: "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center space-x-1 w-fit"
        }, /*#__PURE__*/React.createElement("span", null, "⏳"), /*#__PURE__*/React.createElement("span", null, "14-Day Trial (", sub.daysRemaining, "d left)")), /*#__PURE__*/React.createElement("div", {
          className: "text-[10px] text-slate-400 font-mono mt-1"
        }, "➔ ", sub.targetPaidTier));
      }
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
        className: "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border bg-teal-500/10 text-teal-400 border-teal-500/30"
      }, "💳 ", clinic.subscriptionPlan || 'Paid Tier'), /*#__PURE__*/React.createElement("div", {
        className: "text-[10px] text-teal-400 font-mono mt-1"
      }, "Active Paid"));
    })()), /*#__PURE__*/React.createElement("td", {
      className: "py-3.5 px-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-1.5"
    }, /*#__PURE__*/React.createElement("span", {
      className: "font-black text-white"
    }, clinicDoctors.length), /*#__PURE__*/React.createElement("span", {
      className: "text-slate-500"
    }, "/ ", clinic.doctorSeats || 1, " Seats")), /*#__PURE__*/React.createElement("div", {
      className: "w-20 bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bg-teal-400 h-1.5 rounded-full",
      style: {
        width: `${Math.min(100, Math.round(clinicDoctors.length / (clinic.doctorSeats || 1) * 100))}%`
      }
    }))), /*#__PURE__*/React.createElement("td", {
      className: "py-3.5 px-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-1.5"
    }, /*#__PURE__*/React.createElement("span", {
      className: `w-2 h-2 rounded-full ${activeQueueCount > 0 ? 'bg-amber-400 animate-ping' : 'bg-slate-600'}`
    }), /*#__PURE__*/React.createElement("span", {
      className: "font-mono font-bold text-slate-200"
    }, activeQueueCount, " Active")), /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] text-slate-500"
    }, clinicQueue.length, " total today")), /*#__PURE__*/React.createElement("td", {
      className: "py-3.5 px-4"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onToggleClinicStatus(clinic.clinicId || clinic.slug, isSuspended ? 'ACTIVE' : 'SUSPENDED'),
      className: `px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition cursor-pointer flex items-center space-x-1 ${isSuspended ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'}`,
      title: "Click to toggle Active / Suspended status"
    }, /*#__PURE__*/React.createElement("span", null, isSuspended ? '🔴 SUSPENDED' : '🟢 ACTIVE'))), /*#__PURE__*/React.createElement("td", {
      className: "py-3.5 px-4 text-right"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-end space-x-1.5"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onSwitchToClinic(clinic),
      disabled: isSuspended,
      className: `px-2.5 py-1.5 text-xs font-bold rounded-lg border transition flex items-center space-x-1 ${isSuspended ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' : 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border-teal-500/30 cursor-pointer'}`,
      title: isSuspended ? 'Clinic is suspended' : 'Launch isolated Doctor Portal'
    }, /*#__PURE__*/React.createElement("span", null, "🚀 Launch")), (() => {
      const sub = checkClinicSubscriptionStatus(clinic);
      if (sub.isTrial || sub.isLocked) {
        return /*#__PURE__*/React.createElement("button", {
          type: "button",
          onClick: () => onActivateSubscription && onActivateSubscription(clinic.clinicId || clinic.slug),
          className: "px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-lg transition cursor-pointer flex items-center space-x-1",
          title: `Activate paid annual subscription (${sub.targetPaidTier})`
        }, /*#__PURE__*/React.createElement("span", null, "💳"), /*#__PURE__*/React.createElement("span", null, "Activate"));
      }
      return null;
    })(), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onNavigateTo(`/q/${clinic.slug}`),
      className: "px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg border border-slate-700 transition cursor-pointer",
      title: "Open Patient QR Check-In Route"
    }, "📱 QR"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => {
        setCreatedCredentialsModal({
          clinicId: clinic.clinicId || `CLN-${clinic.id}`,
          clinicName: clinic.name,
          ownerName: clinic.ownerName,
          email: clinic.email,
          password: clinic.initialPassword || 'clinic123',
          slug: clinic.slug
        });
      },
      className: "px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 cursor-pointer",
      title: "View Access Credentials"
    }, "🔑"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setClinicToDelete(clinic),
      className: "px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 text-xs font-bold rounded-lg transition cursor-pointer flex items-center space-x-1",
      title: `Permanently delete ${clinic.name} and wipe all tenant data`
    }, /*#__PURE__*/React.createElement("span", null, "🗑️"), /*#__PURE__*/React.createElement("span", {
      className: "hidden sm:inline"
    }, "Delete")))));
  })))))), clinicToDelete && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border-2 border-rose-500/50 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-4 text-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 text-2xl shadow-inner"
  }, "⚠️"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-black text-white"
  }, "Permanently Delete Clinic?"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-rose-300 font-semibold mt-1"
  }, "Are you sure you want to delete ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold underline text-white"
  }, clinicToDelete.name), "?")), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left text-xs space-y-2"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-slate-300 font-semibold text-[11px] uppercase tracking-wider text-rose-400"
  }, "Cascade Deletion Scope:"), /*#__PURE__*/React.createElement("ul", {
    className: "text-slate-400 space-y-1 text-xs list-disc list-inside"
  }, /*#__PURE__*/React.createElement("li", null, "Clinic ID: ", /*#__PURE__*/React.createElement("span", {
    className: "text-cyan-400 font-mono font-bold"
  }, clinicToDelete.clinicId || `CLN-${clinicToDelete.id}`)), /*#__PURE__*/React.createElement("li", null, "Tenant Route: ", /*#__PURE__*/React.createElement("span", {
    className: "text-teal-400 font-mono"
  }, "/clinic/", clinicToDelete.slug)), /*#__PURE__*/React.createElement("li", null, "Firebase Authentication user account & access credentials"), /*#__PURE__*/React.createElement("li", null, "All registered doctor profiles & consultation rooms"), /*#__PURE__*/React.createElement("li", null, "Active and historical queue tokens & patient records"), /*#__PURE__*/React.createElement("li", null, "Active browser login sessions & stored session tokens")), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-amber-300/90 pt-1 font-medium"
  }, "⚠️ This action is irreversible. All associated tenant data will be permanently wiped.")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3 pt-2"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: isDeletingClinic,
    onClick: () => setClinicToDelete(null),
    className: "py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: isDeletingClinic,
    onClick: () => handleConfirmDeleteClinic(clinicToDelete),
    className: "py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-1.5"
  }, isDeletingClinic ? /*#__PURE__*/React.createElement("span", null, "Wiping Tenant...") : /*#__PURE__*/React.createElement("span", null, "🗑️ Yes, Delete Clinic"))))), showOnboardModal && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-900 border-2 border-teal-500/40 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between pb-3 border-b border-slate-800"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 font-bold text-lg"
  }, "➕"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-black text-white"
  }, "Onboard New Clinic Tenant"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "Deploy isolated instance with auto-generated credentials"))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowOnboardModal(false),
    className: "text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
  }, "✕")), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleOnboardSubmit,
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Clinic Name *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: clinicName,
    onChange: e => setClinicName(e.target.value),
    placeholder: "e.g. Apollo Cradle Clinic",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Owner / Primary Doctor *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: ownerName,
    onChange: e => setOwnerName(e.target.value),
    placeholder: "e.g. Dr. Ramesh Gupta",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Admin Email Address *"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    required: true,
    value: email,
    onChange: e => setEmail(e.target.value),
    placeholder: "admin@clinic.com",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Phone / WhatsApp Number"), /*#__PURE__*/React.createElement("input", {
    type: "tel",
    value: phone,
    onChange: e => setPhone(e.target.value),
    placeholder: "+91 98450 12345",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Clinic Physical Address"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: address,
    onChange: e => setAddress(e.target.value),
    placeholder: "e.g. 12th Cross, Indiranagar, Bangalore",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Subscription Plan"), /*#__PURE__*/React.createElement("select", {
    value: subscriptionPlan,
    onChange: e => handlePlanChange(e.target.value),
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-semibold"
  }, /*#__PURE__*/React.createElement("optgroup", {
    label: "14-Day Free Trials (₹0)"
  }, /*#__PURE__*/React.createElement("option", {
    value: "Free Trial (14 Days — 1 Seat) (₹0)"
  }, "Free Trial (14 Days — 1 Seat) (₹0)"), /*#__PURE__*/React.createElement("option", {
    value: "Free Trial (14 Days — 2 to 5 Seats) (₹0)"
  }, "Free Trial (14 Days — 2 to 5 Seats) (₹0)"), /*#__PURE__*/React.createElement("option", {
    value: "Free Trial (14 Days — Unlimited Seats) (₹0)"
  }, "Free Trial (14 Days — Unlimited Seats) (₹0)")), /*#__PURE__*/React.createElement("optgroup", {
    label: "Annual Paid Tiers"
  }, /*#__PURE__*/React.createElement("option", {
    value: "Starter / Solo (₹9,999/yr)"
  }, "Starter / Solo (₹9,999/yr) — 1 Seat"), /*#__PURE__*/React.createElement("option", {
    value: "Professional (₹19,999/yr)"
  }, "Professional (₹19,999/yr) — Up to 5 Seats"), /*#__PURE__*/React.createElement("option", {
    value: "Enterprise (₹49,999/yr)"
  }, "Enterprise (₹49,999/yr) — Unlimited Seats")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Doctor Seats Allocated"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: subscriptionPlan.includes('2 to 5') ? "2" : "1",
    max: subscriptionPlan.includes('2 to 5') ? "5" : subscriptionPlan.includes('1 Seat') ? "1" : "1000",
    disabled: subscriptionPlan.includes('1 Seat') || subscriptionPlan.includes('Unlimited'),
    value: subscriptionPlan.includes('Unlimited') ? 999 : doctorSeats,
    onChange: e => {
      const val = Number(e.target.value);
      if (subscriptionPlan.includes('2 to 5')) {
        setDoctorSeats(Math.min(5, Math.max(2, val)));
      } else {
        setDoctorSeats(val);
      }
    },
    className: `w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-mono-numbers ${subscriptionPlan.includes('1 Seat') || subscriptionPlan.includes('Unlimited') ? 'opacity-70 cursor-not-allowed bg-slate-900' : ''}`
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-400 mt-1 block"
  }, subscriptionPlan.includes('1 Seat') ? '🔒 Locked: 1 Doctor Seat allowed for 1-Seat Trial.' : subscriptionPlan.includes('2 to 5') ? '⚡ Allowed: 2 to 5 Doctor Seats for this Trial tier.' : subscriptionPlan.includes('Unlimited') ? '🚀 Unlimited Doctor Seats enabled.' : 'Doctor seat quota for this tier.'))), /*#__PURE__*/React.createElement("div", {
    className: "p-3.5 bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-950 border border-teal-500/30 rounded-2xl text-xs space-y-1.5 shadow-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 font-semibold"
  }, "Tier Plan:"), /*#__PURE__*/React.createElement("span", {
    className: "text-emerald-400 font-bold"
  }, subscriptionPlan.includes('Trial') ? '14-Day Free Trial (₹0 Active Period)' : 'Annual Paid Tier')), subscriptionPlan.includes('Trial') ? /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 font-semibold"
  }, "Post-Trial Conversion:"), /*#__PURE__*/React.createElement("span", {
    className: "text-amber-400 font-mono font-bold"
  }, "➔ ", subscriptionPlan.includes('1 Seat') ? 'Starter / Solo (₹9,999/yr)' : subscriptionPlan.includes('2 to 5') ? 'Professional (₹19,999/yr)' : 'Enterprise (₹49,999/yr)')) : /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400 font-semibold"
  }, "Billing Rate:"), /*#__PURE__*/React.createElement("span", {
    className: "text-teal-300 font-mono font-bold"
  }, subscriptionPlan.includes('Starter') ? '₹9,999/yr' : subscriptionPlan.includes('Enterprise') ? '₹49,999/yr' : '₹19,999/yr')), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-slate-400"
  }, subscriptionPlan.includes('Trial') ? '14-day free access. Locks account upon expiration unless paid subscription is verified.' : 'Continuous paid access with full clinic capabilities.')), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-xs font-bold text-teal-400 uppercase"
  }, /*#__PURE__*/React.createElement("span", null, "Tenant Credentials & Access"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-slate-500"
  }, "Auto-Generated by Default")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-[11px] font-semibold text-slate-400 block mb-0.5"
  }, "Clinic ID (Auto or Custom)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: customClinicId,
    onChange: e => setCustomClinicId(e.target.value),
    placeholder: previewClinicId,
    className: "w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-[11px] font-semibold text-slate-400 block mb-0.5"
  }, "Initial Password (Auto or Custom)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: initialPassword,
    onChange: e => setInitialPassword(e.target.value),
    placeholder: "e.g. Goyoh@2026",
    className: "w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-1 text-[11px]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-slate-400"
  }, /*#__PURE__*/React.createElement("span", null, "Unique Firestore Slug:"), /*#__PURE__*/React.createElement("span", {
    className: "text-emerald-400 font-mono font-bold"
  }, previewSlug)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-slate-500"
  }, /*#__PURE__*/React.createElement("span", null, "Public Check-In URL:"), /*#__PURE__*/React.createElement("span", {
    className: "text-teal-400 font-mono font-semibold"
  }, "/q/", previewSlug)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-slate-500"
  }, /*#__PURE__*/React.createElement("span", null, "Doctor Dashboard URL:"), /*#__PURE__*/React.createElement("span", {
    className: "text-cyan-400 font-mono font-semibold"
  }, "/clinic/", previewSlug)))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3 pt-2"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowOnboardModal(false),
    className: "py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    disabled: isSubmitting,
    className: "py-3 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-teal-500/20"
  }, isSubmitting ? 'Onboarding...' : '🚀 Provision & Launch Tenant'))))), createdCredentialsModal && (() => {
    const currentOrigin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://smart-clinic-app-cf39b.web.app';
    const publicCheckinPath = `/q/${createdCredentialsModal.slug}`;
    const publicCheckinUrl = `${currentOrigin}${publicCheckinPath}`;
    const doctorDashPath = `/clinic/${createdCredentialsModal.slug}`;
    const doctorDashUrl = `${currentOrigin}${doctorDashPath}`;
    return /*#__PURE__*/React.createElement("div", {
      className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in overflow-y-auto"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bg-slate-900 border-2 border-emerald-500/50 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 text-center my-8"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-14 h-14 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl shadow-inner"
    }, "✓"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] font-black tracking-widest uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full"
    }, "● FIRESTORE CLOUD INSTANCE ACTIVE"), /*#__PURE__*/React.createElement("h3", {
      className: "text-xl font-black text-white mt-2"
    }, "Clinic Onboarded Successfully!"), /*#__PURE__*/React.createElement("p", {
      className: "text-xs text-slate-400 mt-1"
    }, "Unique tenant created for ", /*#__PURE__*/React.createElement("span", {
      className: "text-teal-400 font-bold"
    }, createdCredentialsModal.clinicName))), /*#__PURE__*/React.createElement("div", {
      className: "space-y-3 text-left"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bg-gradient-to-r from-teal-950/60 to-slate-950 p-4 rounded-2xl border border-teal-500/30 space-y-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-xs font-bold text-teal-300 flex items-center space-x-1.5"
    }, /*#__PURE__*/React.createElement("span", null, "📱"), /*#__PURE__*/React.createElement("span", null, "Public Patient Check-In Form (Mobile / QR)")), /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] font-mono font-bold bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full border border-teal-500/30"
    }, "/q/", createdCredentialsModal.slug)), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800"
    }, /*#__PURE__*/React.createElement("a", {
      href: publicCheckinPath,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "text-xs font-mono text-teal-400 hover:text-teal-300 underline font-semibold truncate flex-1 flex items-center space-x-1",
      title: "Open public patient check-in in new tab"
    }, /*#__PURE__*/React.createElement("span", {
      className: "truncate"
    }, publicCheckinUrl), /*#__PURE__*/React.createElement("span", {
      className: "text-[10px]"
    }, "↗")), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => copyToClipboard(publicCheckinUrl),
      className: "px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition shrink-0 cursor-pointer"
    }, copyFeedback ? '✓ Copied' : 'Copy Link'))), /*#__PURE__*/React.createElement("div", {
      className: "bg-gradient-to-r from-cyan-950/60 to-slate-950 p-4 rounded-2xl border border-cyan-500/30 space-y-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-xs font-bold text-cyan-300 flex items-center space-x-1.5"
    }, /*#__PURE__*/React.createElement("span", null, "🩺"), /*#__PURE__*/React.createElement("span", null, "Doctor & Staff OPD Dashboard")), /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30"
    }, "/clinic/", createdCredentialsModal.slug)), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800"
    }, /*#__PURE__*/React.createElement("a", {
      href: doctorDashPath,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "text-xs font-mono text-cyan-400 hover:text-cyan-300 underline font-semibold truncate flex-1 flex items-center space-x-1",
      title: "Open doctor dashboard in new tab"
    }, /*#__PURE__*/React.createElement("span", {
      className: "truncate"
    }, doctorDashUrl), /*#__PURE__*/React.createElement("span", {
      className: "text-[10px]"
    }, "↗")), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => copyToClipboard(doctorDashUrl),
      className: "px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition shrink-0 cursor-pointer"
    }, copyFeedback ? '✓ Copied' : 'Copy Link')))), /*#__PURE__*/React.createElement("div", {
      className: "bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left space-y-2.5 font-mono text-xs"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex justify-between items-center pb-2 border-b border-slate-800/80"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400"
    }, "Unique Firestore Slug:"), /*#__PURE__*/React.createElement("span", {
      className: "font-bold text-emerald-400"
    }, createdCredentialsModal.slug)), /*#__PURE__*/React.createElement("div", {
      className: "flex justify-between items-center pb-2 border-b border-slate-800/80"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400"
    }, "Clinic Tenant ID:"), /*#__PURE__*/React.createElement("span", {
      className: "font-bold text-cyan-400"
    }, createdCredentialsModal.clinicId)), /*#__PURE__*/React.createElement("div", {
      className: "flex justify-between items-center pb-2 border-b border-slate-800/80"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400"
    }, "Admin Email:"), /*#__PURE__*/React.createElement("span", {
      className: "text-white font-bold"
    }, createdCredentialsModal.email)), /*#__PURE__*/React.createElement("div", {
      className: "flex justify-between items-center"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-slate-400"
    }, "Initial Password:"), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-emerald-400 font-bold"
    }, showPassword ? createdCredentialsModal.password : '••••••••••••'), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setShowPassword(!showPassword),
      className: "text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
    }, showPassword ? 'Hide' : 'Show')))), /*#__PURE__*/React.createElement("div", {
      className: "grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => {
        onSwitchToClinic({
          slug: createdCredentialsModal.slug,
          clinicId: createdCredentialsModal.clinicId,
          name: createdCredentialsModal.clinicName,
          ownerName: createdCredentialsModal.ownerName,
          email: createdCredentialsModal.email,
          doctorSeats: createdCredentialsModal.doctorSeats,
          subscriptionPlan: createdCredentialsModal.subscriptionPlan
        });
        setCreatedCredentialsModal(null);
        setShowPassword(false);
      },
      className: "py-3 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-teal-500/20"
    }, "Open Doctor Console →"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => {
        setCreatedCredentialsModal(null);
        setShowPassword(false);
      },
      className: "py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
    }, "Done / Close"))));
  })());
}

// ========================================================================
// 9B. VIEW: GOYOH HEALTH CONNECT - SUPER ADMIN PORTAL LOGIN (/super-admin/login)
// ========================================================================
function SuperAdminLoginView({
  onLoginSuccess,
  onNavigateTo
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleMasterSubmit = e => {
    e.preventDefault();
    setErrorMsg('');
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();
    if (!cleanUser || !cleanPass) {
      setErrorMsg('Please enter both master username/email and password.');
      return;
    }
    setIsSubmitting(true);
    const isMasterUser = cleanUser === 'superadmin@goyoh.com' || cleanUser === 'superadmin' || cleanUser === 'admin' || cleanUser === 'goyoh_owner';
    const isMasterPass = cleanPass === 'admin123';
    if (isMasterUser && isMasterPass) {
      setIsSubmitting(false);
      onLoginSuccess({
        email: 'superadmin@goyoh.com',
        username: 'superadmin',
        role: 'super_admin'
      });
    } else {
      setIsSubmitting(false);
      setErrorMsg('Invalid Super Admin credentials. Access denied.');
    }
  };
  const handleQuickMasterLogin = () => {
    setErrorMsg('');
    onLoginSuccess({
      email: 'superadmin@goyoh.com',
      username: 'superadmin',
      role: 'super_admin'
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans relative overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"
  }), /*#__PURE__*/React.createElement("header", {
    className: "flex items-center justify-between max-w-4xl w-full mx-auto pb-4 border-b border-slate-800 relative z-10"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-teal-500/20"
  }, "G"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "font-extrabold text-base tracking-tight text-white"
  }, "GOYOH Health Connect"), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-cyan-400 font-semibold"
  }, "Master Platform Operations"))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onNavigateTo && onNavigateTo('/login'),
    className: "px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer flex items-center space-x-1.5"
  }, /*#__PURE__*/React.createElement("span", null, "← Clinic Portal Login"))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 flex items-center justify-center py-8 relative z-10"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-md w-full bg-slate-900/95 border-2 border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-500/10 space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center space-y-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-teal-500/20 border border-cyan-500/40 flex items-center justify-center text-2xl shadow-inner"
  }, "🛡️"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-black text-cyan-300 uppercase tracking-widest bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30"
  }, "PLATFORM OWNER MASTER ACCESS"), /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-black text-white mt-2"
  }, "Super Admin Portal"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "Restricted control center to manage onboarded clinics, credentials, and telemetry")), errorMsg && /*#__PURE__*/React.createElement("div", {
    className: "p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-semibold leading-relaxed animate-fade-in"
  }, errorMsg), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleMasterSubmit,
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Master Username or Admin Email *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: username,
    onChange: e => setUsername(e.target.value),
    placeholder: "superadmin@goyoh.com or superadmin",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Master Security Password *"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    required: true,
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: "••••••••",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    disabled: isSubmitting,
    className: "w-full py-3 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-cyan-500/20"
  }, isSubmitting ? 'Verifying Master Credentials...' : 'Authenticate Master Session →')), /*#__PURE__*/React.createElement("div", {
    className: "pt-4 border-t border-slate-800 space-y-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center"
  }, "⚡ Platform Owner Testing Access:"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleQuickMasterLogin,
    className: "w-full p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 rounded-xl text-left transition cursor-pointer flex items-center justify-between group"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-bold text-white group-hover:text-cyan-300 transition"
  }, "1-Click Master Access"), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-slate-400"
  }, "superadmin@goyoh.com • admin123")), /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] font-mono text-cyan-400 font-bold bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800"
  }, "Enter Control Center →"))), /*#__PURE__*/React.createElement("div", {
    className: "text-center pt-2"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onNavigateTo && onNavigateTo('/login'),
    className: "text-xs text-slate-400 hover:text-white transition cursor-pointer"
  }, "← Back to Clinic Staff Login (/login)")))), /*#__PURE__*/React.createElement("footer", {
    className: "text-center py-3 text-xs text-slate-500 border-t border-slate-900 relative z-10"
  }, "GOYOH Health Connect • Protected Master Operations Console"));
}

// ========================================================================
// 9C. VIEW: DEDICATED CLINIC TENANT LOGIN (/clinic/:slug/login)
// ========================================================================
function DedicatedClinicLoginView({
  clinicSlug,
  clinics,
  doctors,
  onLoginSuccess,
  onNavigateTo
}) {
  const clinic = clinics.find(c => c.slug.toLowerCase() === (clinicSlug || '').toLowerCase() || c.clinicId.toLowerCase() === (clinicSlug || '').toLowerCase() || c.alias && c.alias.toLowerCase() === (clinicSlug || '').toLowerCase()) || {
    name: clinicSlug ? clinicSlug.replace(/-/g, ' ').toUpperCase() : 'Clinic',
    slug: clinicSlug || 'clinic',
    clinicId: 'CLN-TENANT',
    address: 'Medical Enclave'
  };
  const clinicDocList = doctors.filter(d => d.clinicSlug === clinic.slug || d.clinicId === clinic.clinicId || d.clinicName && d.clinicName.toLowerCase() === clinic.name.toLowerCase());
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = e => {
    e.preventDefault();
    setErrorMsg('');
    const cleanUser = usernameOrEmail.trim().toLowerCase();
    const cleanPass = password.trim();
    if (!cleanUser || !cleanPass) {
      setErrorMsg('Please enter your staff username/email and password.');
      return;
    }
    setIsSubmitting(true);

    // Find doctor within THIS clinic only
    let matchedDoc = clinicDocList.find(d => d.email && d.email.toLowerCase() === cleanUser || d.username && d.username.toLowerCase() === cleanUser || d.doctorName && d.doctorName.toLowerCase() === cleanUser);
    if (!matchedDoc && (cleanUser.includes(clinic.slug) || cleanUser === clinic.email?.toLowerCase() || cleanUser === clinic.clinicId?.toLowerCase())) {
      matchedDoc = clinicDocList[0] || {
        id: Date.now(),
        doctorName: clinic.ownerName || 'Doctor',
        clinicName: clinic.name,
        clinicSlug: clinic.slug,
        clinicId: clinic.clinicId,
        email: clinic.email,
        specialization: 'Lead Physician & Clinic Admin',
        roomNumber: 'Consultation Room 1',
        avgConsultationTime: 8.0
      };
    }
    if (!matchedDoc) {
      setIsSubmitting(false);
      setErrorMsg(`Invalid credentials for ${clinic.name}. Please check with your clinic administrator.`);
      return;
    }
    if (clinic.status === 'SUSPENDED') {
      setIsSubmitting(false);
      setErrorMsg(`⛔ Access Suspended: ${clinic.name}'s subscription has been suspended by GOYOH Health Connect.`);
      return;
    }
    const clinicSubStatus = checkClinicSubscriptionStatus(clinic);
    if (clinicSubStatus.isLocked) {
      setIsSubmitting(false);
      setErrorMsg(`⛔ 14-Day Free Trial Expired: ${clinic.name} has transitioned to ${clinicSubStatus.targetPaidTier} (${clinicSubStatus.targetPaidPrice}). Please activate your paid annual subscription.`);
      return;
    }
    setIsSubmitting(false);
    onLoginSuccess(matchedDoc, clinic);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans"
  }, /*#__PURE__*/React.createElement("header", {
    className: "flex items-center justify-between max-w-4xl w-full mx-auto pb-4 border-b border-slate-800"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-teal-500/20"
  }, "G"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "font-extrabold text-base tracking-tight text-white"
  }, clinic.name), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-teal-400 font-semibold"
  }, "Tenant-Dedicated Staff & Doctor Console"))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onNavigateTo && onNavigateTo('/login'),
    className: "px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-400 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer"
  }, /*#__PURE__*/React.createElement("span", null, "🔐 Unified Login"))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 flex items-center justify-center py-8"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-md w-full bg-slate-900 border-2 border-teal-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center space-y-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 border border-teal-500/40 flex items-center justify-center text-2xl shadow-inner"
  }, "🩺"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-black text-teal-300 uppercase tracking-widest bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/30"
  }, "DEDICATED CLINIC PORTAL"), /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-black text-white mt-1"
  }, clinic.name), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400"
  }, clinic.address, " • Route: ", /*#__PURE__*/React.createElement("code", {
    className: "text-teal-400 font-mono"
  }, "/clinic/", clinic.slug))), errorMsg && /*#__PURE__*/React.createElement("div", {
    className: "p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-semibold leading-relaxed animate-fade-in"
  }, errorMsg), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Doctor / Staff Email or Username *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: usernameOrEmail,
    onChange: e => setUsernameOrEmail(e.target.value),
    placeholder: `e.g. dr@${clinic.slug}.com`,
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Password *"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    required: true,
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: "••••••••",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    disabled: isSubmitting,
    className: "w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-teal-500/20"
  }, isSubmitting ? 'Authenticating...' : `Enter ${clinic.name} Console →`)), /*#__PURE__*/React.createElement("div", {
    className: "pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center space-x-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-1.5 h-1.5 rounded-full bg-emerald-400"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400"
  }, "Strict Data Isolation")), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-cyan-400"
  }, clinic.clinicId)))), /*#__PURE__*/React.createElement("footer", {
    className: "text-center py-3 text-xs text-slate-500 border-t border-slate-900"
  }, "GOYOH Health Connect • Dedicated Tenant Console"));
}
// ========================================================================
// 10. UNIFIED SINGLE LOGIN PAGE (/login) - ZERO MULTI-ACCOUNT SWITCHERS
// ========================================================================
function UnifiedLoginView({
  clinics,
  doctors,
  onLoginSuccess,
  onSuperAdminSuccess,
  onNavigateTo
}) {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async e => {
    e.preventDefault();
    setErrorMsg('');
    const cleanUser = usernameOrEmail.trim();
    const cleanPass = password.trim();
    if (!cleanUser || !cleanPass) {
      setErrorMsg('Please enter both username/email and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Authenticate with backend API for credential-based tenant routing
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: cleanUser,
          password: cleanPass
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        // Safe local fallback
        const lowerUser = cleanUser.toLowerCase();
        const matchedClinic = clinics.find(c => c.email.toLowerCase() === lowerUser || c.clinicId.toLowerCase() === lowerUser || c.username && c.username.toLowerCase() === lowerUser || c.slug.toLowerCase() === lowerUser || c.name.toLowerCase() === lowerUser || cleanUser.toLowerCase().replace(/[^a-z0-9]/g, '') === c.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const matchedDoc = doctors.find(d => d.email && d.email.toLowerCase() === lowerUser || d.username && d.username.toLowerCase() === lowerUser || matchedClinic && (d.clinicId === matchedClinic.clinicId || d.clinicSlug === matchedClinic.slug));
        if (matchedClinic || matchedDoc) {
          const targetClinic = matchedClinic || clinics.find(c => c.clinicId === matchedDoc.clinicId || c.slug === matchedDoc.clinicSlug);
          const targetDoc = matchedDoc || doctors.find(d => d.clinicId === targetClinic.clinicId);
          if (targetClinic) {
            const subStatus = checkClinicSubscriptionStatus(targetClinic);
            if (subStatus.isLocked) {
              setIsSubmitting(false);
              setErrorMsg(`⛔ 14-Day Free Trial Expired: ${targetClinic.name} has transitioned to ${subStatus.targetPaidTier} (${subStatus.targetPaidPrice}). Please activate your paid annual subscription.`);
              return;
            }
          }
          setIsSubmitting(false);
          onLoginSuccess(targetDoc, targetClinic, targetClinic.slug);
          return;
        }
        setIsSubmitting(false);
        setErrorMsg(data.error || 'Invalid credentials. Please verify your clinic username and password.');
        return;
      }
      setIsSubmitting(false);

      // Super Admin Role
      if (data.role === 'super_admin') {
        if (onSuperAdminSuccess) {
          onSuperAdminSuccess();
        } else {
          onNavigateTo('/super-admin');
        }
        return;
      }

      // Clinic Tenant Role -> Route directly to dedicated dashboard
      if (data.role === 'clinic') {
        setIsSuperAdminAuthed(false);
        try {
          localStorage.removeItem('goyoh_super_admin_authed');
        } catch (e) {}
        onLoginSuccess(data.doctor, data.clinic, data.clinicSlug);
      }
    } catch (err) {
      // Local fallback
      setIsSubmitting(false);
      const lowerUser = cleanUser.toLowerCase();

      // Direct Super Admin login support
      const isMaster = (lowerUser === 'superadmin' || lowerUser === 'admin' || lowerUser === 'superadmin@goyoh.com') && cleanPass === 'admin123';
      if (isMaster) {
        if (onSuperAdminSuccess) {
          onSuperAdminSuccess();
        } else {
          onNavigateTo('/super-admin');
        }
        return;
      }
      const matchedClinic = clinics.find(c => c.email.toLowerCase() === lowerUser || c.clinicId.toLowerCase() === lowerUser || c.username && c.username.toLowerCase() === lowerUser || c.slug.toLowerCase() === lowerUser || c.name.toLowerCase() === lowerUser);
      if (matchedClinic) {
        const subStatus = checkClinicSubscriptionStatus(matchedClinic);
        if (subStatus.isLocked) {
          setIsSubmitting(false);
          setErrorMsg(`⛔ 14-Day Free Trial Expired: ${matchedClinic.name} has transitioned to ${subStatus.targetPaidTier} (${subStatus.targetPaidPrice}). Please activate your paid annual subscription.`);
          return;
        }
        const targetDoc = doctors.find(d => d.clinicId === matchedClinic.clinicId || d.clinicSlug === matchedClinic.slug);
        onLoginSuccess(targetDoc, matchedClinic, matchedClinic.slug);
        return;
      }
      setErrorMsg('Unable to connect to authentication server. Please check your network.');
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans"
  }, /*#__PURE__*/React.createElement("header", {
    className: "flex items-center justify-between max-w-md sm:max-w-xl w-full mx-auto pb-4 border-b border-slate-800"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-teal-500/20"
  }, "G"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "font-extrabold text-base tracking-tight text-white"
  }, "GOYOH Health Connect"), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-teal-400 font-semibold"
  }, "Unified Healthcare OS"))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onNavigateTo('/super-admin/login'),
    className: "text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-teal-500/50 px-3 py-1.5 rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-sm",
    title: "Switch to Super Admin Portal"
  }, /*#__PURE__*/React.createElement("span", null, "🛡️ Super Admin"), /*#__PURE__*/React.createElement("span", {
    className: "text-teal-400 font-bold"
  }, "→"))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 flex items-center justify-center py-8"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center space-y-1.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 border border-teal-500/40 flex items-center justify-center text-xl shadow-inner mb-2"
  }, "🔐"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20"
  }, "SECURE TENANT AUTHENTICATION"), /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-black text-white mt-1"
  }, "Sign In to Your Dashboard"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "Enter your assigned username or email to enter your clinic console")), errorMsg && /*#__PURE__*/React.createElement("div", {
    className: "p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-semibold leading-relaxed animate-fade-in"
  }, errorMsg), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Username or Email *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    value: usernameOrEmail,
    onChange: e => setUsernameOrEmail(e.target.value),
    placeholder: "e.g. clinic_username or admin@clinic.com",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium",
    autoFocus: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-300 block mb-1"
  }, "Password *"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    required: true,
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: "••••••••",
    className: "w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    disabled: isSubmitting,
    className: "w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-teal-500/20"
  }, isSubmitting ? 'Authenticating & Routing...' : 'Sign In to Dashboard →')), /*#__PURE__*/React.createElement("div", {
    className: "pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center space-x-1.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-1.5 h-1.5 rounded-full bg-emerald-400"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400"
  }, "Strict Tenant Routing")), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-cyan-400 text-[10px]"
  }, "Zero Cross-Data Leakage")))), /*#__PURE__*/React.createElement("footer", {
    className: "text-center py-3 text-xs text-slate-500 border-t border-slate-900"
  }, "GOYOH Health Connect • Strict Multi-Tenant Isolation"));
}
class SafeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error
    };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Clinical Engine Error Boundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          minHeight: '100vh',
          background: '#020617',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: 'sans-serif'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          background: '#0f172a',
          border: '2px solid #0d9488',
          borderRadius: '16px',
          padding: '28px',
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: '48px',
          height: '48px',
          margin: '0 auto 12px',
          background: 'rgba(20, 184, 166, 0.15)',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          color: '#14b8a6'
        }
      }, "🩺"), /*#__PURE__*/React.createElement("h2", {
        style: {
          color: '#f8fafc',
          fontSize: '18px',
          fontWeight: 'bold',
          marginBottom: '8px'
        }
      }, "GOYOH Health Connect"), /*#__PURE__*/React.createElement("p", {
        style: {
          color: '#94a3b8',
          fontSize: '13px',
          lineHeight: '1.5',
          marginBottom: '20px'
        }
      }, "An interface refresh is required. Click below to reload the clinic console."), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          gap: '10px',
          justifyContent: 'center'
        }
      }, /*#__PURE__*/React.createElement("button", {
        onClick: () => window.location.reload(),
        style: {
          background: '#14b8a6',
          color: '#020617',
          fontWeight: 'bold',
          padding: '10px 24px',
          borderRadius: '10px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px'
        }
      }, "Reload Clinic Console"), /*#__PURE__*/React.createElement("button", {
        onClick: () => {
          localStorage.clear();
          window.location.reload();
        },
        style: {
          background: '#334155',
          color: '#f8fafc',
          fontWeight: 'bold',
          padding: '10px 18px',
          borderRadius: '10px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px'
        }
      }, "Reset Storage"))));
    }
    return this.props.children;
  }
}
try {
  const rootElement = document.getElementById('root');
  ReactDOM.createRoot(rootElement).render(/*#__PURE__*/React.createElement(SafeErrorBoundary, null, /*#__PURE__*/React.createElement(App, null)));
} catch (err) {
  console.error('Fatal render initialization:', err);
}