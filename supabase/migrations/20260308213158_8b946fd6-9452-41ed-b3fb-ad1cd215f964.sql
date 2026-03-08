
ALTER TABLE public.documents 
  ADD COLUMN IF NOT EXISTS related_document_id uuid REFERENCES public.documents(id),
  ADD COLUMN IF NOT EXISTS correction_reason text;
