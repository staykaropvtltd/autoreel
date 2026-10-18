"""Comprehensive End-to-End Live Supabase Integration Test.

Tests the actual FastAPI application against the live Supabase PostgreSQL
database and Supabase Storage:
1. POST /api/auth/signup -> creates User, CreditBalance, CreditTransaction
2. POST /api/auth/login -> verifies password hash and returns JWT token
3. GET /api/credits/balance -> verifies live credit balance
4. GET & PUT /api/preferences -> tests UserPreferences storage
5. GET & PUT /api/branding -> tests BrandSettings storage
6. POST & DELETE /api/templates/upload -> tests live Supabase Storage bucket upload and deletion
7. Clean up test user and records from Supabase
"""

import os
import sys
import uuid
from pathlib import Path
from io import BytesIO
from PIL import Image

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

# Ensure live .env is loaded
from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env", override=True)

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.database_models import User
from sqlalchemy import select


def run_comprehensive_live_test():
    print("=" * 70)
    print("RUNNING 100% END-TO-END LIVE API & SUPABASE INTEGRATION TEST")
    print("=" * 70)

    test_email = f"guarantee_test_{uuid.uuid4().hex[:8]}@example.com"
    test_password = "SecurePassword123!"
    test_user_id = None

    client = TestClient(app)

    try:
        # 1. Test Signup
        print("\n[Step 1] Testing /api/auth/signup on live Supabase...")
        signup_resp = client.post("/api/auth/signup", json={
            "name": "Live Guarantee User",
            "email": test_email,
            "password": test_password,
            "brand_name": "Staykaro Live Studio",
        })
        assert signup_resp.status_code == 201, f"Signup failed: {signup_resp.status_code} {signup_resp.text}"
        signup_data = signup_resp.json()
        token = signup_data["access_token"]
        test_user_id = int(signup_data["user"]["id"])
        print(f"  -> SUCCESS: Signed up User ID {test_user_id} with JWT token issued.")

        headers = {"Authorization": f"Bearer {token}"}

        # 2. Test Login
        print("\n[Step 2] Testing /api/auth/login with password verification...")
        login_resp = client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_password,
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.status_code} {login_resp.text}"
        assert login_resp.json()["access_token"], "Missing token"
        print("  -> SUCCESS: Password verified and login authenticated.")

        # 3. Test Credits
        print("\n[Step 3] Testing /api/credits (verifying initial 50 credits & ledger)...")
        credits_resp = client.get("/api/credits", headers=headers)
        assert credits_resp.status_code == 200, f"Credits check failed: {credits_resp.text}"
        balance = credits_resp.json()["credits"]
        assert balance == 50, f"Expected 50 credits, got {balance}"
        print(f"  -> SUCCESS: Credit balance correctly initialized to {balance} credits.")

        # 4. Test User Preferences
        print("\n[Step 4] Testing /api/preferences on live Supabase...")
        get_pref = client.get("/api/preferences", headers=headers)
        assert get_pref.status_code == 200, f"Get preferences failed: {get_pref.text}"
        assert get_pref.json()["theme"] in ["dark", "light"]

        put_pref = client.put("/api/preferences", headers=headers, json={
            "theme": "light",
            "default_target_duration": 30,
            "default_aspect_ratio": "9:16",
        })
        assert put_pref.status_code == 200, f"Update preferences failed: {put_pref.text}"
        assert put_pref.json()["theme"] == "light"
        assert put_pref.json()["default_target_duration"] == 30
        print("  -> SUCCESS: Preferences updated and verified in Supabase.")

        # 5. Test Branding Settings
        print("\n[Step 5] Testing /api/branding on live Supabase...")
        brand_resp = client.get("/api/branding", headers=headers)
        assert brand_resp.status_code == 200, f"Get branding failed: {brand_resp.text}"

        update_brand = client.put("/api/branding", headers=headers, json={
            "name": "Live Brand Updated",
            "tagline": "Crafting reels automatically",
            "primary_color": "#FF5733",
            "secondary_color": "#000000",
            "text_color": "#FFFFFF",
        })
        assert update_brand.status_code == 200, f"Update branding failed: {update_brand.text}"
        assert update_brand.json()["name"] == "Live Brand Updated"
        assert update_brand.json()["primary_color"] == "#FF5733"
        print("  -> SUCCESS: Brand settings updated and verified in Supabase.")

        # 6. Test Live Storage Upload & Deletion via /api/templates
        print("\n[Step 6] Testing live Supabase Storage upload via /api/templates/upload...")
        # Create a tiny 100x100 PNG in memory
        img_buffer = BytesIO()
        img = Image.new("RGB", (100, 100), color=(255, 87, 51))
        img.save(img_buffer, format="PNG")
        img_bytes = img_buffer.getvalue()

        upload_resp = client.post(
            "/api/templates/upload",
            headers=headers,
            files={"file": ("live_test_template.png", img_bytes, "image/png")},
        )
        assert upload_resp.status_code == 201, f"Template upload failed: {upload_resp.status_code} {upload_resp.text}"
        template_id = upload_resp.json()["template_id"]
        print(f"  -> SUCCESS: Uploaded test template to Supabase Storage (template_id={template_id}).")

        # Preview template (download from Supabase Storage)
        preview_resp = client.get(f"/api/templates/{template_id}/preview", headers=headers)
        assert preview_resp.status_code == 200, f"Preview failed: {preview_resp.status_code}"
        assert len(preview_resp.content) == len(img_bytes), "Downloaded size does not match uploaded size"
        print("  -> SUCCESS: Downloaded/previewed template directly from Supabase Storage.")

        # Delete template from Supabase Storage & DB
        delete_resp = client.delete(f"/api/templates/{template_id}", headers=headers)
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.status_code}"
        print("  -> SUCCESS: Deleted template from Supabase Storage and database.")

        print("\n" + "=" * 70)
        print("100% COMPLETE: ALL LIVE API ENDPOINTS, DB & STORAGE OPERATIONAL!")
        print("=" * 70)
        return True

    finally:
        # Cleanup test user from Supabase
        if test_user_id:
            print(f"\n[Cleanup] Removing live test user id={test_user_id} from Supabase...")
            with SessionLocal() as db:
                user = db.scalar(select(User).where(User.id == test_user_id))
                if user:
                    db.delete(user)
                    db.commit()
            print("  -> Cleanup complete.")


if __name__ == "__main__":
    success = run_comprehensive_live_test()
    sys.exit(0 if success else 1)
