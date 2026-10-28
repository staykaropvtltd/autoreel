from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router

from app.api import (
    analysis,
    branding,
    health,
    music,
    reels,
    thumbnails,
    videos,
    templates,
    credits,
    editor_projects,
    preferences,
)
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)

# Allow the configured frontend origin and common local Vite dev origins.
allowed_origins = list(
    dict.fromkeys(
        [
            settings.frontend_url,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5175",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(videos.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(reels.router, prefix="/api")
app.include_router(thumbnails.router, prefix="/api")
app.include_router(music.router, prefix="/api")
app.include_router(branding.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(credits.router, prefix="/api")
app.include_router(editor_projects.router, prefix="/api")
app.include_router(preferences.router, prefix="/api")
app.include_router(auth_router)
