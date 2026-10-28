"""Purge any remaining dummy/test records from Supabase."""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env", override=True)

from sqlalchemy import text
from app.core.database import SessionLocal, engine

tables = [
    'users',
    'credit_balances',
    'credit_transactions',
    'reel_history',
    'reel_jobs',
    'brand_settings',
    'user_preferences',
    'templates',
    'uploaded_assets',
    'editor_projects',
]

def purge():
    print("Checking live database state on Supabase...")
    with engine.connect() as conn:
        print("\nCurrent row counts:")
        for t in tables:
            count = conn.execute(text(f"SELECT COUNT(*) FROM public.{t}")).scalar()
            print(f"  {t}: {count}")

    with SessionLocal() as db:
        res = db.execute(text(
            "DELETE FROM public.users "
            "WHERE email LIKE '%test%' OR email LIKE '%dummy%' OR email LIKE 'guarantee%'"
        ))
        db.commit()
        print(f"\nPurged test users (and all cascading rows): {res.rowcount}")

    with engine.connect() as conn:
        print("\nFinal verified clean row counts:")
        for t in tables:
            count = conn.execute(text(f"SELECT COUNT(*) FROM public.{t}")).scalar()
            print(f"  {t}: {count}")

if __name__ == "__main__":
    purge()
