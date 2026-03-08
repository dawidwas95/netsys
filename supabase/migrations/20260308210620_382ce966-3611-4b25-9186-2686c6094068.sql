-- Create business_role enum
CREATE TYPE public.business_role AS ENUM ('CUSTOMER', 'SUPPLIER', 'CUSTOMER_AND_SUPPLIER');

-- Add business_role column to clients with default CUSTOMER
ALTER TABLE public.clients ADD COLUMN business_role public.business_role NOT NULL DEFAULT 'CUSTOMER'::public.business_role;