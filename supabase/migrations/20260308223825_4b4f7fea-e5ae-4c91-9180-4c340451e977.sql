
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS contractor_street text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contractor_building text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contractor_local text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contractor_postal_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contractor_city text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contractor_country text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contractor_email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contractor_phone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_street text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_building text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_local text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_postal_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_city text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_country text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_phone text DEFAULT NULL;
