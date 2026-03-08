-- Add cost fields to purchase_requests
ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS estimated_gross NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_net NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_vat NUMERIC DEFAULT 0;

-- Create purchase_categories table
CREATE TABLE IF NOT EXISTS public.purchase_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view purchase_categories"
  ON public.purchase_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert purchase_categories"
  ON public.purchase_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update purchase_categories"
  ON public.purchase_categories FOR UPDATE TO authenticated USING (true);

-- Seed default categories
INSERT INTO public.purchase_categories (name, label, sort_order) VALUES
  ('MOTHERBOARD', 'Płyta główna', 1),
  ('CPU', 'Procesor', 2),
  ('GPU', 'Karta graficzna', 3),
  ('PSU', 'Zasilacz', 4),
  ('DISPLAY', 'Wyświetlacz', 5),
  ('BATTERY', 'Bateria', 6),
  ('DISK', 'Dysk', 7),
  ('RAM', 'RAM', 8),
  ('KEYBOARD', 'Klawiatura', 9),
  ('HINGE', 'Zawias', 10),
  ('FAN', 'Wentylator', 11),
  ('CHARGING_PORT', 'Gniazdo ładowania', 12),
  ('CASE', 'Obudowa', 13),
  ('RIBBON', 'Taśma', 14),
  ('OTHER', 'Inne', 99)
ON CONFLICT (name) DO NOTHING;