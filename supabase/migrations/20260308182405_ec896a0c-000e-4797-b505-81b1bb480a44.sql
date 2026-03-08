
-- Inventory reservations table
CREATE TABLE public.inventory_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  service_order_item_id UUID NOT NULL REFERENCES public.service_order_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'CONSUMED', 'RELEASED')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  consumed_at TIMESTAMP WITH TIME ZONE,
  released_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view inventory_reservations" ON public.inventory_reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert inventory_reservations" ON public.inventory_reservations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update inventory_reservations" ON public.inventory_reservations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete inventory_reservations" ON public.inventory_reservations FOR DELETE TO authenticated USING (true);

-- Index for fast lookups
CREATE INDEX idx_inventory_reservations_item ON public.inventory_reservations(inventory_item_id) WHERE status = 'RESERVED';
CREATE INDEX idx_inventory_reservations_order ON public.inventory_reservations(service_order_id) WHERE status = 'RESERVED';
