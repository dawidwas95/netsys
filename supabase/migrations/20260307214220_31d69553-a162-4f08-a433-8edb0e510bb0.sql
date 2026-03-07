
-- Create document_items table for invoice line items
CREATE TABLE public.document_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'szt.',
  unit_net numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 23,
  total_net numeric NOT NULL DEFAULT 0,
  total_vat numeric NOT NULL DEFAULT 0,
  total_gross numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  related_order_id uuid REFERENCES public.service_orders(id),
  related_it_work_id uuid REFERENCES public.it_work_entries(id),
  inventory_item_id uuid REFERENCES public.inventory_items(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view document_items" ON public.document_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert document_items" ON public.document_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update document_items" ON public.document_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete document_items" ON public.document_items FOR DELETE TO authenticated USING (true);

-- Add gross_amount to cash_transactions for proper cash register
ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS gross_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text;
