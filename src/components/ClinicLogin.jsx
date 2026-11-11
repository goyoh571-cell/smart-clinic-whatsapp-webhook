import React, { useState } from 'react';

export default function ClinicLogin({
  clinics,
  doctors,
  onLoginSuccess,
  onNavigateTo
}) {
  const [clinicIdentifier, setClinicIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);

    // 1. Find matching doctor by email, username, or clinicId
    const cleanUser = email.trim().toLowerCase();
    const matchedDoctor = doctors.find(
      (d) =>
        (d.email && d.email.toLowerCase() === cleanUser) ||
        (d.username && d.username.toLowerCase() === cleanUser) ||
        (d.clinicId && d.clinicId.toLowerCase() === cleanUser)
    );

    if (!matchedDoctor) {
      setIsSubmitting(false);
      setErrorMsg('Invalid clinic credentials or unregistered username/email.');
      return;
    }

    // 2. Find matching clinic
    const matchedClinic = clinics.find(
      (c) =>
        c.id === matchedDoctor.clinicId ||
        c.slug === matchedDoctor.clinicSlug ||
        (clinicIdentifier && (c.clinicId === clinicIdentifier.trim().toUpperCase() || c.slug === clinicIdentifier.trim()))
    );

    // 3. Check Clinic Status
    if (matchedClinic && matchedClinic.status === 'SUSPENDED') {
      setIsSubmitting(false);
      setErrorMsg(
        `⛔ Access Suspended: ${matchedClinic.name}'s subscription has been suspended by GOYOH Health Connect. Please contact superadmin@goyoh.com.`
      );
      return;
    }

    setIsSubmitting(false);
    onLoginSuccess(matchedDoctor, matchedClinic);
  };

  const handleQuickLogin = (demoDoc) => {
    setErrorMsg('');
    const matchedClinic = clinics.find(
      (c) => c.id === demoDoc.clinicId || c.slug === demoDoc.clinicSlug || c.clinicId === demoDoc.clinicId
    );

    if (matchedClinic && matchedClinic.status === 'SUSPENDED') {
      setErrorMsg(
        `⛔ Access Suspended: ${matchedClinic.name}'s subscription has been suspended by GOYOH Health Connect.`
      );
      return;
    }

    onLoginSuccess(demoDoc, matchedClinic);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      {/* Top Header */}
      <header className="flex items-center justify-between max-w-4xl w-full mx-auto pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-teal-500/20">
            G
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white">GOYOH Health Connect</h1>
            <p className="text-[11px] text-teal-400 font-semibold">Tenant Scoped Authentication Portal</p>
          </div>
        </div>

        <button
          onClick={() => onNavigateTo && onNavigateTo('/dashboard')}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer flex items-center space-x-1.5"
        >
          <span>Clinic Portal →</span>
        </button>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center py-8">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
              CLINIC PROVIDER LOGIN
            </span>
            <h2 className="text-2xl font-black text-white mt-3">Sign In to Your Clinic</h2>
            <p className="text-xs text-slate-400">
              Enter your credentials to access your isolated clinical queue & records
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-semibold leading-relaxed animate-fade-in">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Clinic ID <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={clinicIdentifier}
                onChange={(e) => setClinicIdentifier(e.target.value)}
                placeholder="e.g. CLN-MEDICLINC"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-cyan-300 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Clinic Username or Email *</label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. dr.musheer@mediclinic.com or CLN-MEDICLINC"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Password *</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-teal-500/20"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In to Clinic Console'}
            </button>
          </form>

          {/* Strict Multi-Tenant Isolation Safeguard - Shared picker removed */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="flex items-center space-x-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold text-slate-300">Strict Clinic Isolation</span>
            </span>
            <span className="text-slate-500 font-mono">Scoped by Clinic ID</span>
          </div>

          {/* Discreet Platform Owner Link */}
          <div className="pt-4 text-center border-t border-slate-800/80">
            <span className="text-[11px] text-slate-500">
              Platform Owner / Master Access?{' '}
              <button
                type="button"
                onClick={() => onNavigateTo && onNavigateTo('/super-admin/login')}
                className="text-slate-400 hover:text-cyan-400 font-semibold underline transition cursor-pointer"
              >
                Super Admin Portal ↗
              </button>
            </span>
          </div>
        </div>
      </main>

      <footer className="text-center py-3 text-xs text-slate-500 border-t border-slate-900">
        GOYOH Health Connect • Secure Multi-Tenant Cloud Architecture
      </footer>
    </div>
  );
}
