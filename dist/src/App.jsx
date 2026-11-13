import React, { useState, useEffect, useRef, useMemo } from 'react';
import DoctorDashboard from './components/DoctorDashboard';
import PatientMobileView from './components/PatientMobileView';
import WaitingRoomTV from './components/WaitingRoomTV';
import DoctorTenantModal from './components/DoctorTenantModal';
import PrescriptionPreviewModal from './components/PrescriptionPreviewModal';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import ClinicLogin from './components/ClinicLogin';
import SuperAdminLogin from './components/SuperAdminLogin';
import { audioService } from './services/audioService';
import { getSocket } from './services/socket';

const INITIAL_CLINICS = [
  {
    id: 1,
    clinicId: 'CLN-MEDICLINC',
    name: 'medi clinc',
    slug: 'medi-clinc',
    alias: 'dr-musheer-medi-clinc',
    ownerName: 'Dr. Musheer',
    email: 'dr.musheer@mediclinic.com',
    phone: '+91 98450 12345',
    address: '12, Main Road, Bangalore - 560001',
    subscriptionPlan: 'Professional',
    doctorSeats: 5,
    status: 'ACTIVE',
    createdAt: '2026-10-20T10:00:00.000Z',
    initialPassword: 'clinic123'
  },
  {
    id: 2,
    clinicId: 'CLN-APOLLO-IND',
    name: 'Apollo Cradle Clinic, Indiranagar',
    slug: 'dr-arvind-indiranagar',
    ownerName: 'Dr. Arvind Deshmukh',
    email: 'dr.arvind@apollo.com',
    phone: '+91 98450 11223',
    address: '16th Cross, Indiranagar, Bangalore - 560038',
    subscriptionPlan: 'Enterprise',
    doctorSeats: 10,
    status: 'ACTIVE',
    createdAt: '2026-10-21T10:00:00.000Z',
    initialPassword: 'doctor123'
  },
  {
    id: 3,
    clinicId: 'CLN-BLOSSOM-KOR',
    name: 'Blossom Children Clinic, Koramangala',
    slug: 'dr-sneha-pediatrics',
    ownerName: 'Dr. Sneha Rao',
    email: 'dr.sneha@pediacare.com',
    phone: '+91 97410 44556',
    address: '4th Block, Koramangala, Bangalore - 560034',
    subscriptionPlan: 'Starter',
    doctorSeats: 1,
    status: 'ACTIVE',
    createdAt: '2026-10-22T10:00:00.000Z',
    initialPassword: 'doctor123'
  },
  {
    id: 4,
    clinicId: 'CLN-ANKITHA',
    name: 'Ankitha Clinic',
    slug: 'ankitha-clinic',
    alias: 'dr-ankitha-clinic',
    ownerName: 'Dr. Ankitha Reddy',
    email: 'dr.ankitha@ankithaclinic.com',
    phone: '+91 98455 67890',
    address: '7th Sector, HSR Layout, Bangalore - 560102',
    subscriptionPlan: 'Professional',
    doctorSeats: 5,
    status: 'ACTIVE',
    createdAt: '2026-10-23T10:00:00.000Z',
    initialPassword: 'clinic123'
  }
];

const INITIAL_DOCTORS = [
  {
    id: 1,
    doctorName: 'Dr. Musheer',
    specialization: 'General Physician',
    roomNumber: 'Consultation Room 1',
    clinicName: 'medi clinc',
    clinicSlug: 'medi-clinc',
    clinicId: 'CLN-MEDICLINC',
    email: 'dr.musheer@mediclinic.com',
  },
  {
    id: 2,
    doctorName: 'Dr. Arvind Deshmukh',
    specialization: 'MD (Gen Med)',
    roomNumber: 'Consultation Room 1',
    clinicName: 'Apollo Cradle Clinic, Indiranagar',
    clinicSlug: 'dr-arvind-indiranagar',
    clinicId: 'CLN-APOLLO-IND',
    email: 'dr.arvind@clinic.com',
  },
  {
    id: 3,
    doctorName: 'Dr. Sneha Rao',
    specialization: 'Pediatrician',
    roomNumber: 'Consultation Room 1',
    clinicName: 'Blossom Children Clinic, Koramangala',
    clinicSlug: 'dr-sneha-pediatrics',
    clinicId: 'CLN-BLOSSOM-KOR',
    email: 'dr.sneha@pediacare.com',
  },
  {
    id: 4,
    doctorName: 'Dr. Ankitha Reddy',
    specialization: 'Obstetrician & Gynaecologist',
    roomNumber: 'Consultation Room 1',
    clinicName: 'Ankitha Clinic',
    clinicSlug: 'ankitha-clinic',
    clinicId: 'CLN-ANKITHA',
    email: 'dr.ankitha@ankithaclinic.com',
  },
];

const DEFAULT_PROFILE = INITIAL_DOCTORS[0];

