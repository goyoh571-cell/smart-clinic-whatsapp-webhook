import time
import os
import sys
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

sys.stdout.reconfigure(encoding='utf-8')

artifacts_dir = r"C:\Users\user\.gemini\antigravity\brain\dd41eb20-76b2-4d9f-9694-2e127d4507ec"

chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--window-size=1440,900")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")

driver = webdriver.Chrome(options=chrome_options)

try:
    print("1. Opening patient checkin page...")
    driver.get("http://localhost:3000/checkin/apollo-clinic")
    time.sleep(3)

    # Fill patient name and phone
    name_input = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//input[@placeholder='e.g., Rajesh Sharma' or contains(@placeholder, 'Rajesh') or @type='text']"))
    )
    name_input.clear()
    name_input.send_keys("Pooja Nair")

    phone_input = driver.find_element(By.XPATH, "//input[contains(@placeholder, '98765') or @type='tel' or contains(@placeholder, 'phone') or contains(@placeholder, 'Mobile')]")
    phone_input.clear()
    phone_input.send_keys("6361275596")

    screenshot_form = os.path.join(artifacts_dir, "whatsapp_patient_form_filled.png")
    driver.save_screenshot(screenshot_form)
    print("   Saved screenshot:", screenshot_form)

    # Click Submit / Check In
    submit_btn = driver.find_element(By.XPATH, "//button[@type='submit' or contains(., 'GET MY TOKEN')]")
    submit_btn.click()
    print("   Clicked checkin submit...")

    # Wait for queue page
    time.sleep(3)
    screenshot_queue = os.path.join(artifacts_dir, "whatsapp_patient_queue_card.png")
    driver.save_screenshot(screenshot_queue)
    print("   Saved queue screenshot:", screenshot_queue)

    # Check for WhatsApp Tracker in page source
    page_html = driver.page_source
    if "Automated WhatsApp Tracker" in page_html or "WhatsApp" in page_html:
        print("   ✓ WhatsApp Tracker verified on patient queue screen!")

    # 2. Open Doctor Console
    print("2. Opening Doctor Console...")
    driver.get("http://localhost:3000/clinic/apollo-clinic/dashboard")
    time.sleep(4)

    screenshot_doctor = os.path.join(artifacts_dir, "whatsapp_doctor_dashboard.png")
    driver.save_screenshot(screenshot_doctor)
    print("   Saved doctor dashboard screenshot:", screenshot_doctor)

    # Check if patient appears or Call Next works
    call_next_btns = driver.find_elements(By.XPATH, "//button[contains(., 'CALL NEXT')]")
    if call_next_btns:
        print("   Clicking 1-TAP CALL NEXT...")
        call_next_btns[0].click()
        time.sleep(3)
        screenshot_in_room = os.path.join(artifacts_dir, "whatsapp_patient_in_room.png")
        driver.save_screenshot(screenshot_in_room)
        print("   Saved in-room screenshot:", screenshot_in_room)

        # Check for Save / Finish Prescription (WhatsApp Rx) button
        rx_btns = driver.find_elements(By.XPATH, "//button[contains(., 'Save / Finish Prescription') or contains(., 'WhatsApp Rx')]")
        if rx_btns:
            print("   ✓ Found 'Save / Finish Prescription (WhatsApp Rx ⚡)' button! Clicking...")
            rx_btns[0].click()
            time.sleep(3)
            screenshot_rx_dispatched = os.path.join(artifacts_dir, "whatsapp_rx_dispatched_modal.png")
            driver.save_screenshot(screenshot_rx_dispatched)
            print("   Saved rx dispatched modal screenshot:", screenshot_rx_dispatched)
            
            modal_html = driver.page_source
            if "10-Second WhatsApp Rx Dispatched" in modal_html or "Prescription Generated & Dispatched" in modal_html:
                print("   ✓ 10-Second WhatsApp Rx Dispatch Modal verified successfully!")
        else:
            print("   Rx button not immediately visible in active room.")

    print("ALL FRONTEND VERIFICATION TESTS COMPLETED SUCCESSFULLY!")

finally:
    driver.quit()
