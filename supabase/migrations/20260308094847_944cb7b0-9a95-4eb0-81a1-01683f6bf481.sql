
-- 1. Add deleted_by to tables that have deleted_at but no deleted_by
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.it_work_entries ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- 2. Add soft delete columns to documents (missing deleted_at)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- 3. Add soft delete to service_order_comments
ALTER TABLE public.service_order_comments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.service_order_comments ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- 4. Create system_events table
CREATE TABLE IF NOT EXISTS public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_name text,
  payload jsonb,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  user_id uuid
);

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view system_events"
  ON public.system_events FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert system_events"
  ON public.system_events FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update system_events"
  ON public.system_events FOR UPDATE
  TO authenticated USING (true);
