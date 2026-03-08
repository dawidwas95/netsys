
-- Migrate existing role values
UPDATE public.user_roles SET role = 'KIEROWNIK' WHERE role = 'MANAGER';
UPDATE public.user_roles SET role = 'SERWISANT' WHERE role = 'TECHNICIAN';
UPDATE public.user_roles SET role = 'KIEROWNIK' WHERE role = 'OFFICE';
UPDATE public.user_roles SET role = 'SERWISANT' WHERE role = 'EMPLOYEE';
UPDATE public.user_roles SET role = 'SERWISANT' WHERE role = 'READONLY';

-- Update handle_new_user to default to SERWISANT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'SERWISANT');
  RETURN NEW;
END;
$$;
