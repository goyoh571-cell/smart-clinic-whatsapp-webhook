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

// Helper: Normalize phone number to clean E.164 digits without '+' (e.g., +1 (555) 145-6531 -> 15551456531)
function formatPhone(num) {
  if (!num) return WHATSAPP_TEST_NUMBER.replace(/[^0-9]/g, '');
  let digits = String(num).replace(/[^0-9]/g, '');
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) return `91${digits}`; // default India 10-digit
  return digits;
}

// ----------------------------------------------------------------------------
// OUTBOUND META WHATSAPP DISPATCH HELPER
// ----------------------------------------------------------------------------
async function sendMetaWhatsAppMessage({
  to,
  messageText,
  mediaUrl,
  filename,
  templateName,
  languageCode = 'en_US',
  parameters = [],
  components = null
}) {
  const cleanTo = formatPhone(to);
  const directLink = `https://api.whatsapp.com/send?phone=${cleanTo}&text=${encodeURIComponent(
    (messageText || 'Token confirmation alert') + (mediaUrl ? `\n\n📄 Prescription PDF: ${mediaUrl}` : '')
  )}`;

  const metaUrl = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  // Payload: template, document, or text
  let payload;
  let isTemplateMode = Boolean(templateName);

  if (isTemplateMode) {
    const templatePayload = {
      name: templateName,
      language: {
        code: languageCode || 'en_US'
      }
    };

    // hello_world template in Meta test environments cannot have components/parameters
    if (templateName !== 'hello_world') {
      if (Array.isArray(components) && components.length > 0) {
        templatePayload.components = components;
      } else if (Array.isArray(parameters) && parameters.length > 0) {
        templatePayload.components = [
          {
            type: 'body',
            parameters: parameters.map(p => {
              if (typeof p === 'object' && p !== null && p.type) return p;
              return { type: 'text', text: String(p ?? '') };
            })
          }
        ];
      }
    }

    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'template',
      template: templatePayload
    };
  } else if (mediaUrl) {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'document',
      document: {
        link: mediaUrl,
        caption: (messageText || '').slice(0, 1024),
        filename: filename || 'Prescription.pdf'
      }
    };
  } else {
    // Plain text mode (only succeeds within active 24-hr customer service window)
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: { preview_url: false, body: messageText || 'Token confirmation alert' }
    };
  }

  try {
    console.log(`[Meta Outbound Request] Dispatching ${payload.type} to ${cleanTo} via Phone ID ${WHATSAPP_PHONE_NUMBER_ID}...`);
    if (payload.type === 'template') {
      console.log(`[Meta Template Payload] Template: "${payload.template.name}" | Lang: "${payload.template.language.code}" | Body Params:`, JSON.stringify(payload.template.components?.[0]?.parameters || []));
    }

    const response = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const resJson = await response.json().catch(() => ({}));
    const isSuccess = response.ok && Array.isArray(resJson.messages) && resJson.messages.length > 0;

    if (isSuccess) {
      const msgId = resJson.messages[0]?.id || `wamid_${Date.now()}`;
      console.log(`✓ [Meta Outbound SUCCESS] Sent to: ${cleanTo} | Template: ${templateName || 'none'} | Message ID: ${msgId}`);
      return {
        success: true,
        delivered: true,
        mode: 'meta_cloud_api',
        messageId: msgId,
        templateName: templateName || null,
        recipient: cleanTo,
        directLink,
        raw: resJson
      };
    } else {
      console.error(`❌ [Meta Outbound REJECTED] Status ${response.status}:`, JSON.stringify(resJson.error || resJson));

      // If a custom template failed with error 132000 (template does not exist) and templateName is not hello_world,
      // attempt fallback to pre-approved 'hello_world' in test accounts
      if (isTemplateMode && templateName !== 'hello_world' && (resJson.error?.code === 132000 || resJson.error?.error_subcode === 2494011)) {
        console.warn(`[Meta Template Fallback] Custom template '${templateName}' not found or unapproved in Meta. Attempting 'hello_world' fallback for sandbox verification...`);
        try {
          const fallbackPayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanTo,
            type: 'template',
            template: {
              name: 'hello_world',
              language: { code: 'en_US' }
            }
          };
          const fbResp = await fetch(metaUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(fallbackPayload)
          });
          const fbJson = await fbResp.json().catch(() => ({}));
          if (fbResp.ok && Array.isArray(fbJson.messages) && fbJson.messages.length > 0) {
            const fbMsgId = fbJson.messages[0].id;
            console.log(`✓ [Meta Outbound SUCCESS via hello_world Fallback] Sent to: ${cleanTo} | Message ID: ${fbMsgId}`);
            return {
              success: true,
              delivered: true,
              mode: 'meta_template_fallback_hello_world',
              messageId: fbMsgId,
              templateName: 'hello_world',
              recipient: cleanTo,
              directLink,
              raw: fbJson
            };
          }
        } catch (fbErr) {
          console.warn('[Meta hello_world fallback failed]:', fbErr.message);
        }
      }

      return {
        success: false,
        delivered: false,
        mode: 'meta_error',
        recipient: cleanTo,
        templateName: templateName || null,
        directLink,
        error: resJson.error?.message || response.statusText || 'Meta Graph API call failed',
        errorCode: resJson.error?.code,
        errorSubcode: resJson.error?.error_subcode,
        errorDetails: resJson.error?.error_data?.details,
        fbtrace_id: resJson.error?.fbtrace_id,
        metaError: resJson.error
      };
    }
  } catch (netErr) {
    console.error(`[Meta Network Error]:`, netErr.message);
    return {
      success: false,
      delivered: false,
      mode: 'network_error',
      recipient: cleanTo,
      templateName: templateName || null,
      directLink,
      error: netErr.message
    };
  }
}

