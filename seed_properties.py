
import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import Base, Property

# Get DB URL from env or fallback to local sqlite
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if SQLALCHEMY_DATABASE_URL:
    # Fix for Heroku/Render providing postgres:// instead of postgresql://
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
    print(f"Connecting to production DB: {SQLALCHEMY_DATABASE_URL.split('@')[1] if '@' in SQLALCHEMY_DATABASE_URL else '...'}")
else:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./nexestate.db"
    print("Connecting to local SQLite DB")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Initial Properties Data
properties = [
    {
        "title": "Skyline Modern Villa",
        "description": "Luxurious 5-bedroom villa with panoramic city views, infinity pool, and smart home automation. Located in the exclusive Banana Island neighborhood.",
        "price": 3500000,
        "location": "Banana Island, Lagos",
        "type": "Villa",
        "bedrooms": 5,
        "bathrooms": 6,
        "sqft": 4500,
        "image_url": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800",
        "images": [
            "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800",
            "https://images.unsplash.com/photo-1613545325278-f24b0cae1224?auto=format&fit=crop&w=800",
            "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800",
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800"
        ],
        "owner_id": 1 # Assumes admin/landlord with ID 1 exists, or nullable?
    },
    {
        "title": "Cozy Lekki Apartment",
        "description": "Modern 2-bedroom apartment perfect for young professionals. Features 24/7 power, security, and proximity to major shopping malls.",
        "price": 800000,
        "location": "Lekki Phase 1, Lagos",
        "type": "Apartment",
        "bedrooms": 2,
        "bathrooms": 2,
        "sqft": 1200,
        "image_url": "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800",
        "images": [
            "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800",
            "https://images.unsplash.com/photo-1484154218962-a1c19b5d29b2?auto=format&fit=crop&w=800",
            "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800"
        ],
        "owner_id": 1
    },
    {
        "title": "Victoria Island Executive Suite",
        "description": "Premium 3-bedroom flat in the heart of the business district. Includes gym access, swimming pool, and underground parking.",
        "price": 1500000,
        "location": "Victoria Island, Lagos",
        "type": "Flat",
        "bedrooms": 3,
        "bathrooms": 3,
        "sqft": 1800,
        "image_url": "https://images.unsplash.com/photo-1484154218962-a1c19b5d29b2?auto=format&fit=crop&w=800",
        "images": [
            "https://images.unsplash.com/photo-1484154218962-a1c19b5d29b2?auto=format&fit=crop&w=800",
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800",
            "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=800"
        ],
        "owner_id": 1
    }
]

def seed_properties():
    try:
        # Check if we have properties
        count = db.query(Property).count()
        if count > 0:
            print(f"Database already has {count} properties. Skipping seed.")
            return

        # Ensure we have a user (landlord) to own these properties
        from backend.models import User
        from backend.auth import get_password_hash
        
        owner = db.query(User).filter(User.role == "landlord").first()
        if not owner:
            print("No landlord found. Creating default landlord...")
            owner = User(
                full_name="Default Landlord",
                email="landlord@example.com",
                hashed_password=get_password_hash("password123"),
                role="landlord",
                is_approved=True
            )
            db.add(owner)
            db.commit()
            db.refresh(owner)
            print(f"Created landlord with ID: {owner.id}")
        else:
            print(f"Using existing landlord ID: {owner.id}")

        print("Seeding properties...")
        for prop_data in properties:
            p_data = prop_data.copy()
            if "owner_id" in p_data:
                del p_data["owner_id"]
            
            new_prop = Property(**p_data)
            new_prop.owner_id = owner.id
            
            db.add(new_prop)
        
        db.commit()
        print("Successfully added sample properties!")

    except Exception as e:
        print(f"Error seeding properties: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_properties()
