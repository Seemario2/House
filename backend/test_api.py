import requests
import json
import uuid

BASE_URL = "http://127.0.0.1:8000/api"

def test_auth():
    email = f"test_{uuid.uuid4()}@example.com"
    password = "password123"
    
    print(f"Testing with Email: {email}")
    
    # 1. Signup
    print("Attempting Signup...")
    signup_data = {
        "full_name": "Test User",
        "email": email,
        "password": password,
        "role": "tenant"
    }
    
    try:
        r = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
        print(f"Signup Status: {r.status_code}")
        print(f"Signup Response: {r.text}")
        
        if r.status_code != 200:
            print("Signup failed!")
            return

        # 2. Login
        print("\nAttempting Login...")
        login_data = {
            "email": email,
            "password": password
        }
        
        r = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        print(f"Login Status: {r.status_code}")
        print(f"Login Response: {r.text}")
        
        if r.status_code == 200:
            print("Login SUCCESS!")
            token = r.json().get("access_token")
            print(f"Token received: {token[:20]}...")
        else:
            print("Login FAILED!")

    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_auth()
