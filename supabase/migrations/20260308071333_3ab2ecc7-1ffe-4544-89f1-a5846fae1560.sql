CREATE OR REPLACE FUNCTION public.generate_document_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  year_str TEXT;
  seq_num INTEGER;
  prefix TEXT;
BEGIN
  -- Only auto-generate if document_number is NULL, empty, or 'TEMP'
  IF NEW.document_number IS NOT NULL AND NEW.document_number <> '' AND NEW.document_number <> 'TEMP' THEN
    RETURN NEW;
  END IF;

  year_str := to_char(now(), 'YYYY');
  
  CASE NEW.document_type
    WHEN 'PURCHASE_INVOICE' THEN prefix := 'FZ';
    WHEN 'SALES_INVOICE' THEN prefix := 'FS';
    WHEN 'RECEIPT' THEN prefix := 'PAR';
    WHEN 'PROFORMA' THEN prefix := 'PRO';
    WHEN 'CORRECTION' THEN prefix := 'KOR';
    ELSE prefix := 'DOC';
  END CASE;

  SELECT COALESCE(MAX(CAST(split_part(document_number, '/', 3) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.documents
  WHERE document_number LIKE prefix || '/' || year_str || '/%';

  NEW.document_number := prefix || '/' || year_str || '/' || lpad(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;