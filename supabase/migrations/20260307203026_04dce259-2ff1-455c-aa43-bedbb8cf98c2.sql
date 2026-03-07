
-- Document type enum
CREATE TYPE public.document_type AS ENUM (
  'PURCHASE_INVOICE',
  'SALES_INVOICE', 
  'RECEIPT',
  'PROFORMA',
  'CORRECTION',
  'OTHER'
);

-- Payment status enum
CREATE TYPE public.document_payment_status AS ENUM (
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE'
);

-- Document direction enum
CREATE TYPE public.document_direction AS ENUM ('INCOME', 'EXPENSE');

-- Documents registry table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_number TEXT NOT NULL,
  document_type public.document_type NOT NULL DEFAULT 'SALES_INVOICE',
  direction public.document_direction NOT NULL DEFAULT 'INCOME',
  
  -- Contractor
  client_id UUID REFERENCES public.clients(id),
  contractor_name TEXT,
  contractor_nip TEXT,
  
  -- Dates
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sale_date DATE,
  due_date DATE,
  received_date DATE,
  
  -- Amounts
  net_amount NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 23,
  
  -- Payment
  payment_status public.document_payment_status NOT NULL DEFAULT 'UNPAID',
  payment_method public.payment_method,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Related
  related_order_id UUID REFERENCES public.service_orders(id),
  related_offer_id UUID REFERENCES public.offers(id),
  
  -- Meta
  description TEXT,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view documents"
  ON public.documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert documents"
  ON public.documents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update documents"
  ON public.documents FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete documents"
  ON public.documents FOR DELETE TO authenticated USING (true);

-- Indexes
CREATE INDEX idx_documents_client_id ON public.documents(client_id);
CREATE INDEX idx_documents_issue_date ON public.documents(issue_date);
CREATE INDEX idx_documents_direction ON public.documents(direction);

-- Updated_at trigger
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate document number
CREATE OR REPLACE FUNCTION public.generate_document_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  year_str TEXT;
  seq_num INTEGER;
  prefix TEXT;
BEGIN
  year_str := to_char(now(), 'YYYY');
  
  CASE NEW.document_type
    WHEN 'PURCHASE_INVOICE' THEN prefix := 'FZ';
    WHEN 'SALES_INVOICE' THEN prefix := 'FS';
    WHEN 'RECEIPT' THEN prefix := 'PAR';
    WHEN 'PROFORMA' THEN prefix := 'PRO';
    WHEN 'CORRECTION' THEN prefix := 'KOR';
    ELSE prefix := 'DOC';
  END CASE;

  SELECT COALESCE(MAX(CAST(split_part(document_number, '/', 3) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.documents
  WHERE document_number LIKE prefix || '/' || year_str || '/%';

  NEW.document_number := prefix || '/' || year_str || '/' || lpad(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_document_number_trigger
  BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.generate_document_number();
