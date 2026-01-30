import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from models import User

def check_db(db_path):
    print(f"\n--- Checking database: {db_path} ---")
    if not os.path.exists(db_path):
        print("File does not exist.")
        return

    db_url = f"sqlite:///{db_path}"
    engine = create_engine(db_url)
    
    try:
        insp = inspect(engine)
        tables = insp.get_table_names()
        print(f"Tables found: {tables}")
        
        if 'users' in tables:
            SessionLocal = sessionmaker(bind=engine)
            db = SessionLocal()
            try:
                users = db.query(User).all()
                print(f"User count: {len(users)}")
                for user in users:
                    print(f" - ID: {user.id}, Email: {user.email}, Role: {user.role}")
            except Exception as e:
                print(f"Error querying users: {e}")
            finally:
                db.close()
        else:
            print("Table 'users' NOT found.")
            
    except Exception as e:
        print(f"Error inspecting DB: {e}")

# Paths to check
backend_db = os.path.abspath("nexestate.db")
root_db = os.path.abspath("../nexestate.db")

check_db(backend_db)
check_db(root_db)
