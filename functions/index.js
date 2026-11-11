const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

// Helper to format clean phone numbers for WhatsApp API (defaults to Indian 91 country code for 10-digit numbers)
function formatWhatsAppPhone(rawPhone) {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/[^\d]/g, '');
  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = `91${digits.slice(1)}`;
  }
  return digits;
}

// Fetch WhatsApp API Credentials (checks Firestore settings/whatsapp first, then process.env)
async function getWhatsAppCredentials(clinicSlug) {
  try {
    // 1. Check clinic-specific settings if clinicSlug provided
    if (clinicSlug) {
      const clinicDoc = await db.collection('clinics').doc(clinicSlug).get();
      if (clinicDoc.exists && clinicDoc.data().whatsappConfig) {
        const cfg = clinicDoc.data().whatsappConfig;
        if (cfg.token && cfg.phoneNumberId) {
          return {
            token: cfg.token,
            phoneNumberId: cfg.phoneNumberId,
            verifyToken: cfg.verifyToken || 'GOYOH_HEALTH_CONNECT_VERIFY_TOKEN',
            source: 'clinic_settings'
          };
        }
      }
    }

    // 2. Check global settings in Firestore
    const globalSettings = await db.collection('settings').doc('whatsapp').get();
    if (globalSettings.exists) {
      const data = globalSettings.data();
      if (data.token && data.phoneNumberId) {
        return {
          token: data.token,
          phoneNumberId: data.phoneNumberId,
          verifyToken: data.verifyToken || 'GOYOH_HEALTH_CONNECT_VERIFY_TOKEN',
          source: 'firestore_global'
        };
      }
    }
  } catch (err) {
    console.warn('[WhatsApp Config] Firestore lookup notice:', err.message);
  }

  // 3. Fallback to environment variables
  return {
    token: process.env.WHATSAPP_TOKEN || functions.config()?.whatsapp?.token || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || functions.config()?.whatsapp?.phone_id || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || functions.config()?.whatsapp?.verify_token || 'GOYOH_HEALTH_CONNECT_VERIFY_TOKEN',
    source: 'environment'
  };
}

// Core Meta WhatsApp Cloud API Dispatcher
async function sendMetaWhatsAppMessage({ toPhone, messageText, mediaUrl, filename, clinicSlug, metadata = {} }) {
  const cleanPhone = formatWhatsAppPhone(toPhone);
  if (!cleanPhone) {
    throw new Error('Valid recipient phone number is required');
  }

  const directLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(
    messageText + (mediaUrl ? `\n\n📄 Prescription PDF: ${mediaUrl}` : '')
  )}`;

  const creds = await getWhatsAppCredentials(clinicSlug);

  if (!creds.token || !creds.phoneNumberId) {
    console.log(`[WhatsApp Dispatcher] No Meta API credentials active for ${cleanPhone}. Returning click-to-chat direct link.`);
    const logRecord = {
      phone: cleanPhone,
      type: mediaUrl ? 'PRESCRIPTION_PDF' : 'QUEUE_ALERT',
      provider: 'direct_link_fallback',
      status: 'PREPARED_DIRECT_LINK',
      directLink,
      messageSnippet: messageText.slice(0, 150),
      mediaUrl: mediaUrl || null,
      metadata,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('whatsapp_logs').add(logRecord).catch(() => {});

    return {
      success: true,
      delivered: false,
      mode: 'direct_link_fallback',
      directLink,
      message: 'WhatsApp Cloud API token not configured. Pre-filled direct link created for 1-tap dispatch.'
    };
  }

  // Construct Meta Cloud API Payload
  const payload = mediaUrl
    ? {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'document',
        document: {
          link: mediaUrl,
          filename: filename || 'Prescription.pdf',
          caption: messageText
        }
      }
    : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body: messageText, preview_url: true }
      };

  console.log(`[WhatsApp Cloud API] Dispatching ${payload.type} to ${cleanPhone} via phoneId ${creds.phoneNumberId}...`);

  const response = await fetch(`https://graph.facebook.com/v19.0/${creds.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${creds.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const resData = await response.json();

  const isSuccess = response.ok && resData.messages && resData.messages.length > 0;
  const messageId = isSuccess ? resData.messages[0].id : null;

  const logRecord = {
    phone: cleanPhone,
    type: mediaUrl ? 'PRESCRIPTION_PDF' : 'QUEUE_ALERT',
    provider: 'meta_cloud_api',
    status: isSuccess ? 'DISPATCHED_TO_META' : 'ERROR',
    messageId,
    apiResponse: resData,
    directLink,
    messageSnippet: messageText.slice(0, 150),
    mediaUrl: mediaUrl || null,
    metadata,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  await db.collection('whatsapp_logs').add(logRecord).catch(() => {});

  if (!isSuccess) {
    console.warn('[WhatsApp Cloud API] Meta error response:', resData);
    return {
      success: false,
      delivered: false,
      error: resData,
      directLink,
      mode: 'meta_cloud_api_failed'
    };
  }

  return {
    success: true,
    delivered: true,
    messageId,
    provider: 'meta_cloud_api',
    directLink,
    data: resData
  };
}

