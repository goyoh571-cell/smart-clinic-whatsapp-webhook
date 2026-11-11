import time
import os
import sys
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

sys.stdout.reconfigure(encoding='utf-8')

ARTIFACT_DIR = r"C:\Users\user\.gemini\antigravity\brain\dd41eb20-76b2-4d9f-9694-2e127d4507ec"
BASE_URL = "https://smart-clinic-app-cf39b.web.app"

chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--window-size=1400,900")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")

driver = webdriver.Chrome(options=chrome_options)

def ensure_super_admin():
    driver.get(f"{BASE_URL}/super-admin")
    time.sleep(2)
    driver.execute_script("localStorage.setItem('goyoh_super_admin_authed', 'true');")
    driver.get(f"{BASE_URL}/super-admin")
    time.sleep(3)

    pass_inputs = driver.find_elements(By.XPATH, "//input[@type='password']")
    if pass_inputs:
        user_inputs = driver.find_elements(By.XPATH, "//input[@type='text']")
        if user_inputs:
            user_inputs[0].send_keys("superadmin@goyoh.com")
        pass_inputs[0].send_keys("admin123")
        driver.find_element(By.XPATH, "//button[contains(., 'Sign In') or contains(., 'Login') or @type='submit']").click()
        time.sleep(3)

try:
    ts = int(time.time())

    # Step 1: Solo 1-seat clinic
    print("Step 1: Verify clean top-left branding for 1-Seat Solo Clinic...")
    solo_slug = f"apex-solo-{ts % 1000}"
    driver.get(f"{BASE_URL}/clinic/{solo_slug}/dashboard")
    time.sleep(4)

    solo_header = driver.find_element(By.TAG_NAME, "header")
    solo_header_text = solo_header.text
    print("Solo Clinic Header Text:\n", solo_header_text)

    # Solo clinic must show branding + active badge only in top-left
    assert "ACTIVE OPD" in solo_header_text, "ACTIVE OPD badge must be present in header"
    assert "Manage Doctors" not in solo_header_text, "Manage Doctors should NOT be in header for 1-seat clinic!"
    assert "+ Add Doctor" not in solo_header_text, "+ Add Doctor should NOT be in header for 1-seat clinic!"
    assert "/clinic/" not in solo_header_text, "Route pill should NOT be in header for 1-seat clinic!"

    solo_shot = os.path.join(ARTIFACT_DIR, "verified_solo_clean_topleft.png")
    driver.save_screenshot(solo_shot)
    print(f"Saved solo screenshot to: {solo_shot}")
    print("SUCCESS: Solo clinic header verified clean and minimal!")

    # Step 2: Multi-seat clinic
    print("\nStep 2: Verify multi-doctor controls for multi-seat clinic...")
    multi_slug = f"metro-multi-seats-{ts % 1000}"
    driver.get(f"{BASE_URL}/clinic/{multi_slug}/dashboard")
    time.sleep(4)

    multi_header = driver.find_element(By.TAG_NAME, "header")
    multi_header_text = multi_header.text
    print("Multi Clinic Header Text:\n", multi_header_text)

    assert "ACTIVE OPD" in multi_header_text, "ACTIVE OPD badge must be present in multi clinic header"
    assert "Manage Doctors" in multi_header_text, "Multi clinic must include Manage Doctors trigger"
    assert "+ Add Doctor" in multi_header_text, "Multi clinic must include + Add Doctor button"

    multi_shot = os.path.join(ARTIFACT_DIR, "verified_multi_with_controls.png")
    driver.save_screenshot(multi_shot)
    print(f"Saved multi screenshot to: {multi_shot}")
    print("ALL TESTS COMPLETED SUCCESSFULLY!")

finally:
    driver.quit()
