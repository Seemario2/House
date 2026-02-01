from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from typing import List, Dict
import json
import base64
import os
import uuid
from fastapi.staticfiles import StaticFiles

from .models import Base, User, Property, Application, Message, BlogPost, Favorite, Tour
from .auth import get_password_hash, verify_password, create_access_token, decode_token
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Supabase Setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "property-images")

supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY and "your_supabase" not in SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Supabase connected")
    except Exception as e:
        print(f"Failed to connect to Supabase: {e}")
else:
    print("Supabase credentials missing or invalid. Image uploads will fail or fall back to placeholder.")

# Database Setup
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if SQLALCHEMY_DATABASE_URL:
    try:
        # Production (PostgreSQL)
        # Fix for Heroku/Render providing postgres:// instead of postgresql://
        if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
            SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
        # Test connection
        with engine.connect() as connection:
            pass
        print(f"Connected to Database")
    except Exception as e:
        print(f"Database connection failed: {e}. Falling back to SQLite.")
        SQLALCHEMY_DATABASE_URL = "sqlite:///./nexestate.db"
        engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # Local (SQLite)
    SQLALCHEMY_DATABASE_URL = "sqlite:///./nexestate.db"
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
from sqlalchemy.orm import sessionmaker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Oluwanjoba Homes API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
if not os.path.exists("uploads"):
    os.makedirs("uploads")

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)

manager = ConnectionManager()

# --- Auth Endpoints ---

