
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS cpu text,
  ADD COLUMN IF NOT EXISTS ram_type text,
  ADD COLUMN IF NOT EXISTS gpu text,
  ADD COLUMN IF NOT EXISTS storage1_type text,
  ADD COLUMN IF NOT EXISTS storage1_size text,
  ADD COLUMN IF NOT EXISTS storage2_type text,
  ADD COLUMN IF NOT EXISTS storage2_size text,
  ADD COLUMN IF NOT EXISTS motherboard text,
  ADD COLUMN IF NOT EXISTS psu text,
  ADD COLUMN IF NOT EXISTS specification_notes text;
