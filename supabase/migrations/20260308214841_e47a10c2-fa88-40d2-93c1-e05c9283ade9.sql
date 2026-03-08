
-- Add item_type to service_order_items (PRODUCT = inventory, SERVICE = non-inventory service, INTERNAL_COST = internal cost like Bolt, parking)
ALTER TABLE public.service_order_items 
ADD COLUMN item_type text NOT NULL DEFAULT 'PRODUCT';

-- Update existing rows: items with inventory_item_id = PRODUCT, others = SERVICE
UPDATE public.service_order_items 
SET item_type = CASE 
  WHEN inventory_item_id IS NOT NULL THEN 'PRODUCT' 
  ELSE 'SERVICE' 
END;

-- Add item_type column to document_items (currently stored in description field as a hack)
ALTER TABLE public.document_items 
ADD COLUMN item_type text NOT NULL DEFAULT 'SERVICE';
