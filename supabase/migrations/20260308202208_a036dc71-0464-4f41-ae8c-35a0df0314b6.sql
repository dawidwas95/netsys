
-- Add new enum values to existing app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'KIEROWNIK';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'SERWISANT';
