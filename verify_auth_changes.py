import requests
import uuid

BASE_URL = "http://127.0.0.1:8000/api"

def test_tenant_signup():
    email = f"tenant_{uuid.uuid4()}@test.com"
    data = {"full_name": "Test Tenant", "email": email, "password": "password123", "role": "tenant"}
    
    print(f"Testing Tenant Signup: {email}")
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json=data)
        if response.status_code == 200:
            res_json = response.json()
            if "access_token" in res_json and res_json["is_approved"] == True:
                print("PASS: Tenant signup returned token and is_approved=True")
            else:
                print(f"FAIL: Unexpected response: {res_json}")
        else:
            print(f"FAIL: Status {response.status_code} - {response.text}")
    except Exception as e:
        print(f"FAIL: Error {e}")

def test_landlord_signup():
    email = f"landlord_{uuid.uuid4()}@test.com"
    data = {"full_name": "Test Landlord", "email": email, "password": "password123", "role": "landlord"}
    
    print(f"\nTesting Landlord Signup: {email}")
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json=data)
        if response.status_code == 200:
            res_json = response.json()
            if "access_token" in res_json and res_json["is_approved"] == False:
                print("PASS: Landlord signup returned token and is_approved=False")
            else:
                print(f"FAIL: Unexpected response: {res_json}")
        else:
            print(f"FAIL: Status {response.status_code} - {response.text}")
    except Exception as e:
        print(f"FAIL: Error {e}")

if __name__ == "__main__":
    print("Verifying Auth Changes...\n")
    # Note: This assumes the server is running. If not, it will fail connection.
    test_tenant_signup()
    test_landlord_signup()
