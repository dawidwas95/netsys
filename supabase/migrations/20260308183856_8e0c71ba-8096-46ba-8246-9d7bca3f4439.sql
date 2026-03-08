
ALTER TABLE public.service_orders
ADD COLUMN IF NOT EXISTS planned_execution_date DATE,
ADD COLUMN IF NOT EXISTS planned_execution_time TIME,
ADD COLUMN IF NOT EXISTS appointment_note TEXT;
