import React, { useState } from 'react';

/**
 * DoctorTenantModal (In-Clinic "Manage Doctors" Module)
 * Allows clinic admins to manage their clinic's internal doctors,
 * switch the active consultation room desk, and add multiple doctors
 * operating strictly within this clinic's isolated tenant space.
 */
export default function DoctorTenantModal({
  isOpen,
  doctorsList = [],
  clinicDoctors,
  activeDoctor,
  onSwitch,
  onCreateDoctor,
  onDeleteDoctor,
  initialTab = 'list',
  onClose,
}) {
  const [tab, setTab] = useState(initialTab); // 'list' | 'add'

  React.useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);
  const [doctorToDelete, setDoctorToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Doctors belonging to this clinic
  const effectiveDoctors = clinicDoctors || doctorsList;

  // Form states for adding a doctor under THIS clinic
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  if (!isOpen) return null;

  const handleAddDoctorSubmit = (e) => {
    e.preventDefault();
    if (!doctorName.trim() || !specialty.trim() || !roomNumber.trim()) return;

    if (onCreateDoctor) {
      onCreateDoctor({
        doctorName: doctorName.trim(),
        specialization: specialty.trim(),
        roomNumber: roomNumber.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
    }

    // Reset form
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      {/* Main Dialog */}
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl">👨‍⚕️</span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-white text-lg tracking-tight">
                  Manage Doctors
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30">
                  {activeDoctor?.clinicId || activeDoctor?.clinicSlug}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Internal doctor roster & consultation rooms for{' '}
                <span className="text-teal-300 font-semibold">{activeDoctor?.clinicName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab('list')}
            className={`py-2 rounded-lg transition cursor-pointer flex items-center justify-center space-x-1.5 ${
              tab === 'list'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>👨‍⚕️ Clinic Doctors</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-[10px] text-teal-300 font-mono font-bold">
              {effectiveDoctors.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab('add')}
            className={`py-2 rounded-lg transition cursor-pointer flex items-center justify-center space-x-1 ${
              tab === 'add'
                ? 'bg-teal-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>➕ Add Doctor</span>
          </button>
        </div>

        {tab === 'list' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Doctors registered under this clinic:</span>
              <span className="text-[11px] text-slate-500 font-mono">Isolated Clinic Roster</span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {effectiveDoctors.map((doc) => {
                const isActive = doc.id === activeDoctor?.id;
                const isOnlyDoctor = effectiveDoctors.length <= 1;

                return (
                  <div
                    key={doc.id}
                    onClick={() => onSwitch(doc)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between group ${
                      isActive
                        ? 'bg-indigo-950/50 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/30'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-0.5 flex-1 pr-2">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-sm text-white group-hover:text-indigo-300 transition">
                          {doc.doctorName}
                        </h4>
                        {isActive && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold shadow-sm">
                            ● Currently Consulting
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-teal-400 font-medium">
                        {doc.specialization} •{' '}
                        <span className="text-slate-300 font-mono">{doc.roomNumber}</span>
                      </p>
                      {doc.email && (
                        <p className="text-[10px] text-slate-500 font-mono">{doc.email}</p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSwitch(doc);
                          }}
                          className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          Switch Desk →
                        </button>
                      )}

                      {/* Remove Doctor Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isOnlyDoctor) {
                            alert(
                              `Cannot remove the only registered doctor for ${activeDoctor?.clinicName}. At least one doctor must remain active.`
                            );
                            return;
                          }
                          setDoctorToDelete(doc);
                        }}
                        className={`p-2 rounded-xl border transition-all cursor-pointer ${
                          isOnlyDoctor
                            ? 'text-slate-600 border-slate-800 opacity-40 cursor-not-allowed'
                            : 'text-slate-400 hover:text-rose-400 bg-slate-900 hover:bg-rose-500/10 border-slate-800 hover:border-rose-500/30 shadow-sm active:scale-95'
                        }`}
                        title={isOnlyDoctor ? 'At least one doctor required in clinic' : `Remove ${doc.doctorName}`}
                        aria-label={`Remove ${doc.doctorName}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* TAB 2: IN-CLINIC ADD DOCTOR FORM */
          <form onSubmit={handleAddDoctorSubmit} className="space-y-3.5 text-xs">
            <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-2xl text-[11px] text-teal-300">
              Adding doctor to <span className="font-bold text-white">{activeDoctor?.clinicName}</span> ({activeDoctor?.clinicId}). This doctor operates strictly within this clinic's isolated queue and records.
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Doctor Name *</label>
              <input
                type="text"
                required
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="e.g. Dr. Ankitha Reddy or Dr. Rajesh Patel"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Specialty / Department *</label>
                <input
                  type="text"
                  required
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="e.g. Pediatrics, Cardiology"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1">Consultation Room / Queue *</label>
                <input
                  type="text"
                  required
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g. Room 2 or Desk B"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Doctor Email (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. doctor@clinic.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98450 00000"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-teal-500/20 mt-2"
            >
              ➕ Add Doctor to {activeDoctor?.clinicName}
            </button>
          </form>
        )}

        {/* Confirmation Safeguard Modal Dialog */}
        {doctorToDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border-2 border-rose-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 text-2xl shadow-inner">
                ⚠️
              </div>

              <div>
                <h4 className="text-lg font-extrabold text-white">Remove Doctor Profile?</h4>
                <p className="text-sm font-semibold text-rose-300 mt-1">
                  Are you sure you want to remove {doctorToDelete.doctorName}?
                </p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  This doctor will be unassigned from {activeDoctor?.clinicName}'s consultation rooms. Historical consultation data remains archived.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDoctorToDelete(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition cursor-pointer flex items-center justify-center space-x-1.5 active:scale-95"
                >
                  {isDeleting ? <span>Removing...</span> : <span>🗑️ Yes, Remove Doctor</span>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
