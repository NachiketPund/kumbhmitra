-- KumbhMitra: Full Production Schema
-- Migration: 002_full_schema
-- Idempotent — safe to re-run.
-- Run via: npm run migrate (from server/)

BEGIN;

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
-- Note: unaccent extension omitted — index expressions don't support STABLE functions.
-- Full-text search works without accent folding; accent-sensitive matching only.

-- ============================================================
-- Shared updated_at trigger function (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper to attach updated_at trigger to any table
CREATE OR REPLACE FUNCTION attach_updated_at(tbl TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
     CREATE TRIGGER trg_%I_updated_at
     BEFORE UPDATE ON %I
     FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
    tbl, tbl, tbl, tbl
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- users
-- Represents registered pilgrims / app users.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Auth identity (can be linked to Supabase Auth user id)
  auth_id         TEXT UNIQUE,
  display_name    TEXT,
  phone           TEXT,
  email           TEXT,
  language        TEXT NOT NULL DEFAULT 'en'
                  CHECK (language IN ('en','hi','mr','gu','te','ta','kn','raj')),
  -- Anonymous session token for users who haven't registered
  session_token   TEXT UNIQUE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_auth_id        ON users (auth_id);
CREATE INDEX IF NOT EXISTS idx_users_session_token  ON users (session_token);
CREATE INDEX IF NOT EXISTS idx_users_phone          ON users (phone);

SELECT attach_updated_at('users');

-- ============================================================
-- places
-- Physical locations at or near the Mela (ghats, camps, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS places (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL
              CHECK (category IN (
                'ghat', 'camp', 'parking', 'hospital',
                'police', 'toilet', 'food', 'transport',
                'temple', 'info_center', 'other'
              )),
  description TEXT,
  address     TEXT,
  latitude    NUMERIC(9,6)
              CHECK (latitude  BETWEEN -90  AND 90),
  longitude   NUMERIC(9,6)
              CHECK (longitude BETWEEN -180 AND 180),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_places_category  ON places (category, is_active);
CREATE INDEX IF NOT EXISTS idx_places_location  ON places (latitude, longitude)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_places_name_fts  ON places
  USING gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')));

SELECT attach_updated_at('places');

-- ============================================================
-- emergency_services
-- Police, hospitals, fire, rescue desks etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS emergency_services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL
              CHECK (category IN ('police', 'medical', 'fire', 'rescue', 'helpline', 'other')),
  phone       TEXT NOT NULL,
  address     TEXT,
  latitude    NUMERIC(9,6)
              CHECK (latitude  BETWEEN -90  AND 90),
  longitude   NUMERIC(9,6)
              CHECK (longitude BETWEEN -180 AND 180),
  verified    BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_category ON emergency_services (category, is_active);
CREATE INDEX IF NOT EXISTS idx_emergency_location ON emergency_services (latitude, longitude)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_emergency_verified ON emergency_services (verified, is_active);

SELECT attach_updated_at('emergency_services');

-- ============================================================
-- lost_found
-- Community lost & found reports.
-- ============================================================
CREATE TABLE IF NOT EXISTS lost_found (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Optional link to a registered user; nullable for anonymous reports
  user_id     UUID REFERENCES users (id) ON DELETE SET NULL,
  type        TEXT NOT NULL
              CHECK (type IN ('lost', 'found')),
  title       TEXT NOT NULL
              CHECK (char_length(title) BETWEEN 2 AND 120),
  description TEXT
              CHECK (description IS NULL OR char_length(description) <= 500),
  category    TEXT NOT NULL DEFAULT 'other'
              CHECK (category IN (
                'person', 'child', 'bag', 'document',
                'phone', 'wallet', 'jewellery', 'clothing',
                'vehicle', 'animal', 'other'
              )),
  location    TEXT NOT NULL
              CHECK (char_length(location) BETWEEN 2 AND 200),
  latitude    NUMERIC(9,6)
              CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
  longitude   NUMERIC(9,6)
              CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  image_url   TEXT
              CHECK (image_url IS NULL OR image_url ~* '^https?://'),
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'resolved', 'expired')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lost_found_type    ON lost_found (type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_found_user    ON lost_found (user_id);
CREATE INDEX IF NOT EXISTS idx_lost_found_status  ON lost_found (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_found_fts     ON lost_found
  USING gin (to_tsvector('simple',
    coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(location,'')
  ));

SELECT attach_updated_at('lost_found');

-- ============================================================
-- crowd_updates
-- Real-time crowd density and advisory updates.
-- ============================================================
CREATE TABLE IF NOT EXISTS crowd_updates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    UUID REFERENCES places (id) ON DELETE SET NULL,
  -- Density level: 1 (sparse) → 5 (critical)
  density     SMALLINT NOT NULL DEFAULT 1
              CHECK (density BETWEEN 1 AND 5),
  message     TEXT NOT NULL
              CHECK (char_length(message) BETWEEN 5 AND 300),
  -- Language the message was authored in
  language    TEXT NOT NULL DEFAULT 'en'
              CHECK (language IN ('en','hi','mr','gu','te','ta','kn','raj')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crowd_place    ON crowd_updates (place_id, is_active);
CREATE INDEX IF NOT EXISTS idx_crowd_active   ON crowd_updates (is_active, density DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crowd_expires  ON crowd_updates (expires_at)
  WHERE expires_at IS NOT NULL;

SELECT attach_updated_at('crowd_updates');

-- ============================================================
-- events
-- Scheduled Mela events (Shahi Snan, Aarti, processions, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    UUID REFERENCES places (id) ON DELETE SET NULL,
  title       TEXT NOT NULL
              CHECK (char_length(title) BETWEEN 2 AND 200),
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'general'
              CHECK (category IN (
                'snan', 'aarti', 'procession',
                'cultural', 'administrative', 'general'
              )),
  language    TEXT NOT NULL DEFAULT 'en'
              CHECK (language IN ('en','hi','mr','gu','te','ta','kn','raj')),
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT events_ends_after_starts CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_events_time     ON events (starts_at, is_active);
CREATE INDEX IF NOT EXISTS idx_events_category ON events (category, is_active);
CREATE INDEX IF NOT EXISTS idx_events_place    ON events (place_id);

SELECT attach_updated_at('events');

-- ============================================================
-- announcements (replace / upgrade from 001 foundation table)
-- High-priority crowd advisories and mela admin alerts.
-- ============================================================
-- Drop old table only if it lacks the new columns (safe upgrade)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'place_id'
  ) THEN
    DROP TABLE IF EXISTS announcements CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    UUID REFERENCES places (id) ON DELETE SET NULL,
  title       TEXT NOT NULL
              CHECK (char_length(title) BETWEEN 2 AND 200),
  body        TEXT NOT NULL
              CHECK (char_length(body) BETWEEN 5 AND 1000),
  language    TEXT NOT NULL DEFAULT 'en'
              CHECK (language IN ('en','hi','mr','gu','te','ta','kn','raj')),
  priority    TEXT NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active   ON announcements (active, priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_language ON announcements (language, active);

SELECT attach_updated_at('announcements');

-- ============================================================
-- Record this migration
-- ============================================================
INSERT INTO schema_migrations (filename)
VALUES ('002_full_schema.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