// Generate Prescription PDF Buffer via PDFKit (Serverless Backend Engine)
async function generatePrescriptionPdfBuffer({ doctor, patient, tokenNumber, rxNotes, templateName, clinicName }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const primaryTeal = '#0d9488';
      const darkSlate = '#0f172a';
      const textMuted = '#475569';
      const bgLight = '#f8fafc';

      // Header Banner
      doc.rect(0, 0, 595.28, 110).fill(bgLight);
      doc.rect(0, 0, 8, 841.89).fill(primaryTeal);

      // Clinic Title & Subhead
      doc.fillColor(primaryTeal).fontSize(20).font('Helvetica-Bold')
        .text((clinicName || doctor?.clinicName || 'GOYOH Health Connect').toUpperCase(), 45, 30);

      doc.fillColor(textMuted).fontSize(10).font('Helvetica')
        .text('DIGITAL OUTPATIENT DEPARTMENT (OPD) & CLINICAL PRACTICE', 45, 55);

      // Doctor Details (Right-aligned in header)
      doc.fillColor(darkSlate).fontSize(12).font('Helvetica-Bold')
        .text(doctor?.doctorName || 'Dr. Consultant', 350, 30, { align: 'right', width: 200 });

      doc.fillColor(textMuted).fontSize(9).font('Helvetica')
        .text(`${doctor?.specialization || 'General Physician'} • ${doctor?.roomNumber || 'Room 1'}`, 350, 48, { align: 'right', width: 200 });

      if (doctor?.qualifications) {
        doc.text(doctor.qualifications, 350, 62, { align: 'right', width: 200 });
      }

      // Patient Metadata Panel
      doc.rect(40, 125, 515, 60).fillAndStroke('#f1f5f9', '#cbd5e1');

      doc.fillColor(darkSlate).fontSize(10).font('Helvetica-Bold').text('PATIENT INFORMATION', 55, 135);
      doc.font('Helvetica').fontSize(9).fillColor(textMuted);
      doc.text(`Patient Name: ${patient?.name || 'Walk-in Patient'}`, 55, 152);
      doc.text(`Mobile / WhatsApp: ${patient?.phone || 'N/A'}`, 55, 166);

      doc.text(`Token Number: #${String(tokenNumber || '1').replace('#', '')}`, 340, 152);
      doc.text(`Date & Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 340, 166);

      // Rx Symbol
      doc.fillColor(primaryTeal).fontSize(24).font('Helvetica-Bold').text('Rx', 45, 205);
      doc.fillColor(textMuted).fontSize(10).font('Helvetica-Bold')
        .text(`Prescription & Clinical Advice (${templateName || 'Standard Consultation'})`, 85, 215);

      doc.moveTo(45, 235).lineTo(555, 235).strokeColor('#e2e8f0').lineWidth(1).stroke();

      // Clinical Notes / Medicines Content
      doc.fillColor(darkSlate).fontSize(10).font('Helvetica').lineGap(4);
      const cleanNotes = (rxNotes && rxNotes.trim()) ? rxNotes.trim() : '1. Standard follow-up & prescribed rest.\n2. Hydrate adequately.\n3. Review if symptoms persist.';
      doc.text(cleanNotes, 55, 255, { width: 485 });

      // Telemedicine & Verification Footer
      doc.rect(40, 750, 515, 50).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor(primaryTeal).fontSize(9).font('Helvetica-Bold')
        .text('GOYOH HEALTH CONNECT • VERIFIED DIGITAL HEALTHCARE RECORD', 40, 760, { align: 'center', width: 515 });

      doc.fillColor(textMuted).fontSize(8).font('Helvetica')
        .text('This digital prescription is electronically generated and compliant with Indian Telemedicine & Clinical Practice Guidelines.', 40, 775, { align: 'center', width: 515 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Upload Buffer to Firebase Storage and get public signed URL
async function uploadBufferToFirebaseStorage(pdfBuffer, filename, clinicSlug) {
  try {
    const bucket = storage.bucket();
    const slug = clinicSlug || 'general';
    const filePath = `prescriptions/${slug}/${Date.now()}_${filename}`;
    const file = bucket.file(filePath);

    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: { clinicSlug: slug, uploadedAt: new Date().toISOString() }
      }
    });

    // Make public or get signed URL valid for 30 days
    try {
      await file.makePublic();
      return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    } catch (pubErr) {
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 30 * 24 * 60 * 60 * 1000
      });
      return signedUrl;
    }
  } catch (err) {
    console.warn('[Firebase Storage] Buffer upload warning:', err.message);
    return null;
  }
}

// ============================================================================
// EXPRESS APP (API & Webhook Router for Firebase Hosting)
// ============================================================================

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Health Check
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'GOYOH Health Connect - WhatsApp Automation Cloud Functions Engine',
    timestamp: new Date().toISOString()
  });
});

// Meta Webhook Verification (GET /webhook/whatsapp or /api/webhook/whatsapp)
app.get(['/webhook/whatsapp', '/api/webhook/whatsapp'], async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const creds = await getWhatsAppCredentials();

  if (mode === 'subscribe' && token === creds.verifyToken) {
    console.log('[Meta Webhook] Verification successful!');
    return res.status(200).send(challenge);
  }

  console.warn('[Meta Webhook] Verification token mismatch. Provided:', token, 'Expected:', creds.verifyToken);
  res.status(403).send('Forbidden: Verification token mismatch');
});

// Meta Webhook Receiver (POST /webhook/whatsapp or /api/webhook/whatsapp)
app.post(['/webhook/whatsapp', '/api/webhook/whatsapp'], async (req, res) => {
  const body = req.body;
  if (body.object === 'whatsapp_business_account') {
    try {
      if (body.entry && body.entry[0]?.changes && body.entry[0]?.changes[0]?.value) {
        const changeValue = body.entry[0].changes[0].value;

        // Log message status updates (sent, delivered, read, failed)
        if (changeValue.statuses && changeValue.statuses.length > 0) {
          const statusObj = changeValue.statuses[0];
          console.log(`[Meta Webhook] Message ${statusObj.id} status updated to: ${statusObj.status} for recipient ${statusObj.recipient_id}`);

          await db.collection('whatsapp_statuses').add({
            messageId: statusObj.id,
            status: statusObj.status,
            recipientId: statusObj.recipient_id,
            timestamp: statusObj.timestamp,
            raw: statusObj,
            receivedAt: admin.firestore.FieldValue.serverTimestamp()
          }).catch(() => {});
        }

        // Log incoming messages from patients
        if (changeValue.messages && changeValue.messages.length > 0) {
          const incoming = changeValue.messages[0];
          console.log(`[Meta Webhook] Incoming message from ${incoming.from}:`, incoming.text?.body || incoming.type);

          await db.collection('whatsapp_incoming').add({
            from: incoming.from,
            messageId: incoming.id,
            type: incoming.type,
            text: incoming.text?.body || null,
            raw: incoming,
            receivedAt: admin.firestore.FieldValue.serverTimestamp()
          }).catch(() => {});
        }
      }

      // 24/7 Redundancy: Forward incoming event to live Render webhook service
      try {
        fetch('https://smart-clinic-whatsapp-webhook.onrender.com/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }).catch(() => {});
      } catch (forwardErr) {}
    } catch (e) {
      console.warn('[Meta Webhook Error]', e);
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
  res.sendStatus(404);
});

// ----------------------------------------------------------------------------
// FEATURE 1: Automated Queue Check-in Alert
// ----------------------------------------------------------------------------
app.post(['/notifications/queue-checkin', '/api/notifications/queue-checkin'], async (req, res) => {
  try {
    const {
      phone,
      patientName,
      tokenNumber,
      clinicSlug,
      clinicName,
      doctorName,
      roomNumber,
      estimatedWaitMinutes,
      waitingCount,
      trackerUrl
    } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Patient phone number is required' });
    }

    const tNum = String(tokenNumber || '1').startsWith('#') ? tokenNumber : `#${tokenNumber}`;
    const pName = patientName || 'Patient';
    const cName = clinicName || 'Clinic';
    const dName = doctorName || 'Doctor';
    const rNum = roomNumber || 'Consultation Room 1';
    const waitTime = estimatedWaitMinutes ? `~${estimatedWaitMinutes} mins` : '~10-15 mins';
    const posText = (waitingCount !== undefined && waitingCount !== null)
      ? `${waitingCount} patient(s) ahead`
      : 'In waiting queue';

    const cleanBase = (trackerUrl || `https://admin.goyoh.in/queue/${clinicSlug || 'clinic'}?token=${tNum.replace('#', '')}`).trim();

    const messageText = `🏥 *${cName} • GOYOH Health Connect*\n\nNamaste *${pName}*, your digital queue token is confirmed!\n\n🎫 *Your Token:* ${tNum}\n🩺 *Doctor:* ${dName}\n📍 *Room:* ${rNum}\n⏱️ *Est. Wait Time:* ${waitTime} (${posText})\n\n🔴 *Track Your Live Queue Status:* \n${cleanBase}\n\n_Please arrive near your consultation room when your token is called._`;

    const dispatchResult = await sendMetaWhatsAppMessage({
      toPhone: phone,
      messageText,
      clinicSlug,
      metadata: { action: 'QUEUE_CHECKIN', tokenNumber: tNum, patientName: pName, clinicSlug }
    });

    res.status(200).json({
      success: true,
      delivered: dispatchResult.delivered,
      mode: dispatchResult.mode || 'meta_cloud_api',
      messageId: dispatchResult.messageId || null,
      directLink: dispatchResult.directLink,
      message: 'Queue check-in WhatsApp alert dispatched successfully'
    });
  } catch (error) {
    console.error('[Queue Check-in WhatsApp Error]', error);
    res.status(500).json({ error: error.message || 'Failed to dispatch check-in alert' });
  }
});

