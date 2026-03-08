CREATE TYPE public.client_approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS client_approval client_approval_status NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS client_approval_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_approval_changed_by UUID;