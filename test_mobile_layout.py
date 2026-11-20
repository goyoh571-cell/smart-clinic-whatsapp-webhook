import os
import sys
import time
import json
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

sys.stdout.reconfigure(encoding='utf-8')

PORT = 3005
DIST_DIR = r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\dist"
SCREENSHOT_PATH = r"C:\Users\user\.gemini\antigravity\brain\dd41eb20-76b2-4d9f-9694-2e127d4507ec\mobile_clinic_console_verified.png"

class SPAHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def do_GET(self):
        # Serve index.html for SPA routes
        path = self.path.split('?')[0]
        local_file = os.path.join(DIST_DIR, path.lstrip('/'))
        if not os.path.exists(local_file) or os.path.isdir(local_file):
            self.path = '/index.html'
        return super().do_GET()

def start_server():
    server = HTTPServer(('127.0.0.1', PORT), SPAHandler)
    server.serve_forever()

print("1. Starting local SPA server on port 3005...")
t = threading.Thread(target=start_server, daemon=True)
t.start()
time.sleep(1)

print("2. Launching headless Chrome with mobile viewport (375x812)...")
options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-gpu')
options.add_argument('--window-size=375,812')

# Mobile emulation
mobile_emulation = {
    "deviceMetrics": { "width": 375, "height": 812, "pixelRatio": 3.0 },
    "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
}
options.add_experimental_option("mobileEmulation", mobile_emulation)

driver = webdriver.Chrome(options=options)
driver.set_window_size(375, 812)