// ----------------------------------------------------------------------------
// FEATURE 2: 10-Second Prescription Dispatch
// ----------------------------------------------------------------------------
app.post(['/notifications/prescription-dispatch', '/api/notifications/prescription-dispatch'], async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      phone,
      patientName,
      tokenNumber,
      clinicSlug,
      clinicName,
      doctorName,
      rxNotes,
      templateName,
      pdfUrl,
      filename,
      doctor,
      patient
    } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Patient phone number is required' });
    }

    const tNum = String(tokenNumber || '1').startsWith('#') ? tokenNumber : `#${tokenNumber}`;
    const pName = patientName || patient?.name || 'Patient';
    const cName = clinicName || doctor?.clinicName || 'GOYOH Health Connect';
    const dName = doctorName || doctor?.doctorName || 'Doctor';
    const cleanFilename = filename || `Rx_${pName.replace(/\s+/g, '_')}_${tNum.replace('#', '')}.pdf`;

    let finalPdfUrl = pdfUrl;

    // If PDF URL is not provided or is a local blob URL, generate a production PDF on the fly in < 2 seconds
    if (!finalPdfUrl || finalPdfUrl.startsWith('blob:') || finalPdfUrl.startsWith('data:')) {
      console.log(`[Prescription Dispatch] Generating PDF on server for Token ${tNum}...`);
      const pdfBuffer = await generatePrescriptionPdfBuffer({
        doctor: doctor || { doctorName: dName, clinicName: cName },
        patient: patient || { name: pName, phone },
        tokenNumber: tNum,
        rxNotes,
        templateName,
        clinicName: cName
      });

      const uploadedUrl = await uploadBufferToFirebaseStorage(pdfBuffer, cleanFilename, clinicSlug);
      if (uploadedUrl) {
        finalPdfUrl = uploadedUrl;
      }
    }

    const notesSummary = (rxNotes && rxNotes.trim())
      ? (rxNotes.length > 120 ? rxNotes.slice(0, 115) + '...' : rxNotes)
      : 'Standard prescription and clinical advice.';

    const messageText = `🏥 *${cName} • Official Digital Prescription*\n\nDear *${pName}*,\n\nYour consultation with *${dName}* is complete. Your verified prescription has been issued.\n\n🎫 *Token Ref:* ${tNum}\n💊 *Advice / Rx:* ${notesSummary}\n\n📄 *Download Official PDF Prescription:*\n${finalPdfUrl || 'Attached directly to this message.'}\n\n_Wish you a speedy recovery!_`;

    const dispatchResult = await sendMetaWhatsAppMessage({
      toPhone: phone,
      messageText,
      mediaUrl: finalPdfUrl,
      filename: cleanFilename,
      clinicSlug,
      metadata: { action: 'PRESCRIPTION_DISPATCH', tokenNumber: tNum, patientName: pName, clinicSlug }
    });

    const elapsedMs = Date.now() - startTime;
    console.log(`[Prescription Dispatch] Completed in ${elapsedMs}ms (${(elapsedMs / 1000).toFixed(2)}s). SLA <10s met: ${elapsedMs < 10000}`);

    // Update Firestore token document with prescription dispatch status if tokenId is available
    if (req.body.tokenId) {
      await db.collection('queues').doc(String(req.body.tokenId)).set({
        whatsappRxSent: true,
        whatsappRxDispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
        whatsappRxElapsedMs: elapsedMs,
        rxPdfUrl: finalPdfUrl || null
      }, { merge: true }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      delivered: dispatchResult.delivered,
      mode: dispatchResult.mode || 'meta_cloud_api',
      messageId: dispatchResult.messageId || null,
      pdfUrl: finalPdfUrl,
      elapsedMs,
      directLink: dispatchResult.directLink,
      message: `Prescription dispatched via WhatsApp in ${(elapsedMs / 1000).toFixed(1)} seconds`
    });
  } catch (error) {
    console.error('[Prescription WhatsApp Dispatch Error]', error);
    res.status(500).json({ error: error.message || 'Failed to dispatch prescription' });
  }
});

