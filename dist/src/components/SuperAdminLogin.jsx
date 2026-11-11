import React, { useState } from 'react';

export default function SuperAdminLogin({
  onLoginSuccess,
  onNavigateTo
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMasterSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg('Please enter both master username/email and password.');
      return;
    }

    setIsSubmitting(true);

    // Validate master platform owner credentials
    const isMasterUser =
      cleanUser === 'superadmin@goyoh.com' ||
      cleanUser === 'superadmin' ||
      cleanUser === 'admin' ||
      cleanUser === 'goyoh_owner';

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between max-w-4xl w-full mx-auto pb-4 border-b border-slate-800 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-teal-500/20">
            G
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white">GOYOH Health Connect</h1>
            <p className="text-[11px] text-cyan-400 font-semibold">Master Platform Operations</p>
          </div>
        </div>

        <button
          onClick={() => onNavigateTo && onNavigateTo('/login')}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer flex items-center space-x-1.5"
        >
          <span>← Clinic Portal Login</span>
        </button>
      </header>

      {/* Master Login Card */}
      <main className="flex-1 flex items-center justify-center py-8 relative z-10">
        <div className="max-w-md w-full bg-slate-900/95 border-2 border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-500/10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-teal-500/20 border border-cyan-500/40 flex items-center justify-center text-2xl shadow-inner">
              🛡️
            </div>
            <span className="text-[10px] font-black text-cyan-300 uppercase tracking-widest bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30">
              PLATFORM OWNER MASTER ACCESS
            </span>
            <h2 className="text-2xl font-black text-white mt-2">Super Admin Portal</h2>
            <p className="text-xs text-slate-400">
              Restricted control center to manage onboarded clinics, credentials, and telemetry
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-semibold leading-relaxed animate-fade-in">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleMasterSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Master Username or Admin Email *
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="superadmin@goyoh.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Master Security Password *
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              {isSubmitting ? 'Verifying Master Credentials...' : 'Authenticate Master Session →'}
            </button>
          </form>

          {/* Quick Demo Master Access Button */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              ⚡ Platform Owner Testing Access:
            </span>
            <button
              type="button"
              onClick={handleQuickMasterLogin}
              className="w-full p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 rounded-xl text-left transition cursor-pointer flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition">
                  1-Click Master Access
                </div>
                <div className="text-[10px] text-slate-400">superadmin@goyoh.com • admin123</div>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 font-bold bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                Enter Control Center →
              </span>
            </button>
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => onNavigateTo && onNavigateTo('/login')}
              className="text-xs text-slate-400 hover:text-white transition"
            >
              ← Back to Clinic Staff Login (/login)
            </button>
          </div>
        </div>
      </main>

      <footer className="text-center py-3 text-xs text-slate-500 border-t border-slate-900 relative z-10">
        GOYOH Health Connect • Protected Master Operations Console
      </footer>
    </div>
  );
}
