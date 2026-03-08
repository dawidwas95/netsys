
-- Table to track when users last read/viewed a service order
CREATE TABLE public.user_order_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, order_id)
);

ALTER TABLE public.user_order_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reads" ON public.user_order_reads
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own reads" ON public.user_order_reads
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own reads" ON public.user_order_reads
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'INFO',
  title text NOT NULL,
  body text,
  related_order_id uuid REFERENCES public.service_orders(id) ON DELETE CASCADE,
  related_comment_id uuid REFERENCES public.service_order_comments(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Index for quick lookups
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_user_order_reads_lookup ON public.user_order_reads(user_id, order_id);
