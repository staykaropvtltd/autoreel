
from app.core.database import engine
from app.models.database_models import Base

def init_database():
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_database()
