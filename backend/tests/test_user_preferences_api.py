import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth_dependencies import get_current_user, get_db
from app.main import app
from app.models.database_models import Base, BrandSettings, MusicTrack, Template, User, UserPreferences


@pytest.fixture
def preference_client(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'preferences.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add_all([
            User(id=101, email="a@example.test", name="A"),
            User(id=202, email="b@example.test", name="B"),
        ])
        db.add_all([
            MusicTrack(id=11, owner_user_id=101, title="Private A", original_filename="a.mp3",
                       storage_path="101/a.mp3", file_format="mp3", file_size_bytes=1, is_builtin=False),
            MusicTrack(id=22, owner_user_id=202, title="Private B", original_filename="b.mp3",
                       storage_path="202/b.mp3", file_format="mp3", file_size_bytes=1, is_builtin=False),
        ])
        db.add_all([
            Template(id="11111111-1111-4111-8111-111111111111", user_id=101, original_filename="a.png", storage_path="101/a.png",
                     content_type="image/png", file_size_bytes=1),
            Template(id="22222222-2222-4222-8222-222222222222", user_id=202, original_filename="b.png", storage_path="202/b.png",
                     content_type="image/png", file_size_bytes=1),
        ])
        db.commit()

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    identity = {"id": 101}
    def override_user(db=Depends(get_db)):
        return db.get(User, identity["id"])
    app.dependency_overrides[get_current_user] = override_user
    with TestClient(app) as client:
        yield client, identity, sessions
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_preferences_require_authentication(preference_client):
    client, _identity, _sessions = preference_client
    app.dependency_overrides.pop(get_current_user)
    response = client.get("/api/preferences")
    assert response.status_code == 401


def test_defaults_and_updates_persist_across_sessions(preference_client):
    client, _identity, sessions = preference_client
    defaults = client.get("/api/preferences")
    assert defaults.status_code == 200
    assert defaults.json()["theme"] == "dark"
    assert defaults.json()["default_target_duration"] == 15
    assert defaults.json()["auto_save"] is True

    updated = client.put("/api/preferences", json={
        "theme": "light", "default_target_duration": 30,
        "preferred_music_track_id": "11", "preferred_template_id": "11111111-1111-4111-8111-111111111111",
        "compact_layout": True,
    })
    assert updated.status_code == 200
    with sessions() as db:
        stored = db.get(UserPreferences, 101)
        assert stored is not None
        assert stored.theme == "light"
        assert stored.default_target_duration == 30
        assert stored.preferred_music_track_id == "11"
        assert stored.preferred_template_id == "11111111-1111-4111-8111-111111111111"
        assert stored.compact_layout is True


def test_users_get_separate_preferences(preference_client):
    client, identity, sessions = preference_client
    client.put("/api/preferences", json={"theme": "light"})
    identity["id"] = 202
    other = client.get("/api/preferences")
    assert other.status_code == 200
    assert other.json()["theme"] == "dark"
    identity["id"] = 101
    assert client.get("/api/preferences").json()["theme"] == "light"
    with sessions() as db:
        assert db.query(UserPreferences).count() == 2


@pytest.mark.parametrize("payload", [
    {"theme": "system"},
    {"default_target_duration": 120},
    {"default_aspect_ratio": "3:2"},
    {"theme": None},
    {"preferred_template_id": "not-a-uuid"},
    {"admin": True},
])
def test_invalid_preference_updates_are_rejected(preference_client, payload):
    client, _identity, _sessions = preference_client
    assert client.put("/api/preferences", json=payload).status_code == 422


@pytest.mark.parametrize("payload", [
    {"preferred_music_track_id": "22"},
    {"preferred_template_id": "22222222-2222-4222-8222-222222222222"},
])
def test_private_asset_preferences_reject_other_users_assets(preference_client, payload):
    client, _identity, _sessions = preference_client
    response = client.put("/api/preferences", json=payload)
    assert response.status_code == 422


def test_profile_updates_existing_user_and_brand_settings(preference_client):
    client, _identity, sessions = preference_client
    response = client.put("/api/preferences/profile", json={"name": "Creator A", "brand_name": "Studio A"})
    assert response.status_code == 200
    with sessions() as db:
        assert db.get(User, 101).name == "Creator A"
        assert db.get(User, 101).brand_name == "Studio A"
        assert db.query(BrandSettings).filter_by(user_id=101).one().name == "Studio A"
