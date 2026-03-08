
-- Junction table for multiple technicians per order
CREATE TABLE public.order_technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID,
  UNIQUE (order_id, user_id)
);

ALTER TABLE public.order_technicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view order_technicians" ON public.order_technicians FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert order_technicians" ON public.order_technicians FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update order_technicians" ON public.order_technicians FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete order_technicians" ON public.order_technicians FOR DELETE TO authenticated USING (true);
