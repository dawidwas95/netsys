
-- Enum for IT document categories
CREATE TYPE public.it_doc_category AS ENUM ('PASSWORD', 'NETWORK', 'LICENSE', 'NOTE');

-- IT documentation table
CREATE TABLE public.client_it_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category public.it_doc_category NOT NULL DEFAULT 'NOTE',
  title TEXT NOT NULL,
  
  -- Password fields
  username TEXT,
  password_encrypted TEXT,
  url TEXT,
  
  -- Network fields
  ip_address TEXT,
  subnet_mask TEXT,
  gateway TEXT,
  dns_servers TEXT,
  vlan TEXT,
  
  -- License fields
  software_name TEXT,
  license_key TEXT,
  seats INTEGER,
  license_expires_at DATE,
  
  -- Common
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- RLS
ALTER TABLE public.client_it_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view client_it_documents"
  ON public.client_it_documents FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert client_it_documents"
  ON public.client_it_documents FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update client_it_documents"
  ON public.client_it_documents FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated can delete client_it_documents"
  ON public.client_it_documents FOR DELETE TO authenticated
  USING (true);

-- Index
CREATE INDEX idx_client_it_documents_client_id ON public.client_it_documents(client_id);

-- Updated_at trigger
CREATE TRIGGER update_client_it_documents_updated_at
  BEFORE UPDATE ON public.client_it_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
