
import requests
import json

try:
    print("Testing API Connection to http://127.0.0.1:8000/api/properties")
    response = requests.get("http://127.0.0.1:8000/api/properties")
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("Success! Data received:")
        print(json.dumps(data, indent=2))
    else:
        print(f"Failed: {response.text}")

except Exception as e:
    print(f"Connection Error: {e}")
