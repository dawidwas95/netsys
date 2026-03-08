INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload signatures" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures');
CREATE POLICY "Anyone can view signatures" ON storage.objects FOR SELECT USING (bucket_id = 'signatures');
CREATE POLICY "Authenticated can delete signatures" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'signatures');