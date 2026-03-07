
-- Offer status enum
CREATE TYPE public.offer_status AS ENUM ('DRAFT', 'SENT', 'WAITING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');
CREATE TYPE public.offer_item_type AS ENUM ('SERVICE', 'PRODUCT', 'CUSTOM');

-- Offers
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  title TEXT NOT NULL,
  description TEXT,
  status offer_status NOT NULL DEFAULT 'DRAFT',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  total_net NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_gross NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  follow_up_date DATE,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Offer Items
CREATE TABLE public.offer_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  item_type offer_item_type NOT NULL DEFAULT 'CUSTOM',
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'szt.',
  unit_net NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(4,2) NOT NULL DEFAULT 23,
  total_net NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_gross NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_offers_client ON public.offers(client_id);
CREATE INDEX idx_offers_status ON public.offers(status);
CREATE INDEX idx_offer_items_offer ON public.offer_items(offer_id);

-- Updated_at trigger
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Offer number generator
CREATE OR REPLACE FUNCTION public.generate_offer_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  year_str TEXT;
  seq_num INTEGER;
BEGIN
  year_str := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(split_part(offer_number, '/', 3) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.offers
  WHERE offer_number LIKE 'OFR/' || year_str || '/%';
  NEW.offer_number := 'OFR/' || year_str || '/' || lpad(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_offer_number BEFORE INSERT ON public.offers FOR EACH ROW EXECUTE FUNCTION generate_offer_number();

-- RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view offers" ON public.offers FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "Authenticated can insert offers" ON public.offers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update offers" ON public.offers FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can view offer_items" ON public.offer_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert offer_items" ON public.offer_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update offer_items" ON public.offer_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete offer_items" ON public.offer_items FOR DELETE TO authenticated USING (true);
