import { supabase } from "@/integrations/supabase/client";

interface WarehouseDocItem {
  inventory_item_id: string;
  quantity: number;
  price_net: number;
  notes?: string;
}

interface CreateWarehouseDocParams {
  document_type: "PZ" | "WZ" | "PW" | "RW" | "CORRECTION";
  document_date?: string;
  client_id?: string | null;
  related_order_id?: string | null;
  linked_invoice_id?: string | null;
  notes?: string;
  created_by?: string | null;
  items: WarehouseDocItem[];
}

const MOVEMENT_TYPE_MAP: Record<string, string> = {
  PZ: "IN",
  WZ: "OUT",
  PW: "IN",
  RW: "OUT",
  CORRECTION: "ADJUSTMENT",
};

export async function createWarehouseDocument(params: CreateWarehouseDocParams): Promise<string | null> {
  const { data: doc, error } = await (supabase.from("warehouse_documents") as any).insert({
    document_type: params.document_type,
    document_date: params.document_date || new Date().toISOString().split("T")[0],
    client_id: params.client_id || null,
    related_order_id: params.related_order_id || null,
    linked_invoice_id: params.linked_invoice_id || null,
    notes: params.notes || null,
    created_by: params.created_by || null,
  }).select().single();

  if (error || !doc) {
    console.error("Failed to create warehouse document:", error);
    return null;
  }

  const docId = (doc as any).id;
  const movementType = MOVEMENT_TYPE_MAP[params.document_type];

  for (let i = 0; i < params.items.length; i++) {
    const item = params.items[i];
    const { data: inserted } = await (supabase.from("warehouse_document_items") as any).insert({
      warehouse_document_id: docId,
      inventory_item_id: item.inventory_item_id,
      quantity: item.quantity,
      price_net: item.price_net,
      notes: item.notes || null,
      sort_order: i,
    }).select().single();

    if (inserted) {
      await (supabase.from("inventory_movements") as any).insert({
        item_id: item.inventory_item_id,
        movement_type: movementType,
        quantity: item.quantity,
        purchase_net: item.price_net,
        source_id: (inserted as any).id,
        source_type: "DOCUMENT",
        notes: `${params.document_type} auto — ${params.notes || ""}`.trim(),
        created_by: params.created_by || null,
      });
    }
  }

  return docId;
}
