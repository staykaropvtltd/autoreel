from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analysis, branding, health, music, reels, thumbnails, videos, templates
from app.core.config import get_settings

settings = get_settings()


app = FastAPI(title=settings.app_name)
app.include_router(
    branding.router,
    prefix="/api",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
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
