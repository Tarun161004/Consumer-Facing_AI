import sys
import os
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Ensure the project root is on sys.path so we can import brain_engine, etc.
PROJECT_ROOT = str(Path(__file__).parent.parent.absolute())
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Load .env from project root
load_dotenv(dotenv_path=os.path.join(PROJECT_ROOT, ".env"))

from backend.firebase_config import init_firebase
from backend.routes import auth, chat, finance, chat_history
from backend.routes import zerodha_auth, upload

# --- Initialize Firebase on import ---
init_firebase()

# --- Rate Limiter ---
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

# --- Lifespan (replaces deprecated on_event) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    # Startup logic here (if needed)
    yield
    # Shutdown logic here (if needed)


# --- Create FastAPI App ---
app = FastAPI(
    title="Fi AI Agent API",
    description="AI-powered personal finance assistant backed by Zerodha Kite & Firebase",
    version="1.0.0",
    lifespan=lifespan,
)

# Attach limiter to app state (required by slowapi)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CORS (from environment variable) ---
allowed_origins_str = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Security Headers Middleware ---
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    # Enable HSTS in production (uncomment when using HTTPS):
    # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# --- Register Routers ---
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(finance.router)
app.include_router(chat_history.router)
app.include_router(zerodha_auth.router)
app.include_router(upload.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Fi AI Agent API is running 🚀"}


