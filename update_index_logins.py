import re
import sys

INDEX_FILE = r'C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.html'

with open(INDEX_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update parseLocationRoute and add isSuperAdminAuthed
old_resolver = '''      // URL Route Resolver
      const parseLocationRoute = useCallback(() => {
        const path = window.location.pathname || '';
        const hash = window.location.hash || '';
        const search = new URLSearchParams(window.location.search);

        if (path === '/super-admin' || path === '/admin' || hash === '#/super-admin' || hash === '#/admin') {
          return { mode: 'super_admin', slug: null };
        }
        if (path === '/login' || path === '/clinic-login' || hash === '#/login' || hash === '#/clinic-login') {
          return { mode: 'clinic_login', slug: null };
        }'''

new_resolver = '''      // Super Admin Master Authentication State
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

      // URL Route Resolver
      const parseLocationRoute = useCallback(() => {
        const path = window.location.pathname || '';
        const hash = window.location.hash || '';
        const search = new URLSearchParams(window.location.search);

        if (path === '/super-admin/login' || hash === '#/super-admin/login') {
          return { mode: 'super_admin_login', slug: null };
        }
        if (path === '/super-admin' || path === '/admin' || hash === '#/super-admin' || hash === '#/admin') {
          return { mode: 'super_admin', slug: null };
        }
        if (path === '/login' || path === '/clinic-login' || hash === '#/login' || hash === '#/clinic-login') {
          return { mode: 'clinic_login', slug: null };
        }'''

# Normalize line breaks for matching
content_normalized = content.replace('\r\n', '\n')
old_resolver_norm = old_resolver.replace('\r\n', '\n')
new_resolver_norm = new_resolver.replace('\r\n', '\n')

if old_resolver_norm not in content_normalized:
    print("ERROR: old_resolver not found in content!")
    sys.exit(1)

content_normalized = content_normalized.replace(old_resolver_norm, new_resolver_norm, 1)
print("Step 1 (Resolver & Auth State) matched and replaced.")

# 2. Update conditional rendering in App
old_renders = '''      // ======================================================================
      // CONDITIONAL RENDERING: SUPER ADMIN DASHBOARD (/super-admin or /admin)
      // ======================================================================
      if (currentRoute.mode === 'super_admin') {
        return (
          <SuperAdminDashboardView
            clinics={clinicsList}
            doctors={doctorsList}
            queues={clinicQueues}
            onOnboardClinic={handleOnboardClinic}
            onToggleClinicStatus={handleToggleClinicStatus}
            onSwitchToClinic={handleSwitchToClinic}
            onNavigateTo={navigateTo}
            onLogout={() => navigateTo('/login')}
          />
        );
      }

      // ======================================================================
      // CONDITIONAL RENDERING: CLINIC PROVIDER LOGIN (/login or /clinic-login)
      // ======================================================================
      if (currentRoute.mode === 'clinic_login') {
        return (
          <ClinicLoginView
            clinics={clinicsList}
            doctors={doctorsList}
            onLoginSuccess={(doc) => {
              setActiveDoctor(doc);
              navigateTo('/dashboard');
            }}
            onNavigateTo={navigateTo}
          />
        );
      }'''

new_renders = '''      // ======================================================================
      // CONDITIONAL RENDERING: SUPER ADMIN DASHBOARD (/super-admin or /admin)
      // ======================================================================
      if (currentRoute.mode === 'super_admin') {
        if (!isSuperAdminAuthed) {
          return (
            <SuperAdminLoginView
              onLoginSuccess={() => {
                setIsSuperAdminAuthed(true);
                try { localStorage.setItem('goyoh_super_admin_authed', 'true'); } catch(e){}
                navigateTo('/super-admin');
              }}
              onNavigateTo={navigateTo}
            />
          );
        }
        return (
          <SuperAdminDashboardView
            clinics={clinicsList}
            doctors={doctorsList}
            queues={clinicQueues}
            onOnboardClinic={handleOnboardClinic}
            onToggleClinicStatus={handleToggleClinicStatus}
            onSwitchToClinic={handleSwitchToClinic}
            onNavigateTo={navigateTo}
            onLogout={() => {
              setIsSuperAdminAuthed(false);
              try { localStorage.removeItem('goyoh_super_admin_authed'); } catch(e){}
              navigateTo('/super-admin/login');
            }}
          />
        );
      }

      // ======================================================================
      // CONDITIONAL RENDERING: SUPER ADMIN LOGIN (/super-admin/login)
      // ======================================================================
      if (currentRoute.mode === 'super_admin_login') {
        return (
          <SuperAdminLoginView
            onLoginSuccess={() => {
              setIsSuperAdminAuthed(true);
              try { localStorage.setItem('goyoh_super_admin_authed', 'true'); } catch(e){}
              navigateTo('/super-admin');
            }}
            onNavigateTo={navigateTo}
          />
        );
      }

      // ======================================================================
      // CONDITIONAL RENDERING: CLINIC PROVIDER LOGIN (/login or /clinic-login)
      // ======================================================================
      if (currentRoute.mode === 'clinic_login') {
        return (
          <ClinicLoginView
            clinics={clinicsList}
            doctors={doctorsList}
            onLoginSuccess={(doc, clinic) => {
              setActiveDoctor(doc);
              navigateTo('/dashboard');
            }}
            onNavigateTo={navigateTo}
          />
        );
      }'''

old_renders_norm = old_renders.replace('\r\n', '\n')
new_renders_norm = new_renders.replace('\r\n', '\n')

if old_renders_norm not in content_normalized:
    print("ERROR: old_renders not found in content!")
    sys.exit(1)

content_normalized = content_normalized.replace(old_renders_norm, new_renders_norm, 1)
print("Step 2 (Conditional Rendering) matched and replaced.")

# 3. Add explicit Logout button in SuperAdminDashboardView header
old_admin_header_btns = '''              <button
                type="button"
                onClick={() => onNavigateTo && onNavigateTo('/dashboard')}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer flex items-center space-x-1"
              >
                <span>🏥 Clinic Portal →</span>
              </button>
            </div>'''

new_admin_header_btns = '''              <button
                type="button"
                onClick={() => onNavigateTo && onNavigateTo('/dashboard')}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer flex items-center space-x-1"
              >
                <span>🏥 Clinic Portal →</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold rounded-xl border border-rose-500/30 transition cursor-pointer flex items-center space-x-1"
                title="Log out of Super Admin Portal"
              >
                <span>🚪 Logout</span>
              </button>
            </div>'''

old_admin_header_norm = old_admin_header_btns.replace('\r\n', '\n')
new_admin_header_norm = new_admin_header_btns.replace('\r\n', '\n')

if old_admin_header_norm not in content_normalized:
    print("ERROR: old_admin_header_btns not found!")
    sys.exit(1)

content_normalized = content_normalized.replace(old_admin_header_norm, new_admin_header_norm, 1)
print("Step 3 (Super Admin Header Logout) matched and replaced.")

# 4. Inject SuperAdminLoginView and update ClinicLoginView
old_clinic_login_view = '''    // ========================================================================
    // 10. VIEW: GOYOH HEALTH CONNECT - CLINIC PROVIDER LOGIN
    // ========================================================================
    function ClinicLoginView({
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

        const matchedDoctor = doctors.find(
          (d) => d.email.toLowerCase() === email.trim().toLowerCase()
        );

        if (!matchedDoctor) {
          setIsSubmitting(false);
          setErrorMsg('Invalid doctor credentials or unregistered email address.');
          return;
        }

        const matchedClinic = clinics.find(
          (c) =>
            c.id === matchedDoctor.clinicId ||
            c.slug === matchedDoctor.clinicSlug ||
            (clinicIdentifier && (c.clinicId === clinicIdentifier.trim().toUpperCase() || c.slug === clinicIdentifier.trim()))
        );

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
          (c) => c.id === demoDoc.clinicId || c.slug === demoDoc.clinicSlug
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
              type="button"
              onClick={() => onNavigateTo && onNavigateTo('/super-admin')}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer flex items-center space-x-1.5"
            >
              <span>⚡ Super Admin Panel →</span>
            </button>
          </header>

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
                  <label className="text-xs font-bold text-slate-300 block mb-1">Doctor / Admin Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@clinic.com"
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

              <div className="pt-4 border-t border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
                  ⚡ Quick 1-Click Demo Logins:
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {doctors.slice(0, 3).map((doc) => (
                    <button
                      key={doc.id || doc.email}
                      type="button"
                      onClick={() => handleQuickLogin(doc)}
                      className="w-full p-2.5 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{doc.doctorName}</div>
                        <div className="text-[10px] text-teal-400">{doc.clinicName}</div>
                      </div>
                      <span className="text-[11px] font-mono text-cyan-400 font-bold bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                        Log In →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </main>

          <footer className="text-center py-3 text-xs text-slate-500 border-t border-slate-900">
            GOYOH Health Connect • Secure Multi-Tenant Cloud Architecture
          </footer>
        </div>
      );
    }'''

new_combined_login_views = '''    // ========================================================================
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
          {/* Subtle Ambient Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Header */}
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
              type="button"
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
                    placeholder="superadmin@goyoh.com or superadmin"
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
                  className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
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

    // ========================================================================
    // 10. VIEW: GOYOH HEALTH CONNECT - CLINIC PROVIDER LOGIN (/login)
    // ========================================================================
    function ClinicLoginView({
      clinics,
      doctors,
      onLoginSuccess,
      onNavigateTo
    }) {
      const [clinicIdentifier, setClinicIdentifier] = useState('');
      const [usernameOrEmail, setUsernameOrEmail] = useState('');
      const [password, setPassword] = useState('');
      const [errorMsg, setErrorMsg] = useState('');
      const [isSubmitting, setIsSubmitting] = useState(false);

      const handleSubmit = (e) => {
        e.preventDefault();
        setErrorMsg('');

        const cleanUser = usernameOrEmail.trim().toLowerCase();
        const cleanPass = password.trim();

        if (!cleanUser || !cleanPass) {
          setErrorMsg('Please enter both clinic username/email and password.');
          return;
        }

        setIsSubmitting(true);

        // 1. Check matching doctor first
        let matchedDoctor = doctors.find(
          (d) =>
            (d.email && d.email.toLowerCase() === cleanUser) ||
            (d.username && d.username.toLowerCase() === cleanUser) ||
            (d.doctorName && d.doctorName.toLowerCase() === cleanUser) ||
            (d.clinicSlug && d.clinicSlug.toLowerCase() === cleanUser)
        );

        // 2. Check matching clinic if doctor was not found by email/username
        let matchedClinic = clinics.find(
          (c) =>
            c.email.toLowerCase() === cleanUser ||
            (c.clinicId && c.clinicId.toLowerCase() === cleanUser) ||
            (c.username && c.username.toLowerCase() === cleanUser) ||
            c.slug.toLowerCase() === cleanUser ||
            (clinicIdentifier && (c.clinicId.toLowerCase() === clinicIdentifier.trim().toLowerCase() || c.slug.toLowerCase() === clinicIdentifier.trim().toLowerCase()))
        );

        if (!matchedDoctor && matchedClinic) {
          matchedDoctor = doctors.find(
            (d) => d.clinicSlug === matchedClinic.slug || d.clinicId === matchedClinic.id || d.clinicId === matchedClinic.clinicId
          ) || {
            id: Date.now(),
            doctorName: matchedClinic.ownerName || 'Doctor',
            clinicName: matchedClinic.name,
            clinicSlug: matchedClinic.slug,
            clinicId: matchedClinic.clinicId,
            email: matchedClinic.email,
            specialization: 'Lead Physician & Clinic Admin',
            roomNumber: 'Consultation Room 1',
            avgConsultationTime: 8.0
          };
        }

        if (!matchedClinic && matchedDoctor) {
          matchedClinic = clinics.find(
            (c) =>
              c.id === matchedDoctor.clinicId ||
              c.slug === matchedDoctor.clinicSlug ||
              c.clinicId === matchedDoctor.clinicId
          );
        }

        if (!matchedDoctor) {
          setIsSubmitting(false);
          setErrorMsg('Invalid clinic credentials or unregistered username/email.');
          return;
        }

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
          {/* Header */}
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
              type="button"
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
                  CLINIC PORTAL LOGIN
                </span>
                <h2 className="text-2xl font-black text-white mt-3">Sign In to Your Clinic</h2>
                <p className="text-xs text-slate-400">
                  Use your assigned clinic credentials to manage appointments, queues, and prescriptions
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
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
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

              {/* Quick 1-Click Demo Logins */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
                  ⚡ Quick 1-Click Demo Logins:
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {doctors.slice(0, 3).map((doc) => (
                    <button
                      key={doc.id || doc.email}
                      type="button"
                      onClick={() => handleQuickLogin(doc)}
                      className="w-full p-2.5 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{doc.doctorName}</div>
                        <div className="text-[10px] text-teal-400">{doc.clinicName}</div>
                      </div>
                      <span className="text-[11px] font-mono text-cyan-400 font-bold bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                        Log In →
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Discreet Platform Owner Link at the bottom of the main login page */}
              <div className="pt-4 text-center border-t border-slate-800/80">
                <span className="text-[11px] text-slate-500">
                  Platform Owner / Master Access?{' '}
                  <button
                    type="button"
                    onClick={() => onNavigateTo && onNavigateTo('/super-admin/login')}
                    className="text-slate-400 hover:text-cyan-400 font-semibold underline transition cursor-pointer ml-1"
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
    }'''

old_clinic_norm = old_clinic_login_view.replace('\r\n', '\n')
new_clinic_norm = new_combined_login_views.replace('\r\n', '\n')

if old_clinic_norm not in content_normalized:
    print("ERROR: old_clinic_login_view not found!")
    sys.exit(1)

content_normalized = content_normalized.replace(old_clinic_norm, new_clinic_norm, 1)
print("Step 4 (SuperAdminLoginView + ClinicLoginView with Discreet Link) replaced.")

with open(INDEX_FILE, 'w', encoding='utf-8') as f:
    f.write(content_normalized)

print("SUCCESS: index.html updated successfully!")
