import sqlite3
import os

db_path = os.path.abspath("../nexestate.db")
print(f"Connecting to: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if column exists first to be safe
    cursor.execute("PRAGMA table_info(users)")
    columns = [info[1] for info in cursor.fetchall()]
    
    if "avatar_url" not in columns:
        print("Adding missing column 'avatar_url' to 'users' table...")
        cursor.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
        conn.commit()
        print("Column added successfully.")
    else:
        print("Column 'avatar_url' already exists.")
        
    conn.close()
    
except Exception as e:
    print(f"Error patching DB: {e}")