@app.post("/api/auth/signup")
def signup(data: dict, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == data["email"]).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Tenants approved by default
    is_approved = (data["role"] == "tenant")
    
    new_user = User(
        full_name=data["full_name"],
        email=data["email"],
        hashed_password=get_password_hash(data["password"]),
        role=data["role"],
        is_approved=is_approved
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Auto-login: Create token immediately
    token = create_access_token(data={"sub": new_user.email, "role": new_user.role, "id": new_user.id})
    
    return {
        "message": "User created successfully",
        "access_token": token,
        "token_type": "bearer",
        "role": new_user.role,
        "is_approved": new_user.is_approved
    }

@app.post("/api/auth/login")
def login(data: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data["email"]).first()
    if not user or not verify_password(data["password"], user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(data={"sub": user.email, "role": user.role, "id": user.id})
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "role": user.role,
        "is_approved": user.is_approved
    }

# --- Property Endpoints ---

@app.get("/api/properties")
def get_properties(db: Session = Depends(get_db)):
    return db.query(Property).all()

@app.get("/api/properties/{property_id}")
def get_property(property_id: int, db: Session = Depends(get_db)):
    prop = db.query(Property).get(property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop

@app.get("/api/landlord/{landlord_id}/properties")
def get_landlord_properties(landlord_id: int, db: Session = Depends(get_db)):
    return db.query(Property).filter(Property.owner_id == landlord_id).all()

@app.post("/api/properties")
def add_property(data: dict, db: Session = Depends(get_db)):
    # Handle Base64 Image if present
    # Handle Multiple Images
    processed_images = []
    if "images" in data and isinstance(data["images"], list):
        for img_str in data["images"]:
            if img_str.startswith("data:image"):
                try:
                    header, encoded = img_str.split(",", 1)
                    extension = header.split("/")[1].split(";")[0]
                    if extension == "jpeg": extension = "jpg"
                    
                    filename = f"{uuid.uuid4()}.{extension}"
                    
                    if supabase:
                        image_data = base64.b64decode(encoded)
                        supabase.storage.from_(SUPABASE_BUCKET).upload(
                            path=filename,
                            file=image_data,
                            file_options={"content-type": header.split(":")[1].split(";")[0]}
                        )
                        public_url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(filename)
                        processed_images.append(public_url)
                    else:
                        if not os.path.exists("uploads"):
                            os.makedirs("uploads")
                        file_path = os.path.join("uploads", filename)
                        with open(file_path, "wb") as f:
                            f.write(base64.b64decode(encoded))
                        processed_images.append(f"http://localhost:8000/uploads/{filename}")
                except Exception as e:
                    print(f"Image save error: {e}")
                    # Skip failed image
            else:
                # Assume it's already a URL
                processed_images.append(img_str)
    
    # Handle Legacy Single Image (if provided as base64 but valid images list might already cover it)
    # If images were processed, use the first one as main image_url if not set
    if processed_images:
        data["image_url"] = processed_images[0]
        data["images"] = processed_images
    elif "image_url" in data and data["image_url"] and data["image_url"].startswith("data:image"):
        # Fallback for old single image upload behavior
        try:
            # ... (Same logic as before for single image)
            header, encoded = data["image_url"].split(",", 1)
            extension = header.split("/")[1].split(";")[0]
            if extension == "jpeg": extension = "jpg"
            filename = f"{uuid.uuid4()}.{extension}"
            
            if supabase:
                image_data = base64.b64decode(encoded)
                supabase.storage.from_(SUPABASE_BUCKET).upload(path=filename, file=image_data, file_options={"content-type": header.split(":")[1].split(";")[0]})
                data["image_url"] = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(filename)
            else:
                if not os.path.exists("uploads"): os.makedirs("uploads")
                file_path = os.path.join("uploads", filename)
                with open(file_path, "wb") as f: f.write(base64.b64decode(encoded))
                data["image_url"] = f"http://localhost:8000/uploads/{filename}"
        except Exception as e:
             data["image_url"] = "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800"
    elif "image_url" not in data or not data["image_url"]:
         data["image_url"] = "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800"

    if "images" not in data: # ensure field exists for model
        data["images"] = []

    new_prop_data = {
        "title": data.get("title"),
        "description": data.get("description"),
        "price": data.get("price"),
        "location": data.get("location"),
        "type": data.get("type"),
        "bedrooms": data.get("bedrooms"),
        "bathrooms": data.get("bathrooms"),
        "sqft": data.get("sqft"),
        "sqft": data.get("sqft"),
        "image_url": data.get("image_url"),
        "images": data.get("images", []),
        "owner_id": data.get("owner_id")
    }

    # Filter out None values to allow defaults if any (though here we want explicit)
    # or just pass new_prop_data directly since we constructed it manually.
    
    new_prop = Property(**new_prop_data)
    db.add(new_prop)
    db.commit()
    db.refresh(new_prop)
    return new_prop

# --- Application Endpoints ---

@app.get("/api/landlord/{landlord_id}/applications")
def get_landlord_applications(landlord_id: int, db: Session = Depends(get_db)):
    # Fetch applications for properties owned by this landlord
    apps = db.query(Application).join(Property).filter(Property.owner_id == landlord_id).all()
    
    # Simple manual serialization to include property/tenant info for the dashboard
    result = []
    for app in apps:
        result.append({
            "id": app.id,
            "status": app.status,
            "applied_at": app.applied_at.isoformat(),
            "property_title": app.property.title,
            "tenant_name": app.tenant.full_name,
            "tenant_email": app.tenant.email
        })
    return result

@app.post("/api/applications")
async def apply_to_property(data: dict, db: Session = Depends(get_db)):
    new_app = Application(
        property_id=data["property_id"],
        tenant_id=data["tenant_id"]
    )
    db.add(new_app)
    db.commit()
    
    # Notify Landlord via WebSocket (Simplified)
    prop = db.query(Property).get(data["property_id"])
    if prop:
        await manager.send_personal_message(
            json.dumps({"type": "notification", "message": f"New application for {prop.title}"}),
            prop.owner_id
        )
    return {"message": "Application submitted"}

@app.put("/api/applications/{app_id}/status")
async def update_application_status(app_id: int, data: dict, db: Session = Depends(get_db)):
    app = db.query(Application).get(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    app.status = data["status"]
    db.commit()

    # Notify Tenant
    await manager.send_personal_message(
        json.dumps({
            "type": "application_update",
            "app_id": app.id,
            "status": app.status,
            "property_title": app.property.title
        }),
        app.tenant_id
    )

    return {"message": f"Application {data['status']}"}

@app.get("/api/tenant/{tenant_id}/applications")
def get_tenant_applications(tenant_id: int, db: Session = Depends(get_db)):
    apps = db.query(Application).filter(Application.tenant_id == tenant_id).all()
    result = []
    for app in apps:
        result.append({
            "id": app.id,
            "status": app.status,
            "applied_at": app.applied_at.isoformat(),
            "property": {
                "id": app.property.id,
                "title": app.property.title,
                "location": app.property.location,
                "image_url": app.property.image_url,
                "price": app.property.price,
                "owner_id": app.property.owner_id
            }
        })
    return result

# --- Real-Time Chat ---

@app.websocket("/ws/chat/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            # Route message to recipient
            await manager.send_personal_message(
                json.dumps({
                    "type": "chat",
                    "sender_id": user_id,
                    "content": message_data["content"]
                }),
                message_data["receiver_id"]
            )
    except WebSocketDisconnect:
        manager.disconnect(user_id)

# --- Blog Endpoints ---

# --- Auth Dependency ---
from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    email: str = payload.get("sub")
    if email is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- Blog Endpoints ---

@app.get("/api/blog/posts")
def get_blog_posts(db: Session = Depends(get_db)):
    return db.query(BlogPost).order_by(BlogPost.created_at.desc()).all()

@app.get("/api/blog/posts/{post_id}")
def get_blog_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(BlogPost).get(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post

@app.post("/api/blog/posts")
def create_blog_post(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Basic validation or mapping
    new_post = BlogPost(
        title=data["title"],
        content=data["content"],
        image_url=data.get("image_url"),
        author_id=current_user.id
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    return new_post

@app.delete("/api/blog/posts/{post_id}")
def delete_blog_post(post_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    post = db.query(BlogPost).get(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    db.delete(post)
    db.commit()
    return {"message": "Post deleted successfully"}

# --- Favorites Endpoints ---

@app.get("/api/favorites")
def get_favorites(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Return list of properties favorited by this user
    favorites = db.query(Favorite).filter(Favorite.user_id == current_user.id).all()
    # Eager load properties or just return IDs. Better to return property objects or a joined query
    # For simplicity, let's fetch the properties
    valid_favorites = []
    for fav in favorites:
        if fav.property:
            valid_favorites.append(fav.property)
    return valid_favorites

@app.post("/api/favorites/{property_id}")
def add_favorite(property_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if exists
    existing = db.query(Favorite).filter(
        Favorite.user_id == current_user.id, 
        Favorite.property_id == property_id
    ).first()
    
    if existing:
        return {"message": "Already favorited"}
    
    # Check if property exists
    prop = db.query(Property).get(property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    new_fav = Favorite(user_id=current_user.id, property_id=property_id)
    db.add(new_fav)
    db.commit()
    return {"message": "Added to favorites"}

@app.delete("/api/favorites/{property_id}")
def remove_favorite(property_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    fav = db.query(Favorite).filter(
        Favorite.user_id == current_user.id, 
        Favorite.property_id == property_id
    ).first()
    
    if not fav:
        raise HTTPException(status_code=404, detail="Favorite not found")
    
    db.delete(fav)
    db.commit()
    return {"message": "Removed from favorites"}

# --- Tour Endpoints ---

@app.post("/api/tours")
def request_tour(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not data.get("property_id") or not data.get("tour_date"):
        raise HTTPException(status_code=400, detail="Missing property_id or tour_date")
    
    prop = db.query(Property).get(data["property_id"])
    if not prop: raise HTTPException(status_code=404, detail="Property not found")

    try:
        tour_date = datetime.fromisoformat(data["tour_date"].replace('Z', '+00:00'))
    except:
        tour_date = datetime.utcnow()

    new_tour = Tour(property_id=data["property_id"], user_id=current_user.id, tour_date=tour_date)
    db.add(new_tour)
    db.commit()
    
    return {"message": "Tour request submitted successfully"}

# --- File Uploads ---
import shutil
import os
from fastapi import File, UploadFile

# Ensure uploads directory exists
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Mount uploads directory to serve images
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.post("/api/users/avatar")
async def upload_avatar(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique filename
    file_ext = file.filename.split(".")[-1]
    filename = f"user_{current_user.id}_{uuid.uuid4()}.{file_ext}"
    file_path = f"{UPLOAD_DIR}/{filename}"
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Update user profile
    # URL should be relative or absolute based on deployment. 
    # For simplicity, we return relative path from root, client handles domain.
    avatar_url = f"/uploads/{filename}"
    
    current_user.avatar_url = avatar_url
    db.commit()
    
    return {"avatar_url": avatar_url}

# --- Analytics ---

@app.get("/api/analytics/landlord/{landlord_id}")
def get_landlord_analytics(landlord_id: int, db: Session = Depends(get_db)):
    # Placeholder for complex analytics logic
    return {
        "total_applications": 45,
        "views": [120, 450, 300, 500, 600, 400, 550],
        "response_time": "2.4h"
    }

# Mount static files
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")
app.mount("/dashboards", StaticFiles(directory="dashboards"), name="dashboards")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

from fastapi.responses import FileResponse

# Serve HTML Pages
@app.get("/")
async def read_index():
    return FileResponse('index.html')

@app.get("/{page}.html")
async def read_html(page: str):
    return FileResponse(f'{page}.html')

@app.get("/{page}")
async def read_root_page(page: str):
    # Fallback to check if a matching html file exists if extension is missing
    if os.path.exists(f"{page}.html"):
         return FileResponse(f"{page}.html")
    raise HTTPException(status_code=404, detail="Page not found")
