
-- Create customer_messages table for customer-service communication
CREATE TABLE public.customer_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('CLIENT', 'STAFF')),
  sender_user_id UUID NULL,
  sender_name TEXT NOT NULL DEFAULT 'Klient',
  message TEXT NOT NULL,
  is_read_by_staff BOOLEAN NOT NULL DEFAULT false,
  is_read_by_client BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;

-- Staff can read all messages
CREATE POLICY "Authenticated can view customer_messages"
  ON public.customer_messages FOR SELECT TO authenticated
  USING (true);

-- Staff can insert replies
CREATE POLICY "Authenticated can insert customer_messages"
  ON public.customer_messages FOR INSERT TO authenticated
  WITH CHECK (true);

-- Staff can update (mark as read)
CREATE POLICY "Authenticated can update customer_messages"
  ON public.customer_messages FOR UPDATE TO authenticated
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_customer_messages_order_id ON public.customer_messages(service_order_id);
CREATE INDEX idx_customer_messages_unread_staff ON public.customer_messages(service_order_id) WHERE sender_type = 'CLIENT' AND is_read_by_staff = false;
