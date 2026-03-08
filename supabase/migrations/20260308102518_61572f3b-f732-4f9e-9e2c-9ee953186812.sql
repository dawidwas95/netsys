
CREATE TABLE IF NOT EXISTS public.pdf_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pdf_templates' AND policyname = 'Auth can view pdf_templates') THEN
    CREATE POLICY "Auth can view pdf_templates" ON public.pdf_templates FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pdf_templates' AND policyname = 'Auth can update pdf_templates') THEN
    CREATE POLICY "Auth can update pdf_templates" ON public.pdf_templates FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pdf_templates' AND policyname = 'Auth can insert pdf_templates') THEN
    CREATE POLICY "Auth can insert pdf_templates" ON public.pdf_templates FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
