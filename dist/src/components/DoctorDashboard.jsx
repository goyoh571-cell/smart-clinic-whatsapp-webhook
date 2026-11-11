import React, { useState, useMemo } from 'react';

export const PRESCRIPTION_TEMPLATES = {
  fever: {
    name: 'Fever / Viral Pack',
    medicines: `1. Tab Paracetamol 650 mg — 1 tab TDS (After Food) x 3 Days
2. Tab Levocetirizine 5 mg — 1 tab HS (At Bedtime) x 3 Days
3. Tab Vitamin C 500 mg — 1 tab OD x 5 Days
4. Electral / ORS Solution — 1 sachet in 1 Litre water, sip throughout day

Advice:
• Adequate rest and hydration (minimum 2.5 - 3 Litres water)
• Soft, non-spicy diet
• Temperature monitoring every 6 hours. SOS if fever > 101°F`,
  },
  gastritis: {
    name: 'Gastritis / Acidity Pack',
    medicines: `1. Cap Pantoprazole 40 mg — 1 cap OD (30 mins before breakfast) x 7 Days
2. Tab Domperidone 10 mg — 1 tab BD (Before Food) x 5 Days
3. Syp Sucralfate + Oxetacaine — 2 tsp TDS (1 hour after meals) x 5 Days

Advice:
• Avoid spicy, oily, deep-fried food and citrus juices
• Limit tea/coffee to max 1 small cup/day
• Eat smaller, frequent meals; avoid lying down immediately after eating`,
  },
  hypertension: {
    name: 'Hypertension Protocol',
    medicines: `1. Tab Telmisartan 40 mg — 1 tab OD (Morning after breakfast) x 30 Days
2. Tab Amlodipine 5 mg — 1 tab OD (Night) x 30 Days [If SBP > 150 mmHg]

Advice:
• Strict low-salt diet (< 2 grams table salt per day, avoid papads & pickles)
• 30-minute brisk walk 5 days/week
• Maintain daily BP log (Morning & Evening)
• Review in clinic after 14 days with BP chart`,
  },
};