try:
    print("3. Navigating to base URL to seed mock doctor & queue data into localStorage...")
    driver.get(f"http://127.0.0.1:{PORT}/")
    time.sleep(1)

    mock_clinic = {
        "id": 1,
        "clinicId": "CLN-ANKITHA",
        "name": "Dr. Ankitha Clinic",
        "ownerName": "Dr. Ankitha Rao",
        "email": "ankitha@clinic.com",
        "slug": "ankitha-clinic",
        "doctorSeats": 2,
        "subscriptionPlan": "Professional",
        "status": "ACTIVE"
    }

    mock_doc = {
        "id": "doc-1",
        "doctorName": "Dr. Ankitha Rao",
        "specialization": "General Physician",
        "roomNumber": "OPD 1",
        "clinicId": "CLN-ANKITHA",
        "clinicName": "Dr. Ankitha Clinic",
        "clinicSlug": "ankitha-clinic",
        "email": "ankitha@clinic.com"
    }

    today_iso = time.strftime('%Y-%m-%dT%H:%M:%S')
    today_date_str = time.strftime('%a %b %d %Y')

    mock_queues = {
        "ankitha-clinic": [
            {
                "id": "token_16",
                "tokenNumber": "#16",
                "status": "IN_CONSULTATION",
                "createdAt": today_iso,
                "calledAt": today_iso,
                "patient": {
                    "name": "Ramesh Kumar",
                    "phone": "+91 98765 43210",
                    "complaint": "Persistent high fever, severe body ache, and dry cough for 3 days."
                }
            },
            {
                "id": "token_17",
                "tokenNumber": "#17",
                "status": "WAITING",
                "createdAt": today_iso,
                "patient": {
                    "name": "Priya Sharma",
                    "phone": "+91 98765 43211",
                    "complaint": "Throat irritation"
                }
            }
        ]
    }

    seed_script = f"""
    localStorage.setItem('smart_clinic_calendar_date', '{today_date_str}');
    localStorage.setItem('smart_clinic_authed', 'true');
    localStorage.setItem('smart_clinic_active_clinic_slug', 'ankitha-clinic');
    localStorage.setItem('smart_clinic_doctor_ankitha-clinic', JSON.stringify({json.dumps(mock_doc)}));
    localStorage.setItem('smart_clinic_current_doctor', JSON.stringify({json.dumps(mock_doc)}));
    localStorage.setItem('smart_clinic_saas_clinics', JSON.stringify([{json.dumps(mock_clinic)}]));
    localStorage.setItem('smart_clinic_saas_doctors', JSON.stringify([{json.dumps(mock_doc)}]));
    localStorage.setItem('smart_clinic_tenant_queues', JSON.stringify({json.dumps(mock_queues)}));
    """
    driver.execute_script(seed_script)
    print("   [+] Seeded mock doctor and queue (#16 in consultation, #17 waiting).")

    print("4. Navigating to /clinic/ankitha-clinic/dashboard...")
    driver.get(f"http://127.0.0.1:{PORT}/clinic/ankitha-clinic/dashboard")
    
    # Wait for DoctorDashboardView to render
    wait = WebDriverWait(driver, 10)
    wait.until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'Dr. Ankitha Rao')]")))
    time.sleep(2)

    print("\n--- 5. VERIFICATIONS ---")

    # A. Check Horizontal Overflow
    win_inner_width = driver.execute_script("return window.innerWidth;")
    doc_scroll_width = driver.execute_script("return document.documentElement.scrollWidth;")
    body_scroll_width = driver.execute_script("return document.body.scrollWidth;")
    print(f"   [Viewport Check] window.innerWidth: {win_inner_width}px | doc.scrollWidth: {doc_scroll_width}px | body.scrollWidth: {body_scroll_width}px")
    assert doc_scroll_width <= win_inner_width, f"FAIL: Horizontal overflow detected! doc.scrollWidth ({doc_scroll_width}) > window.innerWidth ({win_inner_width})"
    assert body_scroll_width <= win_inner_width, f"FAIL: Body horizontal overflow! body.scrollWidth ({body_scroll_width}) > window.innerWidth ({win_inner_width})"
    print("   [PASS] No horizontal overflow or clipping! (overflow-x: hidden enforced)")

    # B. Check Double-Hash Typo
    page_text = driver.find_element(By.TAG_NAME, "body").text
    assert "##16" not in page_text, "FAIL: Found '##16' in page text!"
    assert "##" not in page_text, f"FAIL: Found double hash '##' in page text!"
    print("   [PASS] No '##16' double-hash typos detected anywhere on the page.")

    # Check active token displays '#16'
    token_elem = driver.find_element(By.XPATH, "//*[contains(@class, 'font-mono-numbers') and contains(text(), '16')]")
    token_text = token_elem.text.strip()
    print(f"   [Token Display Check] Rendered token text: '{token_text}'")
    assert token_text == "#16", f"FAIL: Expected '#16', got '{token_text}'"
    print("   [PASS] Active token renders cleanly as '#16'.")

    # Check 'Token #16 in room'
    in_room_elem = driver.find_element(By.XPATH, "//*[contains(text(), 'in room')]")
    in_room_text = in_room_elem.text.strip()
    print(f"   [In-Room Status Check] Rendered text: '{in_room_text}'")
    assert in_room_text == "Token #16 in room", f"FAIL: Expected 'Token #16 in room', got '{in_room_text}'"
    print("   [PASS] In-room status cleanly renders 'Token #16 in room'.")

    # C. Check Single Clear Primary 'CALL NEXT' Action (No duplicates)
    call_next_buttons = driver.find_elements(By.XPATH, "//button[contains(., 'CALL NEXT')]")
    visible_call_next = [b for b in call_next_buttons if b.is_displayed()]
    print(f"   [Call Next Button Check] Found {len(visible_call_next)} visible 'CALL NEXT' button(s):")
    for b in visible_call_next:
        print(f"      - Button: '{b.text.replace(chr(10), ' ')}' | Location: {b.location}")
    assert len(visible_call_next) == 1, f"FAIL: Expected exactly 1 visible 'CALL NEXT' button, found {len(visible_call_next)}"
    print("   [PASS] Exactly 1 visible primary 'CALL NEXT' button exists on mobile screen.")

    # D. Check Mobile Bottom Navigation Items & Inactive Text Contrast
    nav_elem = driver.find_element(By.XPATH, "//nav[contains(@class, 'md:hidden')]")
    assert nav_elem.is_displayed(), "FAIL: Mobile bottom navigation bar should be visible on mobile!"
    nav_buttons = nav_elem.find_elements(By.TAG_NAME, "button")
    nav_labels = [b.text.replace('\n', ' ').strip() for b in nav_buttons]
    print(f"   [Bottom Nav Tabs Check] Tabs found ({len(nav_labels)}): {nav_labels}")
    expected_tabs = ['Console', 'Desk QR', 'TV View', 'Settings']
    for exp in expected_tabs:
        assert any(exp in lbl for lbl in nav_labels), f"FAIL: Expected nav tab '{exp}' not found in {nav_labels}"
    print("   [PASS] All 4 mobile bottom nav tabs present: Console, Desk QR, TV View, Settings.")

    # Check text color/class of inactive tabs (e.g. Desk QR, Settings)
    desk_qr_btn = [b for b in nav_buttons if 'Desk QR' in b.text][0]
    desk_qr_classes = desk_qr_btn.get_attribute("className")
    print(f"   [Nav Contrast Check] Desk QR classes: '{desk_qr_classes}'")
    assert "text-slate-200" in desk_qr_classes, "FAIL: Inactive tab should have high contrast 'text-slate-200'"
    print("   [PASS] Inactive nav tabs have high-contrast text ('text-slate-200').")

    # E. Check Prescription Editor Textarea Soft-Wrap & Word-Wrapping
    textarea = driver.find_element(By.TAG_NAME, "textarea")
    wrap_attr = textarea.get_attribute("wrap")
    print(f"   [Textarea Wrap Check] wrap attribute: '{wrap_attr}'")
    assert wrap_attr == "soft", f"FAIL: Expected wrap='soft', got '{wrap_attr}'"

    # Type long text into textarea to test word wrapping without horizontal scroll
    long_text = "Paracetamol 650mg TDS x 5 days after food. Azithromycin 500mg OD x 3 days. Steam inhalation twice daily and warm water gargling. Maintain adequate hydration and rest."
    textarea.clear()
    textarea.send_keys(long_text)
    time.sleep(0.5)

    ta_scroll_width = driver.execute_script("return arguments[0].scrollWidth;", textarea)
    ta_client_width = driver.execute_script("return arguments[0].clientWidth;", textarea)
    print(f"   [Textarea Scroll Check] clientWidth: {ta_client_width}px | scrollWidth: {ta_scroll_width}px")
    assert ta_scroll_width <= ta_client_width + 2, f"FAIL: Textarea has horizontal scroll! scrollWidth ({ta_scroll_width}) > clientWidth ({ta_client_width})"
    print("   [PASS] Prescription textarea wraps text softly with zero horizontal scrolling!")

    # F. Capture Verified Screenshot
    driver.save_screenshot(SCREENSHOT_PATH)
    print(f"\n6. Screenshot saved successfully to:\n   {SCREENSHOT_PATH}")
    print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")

finally:
    driver.quit()
