ALTER TABLE public.purchase_requests 
  ADD COLUMN IF NOT EXISTS product_url TEXT,
  ADD COLUMN IF NOT EXISTS supplier TEXT;