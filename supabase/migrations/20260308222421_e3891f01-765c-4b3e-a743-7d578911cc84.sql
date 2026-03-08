
ALTER TABLE public.documents
  ADD COLUMN buyer_name text DEFAULT NULL,
  ADD COLUMN buyer_nip text DEFAULT NULL;
