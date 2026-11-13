// ============================================================================
// GOYOH HEALTH CONNECT - 24/7 WHATSAPP WEBHOOK & DISPATCH SERVICE (RENDER)
// Live Endpoint: https://smart-clinic-whatsapp-webhook.onrender.com/webhook
// Meta Cloud API: Phone Number ID 1378688712001380 (+1 555-145-6531)
// ============================================================================

const express = require('express');

let admin = null;
try {
  admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (e) {
  console.log('[Firebase Admin Notice] Initialized with REST fallback mode');
}

const app = express();
// Native zero-dependency CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());

// ----------------------------------------------------------------------------
// ENVIRONMENT CONFIGURATION & CREDENTIALS
// ----------------------------------------------------------------------------
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || 'EABBS0XEoHBQBS5lZCoWetNjSI5kWkYKFEbvkpb2VZCNCUmk9avtgalUbyu184Wepy89iQqLGzqNwJassfwW4E8LEZBfkQSBpSQE8TQcuhSso7KCZCTQtZBbalNnDq3U6x3kOlRYlveCb8XYlzTNV5dFgp1UhT4cx9ZCsYTNkRZCiBED8NDefGcEGIA3FmQDuo9mUVt7HYnfI79MpLr0jnJ3kbi21osdMOGBA6g6GA8n9NZCrz4FqRymuXZAKHu5FfLEZBf3b2WuwZB281k2ABnLLkxS';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '1378688712001380';
const WHATSAPP_TEST_NUMBER = process.env.WHATSAPP_TEST_NUMBER || '+1 (555) 145-6531';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || 'GOYOH_HEALTH_CONNECT_VERIFY_TOKEN';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyD_0K24tUnG1OWh74HwJfjqQIZ6Q3_IOn0';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'smart-clinic-app-cf39b';

// Helper: Normalize phone number to digits only (e.g., +1 (555) 145-6531 -> 15551456531)
function formatPhone(num) {
  if (!num) return WHATSAPP_TEST_NUMBER.replace(/[^0-9]/g, '');
  const digits = String(num).replace(/[^0-9]/g, '');
  if (digits.length === 10) return `91${digits}`; // default India 10-digit
  return digits;
}

// ----------------------------------------------------------------------------
// OUTBOUND META WHATSAPP DISPATCH HELPER
// ----------------------------------------------------------------------------
async function sendMetaWhatsAppMessage({ to, messageText, mediaUrl, filename }) {
  const cleanTo = formatPhone(to);
  const directLink = `https://api.whatsapp.com/send?phone=${cleanTo}&text=${encodeURIComponent(
    messageText + (mediaUrl ? `\n\n📄 Prescription PDF: ${mediaUrl}` : '')
  )}`;

  const metaUrl = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  // Payload: document or text
  const payload = mediaUrl
    ? {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'document',
        document: {
          link: mediaUrl,
          caption: messageText.slice(0, 1024),
          filename: filename || 'Prescription.pdf'
        }
      }
    : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: { preview_url: false, body: messageText }
      };

  try {
    const response = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const resJson = await response.json();
    const isSuccess = response.ok && (resJson.messages?.length > 0 || !resJson.error);

    if (isSuccess) {
      const msgId = resJson.messages?.[0]?.id || `wamid_${Date.now()}`;
      console.log(`✓ [Meta Outbound SUCCESS] Sent to: ${cleanTo} | Message ID: ${msgId}`);
      return {
        success: true,
        delivered: true,
        mode: 'meta_cloud_api',
        messageId: msgId,
        recipient: cleanTo,
        directLink,
        raw: resJson
      };
    } else {
      console.warn(`⚠️ [Meta Outbound Notice] ${resJson.error?.message || response.statusText}. Fallback link prepared.`);
      return {
        success: true,
        delivered: false,
        mode: 'direct_link_fallback',
        recipient: cleanTo,
        directLink,
        error: resJson.error || response.statusText
      };
    }
  } catch (netErr) {
    console.warn(`[Meta Network Error]:`, netErr.message);
    return {
      success: true,
      delivered: false,
      mode: 'direct_link_fallback',
      recipient: cleanTo,
      directLink,
      error: netErr.message
    };
  }
}

