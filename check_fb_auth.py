import urllib.request
import json

API_KEY = "AIzaSyD_0K24tUnG1OWh74HwJfjqQIZ6Q3_IOn0"
url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"

# Let's test a dummy signup to check if Firebase Auth is enabled on the project
req = urllib.request.Request(
    url,
    data=json.dumps({"email": "test_auth_check_123@example.com", "password": "TestPassword123!", "returnSecureToken": True}).encode('utf-8'),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print("Firebase Auth is ENABLED! User created:", data.get('localId'))
        
        # Now delete this test user right away
        del_url = f"https://identitytoolkit.googleapis.com/v1/accounts:delete?key={API_KEY}"
        del_req = urllib.request.Request(
            del_url,
            data=json.dumps({"idToken": data.get('idToken')}).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(del_req) as del_resp:
            print("Successfully deleted test user! Delete resp status:", del_resp.status)
except urllib.error.HTTPError as e:
    err_body = e.read().decode('utf-8')
    print("HTTP Error:", e.code, err_body)
except Exception as e:
    print("Exception:", e)
