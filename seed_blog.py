from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import Base, BlogPost
from datetime import datetime

# Setup DB connection
SQLALCHEMY_DATABASE_URL = "sqlite:///./nexestate.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine) # Ensure tables exist
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Blog Posts Data
posts = [
    {
        "title": "Top 10 Tips for First-Time Renters",
        "content": "Navigating the rental market can be overwhelming. Here are the essential tips you need to know before signing your first lease...",
        "image_url": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800",
        "created_at": datetime(2025, 10, 12)
    },
    {
        "title": "How to Stage Your Property for Higher Rent",
        "content": "Learn the secrets of professional stagers to make your property irresistible to high-quality tenants...",
        "image_url": "https://images.unsplash.com/photo-1554469384-e58fac16e23a?auto=format&fit=crop&w=800",
        "created_at": datetime(2025, 9, 28)
    },
    {
        "title": "Understanding Tenant Rights in Nigeria",
        "content": "A comprehensive guide to the legal rights and protections available to tenants under current housing laws...",
        "image_url": "https://images.unsplash.com/photo-1484154218962-a1c002085d2f?auto=format&fit=crop&w=800",
        "created_at": datetime(2025, 9, 15)
    }
]

print("Seeding blog posts...")
try:
    for post_data in posts:
        # Check if exists (simple check by title)
        existing = db.query(BlogPost).filter(BlogPost.title == post_data["title"]).first()
        if not existing:
            new_post = BlogPost(**post_data)
            db.add(new_post)
            print(f"Added: {post_data['title']}")
        else:
            print(f"Skipped (exists): {post_data['title']}")
    
    db.commit()
    print("Seeding complete!")
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
