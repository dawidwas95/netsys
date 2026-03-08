
-- 1. Create service_categories table for dynamic IT work categories
CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view service_categories" ON public.service_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert service_categories" ON public.service_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update service_categories" ON public.service_categories FOR UPDATE TO authenticated USING (true);

-- Seed with existing categories
INSERT INTO public.service_categories (name, label, sort_order) VALUES
  ('ADMINISTRATION', 'Administracja', 1),
  ('NETWORK', 'Sieci', 2),
  ('MONITORING', 'Monitoring', 3),
  ('ERP', 'ERP', 4),
  ('HELPDESK', 'Helpdesk', 5),
  ('IMPLEMENTATION', 'Wdrożenie', 6),
  ('MAINTENANCE', 'Konserwacja', 7),
  ('OTHER', 'Inne', 99);

-- 2. Create network_devices table for multi-device network docs
CREATE TABLE public.network_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.client_it_documents(id) ON DELETE CASCADE,
  device_type text NOT NULL DEFAULT 'OTHER',
  device_name text NOT NULL,
  ip_address text,
  subnet_mask text,
  gateway text,
  dns_servers text,
  vlan text,
  username text,
  password_encrypted text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.network_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view network_devices" ON public.network_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert network_devices" ON public.network_devices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update network_devices" ON public.network_devices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete network_devices" ON public.network_devices FOR DELETE TO authenticated USING (true);

-- 3. Create storage bucket for IT documentation files
INSERT INTO storage.buckets (id, name, public) VALUES ('it-docs-files', 'it-docs-files', false);

CREATE POLICY "Authenticated can upload IT doc files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'it-docs-files');
CREATE POLICY "Authenticated can view IT doc files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'it-docs-files');
CREATE POLICY "Authenticated can delete IT doc files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'it-docs-files');

-- 4. Add file_path column to client_it_documents for file attachments
ALTER TABLE public.client_it_documents ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.client_it_documents ADD COLUMN IF NOT EXISTS file_name text;

-- 5. Add it_work_comments table
CREATE TABLE public.it_work_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.it_work_entries(id) ON DELETE CASCADE,
  user_id uuid,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.it_work_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view it_work_comments" ON public.it_work_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert it_work_comments" ON public.it_work_comments FOR INSERT TO authenticated WITH CHECK (true);
