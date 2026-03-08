
-- Notification templates
CREATE TABLE public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  subject TEXT NOT NULL DEFAULT '',
  body_template TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view notification_templates" ON public.notification_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can update notification_templates" ON public.notification_templates
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can insert notification_templates" ON public.notification_templates
  FOR INSERT TO authenticated WITH CHECK (true);

-- Notification log
CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  recipient TEXT,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view notification_log" ON public.notification_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert notification_log" ON public.notification_log
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update notification_log" ON public.notification_log
  FOR UPDATE TO authenticated USING (true);

-- Seed default templates
INSERT INTO public.notification_templates (event_type, channel, subject, body_template) VALUES
  ('READY_FOR_RETURN', 'EMAIL', 'Twoje urządzenie jest gotowe do odbioru — {{order_number}}',
   'Szanowny Kliencie,

Informujemy, że Twoje urządzenie jest gotowe do odbioru.

Numer zlecenia: {{order_number}}
Urządzenie: {{device_name}}

Prosimy o odbiór w godzinach pracy serwisu.

Z poważaniem,
Zespół serwisu'),
  ('COMPLETED', 'EMAIL', 'Zlecenie {{order_number}} zostało zakończone',
   'Szanowny Kliencie,

Informujemy, że zlecenie serwisowe nr {{order_number}} zostało zakończone.

Urządzenie: {{device_name}}

Dziękujemy za skorzystanie z naszych usług.

Z poważaniem,
Zespół serwisu'),
  ('READY_FOR_RETURN', 'SMS', 'Urządzenie gotowe do odbioru. Zlecenie: {{order_number}}. Prosimy o odbiór w godzinach pracy.', ''),
  ('COMPLETED', 'SMS', 'Zlecenie {{order_number}} zakończone. Dziękujemy za skorzystanie z usług serwisu.', '');
