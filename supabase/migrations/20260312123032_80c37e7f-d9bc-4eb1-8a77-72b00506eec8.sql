
-- Disable triggers temporarily to avoid stock updates etc.
SET session_replication_role = 'replica';

-- Child/junction tables
TRUNCATE TABLE public.comment_reads CASCADE;
TRUNCATE TABLE public.billing_batch_items CASCADE;
TRUNCATE TABLE public.it_work_comments CASCADE;
TRUNCATE TABLE public.network_devices CASCADE;
TRUNCATE TABLE public.offer_items CASCADE;
TRUNCATE TABLE public.document_items CASCADE;
TRUNCATE TABLE public.document_attachments CASCADE;
TRUNCATE TABLE public.warehouse_document_items CASCADE;
TRUNCATE TABLE public.service_order_photos CASCADE;
TRUNCATE TABLE public.service_order_items CASCADE;
TRUNCATE TABLE public.service_order_comments CASCADE;
TRUNCATE TABLE public.order_technicians CASCADE;
TRUNCATE TABLE public.customer_messages CASCADE;
TRUNCATE TABLE public.inventory_movements CASCADE;
TRUNCATE TABLE public.inventory_reservations CASCADE;
TRUNCATE TABLE public.purchase_requests CASCADE;
TRUNCATE TABLE public.notification_log CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.cash_transactions CASCADE;

-- Mid-level tables
TRUNCATE TABLE public.billing_batches CASCADE;
TRUNCATE TABLE public.warehouse_documents CASCADE;
TRUNCATE TABLE public.offers CASCADE;
TRUNCATE TABLE public.documents CASCADE;
TRUNCATE TABLE public.it_work_entries CASCADE;
TRUNCATE TABLE public.service_orders CASCADE;
TRUNCATE TABLE public.inventory_items CASCADE;
TRUNCATE TABLE public.devices CASCADE;
TRUNCATE TABLE public.client_contacts CASCADE;
TRUNCATE TABLE public.client_it_documents CASCADE;
TRUNCATE TABLE public.clients CASCADE;
TRUNCATE TABLE public.activity_logs CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';