export default function App() {
  const [currentView, setCurrentView] = useState('doctor');
  const [serverUrl, setServerUrl] = useState('http://localhost:4000');
  const [clinicId, setClinicId] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [doctorModalTab, setDoctorModalTab] = useState('list');
  const [viewingRxToken, setViewingRxToken] = useState(null);
  const [whatsAppNotifications, setWhatsAppNotifications] = useState([]);

  // Super Admin Auth state
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

  // Clinic Doctor Authentication State (1 Single Link Architecture)
  const [isClinicAuthed, setIsClinicAuthed] = useState(() => {
    try {
      return localStorage.getItem('smart_clinic_authed') === 'true';
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('smart_clinic_authed', String(isClinicAuthed));
    } catch (e) {}
  }, [isClinicAuthed]);

  // Clinics list (Persisted in localStorage)
  const [clinicsList, setClinicsList] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_clinic_saas_clinics');
      return saved ? JSON.parse(saved) : INITIAL_CLINICS;
    } catch (e) {
      return INITIAL_CLINICS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('smart_clinic_saas_clinics', JSON.stringify(clinicsList));
    } catch (e) {}
  }, [clinicsList]);

  // Doctors list (Persisted in localStorage)
  const [doctorsList, setDoctorsList] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_clinic_saas_doctors');
      return saved ? JSON.parse(saved) : INITIAL_DOCTORS;
    } catch (e) {
      return INITIAL_DOCTORS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('smart_clinic_saas_doctors', JSON.stringify(doctorsList));
    } catch (e) {}
  }, [doctorsList]);

  // 1. Doctor & Clinic Profile (Persisted in localStorage)
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_clinic_profile');
      return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
    } catch (e) {
      return DEFAULT_PROFILE;
    }
  });

  // Strictly scoped doctors belonging ONLY to profile's clinic
  const clinicDoctors = useMemo(() => {
    const cid = profile?.clinicId;
    const cslug = profile?.clinicSlug;
    const cname = profile?.clinicName?.toLowerCase();
    return doctorsList.filter(
      (d) =>
        (cid && d.clinicId === cid) ||
        (cslug && d.clinicSlug === cslug) ||
        (cname && d.clinicName && d.clinicName.toLowerCase() === cname)
    );
  }, [doctorsList, profile]);

  const currentClinic = useMemo(() => {
    const cid = profile?.clinicId;
    const cslug = profile?.clinicSlug;
    return clinicsList.find((c) => (cid && c.clinicId === cid) || (cslug && c.slug === cslug));
  }, [clinicsList, profile]);

  const maxSeats = useMemo(() => {
    if (currentClinic) {
      const directSeats = Number(currentClinic.doctorSeats);
      if (!isNaN(directSeats) && directSeats > 0) return directSeats;

      const plan = String(currentClinic.subscriptionPlan || '').toLowerCase();
      if (plan.includes('1 seat') || plan.includes('starter') || plan.includes('solo')) return 1;
      if (plan.includes('2 to 5') || plan.includes('professional')) return 5;
      if (plan.includes('unlimited') || plan.includes('enterprise')) return 999;
    }
    if (profile) {
      const directSeats = Number(profile.doctorSeats || profile.clinicSeats);
      if (!isNaN(directSeats) && directSeats > 0) return directSeats;

      const plan = String(profile.subscriptionPlan || '').toLowerCase();
      if (plan.includes('1 seat') || plan.includes('starter') || plan.includes('solo')) return 1;
      if (plan.includes('2 to 5') || plan.includes('professional')) return 5;
      if (plan.includes('unlimited') || plan.includes('enterprise')) return 999;
    }
    return 1;
  }, [currentClinic, profile]);

  const canManageDoctors = maxSeats > 1;

  const handleSwitchDoctor = (doc) => {
    setProfile(doc);
    setShowTenantModal(false);
  };

  const handleCreateDoctor = (newDocData) => {
    const newDoc = {
      id: Date.now(),
      doctorName: newDocData.doctorName.trim(),
      specialization: (newDocData.specialization || newDocData.specialty || 'General Physician').trim(),
      roomNumber: (newDocData.roomNumber || 'Consultation Room 1').trim(),
      email:
        newDocData.email?.trim() ||
        `${newDocData.doctorName.toLowerCase().replace(/[^a-z0-9]/g, '')}@${profile.clinicSlug}.com`,
      phone: newDocData.phone?.trim() || profile.phone,
      clinicName: profile.clinicName,
      clinicSlug: profile.clinicSlug,
      clinicId: profile.clinicId,
      clinicAddress: profile.clinicAddress,
      avgConsultationTime: 8.0,
    };
    setDoctorsList((prev) => [...prev, newDoc]);
    setProfile(newDoc);
    setShowTenantModal(false);
  };

  const handleDeleteDoctor = async (doctorId) => {
    if (clinicDoctors.length <= 1) {
      alert(`Cannot remove the only registered doctor for ${profile.clinicName}. At least one doctor must remain active in this clinic.`);
      return;
    }
    const targetDoctor = clinicDoctors.find((d) => d.id === doctorId);
    if (!targetDoctor) return;

    try {
      await fetch(`${serverUrl}/api/doctors/${doctorId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicSlug: targetDoctor.clinicSlug }),
      });
    } catch (e) {
      console.warn('[Delete Doctor] Backend API offline; updated state locally:', e);
    }

    const remaining = clinicDoctors.filter((d) => d.id !== doctorId);
    setDoctorsList((prev) => prev.filter((d) => d.id !== doctorId));
    if (profile.id === doctorId && remaining.length > 0) {
      setProfile(remaining[0]);
    }
  };

  const handleOnboardClinic = (newClinicData) => {
    const slug = (newClinicData.ownerName + '-' + newClinicData.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const clinicId =
      newClinicData.clinicId ||
      `CLN-${newClinicData.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const now = new Date();
    const trialStartDate = now.toISOString();
    const trialEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const isTrial = String(newClinicData.subscriptionPlan || '').toLowerCase().includes('trial');
    const doctorSeatsNum = Number(newClinicData.doctorSeats) || 1;
    const targetPaidTier = isTrial ? (doctorSeatsNum === 1 ? 'Starter / Solo (₹9,999/yr)' : (doctorSeatsNum > 5 ? 'Enterprise (₹49,999/yr)' : 'Professional (₹19,999/yr)')) : newClinicData.subscriptionPlan;
    const targetPaidPrice = targetPaidTier.includes('9,999') ? '₹9,999/yr' : (targetPaidTier.includes('49,999') ? '₹49,999/yr' : '₹19,999/yr');

    const newClinic = {
      id: slug,
      docId: slug,
      clinicId,
      slug,
      ...newClinicData,
      isTrial,
      trialStartDate: isTrial ? trialStartDate : null,
      trialEndDate: isTrial ? trialEndDate : null,
      targetPaidTier,
      targetPaidPrice,
      hasActiveSubscription: !isTrial,
      subscriptionStatus: isTrial ? 'TRIAL_ACTIVE' : 'PAID_ACTIVE',
      createdAt: now.toISOString(),
    };

    const newDoctor = {
      id: Date.now() + 1,
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
    };

    setClinicsList((prev) => [...prev, newClinic]);
    setDoctorsList((prev) => [...prev, newDoctor]);
    return newClinic;
  };

  const handleToggleClinicStatus = (clinicIdentifier, newStatus) => {
    setClinicsList((prev) =>
      prev.map((c) => {
        if (
          c.clinicId === clinicIdentifier ||
          c.slug === clinicIdentifier ||
          String(c.id) === String(clinicIdentifier)
        ) {
          return { ...c, status: newStatus };
        }
        return c;
      })
    );
  };

  const handleSwitchToClinic = (clinic) => {
    const doc =
      doctorsList.find((d) => d.clinicSlug === clinic.slug || d.clinicId === clinic.clinicId || d.clinicId === clinic.id) || {
        id: Date.now(),
        doctorName: clinic.ownerName || 'Doctor',
        clinicName: clinic.name,
        clinicSlug: clinic.slug,
        clinicId: clinic.clinicId,
        specialization: 'General Physician',
        roomNumber: 'Consultation Room 1',
        avgConsultationTime: 8.0,
      };
    setProfile(doc);
    setIsClinicAuthed(true);
    try {
      localStorage.setItem('smart_clinic_authed', 'true');
      localStorage.setItem('smart_clinic_profile', JSON.stringify(doc));
    } catch (e) {}
    setCurrentView('doctor');
  };

  const handleDeleteClinic = async (clinic) => {
    if (!clinic) return;
    const cId = clinic.clinicId;
    const cSlug = clinic.slug;
    const clinicId = String(clinic.docId || clinic.id || cSlug || cId);
    const db = window.SmartClinicFirebase?.db || (window.firebase && window.firebase.firestore ? window.firebase.firestore() : null);

    if (db) {
      try {
        const docRef = (col, id) => {
          if (typeof window.doc === 'function') return window.doc(db, col, String(id));
          return db.collection(col).doc(String(id));
        };
        const deleteDocument = async (ref) => {
          if (typeof window.deleteDoc === 'function') return await window.deleteDoc(ref);
          if (ref && typeof ref.delete === 'function') return await ref.delete();
          throw new Error('deleteDoc operation not supported on reference');
        };

        // 1. Call deleteDoc(doc(db, "clinics", clinicId))
        await deleteDocument(docRef('clinics', clinicId));
        if (cSlug && cSlug !== clinicId) await deleteDocument(docRef('clinics', cSlug)).catch(() => {});
        if (cId && cId !== clinicId && cId !== cSlug) await deleteDocument(docRef('clinics', cId)).catch(() => {});
      } catch (dbErr) {
        console.error('[Firestore Deletion Error]:', dbErr);
        throw dbErr;
      }
    }

    setClinicsList((prev) => prev.filter((c) => c.id !== clinic.id && c.clinicId !== cId && c.slug !== cSlug && String(c.docId || c.id) !== clinicId));
    setDoctorsList((prev) => prev.filter((d) => d.clinicSlug !== cSlug && d.clinicId !== cId));
  };

  // 2. Queue state: clean queue, no dummy data (Persisted in localStorage with automatic calendar day reset)
  const [queue, setQueue] = useState(() => {
    const todayDateStr = new Date().toDateString();
    const storedDate = localStorage.getItem('smart_clinic_calendar_date');
    const isNewDay = storedDate && storedDate !== todayDateStr;

    try {
      const saved = localStorage.getItem('smart_clinic_queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isNewDay) {
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const cleanQueue = (parsed || []).filter((t) => {
            const tDate = new Date(t.createdAt || t.id);
            return tDate < startOfToday && t.status === 'COMPLETED';
          });
          localStorage.setItem('smart_clinic_queue', JSON.stringify(cleanQueue));
          localStorage.setItem('smart_clinic_calendar_date', todayDateStr);
          return cleanQueue;
        }
        return parsed;
      }
    } catch (e) {
      return [];
    }
    return [];
  });

  // 3. Rolling consultation durations list (in minutes, e.g. [8, 11, 6, 10, 7])
  const [completedDurations, setCompletedDurations] = useState(() => {
    try {
      const todayDateStr = new Date().toDateString();
      const storedDate = localStorage.getItem('smart_clinic_calendar_date');
      if (storedDate && storedDate !== todayDateStr) {
        localStorage.removeItem('smart_clinic_durations');
        return [];
      }
      const saved = localStorage.getItem('smart_clinic_durations');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [activeToken, setActiveToken] = useState(() => queue.find((t) => t.status === 'IN_CONSULTATION') || null);
  const [myTokenId, setMyTokenId] = useState(null);
  const [lastCalled, setLastCalled] = useState(null);

  const socketRef = useRef(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('smart_clinic_profile', JSON.stringify(profile));
    } catch (e) {}
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem('smart_clinic_queue', JSON.stringify(queue));
    } catch (e) {}
  }, [queue]);

  useEffect(() => {
    try {
      localStorage.setItem('smart_clinic_durations', JSON.stringify(completedDurations));
    } catch (e) {}
  }, [completedDurations]);

  // Automatic Daily Calendar Date Reset Detector (checks on mount, window focus, visibility change, and interval)
  useEffect(() => {
    const checkAutoDailyReset = () => {
      const todayDateStr = new Date().toDateString();
      const storedDate = localStorage.getItem('smart_clinic_calendar_date');

      if (!storedDate) {
        localStorage.setItem('smart_clinic_calendar_date', todayDateStr);
        return;
      }

      if (storedDate !== todayDateStr) {
        console.log(`[Smart Clinic OS] Automatic Daily Reset triggered: New day detected (${storedDate} -> ${todayDateStr}). Resetting queue, completed count, and avg consult time to 0.`);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        setQueue((prev) =>
          prev.filter((t) => {
            const tDate = new Date(t.createdAt || t.id);
            return tDate < startOfToday && t.status === 'COMPLETED';
          })
        );
        setCompletedDurations([]);
        setActiveToken(null);
        setLastCalled(null);
        setMyTokenId(null);
        try {
          localStorage.removeItem('smart_clinic_durations');
        } catch (e) {}
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

  // Dynamic Rolling Average Consultation Time (Calculated strictly from today's completed patients)
  const avgConsultationTime = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const completedToday = queue.filter((t) => {
      if (t.status !== 'COMPLETED') return false;
      const tDate = new Date(t.createdAt || t.id);
      return tDate >= startOfToday;
    });

    if (completedToday.length === 0) {
      return 0; // Strictly 0 when no consultations completed today
    }

    const tokenDurations = completedToday
      .map((t) => {
        if (t.durationMinutes && t.durationMinutes > 0) return Number(t.durationMinutes);
        if (t.consultationStartTime && t.consultationEndTime) {
          const diff = (new Date(t.consultationEndTime).getTime() - new Date(t.consultationStartTime).getTime()) / 60000;
          if (diff > 0) return Number(diff.toFixed(1));
        }
        return null;
      })
      .filter((d) => d !== null);

    if (tokenDurations.length > 0) {
      const sum = tokenDurations.reduce((acc, curr) => acc + curr, 0);
      return Number((sum / tokenDurations.length).toFixed(1));
    }
    return 0;
  }, [queue]);

  // Audio Ready Toggle
  const handleAudioReadyToggle = () => {
    audioService.initContext();
    setAudioReady(true);
    audioService.playChime();
  };

  // WhatsApp Dispatch Helper
  const dispatchWhatsAppMessage = (phone, text, type = 'NOTIFICATION') => {
    const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
    const newNotif = {
      id: Date.now() + Math.random(),
      type,
      phone: cleanPhone || '+91 98450 00000',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      link: `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(text)}`,
    };

    setWhatsAppNotifications((prev) => [newNotif, ...prev.slice(0, 7)]);
    console.log(`[WhatsApp Dispatch - ${type}] Sent to ${cleanPhone}: "${text}"`);
  };

  // Connect Socket.io
  useEffect(() => {
    let socket = null;
    try {
      socket = getSocket(serverUrl);
      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);
        socket.emit('join_clinic_room', clinicId);
      });

      socket.on('disconnect', () => setIsConnected(false));

      socket.on('queue_updated', (updatedQueue) => {
        if (Array.isArray(updatedQueue)) {
          setQueue(updatedQueue);
          const inConsult = updatedQueue.find((t) => t.status === 'IN_CONSULTATION');
          setActiveToken(inConsult || null);
        }
      });

      socket.on('patient_called', (data) => {
        setLastCalled(data);
        audioService.announce(data.tokenNumber, data.patientName, profile.roomNumber);
      });
    } catch (e) {
      console.warn('[Socket] Backend unavailable. Operating in local mode.');
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [serverUrl, clinicId, profile.roomNumber]);

  // CALL NEXT Action with Dynamic Duration Tracker & WhatsApp Trigger 2
  const handleCallNext = async () => {
    if (!audioReady) {
      audioService.initContext();
      setAudioReady(true);
    }

    const now = Date.now();
    let newDurations = [...completedDurations];

    // 1. Calculate duration for current patient
    let durationMins = null;
    if (activeToken && activeToken.consultationStartTime) {
      durationMins = Number(((now - activeToken.consultationStartTime) / 60000).toFixed(1));
      newDurations.push(Math.max(0.5, durationMins));
      setCompletedDurations(newDurations);
    }

    // 2. Find next waiting patient
    const waitingTokens = queue.filter((t) => t.status === 'WAITING');
    if (waitingTokens.length === 0) {
      if (activeToken) {
        setQueue((prev) =>
          prev.map((t) => (t.id === activeToken.id ? { ...t, status: 'COMPLETED', durationMinutes: durationMins, consultationEndTime: now } : t))
        );
        setActiveToken(null);
      }
      alert('Queue is empty! Patients can register via the Patient QR View.');
      return;
    }

    const nextPatient = waitingTokens[0];

    // 3. Advance queue
    const updatedQueue = queue.map((t) => {
      if (t.status === 'IN_CONSULTATION') {
        return { ...t, status: 'COMPLETED', durationMinutes: durationMins, consultationEndTime: now };
      }
      if (t.id === nextPatient.id) {
        return { ...t, status: 'IN_CONSULTATION', consultationStartTime: now };
      }
      return t;
    });

    const newActive = { ...nextPatient, status: 'IN_CONSULTATION', consultationStartTime: now };
    setQueue(updatedQueue);
    setActiveToken(newActive);
    setLastCalled(newActive);

    // 4. Audio Chime & Speech Announcement
    audioService.announce(nextPatient.tokenNumber, nextPatient.patient?.name, profile.roomNumber);

    // 5. Trigger 2: WhatsApp notification when doctor calls patient
    const waMessage = `Token ${nextPatient.tokenNumber}: Dr. ${profile.doctorName} is ready for you now. Please step inside ${profile.roomNumber}.`;
    dispatchWhatsAppMessage(nextPatient.patient?.phone, waMessage, 'CALL_NEXT');

    if (isConnected) {
      try {
        await fetch(`${serverUrl}/api/tokens/call-next`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinicId }),
        });
      } catch (e) {}
    }
  };

  // Register Token Action with WhatsApp Trigger 1
  const handleRegisterToken = async (name, phone, complaint) => {
    const waitingCount = queue.filter((t) => t.status === 'WAITING').length;
    const patientPosition = waitingCount + 1;
    const benchmarkTime = avgConsultationTime > 0 ? avgConsultationTime : (profile.avgConsultationTime || 8.0);
    const estimatedWaitMinutes = Math.round(patientPosition * benchmarkTime);

    const tokenCount = queue.length + 1;
    const tokenNumber = `A-${String(tokenCount).padStart(2, '0')}`;

    const newToken = {
      id: Date.now(),
      tokenNumber,
      complaint: complaint || 'General Consultation',
      status: 'WAITING',
      patient: {
        id: Date.now() + 1,
        name: name.trim(),
        phone: phone.trim(),
        age: 32,
        gender: 'Adult',
      },
      createdAt: new Date().toISOString(),
    };

    setQueue((prev) => [...prev, newToken]);
    setMyTokenId(newToken.id);

    // Trigger 1: WhatsApp message on token registration
    const waMessage = `Hello ${name.trim()}, your Token number is ${tokenNumber} at ${profile.clinicName}. Estimated wait time: ~${estimatedWaitMinutes} mins (${waitingCount} patients ahead of you).`;
    dispatchWhatsAppMessage(phone, waMessage, 'REGISTER');

    // Dispatch directly to full 24/7 Render Webhook URL
    const RENDER_BACKEND_URL = 'https://smart-clinic-whatsapp-webhook.onrender.com';
    try {
      fetch(`${RENDER_BACKEND_URL}/api/send-token-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          clinicSlug: profile.clinicSlug || 'apollo-clinic',
          name,
          phone,
          tokenNumber,
          estWaitTime: `~${estimatedWaitMinutes} mins`,
          clinicName: profile.clinicName,
          doctorName: profile.doctorName,
          roomNumber: profile.roomNumber
        }),
      }).catch(() => {});
    } catch (e) {}

    return newToken;
  };

  // Complete Consultation Action
  const handleCompleteConsultation = async (tokenId, rxNotes, templateName) => {
    const now = Date.now();
    let newDurations = [...completedDurations];

    let durationMins = null;
    if (activeToken && activeToken.consultationStartTime) {
      durationMins = Number(((now - activeToken.consultationStartTime) / 60000).toFixed(1));
      newDurations.push(Math.max(0.5, durationMins));
      setCompletedDurations(newDurations);
    }

    const completedRecord = {
      id: tokenId,
      tokenNumber: activeToken?.tokenNumber || 'A-01',
      patient: activeToken?.patient || {},
      complaint: activeToken?.complaint || 'General Consultation',
      status: 'COMPLETED',
      rxNotes,
      templateName,
      durationMinutes: durationMins,
      consultationEndTime: now,
    };

    setQueue((prev) =>
      prev.map((t) =>
        t.id === tokenId
          ? { ...t, status: 'COMPLETED', rxNotes, templateName, durationMinutes: durationMins, consultationEndTime: now }
          : t
      )
    );
    setActiveToken(null);

    // Open in-app prescription preview modal with dedicated manual download button
    setViewingRxToken(completedRecord);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20 text-slate-950 font-black text-xl">
            +
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-extrabold text-lg tracking-tight text-white">{profile.clinicName}</h1>
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>ACTIVE OPD</span>
              </span>
            </div>
            {canManageDoctors && (
              <p className="text-xs text-slate-400 hidden sm:block">
                {profile.doctorName} • {profile.roomNumber}
              </p>
            )}
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs sm:text-sm font-medium">
          <button
            onClick={() => setCurrentView('doctor')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition ${
              currentView === 'doctor'
                ? 'bg-teal-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>🩺 Doctor Console</span>
          </button>
          <button
            onClick={() => setCurrentView('patient')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition ${
              currentView === 'patient'
                ? 'bg-teal-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>📱 Patient QR View</span>
          </button>
          <button
            onClick={() => setCurrentView('tv')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition ${
              currentView === 'tv'
                ? 'bg-teal-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>📺 Waiting Room TV</span>
          </button>
          <button
            onClick={() => setCurrentView('split')}
            className={`hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg transition ${
              currentView === 'split'
                ? 'bg-indigo-600 text-white shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>🔀 Split View</span>
          </button>
        </div>

        {/* Top Controls: Audio Ready & Settings */}
        <div className="flex items-center space-x-2.5 text-xs">
          <button
            onClick={handleAudioReadyToggle}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border font-bold transition cursor-pointer ${
              audioReady
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 ring-1 ring-emerald-500/30'
                : 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold animate-pulse'
            }`}
          >
            <span>{audioReady ? '🔊 Audio Ready' : '⚡ Click: Enable Audio'}</span>
          </button>

          <button
            onClick={() => setCurrentView('super_admin')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-teal-500/20 hover:from-cyan-500/30 text-cyan-300 border border-cyan-500/30 font-bold transition cursor-pointer shadow-sm"
            title="Open GOYOH Health Connect Super Admin Panel"
          >
            <span>⚡ Super Admin</span>
          </button>

          {isClinicAuthed ? (
            <button
              onClick={() => {
                setIsClinicAuthed(false);
                try {
                  localStorage.removeItem('smart_clinic_authed');
                } catch (e) {}
                setCurrentView('clinic_login');
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold transition cursor-pointer"
              title="Log out of this clinic console"
            >
              <span>🚪 Logout</span>
            </button>
          ) : (
            <button
              onClick={() => setCurrentView('clinic_login')}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition cursor-pointer"
              title="Clinic Provider Login"
            >
              <span>🔐 Login</span>
            </button>
          )}

          {canManageDoctors && (
            <>
              <button
                onClick={() => {
                  setDoctorModalTab('add');
                  setShowTenantModal(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black transition cursor-pointer shadow-md shadow-emerald-500/20"
                title="Add a new doctor under this clinic"
              >
                <span>➕ Add Doctor</span>
              </button>

              <button
                onClick={() => {
                  setDoctorModalTab('list');
                  setShowTenantModal(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium transition cursor-pointer"
                title="Manage clinic doctors & consultation rooms"
              >
                <span>👨‍⚕️</span>
                <span>Manage Doctors ({clinicDoctors.length})</span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition cursor-pointer"
          >
            <span>⚙️ Settings</span>
          </button>

          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
            <span className="text-slate-400">Avg Consult:</span>
            <span className="font-extrabold text-teal-400 font-mono">
              {avgConsultationTime > 0 ? `${avgConsultationTime}m` : '0m'}
            </span>
          </div>
        </div>
      </header>

      {/* Floating WhatsApp Dispatched Alerts Toast */}
      {whatsAppNotifications.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full space-y-2 pointer-events-none">
          {whatsAppNotifications.slice(0, 2).map((item) => (
            <div
              key={item.id}
              className="pointer-events-auto bg-slate-900/95 border-2 border-emerald-500/60 rounded-2xl p-3.5 shadow-2xl backdrop-blur text-xs flex flex-col space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 flex items-center space-x-1">
                  <span>💬 WhatsApp Dispatched</span>
                  <span className="text-[10px] text-slate-400">({item.time})</span>
                </span>
                <button
                  onClick={() => setWhatsAppNotifications((prev) => prev.filter((n) => n.id !== item.id))}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <p className="text-slate-200 font-mono text-[11px] leading-relaxed bg-slate-950 p-2 rounded-lg border border-slate-800">
                {item.text}
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-400">To: {item.phone}</span>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-teal-400 hover:underline flex items-center space-x-0.5"
                >
                  <span>Open in WhatsApp Web ↗</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xl">⚙️</span>
                <h3 className="font-extrabold text-white text-lg">Doctor & Clinic Settings</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowSettingsModal(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="font-bold text-slate-300 uppercase tracking-wider block mb-1">Doctor Name *</label>
                <input
                  type="text"
                  required
                  value={profile.doctorName}
                  onChange={(e) => setProfile({ ...profile, doctorName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 uppercase tracking-wider block mb-1">Specialization *</label>
                <input
                  type="text"
                  required
                  value={profile.specialization}
                  onChange={(e) => setProfile({ ...profile, specialization: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 uppercase tracking-wider block mb-1">Room / Counter *</label>
                  <input
                    type="text"
                    required
                    value={profile.roomNumber}
                    onChange={(e) => setProfile({ ...profile, roomNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 uppercase tracking-wider block mb-1">Current Rolling Avg</label>
                  <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-teal-400 font-mono font-bold">
                    {avgConsultationTime} mins ({completedDurations.length} today)
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 uppercase tracking-wider block mb-1">Clinic Name *</label>
                <input
                  type="text"
                  required
                  value={profile.clinicName}
                  onChange={(e) => setProfile({ ...profile, clinicName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400 flex items-center space-x-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Queue auto-resets daily at midnight</span>
                </span>

                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-teal-500/25 transition cursor-pointer"
                >
                  Save & Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-Clinic Manage Doctors Module */}
      <DoctorTenantModal
        isOpen={showTenantModal}
        clinicDoctors={clinicDoctors}
        doctorsList={clinicDoctors}
        activeDoctor={profile}
        initialTab={doctorModalTab}
        onSwitch={handleSwitchDoctor}
        onCreateDoctor={handleCreateDoctor}
        onDeleteDoctor={handleDeleteDoctor}
        onClose={() => setShowTenantModal(false)}
      />

      {/* Prescription Preview Modal with Explicit Manual Download */}
      <PrescriptionPreviewModal
        isOpen={Boolean(viewingRxToken)}
        token={viewingRxToken}
        doctor={profile}
        onClose={() => setViewingRxToken(null)}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col">
        {currentView === 'super_admin' && (
          isSuperAdminAuthed ? (
            <SuperAdminDashboard
              clinics={clinicsList}
              doctors={doctorsList}
              queues={{ [profile.clinicSlug]: queue }}
              onOnboardClinic={handleOnboardClinic}
              onToggleClinicStatus={handleToggleClinicStatus}
              onSwitchToClinic={handleSwitchToClinic}
              onDeleteClinic={handleDeleteClinic}
              onNavigateTo={(path) => {
                if (path === '/dashboard') setCurrentView('doctor');
                else if (path.startsWith('/clinic/')) {
                  const targetSlug = path.replace(/^\/clinic\//, '').split('/')[0];
                  const matchClinic = clinicsList.find((c) => c.slug === targetSlug || c.clinicId === targetSlug);
                  if (matchClinic) handleSwitchToClinic(matchClinic);
                  else setCurrentView('doctor');
                } else if (path.startsWith('/portal/')) {
                  const targetSlug = path.replace('/portal/', '');
                  const matchClinic = clinicsList.find((c) => c.slug === targetSlug || c.clinicId === targetSlug);
                  if (matchClinic) handleSwitchToClinic(matchClinic);
                  else setCurrentView('doctor');
                } else if (path.startsWith('/q/')) {
                  setCurrentView('patient');
                } else if (path.startsWith('/tv/')) {
                  setCurrentView('tv');
                } else if (path === '/login') setCurrentView('clinic_login');
                else if (path === '/super-admin/login') setCurrentView('super_admin_login');
              }}
              onLogout={() => {
                setIsSuperAdminAuthed(false);
                setCurrentView('super_admin_login');
              }}
            />
          ) : (
            <SuperAdminLogin
              onLoginSuccess={() => {
                setIsSuperAdminAuthed(true);
                setCurrentView('super_admin');
              }}
              onNavigateTo={(path) => {
                if (path === '/login') setCurrentView('clinic_login');
                else if (path === '/dashboard') setCurrentView('doctor');
              }}
            />
          )
        )}

        {currentView === 'super_admin_login' && (
          <SuperAdminLogin
            onLoginSuccess={() => {
              setIsSuperAdminAuthed(true);
              setCurrentView('super_admin');
            }}
            onNavigateTo={(path) => {
              if (path === '/login') setCurrentView('clinic_login');
              else if (path === '/dashboard') setCurrentView('doctor');
            }}
          />
        )}

        {currentView === 'clinic_login' && (
          <ClinicLogin
            clinics={clinicsList}
            doctors={doctorsList}
            onLoginSuccess={(doc, clinic) => {
              setProfile(doc);
              setIsClinicAuthed(true);
              try {
                localStorage.setItem('smart_clinic_authed', 'true');
                localStorage.setItem('smart_clinic_profile', JSON.stringify(doc));
              } catch (e) {}
              setCurrentView('doctor');
            }}
            onNavigateTo={(path) => {
              if (path === '/super-admin') setCurrentView('super_admin');
              else if (path === '/super-admin/login') setCurrentView('super_admin_login');
              else if (path === '/dashboard') setCurrentView('doctor');
            }}
          />
        )}

        {currentView === 'doctor' && (
          !isClinicAuthed ? (
            <ClinicLogin
              clinics={clinicsList}
              doctors={doctorsList}
              onLoginSuccess={(doc, clinic) => {
                setProfile(doc);
                setIsClinicAuthed(true);
                try {
                  localStorage.setItem('smart_clinic_authed', 'true');
                  localStorage.setItem('smart_clinic_profile', JSON.stringify(doc));
                } catch (e) {}
                setCurrentView('doctor');
              }}
              onNavigateTo={(path) => {
                if (path === '/super-admin') setCurrentView('super_admin');
                else if (path === '/super-admin/login') setCurrentView('super_admin_login');
                else if (path === '/dashboard') setCurrentView('doctor');
              }}
            />
          ) : (
            <DoctorDashboard
              profile={profile}
              queue={queue}
              activeToken={activeToken}
              avgConsultationTime={avgConsultationTime}
              completedDurations={completedDurations}
              onCallNext={handleCallNext}
              onComplete={handleCompleteConsultation}
              onViewRx={(token) => setViewingRxToken(token)}
              onOpenSettings={() => setShowSettingsModal(true)}
            />
          )
        )}

        {currentView === 'patient' && (
          <PatientMobileView
            profile={profile}
            queue={queue}
            myTokenId={myTokenId}
            avgConsultationTime={avgConsultationTime}
            onRegister={handleRegisterToken}
          />
        )}

        {currentView === 'tv' && (
          <WaitingRoomTV
            profile={profile}
            queue={queue}
            lastCalled={lastCalled}
            audioReady={audioReady}
            onEnableAudio={handleAudioReadyToggle}
          />
        )}

        {currentView === 'split' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 overflow-hidden">
            <div className="overflow-y-auto max-h-screen">
              <div className="p-2 bg-slate-900 border-b border-slate-800 text-xs font-bold text-teal-400 uppercase tracking-wider flex justify-between items-center">
                <span>🩺 Doctor Console</span>
                <span className="text-slate-400 text-[10px]">Avg: {avgConsultationTime}m</span>
              </div>
              <DoctorDashboard
                profile={profile}
                queue={queue}
                activeToken={activeToken}
                avgConsultationTime={avgConsultationTime}
                completedDurations={completedDurations}
                onCallNext={handleCallNext}
                onComplete={handleCompleteConsultation}
                onViewRx={(token) => setViewingRxToken(token)}
                onOpenSettings={() => setShowSettingsModal(true)}
                compact={true}
              />
            </div>
            <div className="overflow-y-auto max-h-screen bg-slate-950 flex flex-col items-center p-3">
              <div className="w-full p-2 bg-slate-900 border-b border-slate-800 text-xs font-bold text-teal-400 uppercase tracking-wider mb-3">
                📱 Patient Mobile QR View
              </div>
              <div className="w-full max-w-[390px] border-4 border-slate-700 rounded-[40px] shadow-2xl overflow-hidden bg-slate-950">
                <PatientMobileView
                  profile={profile}
                  queue={queue}
                  myTokenId={myTokenId}
                  avgConsultationTime={avgConsultationTime}
                  onRegister={handleRegisterToken}
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-screen">
              <div className="p-2 bg-slate-900 border-b border-slate-800 text-xs font-bold text-teal-400 uppercase tracking-wider">
                📺 Waiting Lounge TV Display
              </div>
              <WaitingRoomTV
                profile={profile}
                queue={queue}
                lastCalled={lastCalled}
                audioReady={audioReady}
                onEnableAudio={handleAudioReadyToggle}
                compact={true}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
