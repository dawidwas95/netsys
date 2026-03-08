
-- Drop duplicate trigger (keep only one)
DROP TRIGGER IF EXISTS trg_update_stock ON public.inventory_movements;

-- Drop and recreate the single trigger function with correct logic
CREATE OR REPLACE FUNCTION public.update_stock_on_movement()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Reverse the effect of the deleted movement
    IF OLD.movement_type = 'IN' THEN
      UPDATE public.inventory_items SET stock_quantity = stock_quantity - OLD.quantity WHERE id = OLD.item_id;
    ELSIF OLD.movement_type IN ('OUT', 'DAMAGE', 'INTERNAL_USE') THEN
      UPDATE public.inventory_items SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.item_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.movement_type = 'IN' THEN
      UPDATE public.inventory_items SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.item_id;
    ELSIF NEW.movement_type IN ('OUT', 'DAMAGE', 'INTERNAL_USE') THEN
      UPDATE public.inventory_items SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.item_id;
    ELSIF NEW.movement_type = 'ADJUSTMENT' THEN
      UPDATE public.inventory_items SET stock_quantity = NEW.quantity WHERE id = NEW.item_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure only one trigger exists
DROP TRIGGER IF EXISTS trg_update_stock_on_movement ON public.inventory_movements;
CREATE TRIGGER trg_update_stock_on_movement
  AFTER INSERT OR DELETE ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_on_movement();