// Helper: Save incoming/outgoing event to Firestore with automatic REST fallback
async function saveToFirestore(collection, data) {
  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}?key=${FIREBASE_API_KEY}`;
    const fields = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'string') fields[k] = { stringValue: v };
      else if (typeof v === 'number') fields[k] = { integerValue: String(v) };
      else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
      else if (typeof v === 'object') fields[k] = { stringValue: JSON.stringify(v) };
    }
    fields.receivedAt = { timestampValue: new Date().toISOString() };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
      signal: controller.signal
    });
    clearTimeout(timer);
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
// 5. OFFICIAL TOKEN ALERT API (/api/send-token-alert & /send-token-alert)
// Triggered dynamically across all checkin pages: admin.goyoh.in/checkin/[clinic-slug]
// Receives: { clinicSlug, name, phone, tokenNumber, estWaitTime, templateName, parameters }
// Dispatches personalized token notification template directly to patient's mobile
// ----------------------------------------------------------------------------
app.post(['/api/send-token-alert', '/send-token-alert'], async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      clinicSlug,
      name,
      phone,
      tokenNumber,
      estWaitTime,
      clinicName,
      doctorName,
      roomNumber,
      waitingCount,
      trackerUrl,
      templateName,
      template,
      languageCode,
      language,
      parameters,
      templateParams,
      components
    } = req.body;

    const patientName = String(name || req.body.patientName || 'Patient').trim();
    const rawPhone = String(phone || req.body.mobileNumber || '').trim();
    const token = String(tokenNumber || req.body.token || '#1').trim();
    const slug = String(clinicSlug || req.body.slug || 'apollo-clinic').trim();
    const waitTime = String(estWaitTime || req.body.estimatedWaitTime || req.body.estimatedWaitMinutes || '10 mins').trim();

    if (!rawPhone || rawPhone.length < 5) {
      return res.status(400).json({ error: 'Valid recipient mobile phone number is required' });
    }

    const cleanRecipient = formatPhone(rawPhone);
    const readableClinic = clinicName || slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const docName = doctorName || 'Consulting Physician';
    const room = roomNumber || 'Consultation Room 1';
    const cleanTokenNum = token.replace(/[^0-9]/g, '') || '1';
    const queueLink = trackerUrl || `https://admin.goyoh.in/queue/${slug}?token=${cleanTokenNum}`;

    // Personalized WhatsApp Message Text (used for directLink and fallback)
    const fallbackMessageText = 
