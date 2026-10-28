
from sqlalchemy import text
from app.core.database import engine
from app.models.database_models import Base

def init_database():
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name == "postgresql":
        with engine.connect() as conn:
            for table in Base.metadata.tables.values():
                conn.execute(text(f"ALTER TABLE IF EXISTS public.{table.name} ENABLE ROW LEVEL SECURITY;"))
            conn.commit()
    print("Database tables created and Row Level Security verified successfully!")

if __name__ == "__main__":
    init_database()
