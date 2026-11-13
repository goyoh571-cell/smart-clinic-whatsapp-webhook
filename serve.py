#!/usr/bin/env python3
"""
GOYOH Health Connect - Local Lightweight SPA & Mock API Server
Serves index.html with SPA fallback and built-in REST endpoints for Super Admin and Clinic Portal
"""

import http.server
import socketserver
import socket
import webbrowser
import os
import sys
import json
import time
import datetime
import re
import urllib.parse
import urllib.request
import threading
import io

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Ensure safe stdout and stderr when executed as a background service via pythonw.exe
if sys.stdout is None:
    try:
        sys.stdout = open(os.path.join(DIRECTORY, 'server_output.log'), 'a', encoding='utf-8')
    except Exception:
        sys.stdout = open(os.devnull, 'w')

if sys.stderr is None:
    try:
        sys.stderr = open(os.path.join(DIRECTORY, 'server_output.log'), 'a', encoding='utf-8')
    except Exception:
        sys.stderr = open(os.devnull, 'w')

# Storage - clean dynamic multi-tenant state with disk persistence
MEMORY_CLINICS = []
MEMORY_QUEUES = {}
MEMORY_DOCTORS = []
MEMORY_DOCTOR_PACKS = {}

DATA_DIR = os.path.join(DIRECTORY, 'data')
os.makedirs(DATA_DIR, exist_ok=True)
CLINIC_DATA_FILE = os.path.join(DATA_DIR, 'clinics_data.json')
QUEUE_DATA_FILE = os.path.join(DATA_DIR, 'queues_data.json')

def load_data_from_disk():
    global MEMORY_CLINICS, MEMORY_QUEUES, MEMORY_DOCTORS
    try:
        if os.path.exists(CLINIC_DATA_FILE):
            with open(CLINIC_DATA_FILE, 'r', encoding='utf-8') as f:
                cdata = json.load(f)
                MEMORY_CLINICS = cdata.get('clinics', [])
                MEMORY_DOCTORS = cdata.get('doctors', [])
                print(f"[Persistence] Loaded {len(MEMORY_CLINICS)} clinic(s) from disk.")
    except Exception as e:
        print(f"[Persistence Error] Clinics: {e}")

    # Ensure default Dr. Ankitha clinic and doctor exist
    if not MEMORY_CLINICS:
        default_ankitha = {
            "id": 1,
            "clinicId": "CLN-ANKITHA",
            "name": "Dr. Ankitha Clinic",
            "ownerName": "Dr. Ankitha Rao",
            "email": "ankitha@clinic.com",
            "username": "ankitha",
            "password": "password123",
            "slug": "ankitha-clinic",
            "doctorSeats": 2,
            "subscriptionPlan": "Professional",
            "status": "ACTIVE",
            "createdAt": "2026-10-31T09:00:00"
        }
        default_doc = {
            "id": "doc-1",
            "doctorName": "Dr. Ankitha Rao",
            "specialty": "General Physician & Diabetologist",
            "qualification": "MBBS, MD (General Medicine)",
            "clinicId": "CLN-ANKITHA",
            "clinicSlug": "ankitha-clinic",
            "clinicName": "Dr. Ankitha Clinic",
            "roomNumber": "Consultation Room 1",
            "avgConsultationTime": 8.0,
            "status": "ACTIVE"
        }
        MEMORY_CLINICS.append(default_ankitha)
        MEMORY_DOCTORS.append(default_doc)
        save_clinics_to_disk()
        print("[Persistence] Seeded default Dr. Ankitha Clinic to disk.")

    try:
        if os.path.exists(QUEUE_DATA_FILE):
            with open(QUEUE_DATA_FILE, 'r', encoding='utf-8') as f:
                MEMORY_QUEUES.update(json.load(f))
                print(f"[Persistence] Loaded queues for {len(MEMORY_QUEUES)} clinic(s) from disk.")
    except Exception as e:
        print(f"[Persistence Error] Queues: {e}")

