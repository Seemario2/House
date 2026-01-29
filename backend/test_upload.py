import requests
import base64

# Small red dot 1x1 px
dummy_image_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

url = "http://127.0.0.1:8000/api/properties"
data = {
    "title": "Test Property Supabase",
    "description": "Testing upload logic",
    "price": 1200,
    "location": "Test City",
    "type": "Apartment",
    "bedrooms": 1,
    "bathrooms": 1,
    "sqft": 500,
    "image_url": dummy_image_b64,
    "owner_id": 1
}

try:
    print("Sending request to", url)
    response = requests.post(url, json=data)
    print("Status Code:", response.status_code)
    if response.status_code == 200:
        print("Success!")
        print("Response:", response.json())
    else:
        print("Failed:", response.text)
except Exception as e:
    print("Error:", e)
