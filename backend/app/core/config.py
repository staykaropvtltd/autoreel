from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Auto-Reel Studio"
    environment: str = "development"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    frontend_url: str = "http://localhost:5173"
    analysis_max_workers: int = Field(default=2, ge=1, le=8)
    analysis_job_timeout_seconds: int = Field(default=900, ge=1, le=86400)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
