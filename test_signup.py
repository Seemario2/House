import requests
import json
import uuid

email = f"test_{uuid.uuid4()}@example.com"
url = "http://127.0.0.1:8000/api/auth/signup"
data = {
    "email": email,
    "password": "password123",
    "role": "tenant",
    "full_name": "Test User"
}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
