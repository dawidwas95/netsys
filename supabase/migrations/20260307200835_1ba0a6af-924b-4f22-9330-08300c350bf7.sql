
-- Enums
CREATE TYPE public.service_category AS ENUM ('ADMINISTRATION', 'NETWORK', 'MONITORING', 'ERP', 'HELPDESK', 'IMPLEMENTATION', 'MAINTENANCE', 'OTHER');
CREATE TYPE public.billing_status AS ENUM ('UNBILLED', 'BILLED', 'CANCELLED');

-- IT Work Entries
CREATE TABLE public.it_work_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_number TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  device_id UUID REFERENCES public.devices(id),
  assigned_user_id UUID REFERENCES auth.users(id),
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  service_category service_category NOT NULL DEFAULT 'OTHER',
  description TEXT NOT NULL,
  work_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  billable_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_net NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_net NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_gross NUMERIC(10,2) NOT NULL DEFAULT 0,
  status billing_status NOT NULL DEFAULT 'UNBILLED',
  billing_batch_id UUID,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Billing Batches
CREATE TABLE public.billing_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  total_net NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_gross NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  invoice_number TEXT,
  billed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Billing Batch Items (join table)
CREATE TABLE public.billing_batch_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.billing_batches(id) ON DELETE CASCADE,
  it_work_entry_id UUID NOT NULL REFERENCES public.it_work_entries(id)
);

-- FK from it_work_entries to billing_batches
ALTER TABLE public.it_work_entries ADD CONSTRAINT it_work_entries_billing_batch_id_fkey FOREIGN KEY (billing_batch_id) REFERENCES public.billing_batches(id);

-- Indexes
CREATE INDEX idx_it_work_entries_client ON public.it_work_entries(client_id);
CREATE INDEX idx_it_work_entries_status ON public.it_work_entries(status);
CREATE INDEX idx_it_work_entries_work_date ON public.it_work_entries(work_date);
CREATE INDEX idx_billing_batches_client ON public.billing_batches(client_id);

-- Updated_at trigger
CREATE TRIGGER update_it_work_entries_updated_at BEFORE UPDATE ON public.it_work_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Entry number generator
CREATE OR REPLACE FUNCTION public.generate_it_entry_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  year_str TEXT;
  seq_num INTEGER;
BEGIN
  year_str := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(split_part(entry_number, '/', 3) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.it_work_entries
  WHERE entry_number LIKE 'IT/' || year_str || '/%';
  NEW.entry_number := 'IT/' || year_str || '/' || lpad(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_it_entry_number BEFORE INSERT ON public.it_work_entries FOR EACH ROW EXECUTE FUNCTION generate_it_entry_number();

-- RLS
ALTER TABLE public.it_work_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_batch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view it_work_entries" ON public.it_work_entries FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "Authenticated can insert it_work_entries" ON public.it_work_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update it_work_entries" ON public.it_work_entries FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can view billing_batches" ON public.billing_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert billing_batches" ON public.billing_batches FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can view billing_batch_items" ON public.billing_batch_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert billing_batch_items" ON public.billing_batch_items FOR INSERT TO authenticated WITH CHECK (true);
