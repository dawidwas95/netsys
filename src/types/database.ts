import type { Database } from "@/integrations/supabase/types";

export type Tables = Database["public"]["Tables"];

export type Client = Tables["clients"]["Row"];
export type ClientInsert = Tables["clients"]["Insert"];
export type ClientUpdate = Tables["clients"]["Update"];

export type ClientContact = Tables["client_contacts"]["Row"];
export type ClientContactInsert = Tables["client_contacts"]["Insert"];

export type Device = Tables["devices"]["Row"];
export type DeviceInsert = Tables["devices"]["Insert"];

export type ServiceOrder = Tables["service_orders"]["Row"];
export type ServiceOrderInsert = Tables["service_orders"]["Insert"];
export type ServiceOrderUpdate = Tables["service_orders"]["Update"];

export type ServiceOrderComment = Tables["service_order_comments"]["Row"];
export type ServiceOrderCommentInsert = Tables["service_order_comments"]["Insert"];

export type ActivityLog = Tables["activity_logs"]["Row"];
export type Profile = Tables["profiles"]["Row"];
export type UserRole = Tables["user_roles"]["Row"];

// Enums
export type ClientType = Database["public"]["Enums"]["client_type"];
export type DeviceCategory = Database["public"]["Enums"]["device_category"];
export type DeviceStatus = Database["public"]["Enums"]["device_status"];
export type ServiceType = Database["public"]["Enums"]["service_type"];
export type OrderPriority = Database["public"]["Enums"]["order_priority"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type IntakeChannel = Database["public"]["Enums"]["intake_channel"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type SalesDocumentType = Database["public"]["Enums"]["sales_document_type"];
export type AppRole = Database["public"]["Enums"]["app_role"];

// Extended types with relations
export type ServiceOrderWithRelations = ServiceOrder & {
  clients?: Client | null;
  devices?: Device | null;
  profiles?: Profile | null;
};

// Labels
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Nowe",
  DIAGNOSIS: "Diagnostyka",
  IN_PROGRESS: "W trakcie",
  WAITING_CLIENT: "Kontakt z klientem",
  READY_FOR_RETURN: "Do zwrotu",
  COMPLETED: "Zakończone",
  ARCHIVED: "Archiwum",
  CANCELLED: "Anulowane",
};

export const ORDER_PRIORITY_LABELS: Record<OrderPriority, string> = {
  LOW: "Niski",
  NORMAL: "Normalny",
  HIGH: "Wysoki",
  URGENT: "Pilny",
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  COMPUTER_SERVICE: "Serwis komputerowy",
  PHONE_SERVICE: "Serwis telefonów",
};

export const DEVICE_CATEGORY_LABELS: Record<DeviceCategory, string> = {
  DESKTOP: "Komputer stacjonarny",
  LAPTOP: "Laptop",
  PHONE: "Telefon",
  TABLET: "Tablet",
  PRINTER: "Drukarka",
  SERVER: "Serwer",
  ROUTER: "Router",
  SWITCH: "Switch",
  AP: "Access Point",
  NVR: "NVR",
  CAMERA: "Kamera",
  OTHER: "Inne",
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  PRIVATE: "Osoba prywatna",
  COMPANY: "Firma",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Gotówka",
  CARD: "Karta",
  TRANSFER: "Przelew",
};

export const INTAKE_CHANNEL_LABELS: Record<IntakeChannel, string> = {
  PHONE: "Telefon",
  EMAIL: "E-mail",
  IN_PERSON: "Osobiście",
  REMOTE: "Zdalnie",
  OTHER: "Inne",
};

// Kanban columns config
export const KANBAN_COLUMNS: { status: OrderStatus; label: string; color: string }[] = [
  { status: "NEW", label: "Nowe", color: "bg-status-new" },
  { status: "DIAGNOSIS", label: "Diagnostyka", color: "bg-status-diagnosis" },
  { status: "IN_PROGRESS", label: "W trakcie", color: "bg-status-in-progress" },
  { status: "WAITING_CLIENT", label: "Kontakt z klientem", color: "bg-status-waiting" },
  { status: "READY_FOR_RETURN", label: "Do zwrotu", color: "bg-status-ready" },
  { status: "COMPLETED", label: "Zakończone", color: "bg-status-completed" },
];
