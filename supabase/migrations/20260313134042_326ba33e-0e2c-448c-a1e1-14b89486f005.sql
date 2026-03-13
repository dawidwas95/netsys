
-- Update existing LOW priority orders to NORMAL
UPDATE public.service_orders SET priority = 'NORMAL' WHERE priority = 'LOW';

-- Rename old enum and create new one without LOW
ALTER TYPE public.order_priority RENAME TO order_priority_old;
CREATE TYPE public.order_priority AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- Alter column to use new enum
ALTER TABLE public.service_orders 
  ALTER COLUMN priority DROP DEFAULT,
  ALTER COLUMN priority TYPE public.order_priority USING priority::text::public.order_priority,
  ALTER COLUMN priority SET DEFAULT 'NORMAL';

-- Drop old enum
DROP TYPE public.order_priority_old;