// Universal Notification Endpoint (Backward compatibility with existing frontend calls)
app.post(['/notifications/whatsapp', '/api/notifications/whatsapp'], async (req, res) => {
  try {
    const { phone, patientName, tokenNumber, clinicName, doctorName, queueUrl, rxText, pdfUrl, filename, clinicSlug } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    let messageText = '';
    let media = pdfUrl || null;

    if (rxText) {
      messageText = `🏥 *${clinicName || 'Clinic'}*\nHello ${patientName || 'Patient'}, here is your digital prescription from ${doctorName || 'Doctor'}.\n\n💊 *Advice:* ${rxText}\n\nDownload: ${media || 'Please collect at reception.'}`;
    } else if (queueUrl) {
      messageText = `🏥 *${clinicName || 'Clinic'}*\nNamaste ${patientName || 'Patient'}! Your OPD Token ${tokenNumber || ''} is active.\n\n🔴 *Track Queue Live:* ${queueUrl}`;
    } else {
      messageText = `🏥 *${clinicName || 'Clinic'}*\nToken ${tokenNumber || ''}: ${doctorName || 'Doctor'} is ready for you now. Please step inside.`;
    }

    const result = await sendMetaWhatsAppMessage({
      toPhone: phone,
      messageText,
      mediaUrl: media,
      filename,
      clinicSlug,
      metadata: { action: 'GENERIC_NOTIFICATION', tokenNumber, patientName }
    });

    res.json({
      success: true,
      delivered: result.delivered,
      mode: result.mode,
      messageId: result.messageId || null,
      directLink: result.directLink
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings: Get WhatsApp Cloud API Configuration Status
app.get(['/whatsapp/config', '/api/whatsapp/config'], async (req, res) => {
  try {
    const clinicSlug = req.query.clinicSlug;
    const creds = await getWhatsAppCredentials(clinicSlug);

    res.json({
      configured: Boolean(creds.token && creds.phoneNumberId),
      hasToken: Boolean(creds.token),
      phoneNumberId: creds.phoneNumberId ? `${creds.phoneNumberId.slice(0, 4)}...${creds.phoneNumberId.slice(-4)}` : null,
      source: creds.source,
      verifyToken: creds.verifyToken,
      webhookUrl: 'https://smart-clinic-whatsapp-webhook.onrender.com/webhook',
      liveWebhookEndpoint: 'https://smart-clinic-whatsapp-webhook.onrender.com/webhook'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings: Save Meta WhatsApp Cloud API Credentials
app.post(['/whatsapp/config', '/api/whatsapp/config'], async (req, res) => {
  try {
    const { token, phoneNumberId, verifyToken, clinicSlug } = req.body;

    if (!token || !phoneNumberId) {
      return res.status(400).json({ error: 'Both token and phoneNumberId are required' });
    }

    const payload = {
      token: token.trim(),
      phoneNumberId: phoneNumberId.trim(),
      verifyToken: (verifyToken || 'GOYOH_HEALTH_CONNECT_VERIFY_TOKEN').trim(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (clinicSlug) {
      await db.collection('clinics').doc(clinicSlug).set({ whatsappConfig: payload }, { merge: true });
    } else {
      await db.collection('settings').doc('whatsapp').set(payload, { merge: true });
    }

    res.json({
      success: true,
      message: 'WhatsApp Business Cloud API credentials saved successfully',
      clinicSlug: clinicSlug || 'global'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export Express App as Cloud Function 'api'
exports.api = functions.https.onRequest(app);

// ============================================================================
// FIRESTORE BACKGROUND TRIGGERS (Automated Dual Redundancy)
// ============================================================================

// Trigger 1: Automatically dispatch WhatsApp check-in alert when new patient enters queue in Firestore
exports.onQueueDocumentCreated = functions.firestore
  .document('queues/{tokenId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data || !data.patient?.phone) return;

    // Check if already dispatched via HTTP frontend call
    if (data.whatsappCheckinSent) {
      console.log(`[Firestore Trigger] Queue check-in WhatsApp already sent for #${data.tokenNumber}.`);
      return;
    }

    try {
      const cleanPhone = formatWhatsAppPhone(data.patient.phone);
      const tNum = data.tokenNumber || `#${context.params.tokenId}`;
      const pName = data.patient.name || 'Patient';
      const cName = data.clinicName || 'Clinic';
      const cSlug = data.clinicSlug || 'clinic';
      const trackerUrl = `https://admin.goyoh.in/queue/${cSlug}?token=${String(tNum).replace('#', '')}`;

      const messageText = `🏥 *${cName} • GOYOH Health Connect*\n\nNamaste *${pName}*, your digital queue token is confirmed!\n\n🎫 *Your Token:* ${tNum}\n📍 *Status:* Waiting in line\n\n🔴 *Track Your Live Queue:* \n${trackerUrl}\n\n_We will notify you on WhatsApp when your turn arrives._`;

      const result = await sendMetaWhatsAppMessage({
        toPhone: cleanPhone,
        messageText,
        clinicSlug: cSlug,
        metadata: { trigger: 'firestore_onCreate', tokenId: context.params.tokenId, tokenNumber: tNum }
      });

      await snap.ref.set({
        whatsappCheckinSent: true,
        whatsappCheckinDispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
        whatsappCheckinMessageId: result.messageId || null
      }, { merge: true });

      console.log(`[Firestore Trigger] Sent check-in alert to ${cleanPhone} for token ${tNum}`);
    } catch (err) {
      console.error('[Firestore Trigger Check-in Error]', err);
    }
  });

// Trigger 2: Automatically dispatch WhatsApp Rx PDF when consultation is completed in Firestore
exports.onQueueDocumentUpdated = functions.firestore
  .document('queues/{tokenId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Trigger ONLY when status changes to COMPLETED and has not already sent WhatsApp Rx
    if (before.status !== 'COMPLETED' && after.status === 'COMPLETED' && !after.whatsappRxSent && after.patient?.phone) {
      try {
        const cleanPhone = formatWhatsAppPhone(after.patient.phone);
        const tNum = after.tokenNumber || `#${context.params.tokenId}`;
        const pName = after.patient.name || 'Patient';
        const cName = after.clinicName || 'Clinic';
        const dName = after.doctorName || 'Doctor';
        const cSlug = after.clinicSlug || 'clinic';
        const pdfUrl = after.rxPdfUrl || null;
        const filename = after.rxFilename || `Rx_${pName.replace(/\s+/g, '_')}_${tNum.replace('#', '')}.pdf`;

        const notes = (after.rxNotes && after.rxNotes.trim()) ? after.rxNotes.trim() : 'Prescription issued.';
        const messageText = `🏥 *${cName} • Digital Prescription*\n\nDear *${pName}*,\n\nYour consultation with *${dName}* is completed. Your digital prescription is ready.\n\n🎫 *Token Ref:* ${tNum}\n💊 *Advice:* ${notes}\n\n📄 *Download PDF:* ${pdfUrl || 'Please collect at reception.'}\n\n_Wish you a speedy recovery!_`;

        const result = await sendMetaWhatsAppMessage({
          toPhone: cleanPhone,
          messageText,
          mediaUrl: pdfUrl,
          filename,
          clinicSlug: cSlug,
          metadata: { trigger: 'firestore_onUpdate_completed', tokenId: context.params.tokenId, tokenNumber: tNum }
        });

        await change.after.ref.set({
          whatsappRxSent: true,
          whatsappRxDispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
          whatsappRxMessageId: result.messageId || null
        }, { merge: true });

        console.log(`[Firestore Trigger] Sent prescription PDF to ${cleanPhone} for token ${tNum}`);
      } catch (err) {
        console.error('[Firestore Trigger Rx Dispatch Error]', err);
      }
    }
  });
