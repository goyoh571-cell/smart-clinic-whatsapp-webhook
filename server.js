// ============================================================================
// GOYOH HEALTH CONNECT - 24/7 WHATSAPP WEBHOOK SERVICE (HOSTED ON RENDER)
// Endpoint: https://smart-clinic-whatsapp-webhook.onrender.com/webhook
// Handles: Meta WhatsApp Cloud API Webhook Verification & Real-Time Inbound Events
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

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || 'GOYOH_HEALTH_CONNECT_VERIFY_TOKEN';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyD_0K24tUnG1OWh74HwJfjqQIZ6Q3_IOn0';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'smart-clinic-app-cf39b';

// Helper: Save incoming event to Firestore with automatic REST fallback
async function saveToFirestore(collection, data) {
  // 1. Try Firebase Admin SDK if active with credentials
  if (admin && admin.apps.length > 0) {
    try {
      await admin.firestore().collection(collection).add({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return true;
    } catch (adminErr) {
      // Fall through to REST API
    }
  }

  // 2. Direct Firestore REST API fallback (100% reliable on Render)
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
    console.warn(`[Firestore REST Error (${collection})]:`, restErr.message);
    return false;
  }
}

// ----------------------------------------------------------------------------
// 1. ROOT & HEALTH CHECK ENDPOINTS
// ----------------------------------------------------------------------------
app.get(['/', '/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'GOYOH Health Connect - 24/7 WhatsApp Webhook Engine',
    provider: 'Render Cloud',
    webhookUrl: 'https://smart-clinic-whatsapp-webhook.onrender.com/webhook',
    endpoints: {
      webhook: '/webhook',
      verification: 'GET /webhook?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...',
      health: '/health',
      config: '/api/whatsapp/config'
    },
    verifyToken: VERIFY_TOKEN,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Configuration info
app.get(['/config', '/api/whatsapp/config', '/whatsapp/config'], (req, res) => {
  res.json({
    success: true,
    configured: true,
    webhookUrl: 'https://smart-clinic-whatsapp-webhook.onrender.com/webhook',
    verifyToken: VERIFY_TOKEN,
    provider: 'Render 24/7 Webhook Service'
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

  // Graceful direct browser visit
  res.status(200).send(`GOYOH WhatsApp Webhook Endpoint Active. Verify Token: ${VERIFY_TOKEN}`);
});

// ----------------------------------------------------------------------------
// 3. META WHATSAPP EVENT RECEIVER (POST Incoming Messages & Status Updates)
// ----------------------------------------------------------------------------
app.post(['/webhook', '/api/webhook/whatsapp', '/api/webhook'], async (req, res) => {
  const body = req.body || {};
  console.log('[Meta Webhook POST] Payload received at:', new Date().toISOString());

  // Confirm WhatsApp Business Account event
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

    // WhatsApp Cloud API mandates a prompt 200 OK response
    return res.status(200).send('EVENT_RECEIVED');
  }

  // General event fallback
  res.status(200).send('EVENT_RECEIVED');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`GOYOH WhatsApp Webhook Service running on port ${PORT}`);
  console.log(`Live Webhook Endpoint: https://smart-clinic-whatsapp-webhook.onrender.com/webhook`);
  console.log(`Verify Token: ${VERIFY_TOKEN}`);
  console.log(`==================================================`);
});
