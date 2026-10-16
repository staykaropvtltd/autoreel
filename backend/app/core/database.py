
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)

load_dotenv(os.path.join(BACKEND_DIR, ".env"), override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing from backend/.env")

# Validate the URL before creating the engine
parsed_url = make_url(DATABASE_URL)

if parsed_url.drivername in {"postgres", "postgresql"}:
    parsed_url = parsed_url.set(drivername="postgresql+psycopg")

if parsed_url.drivername.startswith("sqlite"):
    engine = create_engine(parsed_url)
else:
    # Supabase PostgreSQL connection
    engine = create_engine(
        parsed_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        connect_args={"connect_timeout": 10},
    )

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


def test_database_connection() -> bool:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return True
