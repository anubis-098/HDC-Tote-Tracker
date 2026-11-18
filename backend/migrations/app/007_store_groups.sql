ALTER TABLE stores ADD COLUMN memberships jsonb NOT NULL DEFAULT '[]'::jsonb;
