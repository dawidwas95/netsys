import { supabase } from "@/integrations/supabase/client";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanScanValue(value: string): string {
  return value.trim().replace(/^['"\s]+|['"\s]+$/g, "");
}

function getUrlCandidates(rawValue: string) {
  try {
    const url = new URL(rawValue);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const section = pathParts[0]?.toLowerCase();
    const tokenQuery = url.searchParams.get("token");

    return {
      token: tokenQuery ?? (section === "status" && pathParts[1] ? pathParts[1] : null),
      orderIdPath: section === "orders" && pathParts[1] ? pathParts[1] : null,
      orderNumberPath: section === "order" && pathParts[1] ? decodeURIComponent(pathParts[1]) : null,
      lastPathPart: pathParts[pathParts.length - 1] ?? null,
    };
  } catch {
    return { token: null, orderIdPath: null, orderNumberPath: null, lastPathPart: null };
  }
}

async function findOrderIdByToken(token: string): Promise<string | null> {
  const { data } = await supabase
    .from("service_orders")
    .select("id")
    .eq("status_token", token)
    .maybeSingle();

  return data?.id ?? null;
}

async function findOrderIdById(orderId: string): Promise<string | null> {
  const { data } = await supabase
    .from("service_orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();

  return data?.id ?? null;
}

async function findOrderIdByNumber(orderNumber: string): Promise<string | null> {
  const normalized = orderNumber.trim();
  if (!normalized) return null;

  const variants = [normalized, normalized.toUpperCase(), normalized.toLowerCase()];
  for (const value of variants) {
    const { data } = await supabase
      .from("service_orders")
      .select("id")
      .eq("order_number", value)
      .maybeSingle();

    if (data?.id) return data.id;
  }

  return null;
}

export async function resolveOrderRouteFromScan(scannedValue: string): Promise<string | null> {
  const cleaned = cleanScanValue(scannedValue);
  if (!cleaned) return null;

  const candidates = getUrlCandidates(cleaned);

  if (candidates.token) {
    const byToken = await findOrderIdByToken(candidates.token);
    if (byToken) return `/orders/${byToken}`;
  }

  if (candidates.orderIdPath && UUID_REGEX.test(candidates.orderIdPath)) {
    const byPathId = await findOrderIdById(candidates.orderIdPath);
    if (byPathId) return `/orders/${byPathId}`;
  }

  if (candidates.orderNumberPath) {
    const byPathNumber = await findOrderIdByNumber(candidates.orderNumberPath);
    if (byPathNumber) return `/orders/${byPathNumber}`;
  }

  if (UUID_REGEX.test(cleaned)) {
    const byRawId = await findOrderIdById(cleaned);
    if (byRawId) return `/orders/${byRawId}`;
  }

  const byRawNumber = await findOrderIdByNumber(cleaned);
  if (byRawNumber) return `/orders/${byRawNumber}`;

  if (candidates.lastPathPart && UUID_REGEX.test(candidates.lastPathPart)) {
    const byLastPartId = await findOrderIdById(candidates.lastPathPart);
    if (byLastPartId) return `/orders/${byLastPartId}`;
  }

  if (candidates.lastPathPart) {
    const byLastPartNumber = await findOrderIdByNumber(candidates.lastPathPart);
    if (byLastPartNumber) return `/orders/${byLastPartNumber}`;
  }

  return null;
}
