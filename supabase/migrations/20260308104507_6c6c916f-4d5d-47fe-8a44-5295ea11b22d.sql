ALTER TABLE public.service_orders 
  ADD COLUMN IF NOT EXISTS client_signature_url text,
  ADD COLUMN IF NOT EXISTS technician_signature_url text,
  ADD COLUMN IF NOT EXISTS client_signed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS technician_signed_at timestamp with time zone;