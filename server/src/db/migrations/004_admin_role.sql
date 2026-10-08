-- KumbhMitra: Admin Role Support
-- Migration: 004_admin_role
-- Run via: node run-migrate.js (from server/)
--
-- Adds role column (USER | ADMIN) to users.
-- To grant admin: UPDATE users SET role='ADMIN' WHERE auth_id='<supabase-auth-user-uuid>';

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'USER';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('USER','ADMIN'));

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

INSERT INTO schema_migrations (filename)
VALUES ('004_admin_role.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
