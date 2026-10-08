-- KumbhMitra: Initial Schema
-- Migration: 001_initial_schema
-- Run via: node dist/db/migrate.js (or tsx src/db/migrate.ts)
-- This migration is idempotent — safe to re-run.

BEGIN;

-- ============================================================
-- Schema version tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  id          SERIAL PRIMARY KEY,
  filename    TEXT UNIQUE NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Announcements (home ticker / crowd advisories)
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  language    TEXT NOT NULL DEFAULT 'en',
  priority    TEXT NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active
  ON announcements (active, priority DESC, created_at DESC);

-- ============================================================
-- Lost & Found items
-- ============================================================
CREATE TABLE IF NOT EXISTS lost_found_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL CHECK (category IN ('lost', 'found')),
  title       TEXT NOT NULL,
  location    TEXT NOT NULL,
  details     TEXT,
  language    TEXT NOT NULL DEFAULT 'en',
  reporter_id TEXT,                          -- optional anonymous session token
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lost_found_category
  ON lost_found_items (category, resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lost_found_search
  ON lost_found_items USING gin (
    to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(location,'') || ' ' || coalesce(details,''))
  );

-- ============================================================
-- Directory contacts (help desks, emergency numbers)
-- ============================================================
CREATE TABLE IF NOT EXISTS directory_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key   TEXT NOT NULL CHECK (group_key IN ('medical', 'security', 'rescue')),
  name_key    TEXT NOT NULL,                 -- i18n key reference
  role_key    TEXT NOT NULL,                 -- i18n key reference
  phone       TEXT NOT NULL,
  verified    BOOLEAN NOT NULL DEFAULT FALSE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_directory_group
  ON directory_contacts (group_key, active, sort_order);

-- ============================================================
-- Map points of interest
-- ============================================================
CREATE TABLE IF NOT EXISTS map_points (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,                   -- stable client-side id (m1, p1, etc.)
  type        TEXT NOT NULL CHECK (type IN ('medical', 'police', 'toilet')),
  label_key   TEXT NOT NULL,                 -- i18n key
  kind_key    TEXT NOT NULL,                 -- i18n key
  x_pct       NUMERIC(5,2) NOT NULL CHECK (x_pct BETWEEN 0 AND 100),
  y_pct       NUMERIC(5,2) NOT NULL CHECK (y_pct BETWEEN 0 AND 100),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_map_points_type
  ON map_points (type, active);

-- ============================================================
-- SOS alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS sos_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude      NUMERIC(9,6),
  longitude     NUMERIC(9,6),
  accuracy_m    NUMERIC(8,2),
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'acknowledged', 'resolved', 'false_alarm')),
  reporter_token TEXT,                       -- anonymous session identifier
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_status
  ON sos_alerts (status, created_at DESC);

-- ============================================================
-- updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'announcements',
    'lost_found_items',
    'directory_contacts',
    'map_points',
    'sos_alerts'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
       CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;

COMMIT;
