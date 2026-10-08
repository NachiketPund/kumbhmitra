-- KumbhMitra: Places Categories Update and Demo/Seed Data
-- Migration: 003_places_categories_and_seed
-- Run via: node run-migrate.js (from server/)

BEGIN;

-- 1. Alter the check constraint to support new categories
ALTER TABLE places DROP CONSTRAINT IF EXISTS places_category_check;

ALTER TABLE places ADD CONSTRAINT places_category_check
  CHECK (category IN (
    'ghat', 'camp', 'parking', 'hospital', 'medical',
    'police', 'toilet', 'food', 'transport', 'temple',
    'landmark', 'info_center', 'help_centre', 'other'
  ));

-- 2. Seed Demo Data (Clearly labeled as DEMO)
-- Coordinates center around Prayagraj Sangam (~25.43, ~81.88)
INSERT INTO places (name, category, description, address, latitude, longitude) VALUES
(
  '[DEMO] Sangam Point', 'landmark',
  'Primary confluence of Ganga, Yamuna, and Saraswati.',
  'Triveni Sangam Area, Prayagraj',
  25.426, 81.888
),
(
  '[DEMO] Main Medical Post', 'medical',
  'Primary emergency care facility.',
  'Main Mela Road',
  25.429, 81.885
),
(
  '[DEMO] Temporary Toilet Block A', 'toilet',
  'High capacity facility.',
  'Ghat 1 Entrance',
  25.428, 81.882
),
(
  '[DEMO] Police Control Room', 'police',
  'Central police help desk.',
  'Sector 1',
  25.431, 81.884
),
(
  '[DEMO] Parking P1', 'parking',
  'Large vehicle parking zone.',
  'North Gate',
  25.435, 81.890
)
ON CONFLICT (id) DO NOTHING;

-- 3. Record migration
INSERT INTO schema_migrations (filename)
VALUES ('003_places_categories_and_seed.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