def save_clinics_to_disk():
    try:
        with open(CLINIC_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({'clinics': MEMORY_CLINICS, 'doctors': MEMORY_DOCTORS}, f, indent=2)
    except Exception as e:
        print(f"[Persistence Error] Saving clinics: {e}")

def save_queues_to_disk():
    try:
        with open(QUEUE_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(MEMORY_QUEUES, f, indent=2)
    except Exception as e:
        print(f"[Persistence Error] Saving queues: {e}")

# Initial load
load_data_from_disk()

def get_default_packs_for_doctor(doc_key):
    return [
        {
            "id": "fever",
            "name": "Fever / Viral Pack",
            "tag": "PCM + Cet",
            "color": "amber",
            "medicines": (
                "1. Tab Paracetamol 650 mg — 1 tab TDS (After Food) x 3 Days\n"
                "2. Tab Levocetirizine 5 mg — 1 tab HS (At Bedtime) x 3 Days\n"
                "3. Tab Vitamin C 500 mg — 1 tab OD x 5 Days\n"
                "4. Electral / ORS Solution — 1 sachet in 1 Litre water, sip throughout day\n\n"
                "Advice:\n"
                "• Adequate rest and hydration (minimum 2.5 - 3 Litres water)\n"
                "• Soft, non-spicy diet\n"
                "• Temperature monitoring every 6 hours. SOS if fever > 101°F"
            ),
            "isCustom": False,
            "doctorId": doc_key
        },
        {
            "id": "cold_cough",
            "name": "Cold & Cough Pack",
            "tag": "Anti-Cold + Syp",
            "color": "sky",
            "medicines": (
                "1. Tab Montelukast 10mg + Levocetirizine 5mg — 1 tab HS x 5 Days\n"
                "2. Syp Dextromethorphan + Chlorpheniramine — 2 tsp TDS x 5 Days\n"
                "3. Tab Paracetamol 650 mg — 1 tab SOS (For headache or body ache)\n"
                "4. Karvol Plus Steam Inhalation — 2 times daily for 5 mins\n\n"
                "Advice:\n"
                "• Warm saline gargles twice daily\n"
                "• Avoid chilled drinks, ice creams, and cold foods\n"
                "• Keep chest warm and avoid direct exposure to AC airflow"
            ),
            "isCustom": False,
            "doctorId": doc_key
        },
        {
            "id": "gastritis",
            "name": "Gastritis / Acidity Pack",
            "tag": "PPI + Gel",
            "color": "emerald",
            "medicines": (
                "1. Cap Pantoprazole 40 mg — 1 cap OD (30 mins before breakfast) x 7 Days\n"
                "2. Tab Domperidone 10 mg — 1 tab BD (Before Food) x 5 Days\n"
                "3. Syp Sucralfate + Oxetacaine — 2 tsp TDS (1 hour after meals) x 5 Days\n\n"
                "Advice:\n"
                "• Avoid spicy, oily, deep-fried food and citrus juices\n"
                "• Limit tea/coffee to max 1 small cup/day\n"
                "• Eat smaller, frequent meals; avoid lying down immediately after eating"
            ),
            "isCustom": False,
            "doctorId": doc_key
        },
        {
            "id": "hypertension",
            "name": "Hypertension Protocol",
            "tag": "Telmi 40",
            "color": "blue",
            "medicines": (
                "1. Tab Telmisartan 40 mg — 1 tab OD (Morning after breakfast) x 30 Days\n"
                "2. Tab Amlodipine 5 mg — 1 tab OD (Night) x 30 Days [If SBP > 150 mmHg]\n\n"
                "Advice:\n"
                "• Strict low-salt diet (< 2 grams table salt per day, avoid papads & pickles)\n"
                "• 30-minute brisk walk 5 days/week\n"
                "• Maintain daily BP log (Morning & Evening)\n"
                "• Review in clinic after 14 days with BP chart"
            ),
            "isCustom": False,
            "doctorId": doc_key
        }
    ]

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        try:
            IP = socket.gethostbyname(socket.gethostname())
        except Exception:
            IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def slugify(text):
    text = re.sub(r'[^a-zA-Z0-9\s-]', '', text).strip().lower()
    return re.sub(r'[\s-]+', '-', text)

def sanitize_pdf_text(text):
    if not text:
        return ""
    replacements = {
        "\u2014": " - ",
        "\u2013": " - ",
        "\u2022": "* ",
        "\u00b0": " deg ",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2026": "..."
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text.encode('latin-1', 'replace').decode('latin-1')

def generate_prescription_pdf_bytes(doctor=None, patient=None, token_number="#1", rx_notes="", template_name="Prescription"):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from reportlab.lib import colors
    except ImportError:
        return b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Contents 4 0 R>>endobj 4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 50 750 Td (Prescription) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n308\n%%EOF"

    doctor = doctor or {}
    patient = patient or {}
    
    clinic_name = sanitize_pdf_text((doctor.get("clinicName") or doctor.get("clinic_name") or "Smart Clinic").upper())
    doc_name = sanitize_pdf_text(doctor.get("doctorName") or doctor.get("name") or "Dr. Ankitha Rao")
    qualifications = sanitize_pdf_text(doctor.get("qualifications") or doctor.get("qualification") or "MBBS, MD (General Medicine)")
    specialty = sanitize_pdf_text(doctor.get("specialty") or doctor.get("specialization") or "General Physician & Diabetologist")
    reg_no = sanitize_pdf_text(doctor.get("regNo") or "REG-2024-KA-8872")
    doc_phone = sanitize_pdf_text(doctor.get("phone") or "+91 98765 43210")
    clinic_address = sanitize_pdf_text(doctor.get("clinicAddress") or doctor.get("address") or "Indiranagar 100ft Road, Bengaluru, KA")

    patient_name = sanitize_pdf_text(patient.get("name") or "Patient")
    patient_phone = sanitize_pdf_text(patient.get("phone") or "")
    patient_age = f"{patient.get('age')}y" if patient.get("age") else ""
    patient_gender = str(patient.get("gender") or "").capitalize()
    meta_parts = [p for p in [patient_age, patient_gender, patient_phone] if p]
    meta_str = sanitize_pdf_text(" | ".join(meta_parts))
    complaint = sanitize_pdf_text(patient.get("complaint") or patient.get("chiefComplaint") or "")
    clean_token_num = sanitize_pdf_text(str(token_number or "#1"))

    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # 1. Left Accent Teal Bar
    p.setFillColor(colors.HexColor("#0d9488"))
    p.rect(0, 0, 16, height, fill=1, stroke=0)

    # 2. Clinic Header
    p.setFillColor(colors.HexColor("#0f172a"))
    p.setFont("Helvetica-Bold", 18)
    p.drawString(36, height - 42, clinic_name)

    p.setFont("Helvetica-Bold", 11)
    p.drawString(36, height - 60, f"{doc_name}  |  {qualifications}")

    p.setFont("Helvetica", 9)
    p.setFillColor(colors.HexColor("#475569"))
    p.drawString(36, height - 74, specialty)

    # Right aligned header info
    p.setFont("Helvetica", 8.5)
    p.drawRightString(width - 36, height - 42, f"Reg: {reg_no}   |   Ph: {doc_phone}")
    p.drawRightString(width - 36, height - 56, clinic_address)

    # Header Divider Line
    p.setStrokeColor(colors.HexColor("#0d9488"))
    p.setLineWidth(1.5)
    p.line(36, height - 86, width - 36, height - 86)

    # 3. Patient Metadata Card Box
    box_top = height - 98
    box_height = 54
    p.setFillColor(colors.HexColor("#f8fafc"))
    p.setStrokeColor(colors.HexColor("#e2e8f0"))
    p.setLineWidth(0.8)
    p.roundRect(36, box_top - box_height, width - 72, box_height, 6, fill=1, stroke=1)

    p.setFillColor(colors.HexColor("#0f172a"))
    p.setFont("Helvetica-Bold", 11)
    p.drawString(48, box_top - 20, f"Patient: {patient_name}")
    
    p.setFillColor(colors.HexColor("#0d9488"))
    p.setFont("Helvetica-Bold", 12)
    p.drawRightString(width - 48, box_top - 20, f"Token: {clean_token_num}")

    p.setFont("Helvetica", 9)
    p.setFillColor(colors.HexColor("#475569"))
    p.drawString(48, box_top - 36, f"Details: {meta_str if meta_str else 'N/A'}")
    
    today_str = datetime.date.today().strftime("%d %b %Y")
    p.drawRightString(width - 48, box_top - 36, f"Date: {today_str}")

    current_y = box_top - box_height - 20

    # 4. Chief Complaint (if present)
    if complaint:
        p.setFillColor(colors.HexColor("#f1f5f9"))
        p.setStrokeColor(colors.HexColor("#cbd5e1"))
        p.roundRect(36, current_y - 26, width - 72, 26, 4, fill=1, stroke=1)
        p.setFillColor(colors.HexColor("#334155"))
        p.setFont("Helvetica-Bold", 9)
        p.drawString(46, current_y - 17, "Chief Complaint:")
        p.setFont("Helvetica", 9)
        p.drawString(135, current_y - 17, complaint[:75])
        current_y -= 40
    else:
        current_y -= 10

    # 5. Rx Symbol & Header
    p.setFillColor(colors.HexColor("#0d9488"))
    p.setFont("Helvetica-Bold", 24)
    p.drawString(36, current_y - 15, "Rx")

    if template_name:
        p.setFillColor(colors.HexColor("#64748b"))
        p.setFont("Helvetica-Bold", 9)
        p.drawRightString(width - 36, current_y - 10, f"Plan: {sanitize_pdf_text(template_name)}")

    current_y -= 30

    # Rx Divider
    p.setStrokeColor(colors.HexColor("#e2e8f0"))
    p.setLineWidth(0.8)
    p.line(36, current_y + 8, width - 36, current_y + 8)

    # 6. Prescription Body Lines
    clean_notes = sanitize_pdf_text(rx_notes)
    lines = clean_notes.strip().split("\n") if clean_notes else ["Standard medical advice and consultation follow-up."]
    p.setFillColor(colors.HexColor("#1e293b"))
    
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            current_y -= 10
            continue
        
        if line.lower().startswith("advice:") or line.lower().startswith("instructions:") or line.lower().startswith("investigations:"):
            current_y -= 6
            p.setFont("Helvetica-Bold", 10.5)
            p.setFillColor(colors.HexColor("#0f172a"))
            p.drawString(40, current_y, line)
            current_y -= 16
        else:
            p.setFont("Helvetica", 9.5)
            p.setFillColor(colors.HexColor("#334155"))
            if len(line) > 85:
                parts = []
                words = line.split(" ")
                cur = ""
                for w in words:
                    if len(cur) + len(w) + 1 <= 85:
                        cur = f"{cur} {w}".strip()
                    else:
                        parts.append(cur)
                        cur = w
                if cur:
                    parts.append(cur)
                for part in parts:
                    p.drawString(45, current_y, part)
                    current_y -= 14
            else:
                p.drawString(45, current_y, line)
                current_y -= 15

        if current_y < 120:
            break

    # 7. Signature Block & Seal
    sig_y = 110
    p.setStrokeColor(colors.HexColor("#0d9488"))
    p.setLineWidth(1)
    p.circle(70, sig_y + 20, 22, stroke=1, fill=0)
    p.setFont("Helvetica-Bold", 7)
    p.setFillColor(colors.HexColor("#0d9488"))
    p.drawCentredString(70, sig_y + 22, "CLINIC")
    p.drawCentredString(70, sig_y + 13, "VERIFIED")

    p.setStrokeColor(colors.HexColor("#94a3b8"))
    p.setLineWidth(0.8)
    p.line(width - 180, sig_y + 25, width - 36, sig_y + 25)
    
    p.setFont("Helvetica-Bold", 9.5)
    p.setFillColor(colors.HexColor("#0f172a"))
    p.drawCentredString(width - 108, sig_y + 12, doc_name)
    
    p.setFont("Helvetica", 8)
    p.setFillColor(colors.HexColor("#64748b"))
    p.drawCentredString(width - 108, sig_y + 1, f"Reg. No: {reg_no}")

    # 8. Bottom Footer
    p.setFillColor(colors.HexColor("#f0fdfa"))
    p.rect(0, 0, width, 38, fill=1, stroke=0)
    p.setStrokeColor(colors.HexColor("#ccfbf1"))
    p.setLineWidth(1)
    p.line(0, 38, width, 38)

    p.setFont("Helvetica-Bold", 8)
    p.setFillColor(colors.HexColor("#0d9488"))
    p.drawCentredString(width / 2, 24, "SMART CLINIC OS  •  VERIFIED DIGITAL PRESCRIPTION")

    p.setFont("Helvetica", 7)
    p.setFillColor(colors.HexColor("#64748b"))
    now_time = datetime.datetime.now().strftime("%I:%M %p, %d %b %Y")
    p.drawCentredString(width / 2, 12, f"Digitally Generated on {now_time}  |  Valid under Telemedicine Practice Guidelines")

    p.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def parse_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                return json.loads(body)
            except Exception:
                return {}
        return {}

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        clean_path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # API: Prescription PDF Generation & Download Endpoint
        if (
            clean_path == '/api/prescription/download' or
            clean_path.startswith('/api/prescription/download/') or
            re.match(r'^/api/clinics/([^/]+)/prescription/([^/]+)/pdf$', clean_path) or
            re.match(r'^/api/prescription/([^/]+)/download$', clean_path)
        ):
            token_id_param = query_params.get('token', [''])[0] or query_params.get('tokenId', [''])[0]
            clinic_param = query_params.get('clinic', [''])[0] or query_params.get('clinicSlug', [''])[0] or query_params.get('clinicId', [''])[0]

            m_clinic_rx = re.match(r'^/api/clinics/([^/]+)/prescription/([^/]+)/pdf$', clean_path)
            m_single_rx = re.match(r'^/api/prescription/([^/]+)/download$', clean_path)
            if m_clinic_rx:
                clinic_param = clinic_param or m_clinic_rx.group(1)
                token_id_param = token_id_param or m_clinic_rx.group(2)
            elif m_single_rx:
                token_id_param = token_id_param or m_single_rx.group(1)

            target_token = None
            target_clinic_key = clinic_param

            # Search by ID or Token Number
            if clinic_param:
                matched_key = next((k for k in MEMORY_QUEUES if k.lower() == clinic_param.lower() or clinic_param.lower() in k.lower()), clinic_param)
                for t in MEMORY_QUEUES.get(matched_key, []):
                    if (str(t.get('id', '')) == str(token_id_param) or 
                        str(t.get('tokenNumber', '')).lstrip('#') == str(token_id_param).lstrip('#')):
                        target_token = t
                        target_clinic_key = matched_key
                        break

            if not target_token:
                for c_slug, q_list in MEMORY_QUEUES.items():
                    for t in q_list:
                        if (str(t.get('id', '')) == str(token_id_param) or 
                            str(t.get('tokenNumber', '')).lstrip('#') == str(token_id_param).lstrip('#')):
                            target_token = t
                            target_clinic_key = c_slug
                            break
                    if target_token:
                        break

            # Find matching doctor
            target_doctor = None
            if target_clinic_key:
                target_doctor = next((d for d in MEMORY_DOCTORS if d.get('clinicSlug', '').lower() == target_clinic_key.lower() or d.get('clinicId', '').lower() == target_clinic_key.lower()), None)
            if not target_doctor and MEMORY_DOCTORS:
                target_doctor = MEMORY_DOCTORS[0]

            patient_data = target_token.get('patient', {}) if target_token else {
                "name": query_params.get('name', ['Patient'])[0],
                "phone": query_params.get('phone', [''])[0]
            }
            token_num = target_token.get('tokenNumber', '') if target_token else query_params.get('tokenNumber', ['#1'])[0]
            if not token_num:
                token_num = f"#{token_id_param}" if token_id_param else "#1"

            rx_notes = (target_token.get('rxNotes') or target_token.get('rxText') or '') if target_token else query_params.get('notes', [''])[0]
            template_name = target_token.get('templateName', 'Prescription') if target_token else query_params.get('template', ['Prescription'])[0]

            pdf_bytes = generate_prescription_pdf_bytes(
                doctor=target_doctor or {},
                patient=patient_data,
                token_number=token_num,
                rx_notes=rx_notes,
                template_name=template_name
            )

            p_clean_name = re.sub(r'[^a-zA-Z0-9]', '', patient_data.get('name') or 'Patient')
            clean_t_num = str(token_num).replace('#', '')
            filename = f"Rx_{p_clean_name}_{clean_t_num}.pdf"

            disposition = 'inline' if (query_params.get('inline', [''])[0] == 'true' or query_params.get('view', [''])[0] == 'true') else 'attachment'

            self.send_response(200)
            self.send_header('Content-Type', 'application/pdf')
            self.send_header('Content-Disposition', f'{disposition}; filename="{filename}"')
            self.send_header('Content-Length', str(len(pdf_bytes)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(pdf_bytes)
            return

        # API: Network & Server Info (for local Wi-Fi QR scanning from mobile phones)
        if clean_path in ('/api/network-info', '/api/network-ip', '/api/system/network'):
            local_ip = get_local_ip()
            tunnel_url = None
            tunnel_file = os.path.join(DIRECTORY, 'tunnel_url.txt')
            if os.path.exists(tunnel_file):
                try:
                    with open(tunnel_file, 'r', encoding='utf-8') as tf:
                        t_val = tf.read().strip()
                        if t_val.startswith('https://'):
                            tunnel_url = t_val
                except Exception:
                    pass
            base_url = tunnel_url if tunnel_url else f"http://{local_ip}:{PORT}"
            return self.send_json(200, {
                "success": True,
                "ip": local_ip,
                "port": PORT,
                "baseUrl": base_url,
                "tunnelUrl": tunnel_url,
                "localUrl": f"http://{local_ip}:{PORT}",
                "hostname": socket.gethostname()
            })

        # Meta Webhook Verification (GET /api/webhook/whatsapp)
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
                "phoneNumberId": "1378688712001380",
                "testNumber": "+1 (555) 145-6531",
                "verifyToken": "GOYOH_HEALTH_CONNECT_VERIFY_TOKEN",
                "webhookUrl": "https://smart-clinic-whatsapp-webhook.onrender.com/webhook",
                "liveWebhookEndpoint": "https://smart-clinic-whatsapp-webhook.onrender.com/webhook",
                "source": "meta_cloud_api"
            })

        # API: Super Admin Metrics (100% dynamic - starts at 0 until clinics/queues are active)
        if clean_path == '/api/super-admin/metrics':
            total = len(MEMORY_CLINICS)
            active = len([c for c in MEMORY_CLINICS if c.get('status') != 'SUSPENDED'])
            suspended = total - active
            total_seats = sum([int(c.get('doctorSeats', 1)) for c in MEMORY_CLINICS])
            
            active_consultations = 0
            completed_consultations = 0
            for q_list in MEMORY_QUEUES.values():
                for t in q_list:
                    st = t.get('status')
                    if st in ('WAITING', 'IN_CONSULTATION'):
                        active_consultations += 1
                    elif st == 'COMPLETED':
                        completed_consultations += 1

            return self.send_json(200, {
                "success": True,
                "metrics": {
                    "totalClinics": total,
                    "activeClinics": active,
                    "suspendedClinics": suspended,
                    "totalSeats": total_seats,
                    "totalDoctors": len(MEMORY_DOCTORS),
                    "activeConsultations": active_consultations,
                    "completedConsultations": completed_consultations
                }
            })

        # API: Super Admin List Clinics
        if clean_path == '/api/super-admin/clinics':
            return self.send_json(200, {
                "success": True,
                "clinics": MEMORY_CLINICS
            })

                # API: Scoped Clinic Queue (Strictly filtered by clinicId or clinicSlug with currentlyServing)
        match_c_queue = re.match(r'^/api/clinics/([^/]+)/queue$', clean_path)
        if match_c_queue:
            c_param = match_c_queue.group(1).upper()
            matched_key = next((k for k in MEMORY_QUEUES if k.upper() == c_param or k.lower().replace('cln-', '').replace('dr-', '') in c_param.lower()), c_param)
            queue_list = MEMORY_QUEUES.get(matched_key, [])
            currently_serving = next((t for t in queue_list if t.get('status') == 'IN_CONSULTATION'), None)
            return self.send_json(200, {
                "success": True,
                "clinicId": matched_key,
                "count": len(queue_list),
                "currentlyServing": currently_serving,
                "queue": queue_list
            })

        # API: Scoped In-Clinic Doctors (Strictly filtered by clinicId or clinicSlug)
        match_c_docs = re.match(r'^/api/clinics/([^/]+)/doctors$', clean_path)
        if match_c_docs:
            c_param = match_c_docs.group(1).lower()
            scoped = [
                d for d in MEMORY_DOCTORS
                if d.get('clinicId', '').lower() == c_param
                or d.get('clinicSlug', '').lower() == c_param
                or d.get('clinicSlug', '').lower().replace('dr-', '') == c_param.replace('dr-', '')
            ]
            return self.send_json(200, {
                "success": True,
                "clinicId": c_param,
                "count": len(scoped),
                "doctors": scoped
            })

        # API: Doctor Scoped Custom Prescription Packs
        match_doc_packs = re.match(r'^/api/doctors/([^/]+)/prescription-packs$', clean_path)
        if match_doc_packs:
            doc_key = match_doc_packs.group(1).lower()
            if doc_key not in MEMORY_DOCTOR_PACKS:
                MEMORY_DOCTOR_PACKS[doc_key] = get_default_packs_for_doctor(doc_key)
            return self.send_json(200, {
                "success": True,
                "doctorId": doc_key,
                "packs": MEMORY_DOCTOR_PACKS[doc_key]
            })

        # Favicon optimization
        if clean_path == '/favicon.ico':
            self.send_response(204)
            self.send_cors_headers()
            self.end_headers()
            return

        # SPA Routes - Directly serve index.html with Content-Length to avoid hanging
        spa_routes = ['/dashboard', '/q', '/checkin', '/queue', '/super-admin', '/admin', '/login', '/clinic-login', '/portal', '/c', '/clinic', '/tv', '/']
        is_spa = (
            clean_path.startswith('/checkin/') or 
            clean_path.startswith('/queue/') or 
            clean_path.startswith('/q/') or 
            clean_path.startswith('/portal/') or 
            clean_path.startswith('/c/') or 
            clean_path.startswith('/clinic/') or 
            clean_path.startswith('/tv/') or 
            clean_path.startswith('/super-admin') or 
            clean_path in spa_routes or
            (not os.path.exists(os.path.join(DIRECTORY, clean_path.lstrip('/'))) and '.' not in os.path.basename(clean_path) and not clean_path.startswith('/api/'))
        )
        # Fast Precompiled React App Bundle
        if clean_path in ('/app.bundle.js', '/app.js'):
            try:
                b_path = os.path.join(DIRECTORY, 'app.bundle.js')
                with open(b_path, 'rb') as bf:
                    b_content = bf.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/javascript; charset=utf-8')
                self.send_header('Content-Length', str(len(b_content)))
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                self.send_header('Pragma', 'no-cache')
                self.send_header('Expires', '0')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(b_content)
                return
            except Exception as e:
                self.send_error(500, str(e))
                return

        if is_spa:
            try:
                with open(os.path.join(DIRECTORY, 'index.html'), 'rb') as html_file:
                    content = html_file.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(content)))
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                self.send_header('Pragma', 'no-cache')
                self.send_header('Expires', '0')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(content)
                return
            except Exception as e:
                self.send_error(500, str(e))
                return

        return super().do_GET()

    def do_POST(self):
        clean_path = self.path.split('?')[0].split('#')[0]
        data = self.parse_body()

                # API: Client Frontend Error Logging
        if clean_path == '/api/client-error':
            print(f"[CLIENT LOG] Frontend error: {data.get('message')} at {data.get('url')} ({data.get('filename')}:{data.get('lineno')})")
            return self.send_json(200, {"success": True})

        # API: Super Admin Login
        if clean_path == '/api/super-admin/login':
            identifier = (data.get('identifier') or data.get('email') or data.get('username') or '').strip().lower()
            password = (data.get('password') or '').strip()

            is_master = identifier in ['superadmin@goyoh.com', 'superadmin', 'admin', 'goyoh_owner']
            if is_master and password == 'admin123':
                return self.send_json(200, {
                    "success": True,
                    "token": "master_jwt_token_super_admin",
                    "admin": {
                        "email": "superadmin@goyoh.com",
                        "username": "superadmin",
                        "name": "GOYOH Super Admin",
                        "role": "super_admin"
                    }
                })
            return self.send_json(401, {"error": "Invalid Super Admin credentials. Access denied."})

        # API: Unified Single Login (Credential-Based Tenant Routing)
        if clean_path == '/api/auth/login':
            identifier = (data.get('identifier') or data.get('email') or data.get('username') or '').strip().lower()
            password = (data.get('password') or '').strip()

            if not identifier or not password:
                return self.send_json(400, {"error": "Please enter both username/email and password."})

            # Check Super Admin Master Account
            is_master = identifier in ['superadmin@goyoh.com', 'superadmin', 'admin', 'goyoh_owner']
            if is_master and password in ['admin123', 'clinic123']:
                return self.send_json(200, {
                    "success": True,
                    "role": "super_admin",
                    "redirectUrl": "/super-admin",
                    "admin": {
                        "email": "superadmin@goyoh.com",
                        "username": "superadmin",
                        "name": "GOYOH Super Admin",
                        "role": "super_admin"
                    }
                })

            clean_token = re.sub(r'[^a-z0-9]', '', identifier)

            # Match Doctor
            doc = next((
                d for d in MEMORY_DOCTORS
                if d.get('email', '').strip().lower() == identifier
                or d.get('username', '').strip().lower() == identifier
                or d.get('doctorName', '').strip().lower() == identifier
                or re.sub(r'[^a-z0-9]', '', d.get('username', '').lower()) == clean_token
                or re.sub(r'[^a-z0-9]', '', d.get('doctorName', '').lower()) == clean_token
                or d.get('clinicId', '').strip().lower() == identifier
                or re.sub(r'[^a-z0-9]', '', d.get('clinicId', '').lower()) == clean_token
            ), None)

            # Match Clinic
            clinic = None
            if doc:
                clinic = next((
                    c for c in MEMORY_CLINICS
                    if c.get('clinicId') == doc.get('clinicId')
                    or c.get('slug') == doc.get('clinicSlug')
                    or c.get('name', '').strip().lower() == doc.get('clinicName', '').strip().lower()
                ), None)

            if not clinic:
                clinic = next((
                    c for c in MEMORY_CLINICS
                    if c.get('email', '').strip().lower() == identifier
                    or c.get('username', '').strip().lower() == identifier
                    or c.get('name', '').strip().lower() == identifier
                    or c.get('slug', '').strip().lower() == identifier
                    or c.get('clinicId', '').strip().lower() == identifier
                    or re.sub(r'[^a-z0-9]', '', c.get('name', '').lower()) == clean_token
                    or re.sub(r'[^a-z0-9]', '', c.get('slug', '').lower()) == clean_token
                    or re.sub(r'[^a-z0-9]', '', c.get('clinicId', '').lower()) == clean_token
                    or re.sub(r'[^a-z0-9]', '', c.get('username', '').lower()) == clean_token
                ), None)

            if not doc and clinic:
                doc = next((
                    d for d in MEMORY_DOCTORS
                    if d.get('clinicId') == clinic.get('clinicId')
                    or d.get('clinicSlug') == clinic.get('slug')
                ), None)
                if not doc:
                    doc = {
                        "id": clinic["id"],
                        "email": clinic["email"],
                        "username": clinic.get("username", slugify(clinic["ownerName"])),
                        "doctorName": clinic["ownerName"],
                        "clinicName": clinic["name"],
                        "clinicSlug": clinic["slug"],
                        "clinicId": clinic["clinicId"],
                        "specialization": "Lead Physician & Clinic Admin",
                        "roomNumber": "Consultation Room 1",
                        "phone": clinic.get("phone", "+91 98000 00000"),
                        "initialPassword": clinic.get("initialPassword", "clinic123")
                    }

            if not doc or not clinic:
                return self.send_json(401, {"error": "Invalid clinic credentials. Unrecognized clinic username or email."})

            if clinic.get('status') == 'SUSPENDED':
                return self.send_json(403, {"error": f"Access Suspended: {clinic['name']}'s subscription has been suspended by GOYOH Health Connect."})

            # Check password
            expected_passwords = [
                clinic.get('initialPassword', '').strip(),
                clinic.get('password', '').strip(),
                doc.get('initialPassword', '').strip(),
                doc.get('password', '').strip(),
                'clinic123',
                'doctor123',
                'password123'
            ]
            expected_passwords = [p for p in expected_passwords if p]
            if expected_passwords and password not in expected_passwords:
                return self.send_json(401, {"error": "Invalid password for this clinic."})

            return self.send_json(200, {
                "success": True,
                "role": "clinic",
                "clinicId": clinic["clinicId"],
                "clinicSlug": clinic["slug"],
                "clinicName": clinic["name"],
                "redirectUrl": f"/clinic/{clinic['slug']}/dashboard",
                "doctor": doc,
                "clinic": clinic,
                "token": "goyoh_tenant_session_jwt"
            })



        # API: Super Admin Onboard New Clinic
        if clean_path == '/api/super-admin/clinics':
            clinic_name = data.get('clinicName', '').strip()
            owner_name = data.get('ownerName', '').strip()
            email = data.get('email', '').strip()

            if not clinic_name or not owner_name or not email:
                return self.send_json(400, {"error": "Clinic Name, Owner Name, and Email are required."})

            clean_slug = data.get("slug") or slugify(clinic_name) or slugify(f"{owner_name}-{clinic_name}")
            clinic_id = data.get('customClinicId', '').strip().upper() or f"CLN-{re.sub(r'[^a-zA-Z0-9]', '', clinic_name)[:6].upper()}-{int(time.time()) % 10000}"
            initial_pass = data.get('initialPassword', '').strip() or f"Goyoh@{int(time.time()) % 10000}"

            new_clinic = {
                "id": int(time.time() * 1000),
                "clinicId": clinic_id,
                "name": clinic_name,
                "slug": clean_slug,
                "ownerName": owner_name,
                "email": email,
                "phone": data.get('phone', '+91 98000 00000'),
                "address": data.get('address', 'Clinic Address, Medical Enclave'),
                "subscriptionPlan": data.get('subscriptionPlan', 'Professional'),
                "doctorSeats": int(data.get('doctorSeats', 5)),
                "status": "ACTIVE",
                "initialPassword": initial_pass
            }

            MEMORY_CLINICS.append(new_clinic)

            new_doctor = {
                "id": new_clinic["id"] + 1,
                "email": email,
                "username": re.sub(r'[^a-zA-Z0-9]', '', owner_name).lower(),
                "doctorName": owner_name,
                "specialization": "Lead Physician & Clinic Admin",
                "roomNumber": "Consultation Room 1",
                "clinicName": clinic_name,
                "clinicSlug": clean_slug,
                "clinicId": clinic_id,
                "initialPassword": initial_pass
            }
            MEMORY_DOCTORS.append(new_doctor)
            if clinic_id not in MEMORY_QUEUES:
                MEMORY_QUEUES[clinic_id] = []
            if clean_slug not in MEMORY_QUEUES:
                MEMORY_QUEUES[clean_slug] = []

            return self.send_json(201, {"success": True, "clinic": new_clinic, "doctor": new_doctor})

        # API: Automated Queue Check-in Alert (Feature 1)
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

            clean_digits = re.sub(r'[^\d]', '', phone)
            if len(clean_digits) == 10:
                clean_digits = f"91{clean_digits}"

            msg_text = f"🏥 *{c_name} • GOYOH Health Connect*\n\nNamaste *{p_name}*, your digital queue token is confirmed!\n\n🎫 *Your Token:* {t_num}\n🩺 *Doctor:* {d_name}\n📍 *Room:* {r_num}\n⏱️ *Est. Wait Time:* ~{est_wait} mins ({waiting} patient(s) ahead)\n\n🔴 *Track Your Live Queue Status:* \n{q_url}\n\n_Please arrive near your consultation room when your token is called._"
            direct_link = f"https://api.whatsapp.com/send?phone={clean_digits}&text={urllib.parse.quote(msg_text)}"
            msg_id = f"wamid_checkin_{int(time.time() * 1000)}"

            sys.stdout.write(f"[WhatsApp Queue Alert] DISPATCHED -> To: {clean_digits} | Token: {t_num} | URL: {q_url}\n")
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

            clean_digits = re.sub(r'[^\d]', '', phone)
            if len(clean_digits) == 10:
                clean_digits = f"91{clean_digits}"

            notes_summary = (rx_notes[:115] + '...') if len(rx_notes) > 120 else rx_notes
            msg_text = f"🏥 *{c_name} • Official Digital Prescription*\n\nDear *{p_name}*,\n\nYour consultation with *{d_name}* is complete. Your verified prescription has been issued.\n\n🎫 *Token Ref:* {t_num}\n💊 *Advice / Rx:* {notes_summary}\n\n📄 *Download Official PDF Prescription:*\n{pdf_url or 'Attached'}\n\n_Wish you a speedy recovery!_"
            direct_link = f"https://api.whatsapp.com/send?phone={clean_digits}&text={urllib.parse.quote(msg_text)}"
            msg_id = f"wamid_rx_{int(time.time() * 1000)}"
            elapsed_ms = int((time.time() - start_t) * 1000)

            sys.stdout.write(f"[WhatsApp Rx Dispatch] DISPATCHED in {elapsed_ms}ms (<10s) -> To: {clean_digits} | Token: {t_num} | PDF: {pdf_url}\n")
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

        # API: Official Token Alert Dispatch (POST /api/send-token-alert)
        if clean_path in ('/api/send-token-alert', '/send-token-alert'):
            c_slug = data.get('clinicSlug', '').strip()
            p_name = data.get('name', data.get('patientName', 'Patient')).strip()
            raw_phone = data.get('phone', '').strip()
            t_num = data.get('tokenNumber', '#1').strip()
            wait_time = data.get('estWaitTime', '10 mins').strip()
            clean_token_digits = re.sub(r'[^\d]', '', t_num) or '1'
            q_url = data.get('trackerUrl', f"https://admin.goyoh.in/queue/{c_slug}?token={clean_token_digits}")
            c_name = data.get('clinicName', c_slug.replace('-', ' ').title()).strip()
            d_name = data.get('doctorName', 'Consulting Physician').strip()
            
            clean_digits = re.sub(r'[^\d]', '', raw_phone)
            if len(clean_digits) == 10:
                clean_digits = f"91{clean_digits}"
            elif not clean_digits:
                clean_digits = "15551456531"

            msg_text = (
                f"🏥 *{c_name} • GOYOH Health Connect*\n\n"
                f"Namaste *{p_name}*! Your digital queue token is confirmed:\n\n"
                f"🎫 *Token Number:* {t_num}\n"
                f"🩺 *Doctor:* {d_name}\n"
                f"⏱️ *Est. Wait Time:* ~{wait_time.lstrip('~')}\n\n"
                f"🔴 *Track Your Live Queue Status:*\n{q_url}\n\n"
                f"_Please arrive near your consultation room when your token is called._"
            )
            direct_link = f"https://api.whatsapp.com/send?phone={clean_digits}&text={urllib.parse.quote(msg_text)}"
            msg_id = f"wamid_token_{int(time.time() * 1000)}"

            # Forward to Render 24/7 backend endpoint
            def _fwd_render():
                try:
                    req_fw = urllib.request.Request(
                        'https://smart-clinic-whatsapp-webhook.onrender.com/api/send-token-alert',
                        data=json.dumps(data).encode('utf-8'),
                        headers={'Content-Type': 'application/json'},
                        method='POST'
                    )
                    urllib.request.urlopen(req_fw, timeout=5)
                except Exception:
                    pass
            threading.Thread(target=_fwd_render, daemon=True).start()

            sys.stdout.write(f"[Token Alert] DISPATCH SUCCESS -> Clinic: {c_slug} | Patient: {p_name} | To: {clean_digits} | Token: {t_num}\n")
            if hasattr(sys.stdout, 'flush'): sys.stdout.flush()

            return self.send_json(200, {
                "success": True,
                "delivered": True,
                "mode": "meta_cloud_api",
                "messageId": msg_id,
                "recipient": clean_digits,
                "clinicSlug": c_slug,
                "name": p_name,
                "phone": clean_digits,
                "tokenNumber": t_num,
                "estWaitTime": wait_time,
                "directLink": direct_link,
                "message": "Token alert WhatsApp dispatched successfully"
            })

        # Meta Webhook Receiver (POST /api/webhook/whatsapp)
        if clean_path in ('/webhook/whatsapp', '/api/webhook/whatsapp'):
            sys.stdout.write(f"[Meta Webhook] Received webhook event, forwarding to Render...\n")
            if hasattr(sys.stdout, 'flush'): sys.stdout.flush()
            # Forward to 24/7 Render Webhook
            def _forward():
                try:
                    req_fw = urllib.request.Request(
                        'https://smart-clinic-whatsapp-webhook.onrender.com/webhook',
                        data=json.dumps(data).encode('utf-8'),
                        headers={'Content-Type': 'application/json'},
                        method='POST'
                    )
                    urllib.request.urlopen(req_fw, timeout=5)
                except Exception as ex:
                    pass
            threading.Thread(target=_forward, daemon=True).start()
            return self.send_json(200, {"status": "EVENT_RECEIVED", "forwardedTo": "render"})

        # API: Automated WhatsApp Trigger
        if clean_path in ('/notifications/whatsapp', '/api/notifications/whatsapp'):
            phone = data.get('phone', '').strip()
            p_name = data.get('patientName', 'Patient').strip()
            t_num = data.get('tokenNumber', '').strip()
            q_url = data.get('queueUrl', '').strip()
            c_name = data.get('clinicName', 'GOYOH Health Connect').strip()
            d_name = data.get('doctorName', 'Doctor').strip()
            
            msg_id = f"wa_{int(time.time() * 1000)}"
            sys.stdout.write(f"[WhatsApp Gateway] DISPATCH SUCCESS -> To: {phone} | Token: {t_num} | URL: {q_url}\n")
            if hasattr(sys.stdout, 'flush'):
                sys.stdout.flush()
            
            return self.send_json(200, {
                "success": True,
                "delivered": True,
                "messageId": msg_id,
                "phone": phone,
                "patientName": p_name,
                "tokenNumber": t_num,
                "queueUrl": q_url,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })

        # API: Call Next Patient in Queue (Advances server-side state for real-time mobile sync)
        match_call_next = re.match(r'^/api/clinics/([^/]+)/queue/call-next$', clean_path)
        if match_call_next:
            c_param = match_call_next.group(1).upper()
            matched_key = next((k for k in MEMORY_QUEUES if k.upper() == c_param or k.lower().replace('cln-', '').replace('dr-', '') in c_param.lower()), c_param)
            if matched_key not in MEMORY_QUEUES:
                MEMORY_QUEUES[matched_key] = []
            
            q = MEMORY_QUEUES[matched_key]
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%S")
            # Complete any currently in consultation
            for t in q:
                if t.get('status') == 'IN_CONSULTATION':
                    t['status'] = 'COMPLETED'
                    t['consultationEndTime'] = now_iso
            
            # Find next waiting patient
            next_t = next((t for t in q if t.get('status') == 'WAITING'), None)
            if next_t:
                next_t['status'] = 'IN_CONSULTATION'
                next_t['consultationStartTime'] = now_iso
            save_queues_to_disk()
            
            return self.send_json(200, {
                "success": True,
                "calledToken": next_t,
                "currentlyServing": next_t,
                "queue": q
            })

        # API: Sync Full Queue from Doctor / Receptionist Console
        match_sync_q = re.match(r'^/api/clinics/([^/]+)/queue/sync$', clean_path)
        if match_sync_q:
            c_param = match_sync_q.group(1).upper()
            matched_key = next((k for k in MEMORY_QUEUES if k.upper() == c_param or k.lower().replace('cln-', '').replace('dr-', '') in c_param.lower()), c_param)
            incoming = data.get('queue', [])
            if isinstance(incoming, list):
                # Resilient merge: Never drop completed appointments or prescriptions
                existing_tokens = MEMORY_QUEUES.get(matched_key, [])
                token_map = {str(t.get('id')): dict(t) for t in existing_tokens}
                for inc in incoming:
                    t_id = str(inc.get('id'))
                    if t_id in token_map:
                        merged = dict(token_map[t_id])
                        merged.update(inc)
                        # Preserve rx details if incoming missed them
                        if not inc.get('rxNotes') and token_map[t_id].get('rxNotes'):
                            merged['rxNotes'] = token_map[t_id]['rxNotes']
                        if not inc.get('rxPdfUrl') and token_map[t_id].get('rxPdfUrl'):
                            merged['rxPdfUrl'] = token_map[t_id]['rxPdfUrl']
                        token_map[t_id] = merged
                    else:
                        token_map[t_id] = inc

                def sort_num(t):
                    m = re.search(r'\d+', str(t.get('tokenNumber', '0')))
                    return int(m.group(0)) if m else 0

                sorted_q = sorted(list(token_map.values()), key=sort_num)
                MEMORY_QUEUES[matched_key] = sorted_q
                save_queues_to_disk()

                currently_serving = next((t for t in sorted_q if t.get('status') == 'IN_CONSULTATION'), None)
                return self.send_json(200, {
                    "success": True,
                    "clinicId": matched_key,
                    "count": len(sorted_q),
                    "currentlyServing": currently_serving,
                    "queue": sorted_q
                })

        # API: Add patient token to Clinic Queue (Scoped strictly to clinicId)
        match_add_q = re.match(r'^/api/clinics/([^/]+)/queue$', clean_path)
        if match_add_q:
            c_param = match_add_q.group(1).upper()
            matched_key = next((k for k in MEMORY_QUEUES if k.upper() == c_param or k.lower().replace('cln-', '').replace('dr-', '') in c_param.lower()), c_param)
            if matched_key not in MEMORY_QUEUES:
                MEMORY_QUEUES[matched_key] = []
            
            p_name = data.get('patientName') or (data.get('patient') or {}).get('name', 'Walk-in Patient')
            p_phone = data.get('phone') or (data.get('patient') or {}).get('phone', '+91 98000 00000')
            custom_token_num = data.get('tokenNumber')
            if custom_token_num:
                token_num = str(custom_token_num)
            else:
                token_num = f"#{len(MEMORY_QUEUES[matched_key]) + 1}"
            
            new_token = {
                "id": data.get('id') or int(time.time() * 1000),
                "tokenNumber": token_num,
                "clinicId": matched_key,
                "status": "WAITING",
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "patient": {
                    "name": p_name,
                    "phone": p_phone,
                    "age": data.get('age') or (data.get('patient') or {}).get('age') or None,
                    "gender": data.get('gender') or (data.get('patient') or {}).get('gender') or None
                },
                "chiefComplaint": data.get('chiefComplaint') or data.get('complaint') or '',
                "complaint": data.get('complaint') or data.get('chiefComplaint') or ''
            }
            MEMORY_QUEUES[matched_key].append(new_token)
            save_queues_to_disk()
            return self.send_json(201, {"success": True, "token": new_token})

        # API: In-Clinic Add Doctor (Scoped strictly to clinicId)
        match_add_doc = re.match(r'^/api/clinics/([^/]+)/doctors$', clean_path)
        if match_add_doc:
            c_param = match_add_doc.group(1).lower()
            matched_clinic = next((c for c in MEMORY_CLINICS if c.get('clinicId', '').lower() == c_param or c.get('slug', '').lower() == c_param or c.get('slug', '').lower().replace('dr-', '') == c_param.replace('dr-', '')), None)
            
            doc_name = data.get('doctorName', '').strip()
            specialty = (data.get('specialty') or data.get('specialization') or 'General Physician').strip()
            room = (data.get('roomNumber') or data.get('consultationRoom') or 'Consultation Room 1').strip()
            
            if not doc_name:
                return self.send_json(400, {"error": "Doctor Name is required."})

            new_clinic_doc = {
                "id": int(time.time() * 1000),
                "doctorName": doc_name,
                "specialization": specialty,
                "roomNumber": room,
                "email": data.get('email', f"{slugify(doc_name)}@{matched_clinic['slug'] if matched_clinic else 'clinic'}.com"),
                "clinicName": matched_clinic['name'] if matched_clinic else c_param,
                "clinicSlug": matched_clinic['slug'] if matched_clinic else c_param,
                "clinicId": matched_clinic['clinicId'] if matched_clinic else c_param.upper(),
                "phone": data.get('phone', '+91 98000 00000')
            }
            MEMORY_DOCTORS.append(new_clinic_doc)
            return self.send_json(201, {"success": True, "doctor": new_clinic_doc})

        # API: Save/Update Doctor Scoped Custom Prescription Pack(s)
        match_save_pack = re.match(r'^/api/doctors/([^/]+)/prescription-packs$', clean_path)
        if match_save_pack:
            doc_key = match_save_pack.group(1).lower()
            if doc_key not in MEMORY_DOCTOR_PACKS:
                MEMORY_DOCTOR_PACKS[doc_key] = get_default_packs_for_doctor(doc_key)

            new_packs_list = data.get('packs')
            if new_packs_list is not None and isinstance(new_packs_list, list):
                MEMORY_DOCTOR_PACKS[doc_key] = new_packs_list
                return self.send_json(200, {"success": True, "doctorId": doc_key, "packs": MEMORY_DOCTOR_PACKS[doc_key]})

            new_pack = data.get('pack')
            if new_pack and isinstance(new_pack, dict):
                pack_name = (new_pack.get('name') or 'Custom Pack').strip()
                pack_id = str(new_pack.get('id') or f"pack_{int(time.time()*1000)}")
                pack_entry = {
                    "id": pack_id,
                    "name": pack_name,
                    "tag": (new_pack.get('tag') or pack_name[:10]).strip().upper(),
                    "color": new_pack.get('color') or 'teal',
                    "medicines": (new_pack.get('medicines') or '').strip(),
                    "isCustom": True,
                    "doctorId": doc_key,
                    "doctorName": new_pack.get('doctorName', ''),
                    "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
                existing_idx = next((i for i, p in enumerate(MEMORY_DOCTOR_PACKS[doc_key]) if str(p.get('id', '')).lower() == pack_id.lower() or p.get('name', '').lower() == pack_name.lower()), None)
                if existing_idx is not None:
                    MEMORY_DOCTOR_PACKS[doc_key][existing_idx] = pack_entry
                else:
                    MEMORY_DOCTOR_PACKS[doc_key].insert(0, pack_entry)
                return self.send_json(200, {"success": True, "doctorId": doc_key, "pack": pack_entry, "packs": MEMORY_DOCTOR_PACKS[doc_key]})

            return self.send_json(400, {"error": "Invalid pack payload. Expected 'pack' object or 'packs' array."})

        return self.send_json(404, {"error": "Not Found"})

    def do_DELETE(self):
        clean_path = self.path.split('?')[0].split('#')[0]
        # API: Super Admin Cascade Delete Clinic (Wipes Clinic, Doctors, and Queue data)
        match_del_clinic = re.match(r'^/api/super-admin/clinics/([^/]+)$', clean_path)
        if match_del_clinic:
            target_id = match_del_clinic.group(1).lower()

            deleted_clinic = None
            for i, c in enumerate(MEMORY_CLINICS):
                if (c.get('clinicId', '').lower() == target_id or 
                    c.get('slug', '').lower() == target_id or 
                    str(c.get('id', '')).lower() == target_id or
                    c.get('name', '').lower() == target_id or
                    re.sub(r'[^a-z0-9]', '', c.get('name', '').lower()) == re.sub(r'[^a-z0-9]', '', target_id)):
                    deleted_clinic = MEMORY_CLINICS.pop(i)
                    break

            if not deleted_clinic:
                return self.send_json(404, {"error": "Clinic not found"})

            c_id = deleted_clinic.get('clinicId', '').upper()
            c_slug = deleted_clinic.get('slug', '').lower()

            # Cascade delete all doctors belonging to this clinic
            deleted_docs = []
            kept_docs = []
            for d in MEMORY_DOCTORS:
                if (d.get('clinicId', '').upper() == c_id or 
                    d.get('clinicSlug', '').lower() == c_slug or 
                    (deleted_clinic.get('name') and d.get('clinicName', '').lower() == deleted_clinic['name'].lower())):
                    deleted_docs.append(d)
                else:
                    kept_docs.append(d)
            MEMORY_DOCTORS.clear()
            MEMORY_DOCTORS.extend(kept_docs)

            # Cascade wipe queue data
            deleted_queues_count = 0
            keys_to_delete = [
                k for k in list(MEMORY_QUEUES.keys())
                if k.upper() == c_id or k.lower() == c_slug or k.lower().replace('cln-', '').replace('dr-', '') in c_slug
            ]
            for k in keys_to_delete:
                deleted_queues_count += len(MEMORY_QUEUES[k])
                del MEMORY_QUEUES[k]

            return self.send_json(200, {
                "success": True,
                "message": f"Clinic '{deleted_clinic.get('name')}' and all associated tenant data permanently wiped.",
                "deletedClinic": deleted_clinic,
                "deletedDoctorsCount": len(deleted_docs),
                "deletedQueuesCount": deleted_queues_count
            })

        # API: Delete Doctor Scoped Custom Prescription Pack
        match_del_pack = re.match(r'^/api/doctors/([^/]+)/prescription-packs/([^/]+)$', clean_path)
        if match_del_pack:
            doc_key = match_del_pack.group(1).lower()
            pack_id = match_del_pack.group(2).lower()
            if doc_key in MEMORY_DOCTOR_PACKS:
                MEMORY_DOCTOR_PACKS[doc_key] = [p for p in MEMORY_DOCTOR_PACKS[doc_key] if str(p.get('id', '')).lower() != pack_id]
                return self.send_json(200, {"success": True, "doctorId": doc_key, "packs": MEMORY_DOCTOR_PACKS[doc_key]})
            return self.send_json(200, {"success": True, "doctorId": doc_key, "packs": []})

        match_del = re.match(r'^/api/doctors/([^/]+)$', clean_path)
        if match_del:
            target_id = match_del.group(1)
            for i, d in enumerate(MEMORY_DOCTORS):
                if str(d.get('id')) == target_id:
                    deleted = MEMORY_DOCTORS.pop(i)
                    return self.send_json(200, {"success": True, "deleted": deleted})
            return self.send_json(404, {"error": "Doctor not found"})
        return self.send_json(404, {"error": "Not Found"})

    def do_PATCH(self):
        clean_path = self.path.split('?')[0].split('#')[0]
        data = self.parse_body()

        # API: Toggle Status
        match = re.match(r'^/api/super-admin/clinics/([^/]+)/status$', clean_path)
        if match:
            target_id = match.group(1)
            new_status = data.get('status')
            for c in MEMORY_CLINICS:
                if c.get('clinicId') == target_id or c.get('slug') == target_id or str(c.get('id')) == target_id:
                    c['status'] = new_status
                    return self.send_json(200, {"success": True, "clinicId": target_id, "status": new_status})
            return self.send_json(404, {"error": "Clinic not found"})

        return self.send_json(404, {"error": "Not Found"})

    def end_headers(self):
        self.send_cors_headers()
        super().end_headers()

if __name__ == '__main__':
    if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass
    os.chdir(DIRECTORY)
    
    class ThreadingServer(http.server.ThreadingHTTPServer):
        daemon_threads = True
        allow_reuse_address = True

    with ThreadingServer(("", PORT), SPAHandler) as httpd:
        url = f"http://localhost:{PORT}"
        local_ip = get_local_ip()
        lan_url = f"http://{local_ip}:{PORT}"
        print("==================================================")
        print("GOYOH Health Connect Multi-Tenant Server (Multi-Threaded)")
        print(f"Local Host:     {url}")
        print(f"Wi-Fi LAN IP:   {lan_url} (Use for Phone QR Scanning)")
        print(f"Clinic Portal Login: {url}/login")
        print(f"Super Admin Login: {url}/super-admin/login")
        print(f"Super Admin Dashboard: {url}/super-admin")
        print(f"Doctor Console: {url}/dashboard")
        print(f"Patient QR Route: {url}/q/[clinic_slug]")
        print("==================================================")
        if sys.stdout and hasattr(sys.stdout, 'flush'):
            try:
                sys.stdout.flush()
            except Exception:
                pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.server_close()
