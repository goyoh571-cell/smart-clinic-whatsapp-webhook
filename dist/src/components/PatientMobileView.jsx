import React, { useState, useMemo } from 'react';

export default function PatientMobileView({
  profile,
  queue,
  myTokenId,
  avgConsultationTime = 8.0,
  onRegister,
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [complaint, setComplaint] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState(myTokenId ? 'track' : 'new');

  const myToken = queue.find((t) => t.id === myTokenId) || queue.find((t) => t.status === 'WAITING');

  const tokensAhead = useMemo(() => {
    if (!myToken) return 0;
    const waitingList = queue.filter((t) => t.status === 'WAITING');
    const index = waitingList.findIndex((t) => t.id === myToken.id);
    return index >= 0 ? index : 0;
  }, [queue, myToken]);

  const benchmarkTime = avgConsultationTime > 0 ? avgConsultationTime : (profile?.avgConsultationTime || 8.0);
  const estimatedMinutes = Math.max(3, Math.round((tokensAhead + 1) * benchmarkTime));

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setIsRegistering(true);
    await onRegister(name, phone, complaint);
    setName('');
    setPhone('');
    setComplaint('');
    setIsRegistering(false);
    setActiveTab('track');
  };

  const isInConsultation = myToken?.status === 'IN_CONSULTATION';
  const isCompleted = myToken?.status === 'COMPLETED';

  return (
    <div className="min-h-full w-full max-w-md mx-auto p-4 sm:p-6 flex flex-col justify-between">
      <div className="space-y-5">
        {/* Dynamic Clinic Header */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-850 p-4 rounded-2xl border border-slate-800 text-center shadow">
          <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">SMART CLINIC LIVE QUEUE</span>
          <h2 className="text-lg font-extrabold text-white mt-0.5">{profile?.clinicName || 'Smart Clinic'}</h2>
          <p className="text-xs text-slate-400">
            {profile?.doctorName || 'Doctor'} ({profile?.specialization || 'MD'}) • {profile?.roomNumber || 'Room 1'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('track')}
            className={`py-2 rounded-lg transition cursor-pointer ${
              activeTab === 'track' ? 'bg-teal-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Track My Token
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`py-2 rounded-lg transition cursor-pointer ${
              activeTab === 'new' ? 'bg-teal-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            + Take New Token
          </button>
        </div>

        {activeTab === 'track' ? (
          myToken ? (
            <div className="space-y-4">
              {/* URGENT ALERT BANNER */}
              {isInConsultation && (
                <div className="p-4 bg-emerald-500 text-slate-950 rounded-2xl shadow-xl animate-bounce border-2 border-white text-center">
                  <span className="text-2xl block mb-1">🚨</span>
                  <h3 className="text-lg font-black tracking-tight uppercase">DOCTOR IS READY FOR YOU!</h3>
                  <p className="text-xs font-bold mt-0.5 opacity-90">
                    Please proceed directly inside {profile?.roomNumber || 'Consultation Room'}
                  </p>
                </div>
              )}

              {/* Token Hero Card */}
              <div
                className={`p-6 rounded-3xl border-2 text-center transition-all shadow-2xl relative overflow-hidden ${
                  isInConsultation
                    ? 'bg-teal-950/60 border-teal-400 shadow-teal-500/20'
                    : isCompleted
                    ? 'bg-slate-900 border-slate-700'
                    : 'bg-gradient-to-b from-slate-900 to-slate-950 border-amber-500/40 shadow-amber-500/10'
                }`}
              >
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">YOUR TOKEN NUMBER</span>
                <h1 className="text-6xl font-black text-white font-mono mt-2 tracking-tight">
                  {myToken.tokenNumber}
                </h1>
                <p className="text-sm font-semibold text-teal-400 mt-2">{myToken.patient?.name}</p>

                <div className="mt-4 inline-flex items-center px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-200">
                  <span
                    className={`w-2 h-2 rounded-full mr-2 ${
                      isInConsultation ? 'bg-teal-400 animate-ping' : 'bg-amber-400'
                    }`}
                  ></span>
                  {isInConsultation
                    ? `Ready: Enter ${profile?.roomNumber || 'Room'}`
                    : isCompleted
                    ? 'Consultation Completed'
                    : 'Waiting in Lounge'}
                </div>

                {!isCompleted && !isInConsultation && (
                  <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-800">
                    <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Tokens Ahead</p>
                      <p className="text-2xl font-black text-amber-400 font-mono mt-0.5">{tokensAhead}</p>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Estimated Wait</p>
                      <p className="text-2xl font-black text-teal-400 font-mono mt-0.5">~{estimatedMinutes}m</p>
                      <span className="text-[9px] text-slate-500">(@ {avgConsultationTime}m/patient)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Consultation Journey Progress */}
              <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-4">
                  Consultation Journey
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                      ✓
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">QR Token Issued</p>
                      <p className="text-[10px] text-slate-400">Position confirmed via WhatsApp confirmation</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-7 h-7 rounded-full font-bold flex items-center justify-center text-xs ${
                        isInConsultation || isCompleted
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-amber-500 text-slate-950 animate-pulse'
                      }`}
                    >
                      {isInConsultation || isCompleted ? '✓' : '2'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Waiting in Lounge</p>
                      <p className="text-[10px] text-slate-400">{tokensAhead} patients ahead of you</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-7 h-7 rounded-full font-bold flex items-center justify-center text-xs ${
                        isInConsultation
                          ? 'bg-teal-400 text-slate-950 animate-pulse ring-4 ring-teal-500/20'
                          : isCompleted
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isCompleted ? '✓' : '3'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Doctor Consultation</p>
                      <p className="text-[10px] text-slate-400">
                        {profile?.roomNumber || 'Room 1'} • {profile?.doctorName || 'Doctor'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-7 h-7 rounded-full font-bold flex items-center justify-center text-xs ${
                        isCompleted ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isCompleted ? '✓' : '4'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Digital Prescription</p>
                      <p className="text-[10px] text-slate-400">Instant WhatsApp & download receipt</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Digital Rx Download & Next Patient Action */}
              {isCompleted && (
                <div className="space-y-3">
                  <button
                    onClick={() => alert('Downloading official digital prescription...')}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-2xl shadow-lg shadow-emerald-500/20 text-sm flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>📥 Download Digital Prescription PDF</span>
                  </button>
                  <button
                    onClick={() => {
                      setName('');
                      setPhone('');
                      setComplaint('');
                      setActiveTab('new');
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-teal-500/20 text-sm uppercase tracking-wider flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>➕ Check In Another Patient / New Token</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-8 bg-slate-900 rounded-3xl border border-slate-800">
              <p className="text-sm text-slate-400">No active token registered on this device.</p>
              <button
                onClick={() => setActiveTab('new')}
                className="mt-3 px-4 py-2 bg-teal-500 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
              >
                Take a Token Now
              </button>
            </div>
          )
        ) : (
          <form
            onSubmit={handleFormSubmit}
            className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl"
          >
            <div className="text-center mb-2">
              <h3 className="font-extrabold text-white text-base">Self Registration Check-In</h3>
              <p className="text-xs text-slate-400">Register name & mobile to join the live queue instantly</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Your Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Mobile / WhatsApp Number *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">We will send automated WhatsApp confirmation & call alerts</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Reason for Visit / Complaint</label>
              <input
                type="text"
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                placeholder="e.g. Fever, Acidity, Routine Checkup"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-teal-500/25 text-sm uppercase tracking-wider mt-2 cursor-pointer"
            >
              {isRegistering ? 'Generating Token...' : '🎫 GET MY DIGITAL TOKEN'}
            </button>
          </form>
        )}
      </div>

      <div className="text-center py-4 text-[11px] text-slate-500">
        Powered by Smart Clinic OS • Zero app install required
      </div>
    </div>
  );
}
