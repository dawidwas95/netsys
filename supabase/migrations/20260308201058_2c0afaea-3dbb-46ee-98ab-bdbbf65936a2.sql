
-- Create enum for repair approval status
CREATE TYPE public.repair_approval_status AS ENUM ('NONE', 'WAITING_FOR_CUSTOMER', 'APPROVED_BY_CUSTOMER', 'REJECTED_BY_CUSTOMER');

-- Add repair approval fields to service_orders
ALTER TABLE public.service_orders
  ADD COLUMN estimated_repair_cost_gross numeric DEFAULT NULL,
  ADD COLUMN repair_approval_status public.repair_approval_status NOT NULL DEFAULT 'NONE',
  ADD COLUMN repair_approval_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN repair_approval_note text DEFAULT NULL;
