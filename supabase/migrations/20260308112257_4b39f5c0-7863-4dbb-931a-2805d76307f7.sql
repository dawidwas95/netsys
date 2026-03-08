-- Add inventory_number and compatible_models to inventory_items
ALTER TABLE public.inventory_items 
  ADD COLUMN IF NOT EXISTS inventory_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS compatible_models TEXT[] DEFAULT '{}';

-- Create trigger function for auto-generating inventory_number
CREATE OR REPLACE FUNCTION public.generate_inventory_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  year_str TEXT;
  seq_num INTEGER;
BEGIN
  IF NEW.inventory_number IS NOT NULL AND NEW.inventory_number <> '' THEN
    RETURN NEW;
  END IF;

  year_str := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(split_part(inventory_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM public.inventory_items
  WHERE inventory_number LIKE 'INV-' || year_str || '-%';
  
  NEW.inventory_number := 'INV-' || year_str || '-' || lpad(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;

-- Create trigger
DROP TRIGGER IF EXISTS set_inventory_number ON public.inventory_items;
CREATE TRIGGER set_inventory_number
  BEFORE INSERT ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_inventory_number();

-- Create inventory_categories table
CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view inventory_categories"
  ON public.inventory_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert inventory_categories"
  ON public.inventory_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update inventory_categories"
  ON public.inventory_categories FOR UPDATE TO authenticated USING (true);

-- Backfill existing items with inventory_number
DO $$
DECLARE
  r RECORD;
  year_str TEXT;
  seq INTEGER := 0;
BEGIN
  year_str := to_char(now(), 'YYYY');
  FOR r IN SELECT id FROM public.inventory_items WHERE inventory_number IS NULL ORDER BY created_at LOOP
    seq := seq + 1;
    UPDATE public.inventory_items SET inventory_number = 'INV-' || year_str || '-' || lpad(seq::TEXT, 4, '0') WHERE id = r.id;
  END LOOP;
END $$;