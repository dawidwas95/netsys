
CREATE TABLE public.comment_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.service_order_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.comment_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reads" ON public.comment_reads
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own reads" ON public.comment_reads
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own reads" ON public.comment_reads
  FOR DELETE TO authenticated USING (user_id = auth.uid());
