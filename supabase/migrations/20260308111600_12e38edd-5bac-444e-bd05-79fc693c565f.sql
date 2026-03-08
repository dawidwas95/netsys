-- Add DAMAGE and INTERNAL_USE to movement_type enum
ALTER TYPE public.movement_type ADD VALUE IF NOT EXISTS 'DAMAGE';
ALTER TYPE public.movement_type ADD VALUE IF NOT EXISTS 'INTERNAL_USE';