
-- Warehouse document type enum
CREATE TYPE public.warehouse_doc_type AS ENUM ('PZ', 'WZ', 'PW', 'RW', 'CORRECTION');

-- Warehouse documents table
CREATE TABLE public.warehouse_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL DEFAULT 'TEMP',
  document_type public.warehouse_doc_type NOT NULL,
  document_date date NOT NULL DEFAULT CURRENT_DATE,
  client_id uuid REFERENCES public.clients(id),
  related_order_id uuid REFERENCES public.service_orders(id),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view warehouse_documents" ON public.warehouse_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert warehouse_documents" ON public.warehouse_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update warehouse_documents" ON public.warehouse_documents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete warehouse_documents" ON public.warehouse_documents FOR DELETE TO authenticated USING (true);

-- Warehouse document items
CREATE TABLE public.warehouse_document_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_document_id uuid NOT NULL REFERENCES public.warehouse_documents(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  quantity numeric NOT NULL DEFAULT 1,
  price_net numeric DEFAULT 0,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_document_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view warehouse_document_items" ON public.warehouse_document_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert warehouse_document_items" ON public.warehouse_document_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update warehouse_document_items" ON public.warehouse_document_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete warehouse_document_items" ON public.warehouse_document_items FOR DELETE TO authenticated USING (true);

-- Auto-numbering trigger
CREATE OR REPLACE FUNCTION public.generate_warehouse_doc_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  year_str TEXT;
  seq_num INTEGER;
  prefix TEXT;
BEGIN
  IF NEW.document_number IS NOT NULL AND NEW.document_number <> '' AND NEW.document_number <> 'TEMP' THEN
    RETURN NEW;
  END IF;

  year_str := to_char(now(), 'YYYY');

  CASE NEW.document_type
    WHEN 'PZ' THEN prefix := 'PZ';
    WHEN 'WZ' THEN prefix := 'WZ';
    WHEN 'PW' THEN prefix := 'PW';
    WHEN 'RW' THEN prefix := 'RW';
    WHEN 'CORRECTION' THEN prefix := 'KM';
  END CASE;

  SELECT COALESCE(MAX(CAST(split_part(document_number, '/', 3) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.warehouse_documents
  WHERE document_number LIKE prefix || '/' || year_str || '/%';

  NEW.document_number := prefix || '/' || year_str || '/' || lpad(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_warehouse_doc_number
  BEFORE INSERT ON public.warehouse_documents
  FOR EACH ROW EXECUTE FUNCTION public.generate_warehouse_doc_number();

-- Updated_at trigger
CREATE TRIGGER trg_warehouse_documents_updated_at
  BEFORE UPDATE ON public.warehouse_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
