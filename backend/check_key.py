from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

print(f"URL: {url}")
print(f"Key: {key}")

try:
    client = create_client(url, key)
    print("Client created successfully")
    # Try a simple storage operation, e.g. list buckets
    res = client.storage.list_buckets()
    print("Buckets:", res)
    
    bucket_name = "property-images"
    try:
        # Try to upload a dummy file
        print(f"Attempting upload to {bucket_name}...")
        res = client.storage.from_(bucket_name).upload("test_file.txt", b"hello world", {"content-type": "text/plain"})
        print("Upload result:", res)
    except Exception as e:
        print(f"Upload failed: {e}")

except Exception as e:
    print(f"Error: {e}")
