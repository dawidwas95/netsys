ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS status_token text DEFAULT encode(gen_random_bytes(16), 'hex');

-- Backfill existing orders
UPDATE public.service_orders SET status_token = encode(gen_random_bytes(16), 'hex') WHERE status_token IS NULL;