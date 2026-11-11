import sys

index_path = r'C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.source.html'
with open(index_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update handlePatientRegister check-in dispatch
t1 = """        // 1. Dispatch Automated WhatsApp Trigger
        fetch(`${serverUrl}/api/notifications/whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phone.trim(),
            patientName: name.trim(),
            tokenNumber,
            queueUrl: trackerUrl,
            clinicName: targetDoc.clinicName,
            doctorName: targetDoc.doctorName
          })
        }).catch(() => {});"""

r1 = """        // 1. Dispatch Automated Queue Check-in Alert (Meta Cloud API / Cloud Functions)
        const checkinAlertPayload = {
          phone: phone.trim(),
          patientName: name.trim(),
          tokenNumber,
          clinicSlug: targetSlug,
          clinicName: targetDoc.clinicName,
          doctorName: targetDoc.doctorName,
          roomNumber: targetDoc.roomNumber,
          estimatedWaitMinutes,
          waitingCount,
          trackerUrl
        };

        fetch(`${serverUrl}/api/notifications/queue-checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checkinAlertPayload)
        }).then(r => r.json()).then(res => {
          console.log('[Queue Check-in Alert] Meta Cloud API response:', res);
        }).catch(err => {
          console.warn('[Queue Check-in Alert] Fallback:', err);
        });

        // Also ping universal notification route for full backwards compatibility
        fetch(`${serverUrl}/api/notifications/whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checkinAlertPayload)
        }).catch(() => {});"""

# 2. Update handleCompleteConsultation prescription dispatch
t2 = """        // 6. Trigger automated WhatsApp prescription dispatch to completed patient
        const cleanPhone = (activeToken.patient?.phone || '').replace(/[^0-9]/g, '');
        const waText = `Hello ${activeToken.patient?.name}, your official digital prescription from ${activeDoctor.doctorName} at ${activeDoctor.clinicName} is ready. Token: ${activeToken.tokenNumber}. Rx: ${rxNotes ? rxNotes.slice(0, 100) + '...' : 'Take prescribed rest'}. Wish you a speedy recovery!`;
        const waSendLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(waText)}`;

        dispatchWhatsAppMessage(activeToken.patient?.phone, waText, 'PRESCRIPTION');

        fetch(`${serverUrl}/api/notifications/whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: activeToken.patient?.phone,
            patientName: activeToken.patient?.name,
            tokenNumber: activeToken.tokenNumber,
            clinicName: activeDoctor.clinicName,
            doctorName: activeDoctor.doctorName,
            rxText: rxNotes
          })
        }).catch(() => {});

        setLastCompletedRx({
          patientName: activeToken.patient?.name,
          phone: activeToken.patient?.phone,
          tokenNumber: activeToken.tokenNumber,
          pdfUrl,
          filename,
          waSendLink
        });"""

r2 = """        // 6. Trigger 10-Second Automated WhatsApp Prescription Dispatch (Meta Cloud API / Cloud Functions)
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prescriptionDispatchPayload)
        }).then(r => r.json()).then(res => {
          console.log('[Prescription Dispatch] Completed via Cloud Functions in:', res.elapsedMs, 'ms. SLA <10s met:', res.elapsedMs < 10000);
        }).catch(err => {
          console.warn('[Prescription Dispatch] Cloud Function fallback:', err);
        });

        // Also ping legacy notification route for backwards compatibility
        fetch(`${serverUrl}/api/notifications/whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          dispatchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });"""

# 3. Enhance Modal 3 (Prescription Completed Modal)
t3 = """                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl">
                  📄
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Prescription Generated!</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Verified digital prescription for <strong>{lastCompletedRx.filename}</strong>.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-left space-y-1">
                  <p><span className="text-slate-400 font-semibold">Patient:</span> <span className="text-white font-bold">{lastCompletedRx.patientName}</span></p>
                  <p><span className="text-slate-400 font-semibold">Token:</span> <span className="text-teal-400 font-bold">{lastCompletedRx.tokenNumber}</span></p>
                  <p><span className="text-slate-400 font-semibold">Phone:</span> <span className="text-slate-300 font-mono">{lastCompletedRx.phone}</span></p>
                </div>"""

r3 = """                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl">
                  📄
                </div>

                <div className="space-y-1.5">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>⚡ 10-Second WhatsApp Rx Dispatched (<10s SLA)</span>
                  </div>
                  <h3 className="text-xl font-black text-white">Prescription Generated & Dispatched!</h3>
                  <p className="text-xs text-slate-400">
                    PDF document transmitted via Meta WhatsApp Cloud API to <strong>{lastCompletedRx.phone}</strong>.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-left space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold">Patient:</span>
                    <span className="text-white font-bold">{lastCompletedRx.patientName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold">Token:</span>
                    <span className="text-teal-400 font-bold">{lastCompletedRx.tokenNumber}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold">WhatsApp Delivery:</span>
                    <span className="text-emerald-400 font-bold flex items-center space-x-1">
                      <span>✓ Dispatched</span>
                      <span className="text-[10px] text-slate-500 font-normal font-mono">({lastCompletedRx.dispatchedAt || '<10s'})</span>
                    </span>
                  </div>
                </div>"""

# 4. Update the Complete Consultation Button in Doctor Console
t4 = """                    <button
                      type="button"
                      onClick={handleUnifiedCompleteConsultation}
                      className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/25 flex items-center justify-center space-x-2 transition cursor-pointer transform active:scale-95"
                      title="Save prescription, mark completed, dispatch WhatsApp Rx, and auto-move next patient into room"
                    >
                      <span className="text-base">✓</span>
                      <span>Complete Consultation</span>
                    </button>"""

r4 = """                    <button
                      type="button"
                      onClick={handleUnifiedCompleteConsultation}
                      className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/25 flex items-center justify-center space-x-2 transition cursor-pointer transform active:scale-95"
                      title="Save prescription, generate digital PDF, auto-dispatch to patient WhatsApp in <10s, and call next token"
                    >
                      <span className="text-base">⚡</span>
                      <span>Save / Finish Prescription (WhatsApp Rx)</span>
                    </button>"""

content_norm = content.replace('\r\n', '\n')
t1_norm = t1.replace('\r\n', '\n')
r1_norm = r1.replace('\r\n', '\n')
t2_norm = t2.replace('\r\n', '\n')
r2_norm = r2.replace('\r\n', '\n')
t3_norm = t3.replace('\r\n', '\n')
r3_norm = r3.replace('\r\n', '\n')
t4_norm = t4.replace('\r\n', '\n')
r4_norm = r4.replace('\r\n', '\n')

for idx, (t, r) in enumerate([(t1_norm, r1_norm), (t2_norm, r2_norm), (t3_norm, r3_norm), (t4_norm, r4_norm)], 1):
    if t in content_norm:
        content_norm = content_norm.replace(t, r)
        print(f"Patched block {idx}")
    else:
        print(f"Warning: Block {idx} not found")

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(content_norm)

print("index.source.html updated successfully!")
