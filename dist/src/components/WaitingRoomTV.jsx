import React, { useState, useEffect } from 'react';

export default function WaitingRoomTV({
  profile,
  queue,
  lastCalled,
  audioReady = false,
  onEnableAudio,
  compact = false,
}) {
  const [time, setTime] = useState(new Date());
  const inConsultation = queue.find((t) => t.status === 'IN_CONSULTATION') || lastCalled;
  const waitingList = queue.filter((t) => t.status === 'WAITING');

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

  return (
    <div
      className={`w-full min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 md:p-8 select-none ${
        compact ? 'text-xs' : ''
      }`}
    >
      {/* Top TV Bar: Clinic Info, Live Clock & Fullscreen */}
      <div className="flex flex-wrap items-center justify-between border-b-2 border-slate-800 pb-5 gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-500 flex items-center justify-center font-black text-2xl text-slate-950 shadow-lg shadow-teal-500/20">
            +
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase">
              {profile?.clinicName || 'Smart Clinic'}
            </h1>
            <p className="text-sm font-semibold text-teal-400">
              {profile?.roomNumber || 'Room 1'} • {profile?.doctorName || 'Doctor'}, {profile?.specialization || 'MD'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <button
            onClick={onEnableAudio}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border flex items-center space-x-2 transition cursor-pointer ${
              audioReady
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold animate-pulse'
            }`}
          >
            <span>{audioReady ? '🔊 Audio Ready' : '⚡ Click: Enable Audio'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 cursor-pointer"
          >
            <span>⛶ Fullscreen TV</span>
          </button>

          <div className="text-right">
            <div className="text-2xl md:text-3xl font-black font-mono text-white tracking-wider">
              {time.toLocaleTimeString('en-US', {
                hour12: true,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {time.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Center Stage: Giant NOW SERVING Hero Display */}
      <div className="my-6 md:my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Giant Calling Card */}
        <div className="lg:col-span-8 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 border-4 border-teal-500/60 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-teal-500 text-slate-950 font-black px-8 py-2.5 rounded-bl-3xl text-sm md:text-base uppercase tracking-widest flex items-center space-x-2 shadow-lg">
            <span className="w-3 h-3 rounded-full bg-slate-950 animate-ping"></span>
            <span>NOW CALLING</span>
          </div>

          <div className="text-slate-400 uppercase tracking-widest font-extrabold text-sm md:text-base">
            PLEASE PROCEED INSIDE
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-baseline gap-4 md:gap-8">
            <span className="text-8xl md:text-[140px] font-black text-teal-400 font-mono tracking-tighter leading-none drop-shadow-md">
              {inConsultation ? inConsultation.tokenNumber : '---'}
            </span>
            <div>
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                {inConsultation?.patient?.name || inConsultation?.patientName || 'Waiting for Next Patient'}
              </h2>
              <p className="text-lg md:text-2xl font-bold text-emerald-400 mt-2 flex items-center space-x-2 uppercase">
                <span>➡️</span>
                <span>{profile?.roomNumber || 'Consultation Room'}</span>
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs md:text-sm text-slate-400 font-semibold gap-4">
            <span>{profile?.doctorName || 'Doctor'} is ready for consultation</span>
            <span className="flex items-center space-x-2 text-teal-400">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
              <span>Audio chime & voice synthesis automated</span>
            </span>
          </div>
        </div>

        {/* Waiting Room QR Code & Self-Check-in Info */}
        <div className="lg:col-span-4 bg-slate-900 border-2 border-slate-800 rounded-[36px] p-6 text-center flex flex-col items-center justify-center space-y-3">
          <div className="p-4 bg-white rounded-3xl shadow-xl inline-block">
            <svg className="w-36 h-36 md:w-44 md:h-44" viewBox="0 0 100 100" fill="none">
              <rect width="100" height="100" fill="white" />
              <rect x="10" y="10" width="28" height="28" fill="#0f172a" rx="4" />
              <rect x="16" y="16" width="16" height="16" fill="white" rx="2" />
              <rect x="20" y="20" width="8" height="8" fill="#0f172a" rx="1" />
              <rect x="62" y="10" width="28" height="28" fill="#0f172a" rx="4" />
              <rect x="68" y="16" width="16" height="16" fill="white" rx="2" />
              <rect x="72" y="20" width="8" height="8" fill="#0f172a" rx="1" />
              <rect x="10" y="62" width="28" height="28" fill="#0f172a" rx="4" />
              <rect x="16" y="68" width="16" height="16" fill="white" rx="2" />
              <rect x="20" y="72" width="8" height="8" fill="#0f172a" rx="1" />
              <rect x="44" y="12" width="10" height="8" fill="#0f172a" />
              <rect x="44" y="26" width="6" height="10" fill="#0f172a" />
              <rect x="12" y="44" width="8" height="12" fill="#0f172a" />
              <rect x="26" y="44" width="12" height="6" fill="#0f172a" />
              <rect x="46" y="44" width="16" height="16" fill="#0d9488" rx="2" />
              <rect x="68" y="44" width="20" height="8" fill="#0f172a" />
              <rect x="76" y="58" width="12" height="10" fill="#0f172a" />
              <rect x="44" y="66" width="8" height="18" fill="#0f172a" />
              <rect x="58" y="70" width="16" height="8" fill="#0f172a" />
              <rect x="70" y="82" width="18" height="6" fill="#0f172a" />
            </svg>
          </div>

          <div className="pt-2">
            <span className="text-xs font-black uppercase tracking-wider text-teal-400">SCAN TO GET A TOKEN</span>
            <h4 className="text-sm font-bold text-white mt-0.5">Track your position on mobile</h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
              Zero download required • {profile?.clinicName || 'Smart Clinic'}
            </p>
          </div>
        </div>
      </div>

      {/* Upcoming Tokens Table */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <span>⏱️ NEXT PATIENTS IN LINE</span>
          </span>
          <span className="text-xs font-bold text-amber-400 font-mono">
            {waitingList.length} Patient(s) In Waiting Queue
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {waitingList.slice(0, 6).map((token, idx) => (
            <div
              key={token.id}
              className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center transform hover:scale-105 transition"
            >
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">#{idx + 1} NEXT</span>
              <div className="text-3xl font-black text-amber-400 font-mono mt-1">{token.tokenNumber}</div>
              <div className="text-xs font-bold text-white truncate mt-1">{token.patient?.name}</div>
              <div className="text-[10px] text-teal-400 mt-0.5 font-mono">Est. ~{Math.max(3, (idx + 1) * 8)}m</div>
            </div>
          ))}

          {waitingList.length === 0 && (
            <div className="col-span-full py-6 text-center text-slate-500 text-sm font-medium">
              Queue is clear. No waiting patients.
            </div>
          )}
        </div>
      </div>

      {/* Clinic Notice Bar */}
      <div className="mt-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex items-center space-x-3 text-xs md:text-sm text-slate-300 overflow-hidden">
        <span className="px-2.5 py-1 rounded-lg bg-teal-500 text-slate-950 font-extrabold uppercase tracking-wide text-xs whitespace-nowrap">
          CLINIC NOTICE
        </span>
        <div className="truncate">
          Welcome to {profile?.clinicName || 'Smart Clinic'} • Please have your digital token receipt ready when called • Masks recommended in the waiting lounge
        </div>
      </div>
    </div>
  );
}
