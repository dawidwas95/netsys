
-- Add new enum values to order_status
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'DIAGNOSIS_QUOTE';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'TODO';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'WAITING';
