-- Fix: DELETE uses USING not WITH CHECK
CREATE POLICY "Authenticated can delete inventory_movements"
ON public.inventory_movements
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated can update inventory_movements"
ON public.inventory_movements
FOR UPDATE
TO authenticated
USING (true);