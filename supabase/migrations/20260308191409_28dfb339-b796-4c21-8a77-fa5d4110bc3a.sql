CREATE POLICY "Authenticated can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);