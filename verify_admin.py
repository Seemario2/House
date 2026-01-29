import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def run_verification():
    print("--- Verifying Admin Blog Features ---")

    # 1. Create Admin User (via direct signup, assuming we allow it for now or just checking auth)
    # Ideally admin accounts are seeded, but let's try to signup one or login if exists.
    admin_email = "admin@example.com"
    admin_pass = "admin123"
    
    session = requests.Session()

    # Try Login first
    print(f"1. Attempting login as {admin_email}...")
    try:
        data = {"email": admin_email, "password": admin_pass, "role": "admin"}
        res = session.post(f"{BASE_URL}/auth/login", json=data)
        
        if res.status_code == 401:
            print("   -> Login failed, attempting signup...")
            # Signup
            signup_data = {
                "full_name": "Admin Tester",
                "email": admin_email,
                "password": admin_pass,
                "role": "admin"
            }
            res_signup = session.post(f"{BASE_URL}/auth/signup", json=signup_data)
            if res_signup.status_code == 200:
                print("   -> Signup success! Logging in...")
                res = session.post(f"{BASE_URL}/auth/login", json=data)
            else:
                print(f"   -> Signup failed: {res_signup.text}")
                return

        if res.status_code == 200:
            token = res.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            print("   -> Login success! Token acquired.")
        else:
            print(f"   -> Login failed: {res.text}")
            return

    except Exception as e:
        print(f"   -> Error: {e}")
        return

    # 1.5. Test GET access first
    print("\n1.5. Texting GET /blog/posts...")
    try:
        res_get = session.get(f"{BASE_URL}/blog/posts")
        print(f"   -> GET Status: {res_get.status_code}")
        if res_get.status_code == 200:
             print(f"   -> GET Success. Count: {len(res_get.json())}")
        else:
             print(f"   -> GET Failed: {res_get.text}")
    except Exception as e:
        print(f"   -> GET Error: {e}")

    # 2. Create Blog Post
    print("\n2. Creating a new Blog Post...")
    post_data = {
        "title": "Automated Test Post",
        "content": "This is a post created by the verification script.",
        "image_url": "https://placehold.co/600x400"
    }
    
    url = f"{BASE_URL}/blog/posts"
    print(f"   -> POSTing to: {url}")
    res_create = session.post(url, json=post_data, headers=headers)
    print(f"   -> Status: {res_create.status_code}")
    if res_create.status_code == 200:
        new_post = res_create.json()
        print(f"   -> Success! Post ID: {new_post['id']}")
    else:
        print(f"   -> Failed: {res_create.text}")
        return

    # 3. Verify it exists in list
    print("\n3. Verifying post appears in list...")
    res_list = session.get(f"{BASE_URL}/blog/posts")
    posts = res_list.json()
    found = any(p['id'] == new_post['id'] for p in posts)
    if found:
        print("   -> Post found in list.")
    else:
        print("   -> Post NOT found in list!")
        return

    # 4. Delete the post
    print("\n4. Deleting the post...")
    res_delete = session.delete(f"{BASE_URL}/blog/posts/{new_post['id']}", headers=headers)
    if res_delete.status_code == 200:
        print("   -> Delete success.")
    else:
        print(f"   -> Delete failed: {res_delete.text}")
        return

    # 5. Verify deletion
    print("\n5. Verifying deletion...")
    res_check = session.get(f"{BASE_URL}/blog/posts")
    posts_after = res_check.json()
    found_after = any(p['id'] == new_post['id'] for p in posts_after)
    if not found_after:
        print("   -> Post is gone. Verification Passed!")
    else:
        print("   -> Post still exists! Verification Failed.")

if __name__ == "__main__":
    run_verification()