export default function DoctorDashboard({
  profile,
  queue,
  activeToken,
  avgConsultationTime = 8.0,
  completedDurations = [],
  onCallNext,
  onComplete,
  onViewRx,
  onOpenSettings,
  compact = false,
}) {
  const [customRx, setCustomRx] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('today'); // 'today' | '1week' | '1month'

  // Date Filter calculation (Today, 1 Week, 1 Month)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const filteredQueue = useMemo(() => {
    return queue.filter((t) => {
      const tDate = new Date(t.createdAt || t.id);
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
  }, [queue, dateFilter]);

  // Metrics reflecting real-time status (showing 0 when no active/waiting patients remain for the day)
  const waitingList = filteredQueue.filter((t) => t.status === 'WAITING');

  const inConsultation = (activeToken && (!activeToken.createdAt || new Date(activeToken.createdAt || activeToken.id) >= startOfToday))
    ? activeToken
    : filteredQueue.find((t) => t.status === 'IN_CONSULTATION') || null;

  const completedList = filteredQueue.filter((t) => t.status === 'COMPLETED');

  // Dynamic Rolling Average calculation based on completed patients in selected timeframe
  const completedTokenDurations = completedList
    .map((t) => {
      if (t.durationMinutes && t.durationMinutes > 0) return Number(t.durationMinutes);
      if (t.consultationStartTime && t.consultationEndTime) {
        const diff = (new Date(t.consultationEndTime).getTime() - new Date(t.consultationStartTime).getTime()) / 60000;
        if (diff > 0) return Number(diff.toFixed(1));
      }
      return null;
    })
    .filter((d) => d !== null);

  const completedCount = completedList.length;

  // When 0 completed patients today (or in selected timeframe), reset strictly to 0 mins
  const dynamicAvgConsultTime =
    completedCount > 0 && completedTokenDurations.length > 0
      ? Number((completedTokenDurations.reduce((acc, d) => acc + d, 0) / completedTokenDurations.length).toFixed(1))
      : 0;

  const handleSelectTemplate = (key) => {
    const tpl = PRESCRIPTION_TEMPLATES[key];
    if (tpl) {
      setSelectedTemplate(tpl.name);
      setCustomRx(tpl.medicines);
    }
  };

  const handleSaveAndPrint = async () => {
    if (!inConsultation) return;
    setIsGeneratingPdf(true);
    await onComplete(inConsultation.id, customRx, selectedTemplate);
    setIsGeneratingPdf(false);
    setCustomRx('');
    setSelectedTemplate('');
  };

  // CSV Export Handler
  const handleExportReport = () => {
    const recordsToExport = filteredQueue.length > 0 ? filteredQueue : queue;
    if (recordsToExport.length === 0) {
      alert(`No consultation records found in the selected timeframe (${dateFilter}).`);
      return;
    }

    const headers = [
      'Token Number',
      'Patient Name',
      'Phone Number',
      'Age',
      'Gender',
      'Chief Complaint',
      'Status',
      'Date',
      'Consultation Start',
      'Consultation End',
      'Duration (Mins)',
      'Prescription Template',
      'Prescription / Notes',
      'Doctor Name',
      'Clinic Name',
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' | ');
      return `"${str}"`;
    };

    const rows = recordsToExport.map((t) => {
      const tDate = new Date(t.createdAt || t.id);
      const dateStr = tDate.toLocaleDateString('en-CA');
      const startStr = t.consultationStartTime
        ? new Date(t.consultationStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'N/A';
      const endStr = t.consultationEndTime
        ? new Date(t.consultationEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'N/A';
      const durStr = t.durationMinutes
        ? `${t.durationMinutes}`
        : t.consultationStartTime && t.consultationEndTime
        ? `${((new Date(t.consultationEndTime) - new Date(t.consultationStartTime)) / 60000).toFixed(1)}`
        : 'N/A';

      return [
        escapeCsv(t.tokenNumber),
        escapeCsv(t.patient?.name || 'Patient'),
        escapeCsv(t.patient?.phone || 'N/A'),
        escapeCsv(t.patient?.age || '30'),
        escapeCsv(t.patient?.gender || 'Adult'),
        escapeCsv(t.complaint || 'General Consultation'),
        escapeCsv(t.status),
        escapeCsv(dateStr),
        escapeCsv(startStr),
        escapeCsv(endStr),
        escapeCsv(durStr),
        escapeCsv(t.templateName || 'Prescription'),
        escapeCsv(t.rxNotes || 'Standard advice'),
        escapeCsv(profile?.doctorName || 'Doctor'),
        escapeCsv(profile?.clinicName || 'Smart Clinic'),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateTag = new Date().toISOString().split('T')[0];
    const cleanSlug = (profile?.clinicSlug || 'clinic').replace(/[^a-zA-Z0-9_-]/g, '');
    a.download = `Consultation_Report_${cleanSlug}_${dateFilter}_${dateTag}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6 ${compact ? 'text-sm' : ''}`}>
      {/* Analytics Filter & Daily Reset Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-base">📊</span>
            <span className="text-xs uppercase font-extrabold text-slate-300 tracking-wider">Queue Analytics</span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <div className="flex items-center space-x-2">
            <label htmlFor="analytics-filter-select" className="text-xs text-slate-400 font-medium hidden sm:inline">
              Timeframe:
            </label>
            <select
              id="analytics-filter-select"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 hover:border-teal-500 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-teal-400 cursor-pointer transition shadow-inner"
            >
              <option value="today">📅 Today</option>
              <option value="1week">🗓️ 1 Week</option>
              <option value="1month">📆 1 Month</option>
            </select>
            <span className="text-[10px] text-teal-400 font-mono px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20">
              {filteredQueue.length} record(s)
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportReport}
            className="px-3.5 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 hover:text-white border border-teal-500/30 hover:border-teal-400 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-sm active:scale-95"
            title="Download consultation logs as CSV file"
          >
            <span>📥</span>
            <span>Export Report (CSV)</span>
          </button>

          <span className="text-[10px] text-slate-400 font-medium px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-1.5 shadow-inner" title="Daily queue, completed count, and avg consult time automatically reset each calendar day">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Auto-Reset Daily</span>
          </span>
        </div>
      </div>

      {/* Metric Cards including Dynamic Rolling Average Tracker */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow">
          <div>
            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Waiting in Line</p>
            <h3 className={`text-3xl font-extrabold mt-1 font-mono ${waitingList.length > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {waitingList.length}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              {waitingList.length === 0 ? 'Queue is clear (0 waiting)' : `${waitingList.length} patient(s) waiting`}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl font-bold">
            ⏳
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow">
          <div>
            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">In Consultation</p>
            <h3 className={`text-3xl font-extrabold mt-1 font-mono ${inConsultation ? 'text-teal-400' : 'text-slate-400'}`}>
              {inConsultation ? 1 : 0}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              {inConsultation ? `Token #${inConsultation.tokenNumber} in room` : 'No patient in room (0 active)'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 text-xl font-bold">
            🩺
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow">
          <div>
            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              {dateFilter === 'today' ? 'Completed Today' : dateFilter === '1week' ? 'Completed (1 Week)' : 'Completed (1 Month)'}
            </p>
            <h3 className="text-3xl font-extrabold text-emerald-400 mt-1 font-mono">{completedList.length}</h3>
            <p className="text-[10px] text-slate-400 mt-1">
              {completedList.length === 0 ? '0 completed so far' : `${completedList.length} consultation(s)`}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl font-bold">
            ✅
          </div>
        </div>

        {/* Dynamic Rolling Average Consultation Tracker */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow relative overflow-hidden group hover:border-teal-500/30 transition-all">
          <div>
            <div className="flex items-center space-x-1.5">
              <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Avg Consult Time</p>
              {completedCount > 0 && dynamicAvgConsultTime > 0 && (
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" title="Live dynamic rolling average calculated from completed patients"></span>
              )}
            </div>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <h3 className={`text-3xl font-extrabold font-mono tracking-tight ${dynamicAvgConsultTime > 0 ? 'text-teal-400' : 'text-slate-400'}`}>
                {dynamicAvgConsultTime > 0 ? dynamicAvgConsultTime : '0'}
              </h3>
              <span className="text-xs text-slate-400 font-semibold font-mono">mins</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 flex items-center space-x-1">
              {completedCount > 0 && dynamicAvgConsultTime > 0 ? (
                <span className="text-teal-300 font-medium flex items-center space-x-1">
                  <span>Based on {completedCount} completed ({dateFilter === 'today' ? 'today' : dateFilter === '1week' ? '7 days' : '30 days'})</span>
                </span>
              ) : (
                <span className="text-slate-400 font-medium">
                  {dateFilter === 'today' ? 'No consultations yet today' : 'No consultations in this period'}
                </span>
              )}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 text-xl font-bold shadow-sm shadow-teal-500/10">
            ⏱️
          </div>
        </div>
      </div>

      {/* Action Bar with Editable Profile Banner & Giant 1-Tap "CALL NEXT" Button */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
            <h2 className="text-xl font-bold text-white">
              {profile?.doctorName || 'Dr. Arvind Deshmukh'}, {profile?.specialization || 'MD (Gen Med)'}
            </h2>
            <button
              onClick={onOpenSettings}
              className="text-xs px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
            >
              Edit Profile
            </button>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {profile?.roomNumber || 'Consultation Room 1'} • {profile?.clinicName || 'Smart Clinic'}
          </p>
        </div>

        <button
          onClick={onCallNext}
          className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-lg rounded-2xl shadow-lg shadow-teal-500/30 transform active:scale-95 transition-all flex items-center justify-center space-x-3 cursor-pointer"
        >
          <span className="text-2xl">📢</span>
          <span>1-TAP "CALL NEXT"</span>
        </button>
      </div>

      {/* Active Consultation Console + 1-Click Rx */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {inConsultation ? (
            <div className="bg-slate-900 border-2 border-teal-500/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-teal-500 text-slate-950 font-extrabold px-5 py-1.5 rounded-bl-2xl text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow">
                <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse"></span>
                <span>ACTIVE IN {profile?.roomNumber?.toUpperCase() || 'ROOM'}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center space-x-3">
                  <span className="text-4xl font-black text-teal-400 font-mono">
                    {inConsultation.tokenNumber}
                  </span>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{inConsultation.patient?.name}</h3>
                    <p className="text-sm text-slate-400">
                      {inConsultation.patient?.phone} • {inConsultation.patient?.age || '32'}y /{' '}
                      {inConsultation.patient?.gender || 'Adult'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Complaint */}
              <div className="mt-4 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Chief Complaint:</span>
                <p className="text-sm font-medium text-slate-200 mt-0.5">
                  {inConsultation.complaint || 'General Checkup'}
                </p>
              </div>

              {/* 1-Click Prescription Templates */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1">
                    <span>⚡ 1-Click Clinical Rx Templates</span>
                  </label>
                  {selectedTemplate && (
                    <span className="text-xs text-teal-400 font-semibold">Active: {selectedTemplate}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={() => handleSelectTemplate('fever')}
                    className="p-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-amber-500/30 hover:border-amber-400 text-left transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400 text-sm">🌡️ Fever Pack</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                        PCM + Cet
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      Paracetamol 650mg TDS, Levocetirizine, Vitamin C
                    </p>
                  </button>

                  <button
                    onClick={() => handleSelectTemplate('gastritis')}
                    className="p-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-emerald-500/30 hover:border-emerald-400 text-left transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400 text-sm">💊 Gastritis Pack</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                        PPI + Gel
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      Pantoprazole 40mg AC, Domperidone, Antacid Gel
                    </p>
                  </button>

                  <button
                    onClick={() => handleSelectTemplate('hypertension')}
                    className="p-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-blue-500/30 hover:border-blue-400 text-left transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-400 text-sm">🫀 Hypertension</span>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">
                        Telmi 40
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      Telmisartan 40mg OD, Low Salt diet, Daily BP Chart
                    </p>
                  </button>
                </div>
              </div>

              {/* Prescription Notes Editor */}
              <div className="mt-5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Prescription / Advice (Editable):
                </label>
                <textarea
                  rows="6"
                  value={customRx}
                  onChange={(e) => setCustomRx(e.target.value)}
                  placeholder="Select a 1-click template above or type custom prescription / medications..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-sm font-mono text-slate-200 focus:outline-none focus:border-teal-500 leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => onComplete(inConsultation.id, customRx || 'Consultation Completed', 'Standard')}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition cursor-pointer"
                >
                  Complete Consultation
                </button>

                <button
                  onClick={handleSaveAndPrint}
                  disabled={isGeneratingPdf}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/25 flex items-center space-x-2 transition cursor-pointer"
                >
                  <span>{isGeneratingPdf ? '⏳ Generating...' : '🖨️ 1-Click Complete & Print PDF'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-dashed border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[360px]">
              <div className="w-20 h-20 rounded-full bg-slate-800/80 flex items-center justify-center text-4xl mb-4">
                🩺
              </div>
              <h3 className="text-xl font-bold text-white">No Active Patient in Room</h3>
              <p className="text-slate-400 text-sm max-w-md mt-1 mb-6">
                {waitingList.length > 0
                  ? `${waitingList.length} patient(s) waiting in lounge. Tap "CALL NEXT" to call the next patient.`
                  : 'Queue is currently empty. Patients can register via the Patient QR View.'}
              </p>
              <button
                onClick={onCallNext}
                className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-teal-500/20 transition cursor-pointer"
              >
                📢 Call Next Patient in Line
              </button>
            </div>
          )}
        </div>

        {/* Live Waiting Queue List with Dynamic Calculated Wait Time */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-white text-base">
                  {dateFilter === 'today' ? 'Live Waiting Queue' : dateFilter === '1week' ? 'Past 7 Days Queue' : 'Past 30 Days Queue'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${waitingList.length > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                  {waitingList.length} Waiting
                </span>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name/token..."
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-teal-500 w-36"
              />
            </div>

            <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
              {filteredQueue.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/60 flex items-center justify-center text-2xl text-slate-400">
                    ✅
                  </div>
                  <p className="text-sm font-semibold text-slate-300">
                    {dateFilter === 'today' ? 'Queue is clear (0 waiting)' : 'No records found for this timeframe'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {dateFilter === 'today' ? 'No patients waiting in queue. Scan desk QR to register.' : 'Switch timeframe to view past consultations.'}
                  </p>
                </div>
              ) : (
                filteredQueue
                  .filter(
                    (t) =>
                      t.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      t.tokenNumber.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((token) => {
                    const isWaiting = token.status === 'WAITING';
                    const isInRoom = token.status === 'IN_CONSULTATION';
                    const isCompleted = token.status === 'COMPLETED';

                    let patientWaitEstimate = 0;
                    if (isWaiting) {
                      const waitIndex = waitingList.findIndex((w) => w.id === token.id);
                      const pos = waitIndex >= 0 ? waitIndex + 1 : 1;
                      const benchmarkTime = dynamicAvgConsultTime > 0 ? dynamicAvgConsultTime : (profile?.avgConsultationTime || 8.0);
                      patientWaitEstimate = Math.round(pos * benchmarkTime);
                    }

                    return (
                      <div
                        key={token.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isInRoom
                            ? 'bg-teal-950/40 border-teal-500/50 shadow-md shadow-teal-500/10'
                            : isWaiting
                            ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                            : 'bg-slate-950/30 border-slate-850 opacity-80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-sm font-black font-mono ${
                                isInRoom
                                  ? 'bg-teal-500 text-slate-950'
                                  : isWaiting
                                  ? 'bg-slate-800 text-amber-400 border border-amber-500/20'
                                  : 'bg-slate-850 text-slate-400'
                              }`}
                            >
                              {token.tokenNumber}
                            </span>
                            <div>
                              <h4 className="font-bold text-sm text-white">{token.patient?.name}</h4>
                              <p className="text-xs text-slate-400">{token.complaint || 'Consultation'}</p>
                            </div>
                          </div>

                          <div className="text-right flex flex-col items-end">
                            <span
                              className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full ${
                                isInRoom
                                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40'
                                  : isWaiting
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {token.status}
                            </span>
                            {isWaiting && (
                              <span className="text-[10px] text-teal-400 font-bold mt-1 font-mono">
                                Est. Wait: ~{patientWaitEstimate}m
                              </span>
                            )}
                            {isCompleted && (
                              <button
                                onClick={() => onViewRx && onViewRx(token)}
                                className="mt-1.5 px-2 py-0.5 rounded bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition"
                                title="Re-open and print prescription PDF"
                              >
                                <span>📄 View Rx</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
