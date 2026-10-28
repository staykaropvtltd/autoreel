"""Manually verify the configured PostgreSQL connection.

Run from the backend directory with:
    python -m app.core.check_db_connection
"""

from app.core.database import test_database_connection


if __name__ == "__main__" and test_database_connection():
    print("Supabase PostgreSQL connection successful!")
