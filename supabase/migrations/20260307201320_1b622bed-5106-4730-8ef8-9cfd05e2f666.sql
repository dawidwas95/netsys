
-- Enums
CREATE TYPE public.movement_type AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'RESERVATION');
CREATE TYPE public.movement_source AS ENUM ('PURCHASE', 'SERVICE_ORDER', 'IT_WORK', 'MANUAL');

-- Inventory Items
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT,
  name TEXT NOT NULL,
  category TEXT,
  manufacturer TEXT,
  model TEXT,
  unit TEXT NOT NULL DEFAULT 'szt.',
  stock_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  purchase_net NUMERIC(10,2) NOT NULL DEFAULT 0,
  sale_net NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(4,2) NOT NULL DEFAULT 23,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inventory Movements
CREATE TABLE public.inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  movement_type movement_type NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  source_type movement_source NOT NULL DEFAULT 'MANUAL',
  source_id UUID,
  purchase_net NUMERIC(10,2),
  sale_net NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Service Order Items (parts used in orders)
CREATE TABLE public.service_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.service_orders(id),
  inventory_item_id UUID REFERENCES public.inventory_items(id),
  item_name_snapshot TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  purchase_net NUMERIC(10,2) NOT NULL DEFAULT 0,
  sale_net NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_purchase_net NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_sale_net NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Indexes
CREATE INDEX idx_inventory_items_sku ON public.inventory_items(sku);
CREATE INDEX idx_inventory_items_name ON public.inventory_items(name);
CREATE INDEX idx_inventory_movements_item ON public.inventory_movements(item_id);
CREATE INDEX idx_service_order_items_order ON public.service_order_items(order_id);

-- Updated_at trigger
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update stock on movement insert
CREATE OR REPLACE FUNCTION public.update_stock_on_movement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.movement_type = 'IN' THEN
    UPDATE public.inventory_items SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.item_id;
  ELSIF NEW.movement_type = 'OUT' THEN
    UPDATE public.inventory_items SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.item_id;
  ELSIF NEW.movement_type = 'ADJUSTMENT' THEN
    UPDATE public.inventory_items SET stock_quantity = NEW.quantity WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_stock AFTER INSERT ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION update_stock_on_movement();

-- RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view inventory_items" ON public.inventory_items FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "Authenticated can insert inventory_items" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update inventory_items" ON public.inventory_items FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can view inventory_movements" ON public.inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert inventory_movements" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can view service_order_items" ON public.service_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert service_order_items" ON public.service_order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete service_order_items" ON public.service_order_items FOR DELETE TO authenticated USING (true);