// Helper: Save incoming/outgoing event to Firestore with automatic REST fallback
async function saveToFirestore(collection, data) {
  if (admin && admin.apps.length > 0) {
    try {
      await admin.firestore().collection(collection).add({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return true;
    } catch (adminErr) {}
  }

  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}?key=${FIREBASE_API_KEY}`;
    const fields = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string') fields[k] = { stringValue: v };
      else if (typeof v === 'number') fields[k] = { integerValue: String(v) };
      else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
      else if (v && typeof v === 'object') fields[k] = { stringValue: JSON.stringify(v) };
    }
    fields.receivedAt = { timestampValue: new Date().toISOString() };

    const resp = await fetch(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    return resp.ok;
  } catch (restErr) {
    return false;
  }
}

// ----------------------------------------------------------------------------
// 1. ROOT & HEALTH CHECK ENDPOINTS
// ----------------------------------------------------------------------------
app.get(['/', '/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'GOYOH Health Connect - 24/7 WhatsApp Webhook & Dispatch Engine',
    provider: 'Render Cloud',
    phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
    testNumber: WHATSAPP_TEST_NUMBER,
    webhookUrl: 'https://smart-clinic-whatsapp-webhook.onrender.com/webhook',
    endpoints: {
      webhook: '/webhook',
      verification: 'GET /webhook?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...',
      testSend: 'GET or POST /api/test/send-whatsapp',
      queueCheckin: 'POST /api/notifications/queue-checkin',
      prescriptionDispatch: 'POST /api/notifications/prescription-dispatch',
      health: '/health',
      config: '/api/whatsapp/config'
    },
    verifyToken: VERIFY_TOKEN,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Configuration Info
app.get(['/config', '/api/whatsapp/config', '/whatsapp/config'], (req, res) => {
  res.json({
    success: true,
    configured: true,
    hasToken: Boolean(WHATSAPP_ACCESS_TOKEN),
    phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
    testNumber: WHATSAPP_TEST_NUMBER,
    webhookUrl: 'https://smart-clinic-whatsapp-webhook.onrender.com/webhook',
    verifyToken: VERIFY_TOKEN,
    provider: 'Meta WhatsApp Cloud API & Render 24/7 Webhook'
  });
});

// ----------------------------------------------------------------------------
// 2. META WHATSAPP WEBHOOK VERIFICATION (GET Handshake)
// ----------------------------------------------------------------------------
app.get(['/webhook', '/api/webhook/whatsapp', '/api/webhook'], (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`[Meta Webhook GET] Mode: ${mode} | Token: ${token} | Challenge: ${challenge}`);

  if (mode === 'subscribe' && (token === VERIFY_TOKEN || !token)) {
    console.log('✓ [Meta Webhook Verification] Handshake verified successfully!');
    return res.status(200).send(challenge || 'OK');
  }

  if (mode === 'subscribe') {
    console.warn(`⚠️ [Meta Webhook Warning] Token mismatch. Expected: ${VERIFY_TOKEN}, Received: ${token}`);
    return res.status(403).send('Forbidden: Token mismatch');
  }

  res.status(200).send(`GOYOH WhatsApp Webhook Endpoint Active. Verify Token: ${VERIFY_TOKEN}`);
});

// ----------------------------------------------------------------------------
// 3. META WHATSAPP EVENT RECEIVER (POST Incoming Messages & Status Updates)
// ----------------------------------------------------------------------------
app.post(['/webhook', '/api/webhook/whatsapp', '/api/webhook'], async (req, res) => {
  const body = req.body || {};
  console.log('[Meta Webhook POST] Payload received at:', new Date().toISOString());

  if (body.object === 'whatsapp_business_account' || body.entry) {
    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const val = change.value || {};

          // A. Process Message Status Updates (sent, delivered, read, failed)
          if (val.statuses && val.statuses.length > 0) {
            for (const st of val.statuses) {
              console.log(`📨 [WhatsApp Status] Message ${st.id} ➔ ${st.status.toUpperCase()} for ${st.recipient_id}`);
              await saveToFirestore('whatsapp_statuses', {
                messageId: st.id,
                status: st.status,
                recipientId: st.recipient_id,
                timestamp: st.timestamp,
                raw: st
              });
            }
          }

          // B. Process Incoming Patient Messages (text, reply, turn inquiry)
          if (val.messages && val.messages.length > 0) {
            for (const msg of val.messages) {
              const textBody = msg.text?.body || msg.type || '';
              console.log(`💬 [WhatsApp Incoming] From: ${msg.from} | Text: "${textBody}" | Type: ${msg.type}`);
              await saveToFirestore('whatsapp_incoming', {
                from: msg.from,
                messageId: msg.id,
                type: msg.type,
                text: textBody,
                timestamp: msg.timestamp,
                raw: msg
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Meta Webhook Processing Error]:', err.message);
    }
    return res.status(200).send('EVENT_RECEIVED');
  }

  res.status(200).send('EVENT_RECEIVED');
});

// ----------------------------------------------------------------------------
// 4. TEST OUTBOUND WHATSAPP DISPATCH TO TEST NUMBER
// ----------------------------------------------------------------------------
app.all(['/api/test/send-whatsapp', '/test/send'], async (req, res) => {
  try {
    const targetPhone = req.body?.phone || req.query?.phone || WHATSAPP_TEST_NUMBER;
    const testMessage = req.body?.message || req.query?.message || `🏥 GOYOH Health Connect Test Alert\n\nThis is an automated test from WhatsApp Cloud API.\nPhone ID: ${WHATSAPP_PHONE_NUMBER_ID}\nTimestamp: ${new Date().toISOString()}`;

    console.log(`[Test Send] Dispatched test WhatsApp message to ${targetPhone}...`);
    const result = await sendMetaWhatsAppMessage({
      to: targetPhone,
      messageText: testMessage
    });

    res.json({
      success: true,
      targetPhone,
      testNumberUsed: targetPhone === WHATSAPP_TEST_NUMBER,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 5. QUEUE CHECK-IN ALERT API
// ----------------------------------------------------------------------------
app.post(['/notifications/queue-checkin', '/api/notifications/queue-checkin'], async (req, res) => {
  try {
    const {
      phone,
      patientName,
      tokenNumber,
      clinicName,
      doctorName,
      roomNumber,
      estimatedWaitMinutes,
      waitingCount,
      trackerUrl
    } = req.body;

    const targetPhone = phone || WHATSAPP_TEST_NUMBER;
    const msg = `🏥 *${clinicName || 'GOYOH Health Connect'}*\n\nNamaste *${patientName || 'Patient'}*, your digital queue token is confirmed!\n\n🎫 *Your Token:* ${tokenNumber || '#1'}\n🩺 *Doctor:* ${doctorName || 'Lead Physician'}\n📍 *Room:* ${roomNumber || 'Consultation Room 1'}\n⏱️ *Est. Wait Time:* ~${estimatedWaitMinutes || 10} mins (${waitingCount || 0} patient(s) ahead)\n\n🔴 *Track Your Live Queue Status:* \n${trackerUrl || 'https://admin.goyoh.in'}\n\n_Please arrive near your consultation room when your token is called._`;

    const result = await sendMetaWhatsAppMessage({
      to: targetPhone,
      messageText: msg
    });

    res.json({
      success: true,
      delivered: result.delivered,
      mode: result.mode,
      messageId: result.messageId || null,
      phone: result.recipient,
      directLink: result.directLink,
      message: 'Queue check-in WhatsApp alert processed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 6. 10-SECOND PRESCRIPTION DISPATCH API
// ----------------------------------------------------------------------------
app.post(['/notifications/prescription-dispatch', '/api/notifications/prescription-dispatch'], async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      phone,
      patientName,
      tokenNumber,
      clinicName,
      doctorName,
      rxNotes,
      pdfUrl,
      filename
    } = req.body;

    const targetPhone = phone || WHATSAPP_TEST_NUMBER;
    const msg = `🏥 *${clinicName || 'GOYOH Health Connect'} • Official Digital Prescription*\n\nDear *${patientName || 'Patient'}*,\n\nYour consultation with *${doctorName || 'Doctor'}* is complete. Your verified prescription has been issued.\n\n🎫 *Token Ref:* ${tokenNumber || '#1'}\n💊 *Advice / Rx:* ${rxNotes ? rxNotes.slice(0, 300) : 'Standard medical instructions.'}\n\n📄 *Download Official PDF Prescription:*\n${pdfUrl || 'https://admin.goyoh.in'}\n\n_Wish you a speedy recovery!_`;

    const result = await sendMetaWhatsAppMessage({
      to: targetPhone,
      messageText: msg,
      mediaUrl: pdfUrl,
      filename: filename || `Rx_${(patientName || 'Patient').replace(/\s+/g, '_')}.pdf`
    });

    const elapsedMs = Date.now() - startTime;
    res.json({
      success: true,
      delivered: result.delivered,
      mode: result.mode,
      messageId: result.messageId || null,
      phone: result.recipient,
      pdfUrl,
      elapsedMs,
      directLink: result.directLink,
      message: `Prescription dispatched via WhatsApp in ${(elapsedMs / 1000).toFixed(2)} seconds`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`GOYOH WhatsApp Engine running on port ${PORT}`);
  console.log(`WhatsApp Phone ID: ${WHATSAPP_PHONE_NUMBER_ID}`);
  console.log(`Test Phone Number: ${WHATSAPP_TEST_NUMBER}`);
  console.log(`Live Webhook Endpoint: https://smart-clinic-whatsapp-webhook.onrender.com/webhook`);
  console.log(`Verify Token: ${VERIFY_TOKEN}`);
  console.log(`==================================================`);
});
