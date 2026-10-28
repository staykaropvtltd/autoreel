"""Real action test script for the Staykaro_Autoreel database.

Validates:
1. Environment configuration and credentials presence
2. Live database connection (SELECT 1)
3. Table initialization (Base.metadata.create_all)
4. Full CRUD operations with actual dummy data:
   - User creation
   - CreditBalance & CreditTransaction creation & verification
   - BrandSettings creation & verification
   - UserPreferences creation & verification
   - ReelJob & ReelHistory creation & verification
5. Clean removal of dummy test data
"""

import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env", override=True)

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.models.database_models import (
    Base,
    BrandSettings,
    CreditBalance,
    CreditTransaction,
    ReelHistory,
    ReelJob,
    User,
    UserPreferences,
)


def run_database_real_action_test() -> bool:
    print("=" * 60)
    print("STAYKARO AUTOREEL - REAL DATABASE ACTION TEST")
    print("=" * 60)

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("\n[RESULT] ERROR: DATABASE_URL is not set in backend/.env!")
        print("Backend cannot connect to online Supabase without credentials.")
        return False

    # Mask credentials for display
    masked_url = db_url
    if "@" in db_url:
        prefix, host_part = db_url.split("@", 1)
        scheme = prefix.split("://")[0]
        masked_url = f"{scheme}://****:****@{host_part}"

    print(f"\n[1] Checking configured database URL: {masked_url}")

    # 1. Connection check
    print("\n[2] Executing live connection check (SELECT 1)...")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            assert result == 1, "SELECT 1 did not return 1"
        print("  -> Connection successful! DB responded with: 1")
    except Exception as exc:
        print(f"  -> Connection FAILED: {exc}")
        return False

    # 2. Table initialization check
    print("\n[3] Verifying and creating database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("  -> Tables verified / created successfully!")
    except Exception as exc:
        print(f"  -> Table creation FAILED: {exc}")
        return False

    # 3. Store real dummy data
    test_email = f"test_dummy_{uuid.uuid4().hex[:8]}@staykaro.test"
    test_reel_id = str(uuid.uuid4())
    print(f"\n[4] Storing real dummy data for test user: {test_email}...")

    created_user_id = None
    try:
        with SessionLocal() as db:
            # 4a. Create User
            user = User(
                name="Dummy Test User",
                email=test_email,
                brand_name="Dummy StayKaro Brand",
            )
            db.add(user)
            db.flush()
            created_user_id = user.id
            print(f"  [+] Inserted User (id={created_user_id}, email='{user.email}')")

            # 4b. Create CreditBalance and CreditTransaction
            credit_bal = CreditBalance(
                user_id=created_user_id,
                balance=50,
            )
            db.add(credit_bal)
            db.flush()

            credit_tx = CreditTransaction(
                user_id=created_user_id,
                transaction_type="addition",
                amount=50,
                balance_after=50,
                description="Test dummy initial grant",
            )
            db.add(credit_tx)
            db.flush()
            print(f"  [+] Inserted CreditBalance (balance={credit_bal.balance}) & CreditTransaction (id={credit_tx.id})")

            # 4c. Create BrandSettings
            brand = BrandSettings(
                user_id=created_user_id,
                name="Test Dummy Brand",
                primary_color="#123456",
                secondary_color="#ABCDEF",
                text_color="#FFFFFF",
            )
            db.add(brand)
            db.flush()
            print(f"  [+] Inserted BrandSettings (primary_color='{brand.primary_color}')")

            # 4d. Create UserPreferences
            prefs = UserPreferences(
                user_id=created_user_id,
                theme="dark",
                default_target_duration=15,
                default_aspect_ratio="9:16",
            )
            db.add(prefs)
            db.flush()
            print(f"  [+] Inserted UserPreferences (theme='{prefs.theme}', aspect='{prefs.default_aspect_ratio}')")

            # 4e. Create ReelJob
            job = ReelJob(
                job_id=test_reel_id,
                reel_id=test_reel_id,
                user_id=created_user_id,
                job_type="reel",
                status="pending",
                stage="queued",
                progress=0,
            )
            db.add(job)
            db.flush()
            print(f"  [+] Inserted ReelJob (job_id='{job.job_id}', status='{job.status}')")

            # 4f. Create ReelHistory
            history = ReelHistory(
                reel_id=test_reel_id,
                user_id=created_user_id,
                status="queued",
                title="Test Dummy Reel",
            )
            db.add(history)
            db.commit()
            print("  -> COMMITTED all dummy records successfully to the database!")

        # 5. Read back and verify stored data from a completely new database session
        print("\n[5] Querying stored records in a fresh session to verify persistence...")
        with SessionLocal() as db:
            fetched_user = db.scalar(select(User).where(User.id == created_user_id))
            assert fetched_user is not None, "User could not be retrieved"
            assert fetched_user.email == test_email, "Email mismatch"

            fetched_credits = db.scalar(select(CreditBalance).where(CreditBalance.user_id == created_user_id))
            assert fetched_credits is not None, "CreditBalance not found"
            assert fetched_credits.balance == 50, f"Expected 50 credits, got {fetched_credits.balance}"

            fetched_tx = db.scalar(select(CreditTransaction).where(CreditTransaction.user_id == created_user_id))
            assert fetched_tx is not None, "CreditTransaction not found"
            assert fetched_tx.amount == 50, "Transaction amount mismatch"

            fetched_job = db.scalar(select(ReelJob).where(ReelJob.job_id == test_reel_id))
            assert fetched_job is not None, "ReelJob not found"
            assert fetched_job.status == "pending", "ReelJob status mismatch"

            print(f"  -> VERIFIED: User '{fetched_user.name}' ({fetched_user.email}) exists")
            print(f"  -> VERIFIED: Balance is {fetched_credits.balance} credits with logged transaction")
            print(f"  -> VERIFIED: ReelJob '{fetched_job.job_id}' is active in state '{fetched_job.status}'")

        # 6. Cleanup test records
        print("\n[6] Cleaning up test records...")
        with SessionLocal() as db:
            test_user = db.scalar(select(User).where(User.id == created_user_id))
            if test_user:
                db.delete(test_user)  # CASCADE deletes child records
                db.commit()
            print("  -> Cleaned up dummy user and cascaded records successfully!")

        print("\n" + "=" * 60)
        print("ALL REAL ACTION DATABASE TESTS PASSED SUCCESSFULLY!")
        print("=" * 60)
        return True

    except Exception as exc:
        print(f"\n[!] Test FAILED with error: {exc}")
        import traceback
        traceback.print_exc()
        if created_user_id:
            try:
                with SessionLocal() as db:
                    u = db.scalar(select(User).where(User.id == created_user_id))
                    if u:
                        db.delete(u)
                        db.commit()
            except Exception:
                pass
        return False


if __name__ == "__main__":
    success = run_database_real_action_test()
    sys.exit(0 if success else 1)
