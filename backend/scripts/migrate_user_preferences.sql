-- Additive migration for persistent, per-user application preferences.
-- Safe to run repeatedly; existing user and branding records are untouched.
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(10) NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
    default_target_duration INTEGER NOT NULL DEFAULT 15
        CHECK (default_target_duration BETWEEN 5 AND 60),
    default_aspect_ratio VARCHAR(10) NOT NULL DEFAULT '9:16',
    default_resolution VARCHAR(20) NOT NULL DEFAULT '1080x1920',
    default_frame_rate INTEGER NOT NULL DEFAULT 30,
    preferred_music_track_id VARCHAR(100),
    preferred_template_id VARCHAR(36),
    auto_save BOOLEAN NOT NULL DEFAULT TRUE,
    notifications BOOLEAN NOT NULL DEFAULT TRUE,
    compact_layout BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
