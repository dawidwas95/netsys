
-- Attach the existing generate_order_number function as a BEFORE INSERT trigger
CREATE TRIGGER trg_generate_order_number
  BEFORE INSERT ON public.service_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_number();

-- Also attach other missing triggers
CREATE TRIGGER trg_generate_it_entry_number
  BEFORE INSERT ON public.it_work_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_it_entry_number();

CREATE TRIGGER trg_generate_offer_number
  BEFORE INSERT ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_offer_number();

CREATE TRIGGER trg_generate_document_number
  BEFORE INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_document_number();

CREATE TRIGGER trg_update_stock_on_movement
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_on_movement();
