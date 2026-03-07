
-- ==========================================
-- ENUMS
-- ==========================================

CREATE TYPE public.app_role AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE', 'READONLY');
CREATE TYPE public.client_type AS ENUM ('PRIVATE', 'COMPANY');
CREATE TYPE public.device_category AS ENUM ('DESKTOP', 'LAPTOP', 'PHONE', 'TABLET', 'PRINTER', 'SERVER', 'ROUTER', 'SWITCH', 'AP', 'NVR', 'CAMERA', 'OTHER');
CREATE TYPE public.device_status AS ENUM ('ACTIVE', 'IN_SERVICE', 'RETIRED');
CREATE TYPE public.service_type AS ENUM ('COMPUTER_SERVICE', 'PHONE_SERVICE');
CREATE TYPE public.order_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE public.order_status AS ENUM ('NEW', 'DIAGNOSIS', 'IN_PROGRESS', 'WAITING_CLIENT', 'READY_FOR_RETURN', 'COMPLETED', 'ARCHIVED', 'CANCELLED');
CREATE TYPE public.intake_channel AS ENUM ('PHONE', 'EMAIL', 'IN_PERSON', 'REMOTE', 'OTHER');
CREATE TYPE public.payment_method AS ENUM ('CASH', 'CARD', 'TRANSFER');
CREATE TYPE public.sales_document_type AS ENUM ('RECEIPT', 'INVOICE', 'NONE');

-- ==========================================
-- TIMESTAMP TRIGGER FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ==========================================
-- USER ROLES TABLE
-- ==========================================

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'EMPLOYEE',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'));

-- ==========================================
-- PROFILES TABLE
-- ==========================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) STORED,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'EMPLOYEE');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- CLIENTS TABLE
-- ==========================================

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_type client_type NOT NULL DEFAULT 'PRIVATE',
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  display_name TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN company_name IS NOT NULL AND company_name != '' THEN company_name
      ELSE COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
    END
  ) STORED,
  nip TEXT,
  regon TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address_street TEXT,
  address_building TEXT,
  address_local TEXT,
  address_postal_code TEXT,
  address_city TEXT,
  address_country TEXT DEFAULT 'Polska',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view clients" ON public.clients
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY "Authenticated can insert clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update clients" ON public.clients
  FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_clients_display_name ON public.clients (display_name);
CREATE INDEX idx_clients_phone ON public.clients (phone);
CREATE INDEX idx_clients_email ON public.clients (email);
CREATE INDEX idx_clients_nip ON public.clients (nip);
CREATE INDEX idx_clients_city ON public.clients (address_city);

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- CLIENT CONTACTS TABLE
-- ==========================================

CREATE TABLE public.client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  position TEXT,
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contacts" ON public.client_contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contacts" ON public.client_contacts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contacts" ON public.client_contacts
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete contacts" ON public.client_contacts
  FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_client_contacts_client ON public.client_contacts (client_id);

CREATE TRIGGER update_client_contacts_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- DEVICES TABLE
-- ==========================================

CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  device_category device_category NOT NULL DEFAULT 'OTHER',
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  imei TEXT,
  asset_tag TEXT,
  operating_system TEXT,
  processor TEXT,
  ram_gb INTEGER,
  storage_type TEXT,
  storage_size_gb INTEGER,
  mac_address TEXT,
  ip_address TEXT,
  purchase_date DATE,
  warranty_until DATE,
  description TEXT,
  notes TEXT,
  status device_status NOT NULL DEFAULT 'ACTIVE',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view devices" ON public.devices
  FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "Authenticated can insert devices" ON public.devices
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update devices" ON public.devices
  FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_devices_serial ON public.devices (serial_number);
CREATE INDEX idx_devices_imei ON public.devices (imei);
CREATE INDEX idx_devices_client ON public.devices (client_id);
CREATE INDEX idx_devices_manufacturer_model ON public.devices (manufacturer, model);

CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- SERVICE ORDERS TABLE
-- ==========================================

CREATE TABLE public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  service_type service_type NOT NULL DEFAULT 'COMPUTER_SERVICE',
  client_id UUID NOT NULL REFERENCES public.clients(id),
  device_id UUID REFERENCES public.devices(id),
  assigned_user_id UUID REFERENCES auth.users(id),
  priority order_priority NOT NULL DEFAULT 'NORMAL',
  status order_status NOT NULL DEFAULT 'NEW',
  intake_channel intake_channel DEFAULT 'IN_PERSON',
  problem_description TEXT,
  client_description TEXT,
  diagnosis TEXT,
  repair_description TEXT,
  internal_notes TEXT,
  accessories_received TEXT,
  visual_condition TEXT,
  lock_code TEXT,
  estimated_completion_date DATE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reported_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  labor_net NUMERIC(10,2) DEFAULT 0,
  parts_net NUMERIC(10,2) DEFAULT 0,
  extra_cost_net NUMERIC(10,2) DEFAULT 0,
  total_net NUMERIC(10,2) DEFAULT 0,
  total_gross NUMERIC(10,2) DEFAULT 0,
  payment_method payment_method,
  sales_document_type sales_document_type DEFAULT 'NONE',
  sales_document_number TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  archive_reason TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view orders" ON public.service_orders
  FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "Authenticated can insert orders" ON public.service_orders
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update orders" ON public.service_orders
  FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_orders_status ON public.service_orders (status);
CREATE INDEX idx_orders_client ON public.service_orders (client_id);
CREATE INDEX idx_orders_assigned ON public.service_orders (assigned_user_id);
CREATE INDEX idx_orders_number ON public.service_orders (order_number);
CREATE INDEX idx_orders_received ON public.service_orders (received_at);

CREATE TRIGGER update_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  year_str TEXT;
  seq_num INTEGER;
BEGIN
  year_str := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(split_part(order_number, '/', 3) AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM public.service_orders
  WHERE order_number LIKE 'SRV/' || year_str || '/%';
  
  NEW.order_number := 'SRV/' || year_str || '/' || lpad(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.service_orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION public.generate_order_number();

-- ==========================================
-- SERVICE ORDER COMMENTS
-- ==========================================

CREATE TABLE public.service_order_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_order_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view comments" ON public.service_order_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert comments" ON public.service_order_comments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_comments_order ON public.service_order_comments (order_id);

-- ==========================================
-- ACTIVITY LOGS
-- ==========================================

CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  old_value_json JSONB,
  new_value_json JSONB,
  user_id UUID REFERENCES auth.users(id),
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert logs" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_activity_entity ON public.activity_logs (entity_type, entity_id);
CREATE INDEX idx_activity_created ON public.activity_logs (created_at);
