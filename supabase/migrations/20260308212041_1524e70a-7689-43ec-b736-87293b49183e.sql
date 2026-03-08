
-- Create document_attachments table
CREATE TABLE public.document_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  content_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view document_attachments" ON public.document_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert document_attachments" ON public.document_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete document_attachments" ON public.document_attachments FOR DELETE TO authenticated USING (true);

-- Create storage bucket for document files
INSERT INTO storage.buckets (id, name, public) VALUES ('document-files', 'document-files', true);

-- Storage policies
CREATE POLICY "Authenticated can upload document files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'document-files');
CREATE POLICY "Anyone can view document files" ON storage.objects FOR SELECT USING (bucket_id = 'document-files');
CREATE POLICY "Authenticated can delete document files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'document-files');
