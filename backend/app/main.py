
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
)
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)

# Allow the configured frontend origin and both common local Vite origins.
allowed_origins = list(
    dict.fromkeys(
        [
            settings.frontend_url,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
