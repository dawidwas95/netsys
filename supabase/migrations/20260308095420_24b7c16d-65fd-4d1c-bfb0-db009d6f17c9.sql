
-- Create storage bucket for service order photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-photos', 'order-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for order-photos bucket
CREATE POLICY "Authenticated can upload order photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order-photos');

CREATE POLICY "Anyone can view order photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'order-photos');

CREATE POLICY "Authenticated can delete order photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'order-photos');

-- Create table to track photos linked to orders
CREATE TABLE IF NOT EXISTS public.service_order_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  caption text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_order_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view order photos"
ON public.service_order_photos FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated can insert order photos"
ON public.service_order_photos FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can delete order photos"
ON public.service_order_photos FOR DELETE
TO authenticated USING (true);
