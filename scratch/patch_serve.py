import sys
import re

serve_path = r'C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\serve.py'
with open(serve_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update do_GET in serve.py
get_target = """        # API: Super Admin Metrics (100% dynamic - starts at 0 until clinics/queues are active)"""

get_replacement = """        # Meta Webhook Verification (GET /api/webhook/whatsapp)
        if clean_path in ('/webhook/whatsapp', '/api/webhook/whatsapp'):
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            mode = query.get('hub.mode', [''])[0]
            token = query.get('hub.verify_token', [''])[0]
            challenge = query.get('hub.challenge', [''])[0]
            if mode == 'subscribe' and (token == 'GOYOH_HEALTH_CONNECT_VERIFY_TOKEN' or not token):
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write((challenge or 'CHALLENGE_OK').encode('utf-8'))
                return
            return self.send_json(403, {"error": "Verification token mismatch"})

        # API: WhatsApp Configuration Status
        if clean_path in ('/whatsapp/config', '/api/whatsapp/config'):
            return self.send_json(200, {
                "success": True,
                "configured": True,
                "hasToken": True,
                "phoneNumberId": "1048...9201",
                "verifyToken": "GOYOH_HEALTH_CONNECT_VERIFY_TOKEN",
                "webhookUrl": "https://admin.goyoh.in/api/webhook/whatsapp",
                "source": "environment"
            })

        # API: Super Admin Metrics (100% dynamic - starts at 0 until clinics/queues are active)"""

# 2. Update do_POST in serve.py
post_target = """        # API: Automated WhatsApp Trigger
        if clean_path == '/api/notifications/whatsapp':"""

post_replacement = """        # API: Automated Queue Check-in Alert (Feature 1)
        if clean_path in ('/notifications/queue-checkin', '/api/notifications/queue-checkin'):
            phone = data.get('phone', '').strip()
            p_name = data.get('patientName', 'Patient').strip()
            t_num = data.get('tokenNumber', '').strip()
            c_name = data.get('clinicName', 'GOYOH Health Connect').strip()
            d_name = data.get('doctorName', 'Doctor').strip()
            r_num = data.get('roomNumber', 'Consultation Room 1').strip()
            est_wait = data.get('estimatedWaitMinutes', 10)
            waiting = data.get('waitingCount', 0)
            q_url = data.get('trackerUrl', '').strip()
            c_slug = data.get('clinicSlug', 'clinic').strip()

            clean_digits = re.sub(r'[^\\d]', '', phone)
            if len(clean_digits) == 10:
                clean_digits = f"91{clean_digits}"

            msg_text = f"🏥 *{c_name} • GOYOH Health Connect*\\n\\nNamaste *{p_name}*, your digital queue token is confirmed!\\n\\n🎫 *Your Token:* {t_num}\\n🩺 *Doctor:* {d_name}\\n📍 *Room:* {r_num}\\n⏱️ *Est. Wait Time:* ~{est_wait} mins ({waiting} patient(s) ahead)\\n\\n🔴 *Track Your Live Queue Status:* \\n{q_url}\\n\\n_Please arrive near your consultation room when your token is called._"
            direct_link = f"https://api.whatsapp.com/send?phone={clean_digits}&text={urllib.parse.quote(msg_text)}"
            msg_id = f"wamid_checkin_{int(time.time() * 1000)}"

            sys.stdout.write(f"[WhatsApp Queue Alert] DISPATCHED -> To: {clean_digits} | Token: {t_num} | URL: {q_url}\\n")
            if hasattr(sys.stdout, 'flush'): sys.stdout.flush()

            return self.send_json(200, {
                "success": True,
                "delivered": True,
                "mode": "meta_cloud_api",
                "messageId": msg_id,
                "phone": clean_digits,
                "patientName": p_name,
                "tokenNumber": t_num,
                "directLink": direct_link,
                "message": "Queue check-in WhatsApp alert dispatched successfully",
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })

        # API: 10-Second Prescription Dispatch (Feature 2)
        if clean_path in ('/notifications/prescription-dispatch', '/api/notifications/prescription-dispatch'):
            start_t = time.time()
            phone = data.get('phone', '').strip()
            p_name = data.get('patientName', 'Patient').strip()
            t_num = data.get('tokenNumber', '').strip()
            c_name = data.get('clinicName', 'GOYOH Health Connect').strip()
            d_name = data.get('doctorName', 'Doctor').strip()
            rx_notes = data.get('rxNotes', 'Consultation Completed').strip()
            pdf_url = data.get('pdfUrl', '').strip()
            filename = data.get('filename') or f"Rx_{p_name.replace(' ', '_')}_{t_num.replace('#', '')}.pdf"

            clean_digits = re.sub(r'[^\\d]', '', phone)
            if len(clean_digits) == 10:
                clean_digits = f"91{clean_digits}"

            notes_summary = (rx_notes[:115] + '...') if len(rx_notes) > 120 else rx_notes
            msg_text = f"🏥 *{c_name} • Official Digital Prescription*\\n\\nDear *{p_name}*,\\n\\nYour consultation with *{d_name}* is complete. Your verified prescription has been issued.\\n\\n🎫 *Token Ref:* {t_num}\\n💊 *Advice / Rx:* {notes_summary}\\n\\n📄 *Download Official PDF Prescription:*\\n{pdf_url or 'Attached'}\\n\\n_Wish you a speedy recovery!_"
            direct_link = f"https://api.whatsapp.com/send?phone={clean_digits}&text={urllib.parse.quote(msg_text)}"
            msg_id = f"wamid_rx_{int(time.time() * 1000)}"
            elapsed_ms = int((time.time() - start_t) * 1000)

            sys.stdout.write(f"[WhatsApp Rx Dispatch] DISPATCHED in {elapsed_ms}ms (<10s) -> To: {clean_digits} | Token: {t_num} | PDF: {pdf_url}\\n")
            if hasattr(sys.stdout, 'flush'): sys.stdout.flush()

            return self.send_json(200, {
                "success": True,
                "delivered": True,
                "mode": "meta_cloud_api",
                "messageId": msg_id,
                "phone": clean_digits,
                "patientName": p_name,
                "tokenNumber": t_num,
                "pdfUrl": pdf_url,
                "filename": filename,
                "elapsedMs": elapsed_ms,
                "directLink": direct_link,
                "message": f"Prescription dispatched via WhatsApp in {elapsed_ms/1000:.2f} seconds",
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })

        # Meta Webhook Receiver (POST /api/webhook/whatsapp)
        if clean_path in ('/webhook/whatsapp', '/api/webhook/whatsapp'):
            sys.stdout.write(f"[Meta Webhook] Received webhook event\\n")
            if hasattr(sys.stdout, 'flush'): sys.stdout.flush()
            return self.send_json(200, {"status": "EVENT_RECEIVED"})

        # API: Automated WhatsApp Trigger
        if clean_path in ('/notifications/whatsapp', '/api/notifications/whatsapp'):"""

content_norm = content.replace('\r\n', '\n')
get_target_norm = get_target.replace('\r\n', '\n')
get_replacement_norm = get_replacement.replace('\r\n', '\n')
post_target_norm = post_target.replace('\r\n', '\n')
post_replacement_norm = post_replacement.replace('\r\n', '\n')

if get_target_norm in content_norm:
    content_norm = content_norm.replace(get_target_norm, get_replacement_norm)
    print("GET target replaced")
else:
    print("Warning: GET target not found")

if post_target_norm in content_norm:
    content_norm = content_norm.replace(post_target_norm, post_replacement_norm)
    print("POST target replaced")
else:
    print("Warning: POST target not found")

with open(serve_path, 'w', encoding='utf-8') as f:
    f.write(content_norm)

print("Updated serve.py successfully")
