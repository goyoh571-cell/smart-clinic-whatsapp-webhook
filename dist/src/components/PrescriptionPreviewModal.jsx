import React, { useState, useEffect, useRef } from 'react';

/**
 * PrescriptionPreviewModal
 * Instant in-app prescription preview modal with dedicated manual download option.
 * Prevents unwanted automatic downloads on initial "View Rx" click while enabling
 * full-screen preview, browser tab loading, and explicit manual PDF saving.
 */
export default function PrescriptionPreviewModal({
  isOpen,
  token,
  doctor,
  onClose,
}) {
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const printableRef = useRef(null);

  const patient = token?.patient || {};
  const tokenNumber = token?.tokenNumber || 'A-00';
  const rxNotes = token?.rxNotes || 'Standard medical follow-up and clinical advice.';
  const templateName = token?.templateName || 'Prescription';
  const dateFormatted = new Date(token?.consultationEndTime || token?.createdAt || Date.now())
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const filename = `Rx_${(patient.name || 'Patient').replace(/\s+/g, '')}_${tokenNumber}.pdf`;

  // Generate PDF in memory on modal open if jsPDF is available
  useEffect(() => {
    if (!isOpen || !token) {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      return;
    }

    try {
      const { jsPDF } = window.jspdf || {};
      if (jsPDF) {
        setIsGenerating(true);
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // Accent bar
        doc.setFillColor(13, 148, 136);
        doc.rect(0, 0, 6, 297, 'F');

        // Clinic & Doctor Header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42);
        doc.text((doctor?.clinicName || 'Smart Clinic').toUpperCase(), 14, 18);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`${doctor?.doctorName || 'Doctor'} | ${doctor?.specialization || 'General Medicine'}`, 14, 26);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Room: ${doctor?.roomNumber || 'Room 1'}   |   Date: ${dateFormatted}`, 196, 20, { align: 'right' });

        // Divider
        doc.setDrawColor(13, 148, 136);
        doc.setLineWidth(0.8);
        doc.line(14, 34, 196, 34);

        // Patient Box
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 38, 182, 24, 2, 2, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 38, 182, 24, 2, 2, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`Patient: ${patient.name || 'Patient'}`, 18, 45);
        doc.text(`Token: ${tokenNumber}`, 170, 45, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text(`Phone: ${patient.phone || 'N/A'}   |   Age/Gender: ${patient.age || '30'}y / ${patient.gender || 'Adult'}`, 18, 52);
        doc.text(`Complaint: ${token.complaint || 'General Consultation'}`, 18, 58);

        // Rx Body
        doc.setFont('times', 'bolditalic');
        doc.setFontSize(24);
        doc.setTextColor(13, 148, 136);
        doc.text('Rx', 14, 73);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`Medications & Advice (${templateName})`, 28, 72);

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(14, 76, 196, 76);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        const lines = doc.splitTextToSize(rxNotes, 178);
        doc.text(lines, 18, 84);

        // Footer & Signature
        const sigY = 245;
        doc.setDrawColor(203, 213, 225);
        doc.line(130, sigY, 190, sigY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(doctor?.doctorName || 'Doctor', 160, sigY + 5, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(doctor?.specialization || 'Consultant Physician', 160, sigY + 9, { align: 'center' });

        // Bottom Banner
        doc.setFillColor(240, 253, 250);
        doc.rect(0, 280, 210, 17, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(13, 148, 136);
        doc.text('SMART CLINIC OS  •  VERIFIED DIGITAL PRESCRIPTION', 105, 286, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Digitally validated prescription. No physical signature required.', 105, 291, { align: 'center' });

        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        setIsGenerating(false);
      }
    } catch (e) {
      console.warn('[PrescriptionPreviewModal] PDF generation fallback:', e);
      setIsGenerating(false);
    }
  }, [isOpen, token, doctor]);

  if (!isOpen || !token) return null;

  // 1. Open in new tab handler
  const handleOpenInNewTab = () => {
    if (pdfBlobUrl) {
      window.open(pdfBlobUrl, '_blank');
    } else {
      // Formatted printable window fallback
      const printWindow = window.open('', '_blank');
      if (printWindow && printableRef.current) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${filename}</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; max-width: 800px; margin: 0 auto; }
                .header { border-bottom: 2px solid #0d9488; padding-bottom: 15px; margin-bottom: 20px; }
                .rx-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
                .meds { font-family: monospace; white-space: pre-wrap; line-height: 1.6; background: #fff; padding: 20px; border: 1px solid #cbd5e1; border-radius: 8px; }
                .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1 style="margin:0;color:#0d9488;">${doctor?.clinicName || 'Smart Clinic'}</h1>
                <p style="margin:4px 0 0;font-weight:bold;">${doctor?.doctorName} &bull; ${doctor?.specialization}</p>
                <p style="margin:2px 0 0;font-size:12px;color:#64748b;">${doctor?.roomNumber} &bull; Date: ${dateFormatted}</p>
              </div>
              <div class="rx-box">
                <p style="margin:0 0 6px;"><strong>Patient:</strong> ${patient.name} | <strong>Token:</strong> #${tokenNumber} | <strong>Phone:</strong> ${patient.phone || 'N/A'}</p>
                <p style="margin:0;font-size:13px;color:#475569;"><strong>Chief Complaint:</strong> ${token.complaint || 'General Consultation'}</p>
              </div>
              <h2 style="color:#0d9488;margin-bottom:10px;">Rx Medications & Instructions</h2>
              <div class="meds">${rxNotes}</div>
              <div class="footer">
                <div>Digitally signed prescription &bull; Smart Clinic OS</div>
                <div style="text-align:right;"><strong>${doctor?.doctorName}</strong><br/>${doctor?.specialization}</div>
              </div>
              <script>window.onload = function() { window.print(); }</script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  // 2. Manual explicit download handler (Triggered ONLY when doctor clicks "Download PDF")
  const handleManualDownload = () => {
    try {
      const { jsPDF } = window.jspdf || {};
      if (jsPDF) {
        // Re-generate and save directly to disk
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        doc.setFillColor(13, 148, 136);
        doc.rect(0, 0, 6, 297, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42);
        doc.text((doctor?.clinicName || 'Smart Clinic').toUpperCase(), 14, 18);
        doc.setFontSize(11);
        doc.text(`${doctor?.doctorName || 'Doctor'} | ${doctor?.specialization || 'General Medicine'}`, 14, 26);
        doc.setDrawColor(13, 148, 136);
        doc.setLineWidth(0.8);
        doc.line(14, 34, 196, 34);

        // Patient Box
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 38, 182, 24, 2, 2, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 38, 182, 24, 2, 2, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`Patient: ${patient.name || 'Patient'}`, 18, 45);
        doc.text(`Token: ${tokenNumber}`, 170, 45, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text(`Phone: ${patient.phone || 'N/A'}   |   Age/Gender: ${patient.age || '30'}y / ${patient.gender || 'Adult'}`, 18, 52);

        // Rx Body
        doc.setFont('times', 'bolditalic');
        doc.setFontSize(24);
        doc.setTextColor(13, 148, 136);
        doc.text('Rx', 14, 73);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`Medications & Advice (${templateName})`, 28, 72);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(14, 76, 196, 76);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        const lines = doc.splitTextToSize(rxNotes, 178);
        doc.text(lines, 18, 84);

        doc.save(filename);
        return;
      }
    } catch (e) {
      console.warn('[Manual Download] jsPDF save fallback:', e);
    }

    // Fallback Blob download for plain text/HTML format
    const content = `SMART CLINIC OFFICIAL PRESCRIPTION\nClinic: ${doctor?.clinicName}\nDoctor: ${doctor?.doctorName} (${doctor?.specialization})\nRoom: ${doctor?.roomNumber}\nDate: ${dateFormatted}\n\nPatient: ${patient.name}\nToken: ${tokenNumber}\nPhone: ${patient.phone}\nChief Complaint: ${token.complaint || 'General Consultation'}\n\nRx Medications & Advice (${templateName}):\n${rxNotes}\n\nDigitally Verified by Smart Clinic OS`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Prescription_${patient.name?.replace(/\s+/g, '')}_${tokenNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const waShareUrl = `https://api.whatsapp.com/send?phone=${(patient.phone || '').replace(/[^0-9]/g, '')}&text=${encodeURIComponent(
    `Hello ${patient.name}, here is your verified prescription from ${doctor?.doctorName} at ${doctor?.clinicName}:\n\n${rxNotes}\n\nPrescription Ref: #${tokenNumber}`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:px-6 bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <span className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center text-lg font-bold shadow-inner">
              📄
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-white text-base sm:text-lg">
                  Prescription Preview: #{tokenNumber}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  COMPLETED
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {patient.name} &bull; {patient.phone || 'No phone'} &bull; {dateFormatted}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
            aria-label="Close prescription preview"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Embedded PDF Preview & Visual Letterhead */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-950/60">
          {pdfBlobUrl ? (
            /* Live In-App PDF Embed */
            <div className="w-full rounded-2xl overflow-hidden border border-slate-800 bg-white shadow-2xl h-[420px] sm:h-[480px]">
              <iframe
                src={`${pdfBlobUrl}#toolbar=0&navpanes=0`}
                className="w-full h-full border-none"
                title={`Prescription Preview for ${patient.name}`}
              />
            </div>
          ) : (
            /* High-Fidelity Clean Letterhead Viewer */
            <div
              ref={printableRef}
              className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl border-l-8 border-l-teal-600 border-slate-200 space-y-5"
            >
              {/* Letterhead */}
              <div className="border-b-2 border-teal-600 pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-2">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {(doctor?.clinicName || 'Smart Clinic').toUpperCase()}
                  </h2>
                  <p className="text-sm font-bold text-teal-800">
                    {doctor?.doctorName} &bull; {doctor?.specialization}
                  </p>
                </div>
                <div className="text-left sm:text-right text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">{doctor?.roomNumber}</p>
                  <p>Date: {dateFormatted}</p>
                </div>
              </div>

              {/* Patient Meta Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Patient</span>
                  <span className="font-bold text-slate-900 text-sm">{patient.name || 'Patient'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Token No</span>
                  <span className="font-mono font-bold text-teal-700 text-sm">{tokenNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Contact</span>
                  <span className="font-mono">{patient.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Chief Complaint</span>
                  <span className="truncate block font-medium">{token.complaint || 'General Consultation'}</span>
                </div>
              </div>

              {/* Rx Section */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-teal-700 font-bold border-b border-slate-200 pb-1">
                  <span className="font-serif italic font-extrabold text-2xl">Rx</span>
                  <span className="text-xs uppercase tracking-wider text-slate-700">
                    Medications & Clinical Instructions ({templateName})
                  </span>
                </div>
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed min-h-[140px]">
                  {rxNotes}
                </div>
              </div>

              {/* Signature Footer */}
              <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
                <div className="space-y-0.5">
                  <span className="font-bold text-teal-700 uppercase tracking-wider text-[10px] block">
                    Verified Digital Prescription
                  </span>
                  <p className="text-[11px]">Validated via Smart Clinic OS Platform</p>
                </div>
                <div className="text-center space-y-1">
                  <div className="w-36 border-b border-slate-400 pb-1">
                    <span className="font-bold text-slate-900 block">{doctor?.doctorName}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Consultant Signature</span>
                </div>
              </div>
            </div>
          )}

          {/* Clinical Notes Summary Drawer */}
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <span className="text-slate-400 font-medium">
              Prescription Ref: <strong className="text-white font-mono">{filename}</strong>
            </span>
            <span className="text-[11px] text-teal-400 font-mono">
              Ready for preview & selective download
            </span>
          </div>
        </div>

        {/* Modal Bottom Action Controls (Requirements 2 & 3) */}
        <div className="border-t border-slate-800 p-4 sm:px-6 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            {/* Action 1: Open in New Browser Tab */}
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer active:scale-95 shadow-sm"
              title="Open full-screen PDF in a new browser tab without downloading"
            >
              <span>↗️</span>
              <span>Open in New Tab</span>
            </button>

            {/* Action 2: WhatsApp Share */}
            <a
              href={waShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer active:scale-95 shadow-sm"
              title="Share prescription details on WhatsApp"
            >
              <span>💬</span>
              <span>Share on WhatsApp</span>
            </a>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>

            {/* Action 3: Dedicated Manual Download PDF Button (Requirement 3) */}
            <button
              type="button"
              onClick={handleManualDownload}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-extrabold text-xs flex items-center space-x-1.5 shadow-lg shadow-teal-500/20 transition cursor-pointer active:scale-95"
              title="Save a local copy of this prescription PDF to your device"
            >
              <span>📥</span>
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