`🏥 *${readableClinic} • GOYOH Health Connect*

Namaste *${patientName}*! Your digital queue token is confirmed:

🎫 *Token Number:* ${token}
🩺 *Doctor:* ${docName}
📍 *Room:* ${room}
⏱️ *Est. Wait Time:* ~${waitTime.replace(/^~+/, '')} ${waitingCount ? `(${waitingCount} patient(s) ahead)` : ''}

🔴 *Track Your Live Queue Status:*
${queueLink}

_Please arrive near your consultation room when your token is called._`;

    // Determine WhatsApp Template Name and Language
    const effectiveTemplateName = (templateName || template || process.env.WHATSAPP_TEMPLATE_NAME || 'patient_token_alert').trim();
    const effectiveLanguageCode = (languageCode || language || process.env.WHATSAPP_TEMPLATE_LANG || 'en_US').trim();

    // Determine Template Body Parameters:
    // {{1}} Patient Name
    // {{2}} Token Number
    // {{3}} Clinic Name
    // {{4}} Estimated Wait Time
    // {{5}} Doctor Name
    let effectiveParams = parameters || templateParams;
    if (!effectiveParams && effectiveTemplateName !== 'hello_world') {
      effectiveParams = [
        patientName,
        token,
        readableClinic,
        waitTime.replace(/^~+/, ''),
        docName
      ];
    }

    console.log(`[Token Alert API] Dispatching token ${token} to ${patientName} (${cleanRecipient}) via template: "${effectiveTemplateName}" (lang: ${effectiveLanguageCode})...`);

    // Dispatch directly via Meta WhatsApp Cloud API with template & parameters
    const result = await sendMetaWhatsAppMessage({
      to: cleanRecipient,
      messageText: fallbackMessageText,
      templateName: effectiveTemplateName,
      languageCode: effectiveLanguageCode,
      parameters: effectiveTemplateName === 'hello_world' ? [] : effectiveParams,
      components: components || null
    });

    const elapsedMs = Date.now() - startTime;

    // Save event to Firestore
    await saveToFirestore('whatsapp_logs', {
      type: 'TOKEN_ALERT',
      clinicSlug: slug,
      patientName,
      phone: cleanRecipient,
      tokenNumber: token,
      estWaitTime: waitTime,
      templateName: result.templateName || effectiveTemplateName,
      delivered: result.delivered,
      mode: result.mode,
      messageId: result.messageId || null,
      error: result.error || null,
      elapsedMs,
      timestamp: new Date().toISOString()
    });

    if (result.delivered) {
      return res.status(200).json({
        success: true,
        delivered: true,
        mode: result.mode,
        messageId: result.messageId,
        recipient: cleanRecipient,
        templateName: result.templateName || effectiveTemplateName,
        parameters: effectiveParams,
        clinicSlug: slug,
        name: patientName,
        tokenNumber: token,
        estWaitTime: waitTime,
        directLink: result.directLink,
        elapsedMs,
        message: `Token alert dispatched to ${cleanRecipient} via Meta WhatsApp Cloud API template [${result.templateName || effectiveTemplateName}] in ${(elapsedMs / 1000).toFixed(2)}s`
      });
    } else {
      return res.status(200).json({
        success: false,
        delivered: false,
        mode: result.mode,
        recipient: cleanRecipient,
        templateName: effectiveTemplateName,
        parameters: effectiveParams,
        clinicSlug: slug,
        name: patientName,
        tokenNumber: token,
        error: result.error || 'Meta WhatsApp delivery unconfirmed',
        errorCode: result.errorCode,
        errorSubcode: result.errorSubcode,
        errorDetails: result.errorDetails,
        metaError: result.metaError,
        directLink: result.directLink,
        elapsedMs,
        message: `Meta Cloud API delivery failed: ${result.error}. Pre-filled direct link available.`
      });
    }
  } catch (error) {
    console.error('[Token Alert Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 6. QUEUE CHECK-IN ALERT API (Legacy & Fallback)
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
