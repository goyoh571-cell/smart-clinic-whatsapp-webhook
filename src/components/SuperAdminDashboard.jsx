import React, { useState, useMemo } from 'react';

export default function SuperAdminDashboard({
  clinics,
  doctors,
  queues,
  onOnboardClinic,
  onToggleClinicStatus,
  onSwitchToClinic,
  onDeleteClinic,
  onNavigateTo,
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

  // Form State for Onboarding
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

  // Auto-generate preview slug & ID
  const previewSlug = useMemo(() => {
    if (!ownerName && !clinicName) return 'clinic-preview';
    return `${ownerName}-${clinicName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }, [ownerName, clinicName]);

  const previewClinicId = useMemo(() => {
    if (customClinicId.trim()) return customClinicId.trim().toUpperCase();
    if (!clinicName) return 'CLN-XXXX';
    const clean = clinicName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    return `CLN-${clean}-2026`;
  }, [customClinicId, clinicName]);

  // Global Platform Metrics Calculations
  const metrics = useMemo(() => {
    const totalClinics = clinics.length;
    const activeClinics = clinics.filter((c) => c.status !== 'SUSPENDED').length;
    const suspendedClinics = totalClinics - activeClinics;
    const totalSeats = clinics.reduce((acc, c) => acc + (Number(c.doctorSeats) || 1), 0);
    const totalDoctors = doctors.length;

    let activeConsultations = 0;
    let completedConsultations = 0;

    Object.values(queues).forEach((qList) => {
      if (Array.isArray(qList)) {
        qList.forEach((token) => {
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

  // Filtered Clinics List
  const filteredClinics = useMemo(() => {
    return clinics.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.clinicId && c.clinicId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.ownerName && c.ownerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.slug && c.slug.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && c.status !== 'SUSPENDED') ||
        (statusFilter === 'SUSPENDED' && c.status === 'SUSPENDED');

      const matchPlan = planFilter === 'ALL' || c.subscriptionPlan === planFilter;

      return matchSearch && matchStatus && matchPlan;
    });
  }, [clinics, searchTerm, statusFilter, planFilter]);

  const handlePlanChange = (plan) => {
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

  const handleOnboardSubmit = (e) => {
    e.preventDefault();
    if (!clinicName.trim() || !ownerName.trim() || !email.trim()) return;

    setIsSubmitting(true);
    const finalClinicId = previewClinicId;
    const finalPassword = initialPassword.trim() || `Goyoh@${Math.floor(1000 + Math.random() * 9000)}`;

    const newClinicData = {
      clinicId: finalClinicId,
      name: clinicName.trim(),
      ownerName: ownerName.trim(),
      email: email.trim(),
      phone: phone.trim() || '+91 98000 00000',
      address: address.trim() || 'Suite 101, Medical Park',
      subscriptionPlan,
      doctorSeats: Number(doctorSeats) || 3,
      initialPassword: finalPassword,
      status: 'ACTIVE'
    };

    const created = onOnboardClinic(newClinicData);
    setIsSubmitting(false);
    setShowOnboardModal(false);

    // Show credential success modal
    setCreatedCredentialsModal({
      clinicId: finalClinicId,
      clinicName: newClinicData.name,
      ownerName: newClinicData.ownerName,
      email: newClinicData.email,
      password: finalPassword,
      slug: created?.slug || previewSlug
    });

    // Reset Form
    setClinicName('');
    setOwnerName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCustomClinicId('');
    setInitialPassword('');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Super Admin Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 sticky top-0 z-40 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-teal-500/20">
            G
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="font-black text-xl tracking-tight text-white">GOYOH Health Connect</h1>
              <span className="px-2.5 py-0.5 text-[11px] font-black rounded-full bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                SUPER ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Multi-Tenant Healthcare OS • Global Operations & Platform Telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-400 font-semibold">Tenant Isolation:</span>
            <span className="text-emerald-400 font-mono font-bold">100% SECURE</span>
          </div>

          <button
            onClick={() => setShowOnboardModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-teal-500/20 uppercase tracking-wider transition cursor-pointer flex items-center space-x-1.5"
          >
            <span>➕ Onboard New Clinic</span>
          </button>

          <button
            onClick={() => onNavigateTo && onNavigateTo('/dashboard')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer flex items-center space-x-1"
          >
            <span>🏥 Clinic Portal →</span>
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="px-3 py-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1"
              title="Logout Super Admin"
            >
              <span>🚪 Logout</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Global Platform Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 p-5 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">TOTAL CLINICS</span>
              <span className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center text-sm font-bold">
                🏢
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-3">
              <h2 className="text-4xl font-black text-white font-mono">{metrics.totalClinics}</h2>
              <div className="flex items-center space-x-1.5 text-xs font-bold">
                <span className="text-emerald-400">{metrics.activeClinics} Active</span>
                <span className="text-slate-600">•</span>
                <span className="text-rose-400">{metrics.suspendedClinics} Suspended</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">Independent tenants on GOYOH network</p>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 p-5 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ACTIVE CONSULTATIONS</span>
              <span className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-bold">
                ⚡
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-3">
              <h2 className="text-4xl font-black text-amber-400 font-mono">{metrics.activeConsultations}</h2>
              <span className="text-xs font-bold text-amber-300/80">Live in Queue</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">Across all clinic waiting lounges right now</p>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 p-5 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">DOCTOR CAPACITY</span>
              <span className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold">
                🩺
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-3">
              <h2 className="text-4xl font-black text-white font-mono">{metrics.totalDoctors}</h2>
              <span className="text-xs font-bold text-slate-400">/ {metrics.totalSeats} Total Seats</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">Licensed doctor seats across SaaS subscriptions</p>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 p-5 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">CONSULTATIONS COMPLETED</span>
              <span className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">
                📜
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-3">
              <h2 className="text-4xl font-black text-emerald-400 font-mono">{metrics.completedConsultations}</h2>
              <span className="text-xs font-bold text-emerald-300/80">Rx Generated</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">Verified digital prescriptions delivered</p>
          </div>
        </div>

        {/* Clinics Management Section */}
        <div className="bg-slate-900/80 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          {/* Controls Bar: Search & Filters */}
          <div className="p-5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 bg-slate-900/90">
            <div>
              <h3 className="text-lg font-black text-white">Onboarded Clinic Tenants</h3>
              <p className="text-xs text-slate-400">Manage tenant isolation, doctor allocations, and subscription status</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[240px]">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search clinic, ID, owner, email..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-medium"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-semibold"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">🟢 Active Only</option>
                <option value="SUSPENDED">🔴 Suspended Only</option>
              </select>

              {/* Plan Filter */}
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-semibold"
              >
                <option value="ALL">All Subscription Plans</option>
                <option value="Free Trial">Free Trial</option>
                <option value="Starter">Starter</option>
                <option value="Professional">Professional</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          {/* Table of Clinics */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Clinic Tenant</th>
                  <th className="py-3.5 px-4">Clinic ID & Slug</th>
                  <th className="py-3.5 px-4">Owner / Contact</th>
                  <th className="py-3.5 px-4">Subscription Plan</th>
                  <th className="py-3.5 px-4">Seats & Doctors</th>
                  <th className="py-3.5 px-4">Live Queue</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredClinics.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-12 text-slate-500">
                      No clinics found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredClinics.map((clinic) => {
                    const clinicDoctors = doctors.filter((d) => d.clinicSlug === clinic.slug || d.clinicId === clinic.id);
                    const clinicQueue = queues[clinic.slug] || [];
                    const activeQueueCount = clinicQueue.filter(
                      (t) => t.status === 'WAITING' || t.status === 'IN_CONSULTATION'
                    ).length;
                    const isSuspended = clinic.status === 'SUSPENDED';

                    return (
                      <tr
                        key={clinic.id || clinic.slug}
                        className={`hover:bg-slate-800/40 transition ${
                          isSuspended ? 'bg-rose-950/10 opacity-80' : ''
                        }`}
                      >
                        {/* Clinic Tenant */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-teal-400">
                              +
                            </div>
                            <div>
                              <div className="font-extrabold text-white text-sm">{clinic.name}</div>
                              <div className="text-[11px] text-slate-400 line-clamp-1">{clinic.address || 'Standard Location'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Clinic ID & Slug */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-cyan-400 text-xs">
                            {clinic.clinicId || `CLN-${clinic.id}`}
                          </div>
                          <div className="flex flex-col space-y-1 mt-1 font-mono text-[10px]">
                            <button
                              type="button"
                              onClick={() => onNavigateTo && onNavigateTo(`/clinic/${clinic.slug}/dashboard`)}
                              className="text-left text-teal-400 hover:text-teal-300 hover:underline flex items-center space-x-1 cursor-pointer"
                              title="Open dedicated Doctor Portal for this clinic"
                            >
                              <span>🩺 /clinic/{clinic.slug}/dashboard</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onNavigateTo && onNavigateTo(`/q/${clinic.slug}`)}
                              className="text-left text-slate-400 hover:text-white hover:underline flex items-center space-x-1 cursor-pointer"
                              title="Open public patient check-in for this clinic"
                            >
                              <span>📱 /q/{clinic.slug}</span>
                            </button>
                          </div>
                        </td>

                        {/* Owner / Contact */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-200">{clinic.ownerName || 'Lead Doctor'}</div>
                          <div className="text-[11px] text-slate-400">{clinic.email}</div>
                          <div className="text-[10px] text-slate-500">{clinic.phone}</div>
                        </td>

                        {/* Subscription Plan */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              clinic.subscriptionPlan === 'Enterprise'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                : clinic.subscriptionPlan === 'Professional'
                                ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                                : clinic.subscriptionPlan === 'Starter'
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {clinic.subscriptionPlan || 'Standard'}
                          </span>
                        </td>

                        {/* Seats & Doctors */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-black text-white">{clinicDoctors.length}</span>
                            <span className="text-slate-500">/ {clinic.doctorSeats || 1} Seats</span>
                          </div>
                          <div className="w-20 bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div
                              className="bg-teal-400 h-1.5 rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round((clinicDoctors.length / (clinic.doctorSeats || 1)) * 100)
                                )}%`
                              }}
                            />
                          </div>
                        </td>

                        {/* Live Queue */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                activeQueueCount > 0 ? 'bg-amber-400 animate-ping' : 'bg-slate-600'
                              }`}
                            />
                            <span className="font-mono font-bold text-slate-200">
                              {activeQueueCount} Active
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">{clinicQueue.length} total today</span>
                        </td>

                        {/* Status Toggle */}
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => onToggleClinicStatus(clinic.clinicId || clinic.slug, isSuspended ? 'ACTIVE' : 'SUSPENDED')}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition cursor-pointer flex items-center space-x-1 ${
                              isSuspended
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                            }`}
                            title="Click to toggle Active / Suspended status"
                          >
                            <span>{isSuspended ? '🔴 SUSPENDED' : '🟢 ACTIVE'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Launch Clinic Scoped Portal */}
                            <button
                              onClick={() => onSwitchToClinic(clinic)}
                              disabled={isSuspended}
                              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition flex items-center space-x-1 ${
                                isSuspended
                                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                                  : 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border-teal-500/30 cursor-pointer'
                              }`}
                              title={isSuspended ? 'Clinic is suspended' : 'Launch isolated Doctor Portal'}
                            >
                              <span>🚀 Launch</span>
                            </button>

                            {/* Public Patient QR Route */}
                            <a
                              href={`/q/${clinic.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg border border-slate-700 transition"
                              title="Open Patient QR Check-In Route"
                            >
                              📱 QR
                            </a>

                            {/* Quick Credential Viewer */}
                            <button
                              onClick={() => {
                                setCreatedCredentialsModal({
                                  clinicId: clinic.clinicId || `CLN-${clinic.id}`,
                                  clinicName: clinic.name,
                                  ownerName: clinic.ownerName,
                                  email: clinic.email,
                                  password: clinic.initialPassword || 'clinic123',
                                  slug: clinic.slug
                                });
                              }}
                              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700"
                              title="View Access Credentials"
                            >
                              🔑
                            </button>

                            {/* Delete Clinic */}
                            {onDeleteClinic && (
                              <button
                                type="button"
                                onClick={() => setClinicToDelete(clinic)}
                                className="px-2 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs rounded-lg border border-rose-500/30 cursor-pointer transition"
                                title="Permanently delete clinic and all associated records"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL: ONBOARD NEW CLINIC */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border-2 border-teal-500/40 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 font-bold text-lg">
                  ➕
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Onboard New Clinic Tenant</h3>
                  <p className="text-xs text-slate-400">Deploy isolated instance with auto-generated credentials</p>
                </div>
              </div>
              <button
                onClick={() => setShowOnboardModal(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Clinic Name *</label>
                  <input
                    type="text"
                    required
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="e.g. Apollo Cradle Clinic"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Owner / Primary Doctor *</label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Dr. Ramesh Gupta"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Admin Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@clinic.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Phone / WhatsApp Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98450 12345"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Clinic Physical Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 12th Cross, Indiranagar, Bangalore"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Subscription Plan</label>
                  <select
                    value={subscriptionPlan}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-semibold"
                  >
                    <optgroup label="14-Day Free Trials (₹0)">
                      <option value="Free Trial (14 Days — 1 Seat) (₹0)">Free Trial (14 Days — 1 Seat) (₹0)</option>
                      <option value="Free Trial (14 Days — 2 to 5 Seats) (₹0)">Free Trial (14 Days — 2 to 5 Seats) (₹0)</option>
                      <option value="Free Trial (14 Days — Unlimited Seats) (₹0)">Free Trial (14 Days — Unlimited Seats) (₹0)</option>
                    </optgroup>
                    <optgroup label="Annual Paid Tiers">
                      <option value="Starter / Solo (₹9,999/yr)">Starter / Solo (₹9,999/yr) — 1 Seat</option>
                      <option value="Professional (₹19,999/yr)">Professional (₹19,999/yr) — Up to 5 Seats</option>
                      <option value="Enterprise (₹49,999/yr)">Enterprise (₹49,999/yr) — Unlimited Seats</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Doctor Seats Allocated</label>
                  <input
                    type="number"
                    min={subscriptionPlan.includes('2 to 5') ? "2" : "1"}
                    max={subscriptionPlan.includes('2 to 5') ? "5" : (subscriptionPlan.includes('1 Seat') ? "1" : "1000")}
                    disabled={subscriptionPlan.includes('1 Seat') || subscriptionPlan.includes('Unlimited')}
                    value={subscriptionPlan.includes('Unlimited') ? 999 : doctorSeats}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (subscriptionPlan.includes('2 to 5')) {
                        setDoctorSeats(Math.min(5, Math.max(2, val)));
                      } else {
                        setDoctorSeats(val);
                      }
                    }}
                    className={`w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-mono ${
                      (subscriptionPlan.includes('1 Seat') || subscriptionPlan.includes('Unlimited')) ? 'opacity-70 cursor-not-allowed bg-slate-900' : ''
                    }`}
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {subscriptionPlan.includes('1 Seat')
                      ? '🔒 Locked: 1 Doctor Seat allowed for 1-Seat Trial.'
                      : subscriptionPlan.includes('2 to 5')
                      ? '⚡ Allowed: 2 to 5 Doctor Seats for this Trial tier.'
                      : subscriptionPlan.includes('Unlimited')
                      ? '🚀 Unlimited Doctor Seats enabled.'
                      : 'Doctor seat quota for this tier.'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-950 border border-teal-500/30 rounded-2xl text-xs space-y-1.5 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold">Tier Plan:</span>
                  <span className="text-emerald-400 font-bold">
                    {subscriptionPlan.includes('Trial') ? '14-Day Free Trial (₹0 Active Period)' : 'Annual Paid Tier'}
                  </span>
                </div>
                {subscriptionPlan.includes('Trial') ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Post-Trial Conversion:</span>
                    <span className="text-amber-400 font-mono font-bold">
                      ➔ {subscriptionPlan.includes('1 Seat')
                        ? 'Starter / Solo (₹9,999/yr)'
                        : subscriptionPlan.includes('2 to 5')
                        ? 'Professional (₹19,999/yr)'
                        : 'Enterprise (₹49,999/yr)'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Billing Rate:</span>
                    <span className="text-teal-300 font-mono font-bold">
                      {subscriptionPlan.includes('Starter') ? '₹9,999/yr' : (subscriptionPlan.includes('Enterprise') ? '₹49,999/yr' : '₹19,999/yr')}
                    </span>
                  </div>
                )}
                <p className="text-[10px] text-slate-400">
                  {subscriptionPlan.includes('Trial')
                    ? '14-day free access. Locks account upon expiration unless paid subscription is verified.'
                    : 'Continuous paid access with full clinic capabilities.'}
                </p>
              </div>

              {/* ID & Initial Password Settings */}
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-teal-400 uppercase">
                  <span>Tenant Credentials & Access</span>
                  <span className="text-[10px] text-slate-500">Auto-Generated by Default</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Clinic ID (Auto or Custom)
                    </label>
                    <input
                      type="text"
                      value={customClinicId}
                      onChange={(e) => setCustomClinicId(e.target.value)}
                      placeholder={previewClinicId}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Initial Password (Auto or Custom)
                    </label>
                    <input
                      type="text"
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                      placeholder="e.g. Goyoh@2026"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500">
                  Public Patient URL: <span className="text-slate-300 font-mono">/q/{previewSlug}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-3 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-teal-500/20"
                >
                  {isSubmitting ? 'Onboarding...' : '🚀 Provision & Launch Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREDENTIALS GENERATED DIALOG */}
      {createdCredentialsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl shadow-inner">
              ✓
            </div>

            <div>
              <h3 className="text-xl font-black text-white">Clinic Onboarded Successfully!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Tenant credentials created for <span className="text-teal-400 font-bold">{createdCredentialsModal.clinicName}</span>
              </p>
            </div>

            {/* Credentials Card */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-left space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Clinic ID:</span>
                <span className="font-bold text-cyan-400 text-sm">{createdCredentialsModal.clinicId}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Admin Email:</span>
                <span className="text-white font-bold">{createdCredentialsModal.email}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Initial Password:</span>
                <div className="flex items-center space-x-2">
                  <span className="text-emerald-400 font-bold">
                    {showPassword ? createdCredentialsModal.password : '••••••••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">🩺 Dedicated Clinic Dashboard:</span>
                <span className="text-cyan-300 font-bold">/clinic/{createdCredentialsModal.slug}/dashboard</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">📱 Public Patient QR:</span>
                <span className="text-teal-400 font-bold">/q/{createdCredentialsModal.slug}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">📺 Waiting Lounge TV:</span>
                <span className="text-amber-400 font-bold">/tv/{createdCredentialsModal.slug}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onSwitchToClinic) {
                    onSwitchToClinic({
                      slug: createdCredentialsModal.slug,
                      clinicId: createdCredentialsModal.clinicId,
                      name: createdCredentialsModal.clinicName,
                      ownerName: createdCredentialsModal.ownerName,
                      email: createdCredentialsModal.email
                    });
                  } else if (onNavigateTo) {
                    onNavigateTo('/dashboard');
                  }
                  setCreatedCredentialsModal(null);
                  setShowPassword(false);
                }}
                className="py-3 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-teal-500/20 flex items-center justify-center space-x-1"
              >
                <span>🚀 Launch Clinic Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const qrPath = `/q/${createdCredentialsModal.slug}`;
                  setCreatedCredentialsModal(null);
                  setShowPassword(false);
                  if (onNavigateTo) onNavigateTo(qrPath);
                }}
                className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 transition cursor-pointer flex items-center justify-center space-x-1"
              >
                <span>📱 Patient QR</span>
              </button>
            </div>

            {/* Copy Button */}
            <button
              onClick={() => {
                const credString = `=== GOYOH HEALTH CONNECT TENANT ACCESS PACK ===\nClinic Name: ${createdCredentialsModal.clinicName}\nClinic ID: ${createdCredentialsModal.clinicId}\nAdmin Email: ${createdCredentialsModal.email}\nInitial Password: ${createdCredentialsModal.password}\n\n🔐 Doctor Login & Dashboard (Single Link for all clinics):\n${window.location.origin}/login (opens /dashboard)\n\n📱 Public Patient QR Self Check-in:\n${window.location.origin}/q/${createdCredentialsModal.slug}\n\n📺 Waiting Room TV Display:\n${window.location.origin}/tv/${createdCredentialsModal.slug}`;
                copyToClipboard(credString);
              }}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white font-bold rounded-xl text-xs border border-slate-800 transition cursor-pointer flex items-center justify-center space-x-2"
            >
              <span>{copyFeedback ? '✓ Copied All Links & Credentials!' : '📋 Copy All Links & Credentials'}</span>
            </button>

            <button
              onClick={() => {
                setCreatedCredentialsModal(null);
                setShowPassword(false);
              }}
              className="w-full py-2 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
            >
              Done & Close Modal
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM CLINIC DELETION */}
      {clinicToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border-2 border-rose-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 font-bold text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-black text-white">Permanently Delete Clinic</h3>
                <p className="text-xs text-rose-400 font-medium">Cloud Firestore & Auth Cascade Deletion</p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete <strong className="text-white">{clinicToDelete.name}</strong>?
            </p>
            <p className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              This will permanently delete this clinic document from Cloud Firestore and all associated records.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setClinicToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingClinic}
                onClick={async () => {
                  setIsDeletingClinic(true);
                  try {
                    await onDeleteClinic(clinicToDelete);
                    setClinicToDelete(null);
                  } catch (e) {
                    alert('Error deleting clinic: ' + (e.message || e));
                  } finally {
                    setIsDeletingClinic(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl flex items-center space-x-1"
              >
                <span>{isDeletingClinic ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
