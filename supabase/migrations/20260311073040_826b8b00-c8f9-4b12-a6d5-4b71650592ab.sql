CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  year_str TEXT;
  seq_num INTEGER;
BEGIN
  -- Skip if order_number is already provided (non-null, non-empty)
  IF NEW.order_number IS NOT NULL AND NEW.order_number <> '' THEN
    RETURN NEW;
  END IF;

  year_str := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(split_part(order_number, '/', 3) AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM public.service_orders
  WHERE order_number LIKE 'SRV/' || year_str || '/%';
  
  NEW.order_number := 'SRV/' || year_str || '/' || lpad(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$function$