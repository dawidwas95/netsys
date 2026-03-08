
-- Create enum for purchase request status
CREATE TYPE public.purchase_request_status AS ENUM ('NEW', 'TO_ORDER', 'ORDERED', 'DELIVERED', 'CANCELLED');

-- Create enum for purchase request urgency
CREATE TYPE public.purchase_request_urgency AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- Create purchase_requests table
CREATE TABLE public.purchase_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  category TEXT,
  manufacturer TEXT,
  model TEXT,
  description TEXT,
  urgency public.purchase_request_urgency NOT NULL DEFAULT 'NORMAL',
  status public.purchase_request_status NOT NULL DEFAULT 'NEW',
  inventory_item_id UUID REFERENCES public.inventory_items(id),
  requested_by UUID,
  requested_by_name TEXT,
  status_changed_by UUID,
  status_changed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view purchase_requests" ON public.purchase_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert purchase_requests" ON public.purchase_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update purchase_requests" ON public.purchase_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete purchase_requests" ON public.purchase_requests FOR DELETE TO authenticated USING (true);

-- Updated at trigger
CREATE TRIGGER update_purchase_requests_updated_at
  BEFORE UPDATE ON public.purchase_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
