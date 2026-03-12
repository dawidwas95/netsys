import jsPDF from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import {
  ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, DEVICE_CATEGORY_LABELS,
  type OrderStatus, type PaymentMethod, type DeviceCategory,
} from "@/types/database";

/* ───────────────────────── Types ───────────────────────── */

export interface PdfSection {
  id: string;
  label: string;
  enabled: boolean;
}

export interface PdfSettings {
  margins: { top: number; right: number; bottom: number; left: number };
  fontScale: number;
  showLogo: boolean;
  showCompanyData: boolean;
  logoAlignment: "left" | "center" | "right";
  clientDeviceLayout: "side-by-side" | "stacked";
  showTableBorders: boolean;
  showSectionSeparators: boolean;
  compactSpacing: boolean;
  footerText: string;
}

export interface PdfTemplateConfig {
  settings: PdfSettings;
  sections: PdfSection[];
}

export interface CompanyInfo {
  company_name: string;
  address_street?: string | null;
  address_city?: string | null;
  address_postal_code?: string | null;
  nip?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
}

export const DEFAULT_SETTINGS: PdfSettings = {
  margins: { top: 12, right: 12, bottom: 12, left: 12 },
  fontScale: 1.0,
  showLogo: true,
  showCompanyData: true,
  logoAlignment: "left",
  clientDeviceLayout: "side-by-side",
  showTableBorders: true,
  showSectionSeparators: true,
  compactSpacing: true,
  footerText: "Dziękujemy za skorzystanie z usług naszego serwisu. Dokument wygenerowany elektronicznie.",
};

export const SERVICE_ORDER_SECTIONS: PdfSection[] = [
  { id: "company_header", label: "Nagłówek firmowy", enabled: true },
  { id: "document_title", label: "Tytuł dokumentu", enabled: true },
  { id: "client_data", label: "Dane klienta", enabled: true },
  { id: "device_data", label: "Dane urządzenia", enabled: true },
  { id: "device_spec", label: "Specyfikacja techniczna", enabled: true },
  { id: "order_details", label: "Szczegóły zlecenia", enabled: true },
  { id: "problem_description", label: "Opis usterki", enabled: true },
  { id: "accessories", label: "Akcesoria", enabled: true },
  { id: "visual_condition", label: "Stan wizualny", enabled: true },
  { id: "diagnosis", label: "Diagnoza", enabled: true },
  { id: "repair_description", label: "Opis naprawy", enabled: true },
  { id: "financial", label: "Rozliczenie", enabled: true },
  { id: "pickup_code", label: "Kod odbioru", enabled: false },
  { id: "internal_notes", label: "Notatki wewnętrzne", enabled: false },
  { id: "signatures", label: "Podpisy", enabled: true },
  { id: "footer", label: "Stopka", enabled: true },
];

/* ───────────────────────── Helpers ───────────────────────── */

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ───────────────────────── Font Loading ───────────────────────── */

let fontCacheRegular: string | null = null;
let fontCacheBold: string | null = null;

async function loadFontBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch { return null; }
}

async function setupFonts(doc: jsPDF) {
  if (!fontCacheRegular) fontCacheRegular = await loadFontBase64("/fonts/Roboto-Regular.ttf");
  if (!fontCacheBold) fontCacheBold = await loadFontBase64("/fonts/Roboto-Bold.ttf");
  if (fontCacheRegular) {
    doc.addFileToVFS("Roboto-Regular.ttf", fontCacheRegular);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  }
  if (fontCacheBold) {
    doc.addFileToVFS("Roboto-Bold.ttf", fontCacheBold);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  }
  if (fontCacheRegular || fontCacheBold) {
    doc.setFont("Roboto");
    return true;
  }
  return false;
}

/* ───────────────────────── DB helpers ───────────────────────── */

export async function loadActiveTemplate(documentType: string): Promise<PdfTemplateConfig | null> {
  const { data } = await supabase
    .from("pdf_templates")
    .select("config")
    .eq("document_type", documentType)
    .eq("is_active", true)
    .limit(1);
  if (data?.[0]?.config) return data[0].config as unknown as PdfTemplateConfig;
  return null;
}

export async function loadCompanySettings(): Promise<CompanyInfo> {
  const { data } = await supabase.from("company_settings").select("*").limit(1);
  return data?.[0] ?? { company_name: "W3-Support" };
}

/* ───────────────────────── Drawing primitives ───────────────────────── */

class PdfBuilder {
  doc: jsPDF;
  fontFamily: string;
  y: number;
  ml: number;
  mr: number;
  cw: number;
  pageW: number;
  pageH: number;
  fs: number;
  spacing: number;
  marginTop: number;
  marginBottom: number;
  showBorders: boolean;
  showSeparators: boolean;

  // Colors
  static PRIMARY: [number, number, number] = [30, 64, 130];
  static DARK: [number, number, number] = [33, 37, 41];
  static GRAY: [number, number, number] = [108, 117, 125];
  static LIGHT_GRAY: [number, number, number] = [173, 181, 189];
  static BG_SECTION: [number, number, number] = [248, 249, 250];
  static BG_HEADER: [number, number, number] = [233, 236, 239];
  static BORDER: [number, number, number] = [206, 212, 218];
  static WHITE: [number, number, number] = [255, 255, 255];
  static ACCENT: [number, number, number] = [13, 110, 253];
  static SUCCESS: [number, number, number] = [25, 135, 84];
  static DANGER: [number, number, number] = [220, 53, 69];

  constructor(doc: jsPDF, fontFamily: string, settings: PdfSettings) {
    this.doc = doc;
    this.fontFamily = fontFamily;
    this.pageW = doc.internal.pageSize.getWidth();
    this.pageH = doc.internal.pageSize.getHeight();
    this.ml = settings.margins.left;
    this.mr = this.pageW - settings.margins.right;
    this.cw = this.mr - this.ml;
    this.fs = settings.fontScale;
    this.spacing = settings.compactSpacing ? 3 : 5;
    this.marginTop = settings.margins.top;
    this.marginBottom = settings.margins.bottom;
    this.y = settings.margins.top;
    this.showBorders = settings.showTableBorders;
    this.showSeparators = settings.showSectionSeparators;
  }

  checkPage(needed: number) {
    if (this.y + needed > this.pageH - this.marginBottom - 10) {
      this.doc.addPage();
      this.y = this.marginTop;
    }
  }

  setFont(style: "normal" | "bold", size: number, color: [number, number, number] = PdfBuilder.DARK) {
    this.doc.setFont(this.fontFamily, style);
    this.doc.setFontSize(size * this.fs);
    this.doc.setTextColor(...color);
  }

  // ── Section header with icon-like bar ──
  drawSectionHeader(title: string) {
    this.checkPage(10);
    this.y += this.spacing;

    // Accent bar on left
    this.doc.setFillColor(...PdfBuilder.PRIMARY);
    this.doc.rect(this.ml, this.y - 3.5, 2.5, 6, "F");

    // Background bar
    if (this.showSeparators) {
      this.doc.setFillColor(...PdfBuilder.BG_SECTION);
      this.doc.rect(this.ml + 2.5, this.y - 3.5, this.cw - 2.5, 6, "F");
    }

    this.setFont("bold", 7.5, PdfBuilder.PRIMARY);
    this.doc.text(title.toUpperCase(), this.ml + 6, this.y + 0.5);
    this.y += 7;
  }

  // ── Key-value field ──
  drawField(label: string, value: string | undefined | null, x: number, width: number, labelWidth = 32): number {
    this.checkPage(5);
    this.setFont("normal", 7.5, PdfBuilder.GRAY);
    this.doc.text(label, x, this.y);
    this.setFont("normal", 8.5, PdfBuilder.DARK);
    const val = value || "—";
    const lines = this.doc.splitTextToSize(val, width - labelWidth - 2);
    this.doc.text(lines, x + labelWidth, this.y);
    const lineH = lines.length * 3.8;
    return lineH;
  }

  drawFieldBold(label: string, value: string | undefined | null, x: number, width: number, labelWidth = 32): number {
    this.checkPage(5);
    this.setFont("normal", 7.5, PdfBuilder.GRAY);
    this.doc.text(label, x, this.y);
    this.setFont("bold", 8.5, PdfBuilder.DARK);
    const val = value || "—";
    const lines = this.doc.splitTextToSize(val, width - labelWidth - 2);
    this.doc.text(lines, x + labelWidth, this.y);
    return lines.length * 3.8;
  }

  // ── Two columns of key-value ──
  drawFieldPair(l1: string, v1: string | null | undefined, l2: string, v2: string | null | undefined) {
    const halfW = this.cw / 2 - 2;
    const h1 = this.drawField(l1, v1, this.ml + 2, halfW);
    const startY = this.y;
    this.drawField(l2, v2, this.ml + halfW + 6, halfW);
    this.y = startY + Math.max(h1, 3.8) + 1;
  }

  // ── Multi-line text block ──
  drawTextBlock(label: string, text: string | null | undefined) {
    if (!text) return;
    this.checkPage(10);
    if (label) {
      this.setFont("bold", 7, PdfBuilder.GRAY);
      this.doc.text(label, this.ml + 2, this.y);
      this.y += 3.5;
    }
    this.setFont("normal", 8, PdfBuilder.DARK);
    const lines: string[] = this.doc.splitTextToSize(text, this.cw - 6);
    for (const line of lines) {
      this.checkPage(3.8);
      this.doc.text(line, this.ml + 2, this.y);
      this.y += 3.5;
    }
    this.y += 1;
  }

  // ── Bordered info card ──
  drawInfoCard(x: number, width: number, fields: Array<{ label: string; value: string | null | undefined }>, title?: string) {
    const lineH = 3.8;
    const visibleFields = fields.filter(f => f.value);
    const cardH = (title ? lineH + 1 : 0) + visibleFields.length * lineH + 3;
    this.checkPage(cardH + 2);

    // Card border
    this.doc.setDrawColor(...PdfBuilder.BORDER);
    this.doc.setLineWidth(0.2);
    this.doc.roundedRect(x, this.y - 2, width, cardH, 1, 1, "S");

    const startY = this.y;

    if (title) {
      this.setFont("bold", 7.5, PdfBuilder.PRIMARY);
      this.doc.text(title, x + 3, this.y + 0.5);
      this.y += lineH + 1;
    }

    for (const f of visibleFields) {
      this.setFont("normal", 6.5, PdfBuilder.GRAY);
      this.doc.text(f.label, x + 3, this.y);
      this.setFont("normal", 7.5, PdfBuilder.DARK);
      const val = f.value || "—";
      const maxW = width - 34;
      const truncated = this.doc.splitTextToSize(val, maxW)[0] || val;
      this.doc.text(truncated, x + 28, this.y);
      this.y += lineH;
    }

    this.y = startY + cardH + 1;
    return cardH;
  }

  // ── Horizontal line ──
  drawHRule() {
    this.doc.setDrawColor(...PdfBuilder.BORDER);
    this.doc.setLineWidth(0.2);
    this.doc.line(this.ml, this.y, this.mr, this.y);
    this.y += 2;
  }
}

/* ───────────────────────── Main generator ───────────────────────── */

export interface OrderPDFData {
  order: any;
  orderItems: any[];
  financials: { revenue: number; totalCost: number; profit: number; laborNet: number; partsCost: number; extraCost: number; };
}

export async function generateOrderPDF({ order, orderItems, financials }: OrderPDFData) {
  const [templateConfig, company] = await Promise.all([
    loadActiveTemplate("SERVICE_ORDER"),
    loadCompanySettings(),
  ]);

  const config = templateConfig ?? { settings: DEFAULT_SETTINGS, sections: SERVICE_ORDER_SECTIONS };
  const s = config.settings;

  const doc = new jsPDF("p", "mm", "a4");
  const hasFont = await setupFonts(doc);
  const fontFamily = hasFont ? "Roboto" : "helvetica";

  const b = new PdfBuilder(doc, fontFamily, s);
  const enabledSections = new Set(config.sections.filter(sec => sec.enabled).map(sec => sec.id));

  // Generate QR code
  let qrDataUrl: string | null = null;
  try {
    const orderUrl = `${window.location.origin}/orders/${order.id}?scan=true`;
    qrDataUrl = await QRCode.toDataURL(orderUrl, { width: 200, margin: 1, errorCorrectionLevel: "M" });
  } catch {}

  for (const section of config.sections) {
    if (!section.enabled) continue;

    switch (section.id) {

      /* ═══════════════ COMPANY HEADER ═══════════════ */
      case "company_header": {
        if (!s.showCompanyData) break;

        // Dark header band
        doc.setFillColor(...PdfBuilder.PRIMARY);
        doc.rect(0, 0, b.pageW, 2, "F");

        // Company info - left side
        b.y = s.margins.top;
        b.setFont("bold", 12, PdfBuilder.PRIMARY);
        doc.text(company.company_name, b.ml, b.y);
        b.y += 4.5;

        b.setFont("normal", 7, PdfBuilder.GRAY);
        const addressParts = [company.address_street, company.address_postal_code, company.address_city].filter(Boolean);
        if (addressParts.length) { doc.text(addressParts.join(", "), b.ml, b.y); b.y += 3; }
        const contactLine = [company.phone ? `tel. ${company.phone}` : null, company.email].filter(Boolean).join("  |  ");
        if (contactLine) { doc.text(contactLine, b.ml, b.y); b.y += 3; }
        if (company.nip) { doc.text(`NIP: ${company.nip}`, b.ml, b.y); b.y += 3; }

        // QR code top-right
        if (qrDataUrl) {
          try { doc.addImage(qrDataUrl, "PNG", b.mr - 20, 4, 18, 18); } catch {}
        }

        // Separator under header
        b.y += 1;
        doc.setDrawColor(...PdfBuilder.PRIMARY);
        doc.setLineWidth(0.4);
        doc.line(b.ml, b.y, b.mr, b.y);
        b.y += 4;

        break;
      }

      /* ═══════════════ DOCUMENT TITLE ═══════════════ */
      case "document_title": {
        const statusLabel = ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status;
        const isCompleted = order.status === "ARCHIVED" || order.status === "READY_FOR_RETURN";
        const docTitle = isCompleted ? "PROTOKÓŁ SERWISOWY" : "POTWIERDZENIE PRZYJĘCIA DO SERWISU";

        b.setFont("bold", 12, PdfBuilder.DARK);
        doc.text(docTitle, b.ml, b.y);

        // Info on same line right-aligned
        b.setFont("bold", 9, PdfBuilder.PRIMARY);
        doc.text(order.order_number, b.mr - 2, b.y, { align: "right" });
        b.y += 4;

        b.setFont("normal", 7.5, PdfBuilder.GRAY);
        doc.text(`Status: ${statusLabel}  |  Data: ${fmtDate(order.received_at)}`, b.ml, b.y);
        b.y += 3;
        doc.setDrawColor(...PdfBuilder.BORDER);
        doc.setLineWidth(0.15);
        doc.line(b.ml, b.y, b.mr, b.y);
        b.y += 3;

        break;
      }

      /* ═══════════════ CLIENT DATA ═══════════════ */
      case "client_data": {
        if (s.clientDeviceLayout === "side-by-side" && enabledSections.has("device_data") && order.devices) {
          // ── Side-by-side cards ──
          const halfW = b.cw / 2 - 3;
          const startY = b.y;

          // Client card
          const clientFields = [
            { label: "Nazwa:", value: order.clients?.display_name },
            { label: "Telefon:", value: order.clients?.phone },
            { label: "E-mail:", value: order.clients?.email },
            { label: "NIP:", value: order.clients?.nip },
            { label: "Adres:", value: [order.clients?.address_street, order.clients?.address_city].filter(Boolean).join(", ") || null },
          ];
          b.drawInfoCard(b.ml, halfW, clientFields, "DANE KLIENTA");
          const clientEndY = b.y;

          // Device card
          b.y = startY;
          const d = order.devices;
          const deviceFields = [
            { label: "Kategoria:", value: d.device_category ? (DEVICE_CATEGORY_LABELS[d.device_category as DeviceCategory] ?? d.device_category) : null },
            { label: "Producent:", value: d.manufacturer },
            { label: "Model:", value: d.model },
            { label: "Nr seryjny:", value: d.serial_number },
            { label: "IMEI:", value: d.imei },
          ];
          b.drawInfoCard(b.ml + halfW + 6, halfW, deviceFields, "DANE URZĄDZENIA");

          b.y = Math.max(b.y, clientEndY);
          enabledSections.delete("device_data");
        } else {
          // ── Stacked client data ──
          b.drawSectionHeader("Dane klienta");
          b.drawFieldPair("Nazwa:", order.clients?.display_name, "Telefon:", order.clients?.phone);
          b.drawFieldPair("E-mail:", order.clients?.email, "NIP:", order.clients?.nip);
          const addr = [order.clients?.address_street, order.clients?.address_postal_code, order.clients?.address_city].filter(Boolean).join(", ");
          if (addr) { b.drawField("Adres:", addr, b.ml + 2, b.cw); b.y += b.spacing; }
        }
        break;
      }

      /* ═══════════════ DEVICE DATA (stacked) ═══════════════ */
      case "device_data": {
        if (!order.devices) break;
        b.drawSectionHeader("Dane urządzenia");
        const d = order.devices;
        if (d.device_category) { b.drawField("Kategoria:", DEVICE_CATEGORY_LABELS[d.device_category as DeviceCategory] ?? d.device_category, b.ml + 2, b.cw); b.y += b.spacing; }
        b.drawFieldPair("Producent:", d.manufacturer, "Model:", d.model);
        b.drawFieldPair("Nr seryjny:", d.serial_number, "IMEI:", d.imei);
        break;
      }

      /* ═══════════════ DEVICE SPEC ═══════════════ */
      case "device_spec": {
        if (!order.devices) break;
        const d = order.devices;
        const specs = [
          { label: "Procesor", value: d.cpu },
          { label: "RAM", value: d.ram_gb ? `${d.ram_gb} GB${d.ram_type ? ` ${d.ram_type}` : ""}` : null },
          { label: "GPU", value: d.gpu },
          { label: "Dysk 1", value: d.storage1_type ? `${d.storage1_type} ${d.storage1_size || ""}`.trim() : null },
          { label: "Dysk 2", value: d.storage2_type ? `${d.storage2_type} ${d.storage2_size || ""}`.trim() : null },
          { label: "Płyta gł.", value: d.motherboard },
          { label: "Zasilacz", value: d.psu },
          { label: "System", value: d.operating_system },
        ].filter(s => s.value);
        if (specs.length === 0) break;

        b.drawSectionHeader("Specyfikacja techniczna");

        // Mini spec table
        const colW = b.cw / 2 - 2;
        for (let i = 0; i < specs.length; i += 2) {
          b.checkPage(6);
          const row1 = specs[i];
          const row2 = specs[i + 1];

          // Zebra stripe
          if (Math.floor(i / 2) % 2 === 0) {
            doc.setFillColor(248, 249, 250);
            doc.rect(b.ml, b.y - 3, b.cw, 5.5, "F");
          }

          b.setFont("normal", 7.5, PdfBuilder.GRAY);
          doc.text(row1.label + ":", b.ml + 2, b.y);
          b.setFont("normal", 8.5, PdfBuilder.DARK);
          doc.text(row1.value!, b.ml + 24, b.y);

          if (row2) {
            b.setFont("normal", 7.5, PdfBuilder.GRAY);
            doc.text(row2.label + ":", b.ml + colW + 6, b.y);
            b.setFont("normal", 8.5, PdfBuilder.DARK);
            doc.text(row2.value!, b.ml + colW + 28, b.y);
          }
          b.y += 5.5;
        }
        b.y += 2;
        break;
      }

      /* ═══════════════ ORDER DETAILS ═══════════════ */
      case "order_details": {
        b.drawSectionHeader("Dane zlecenia");
        const statusLabel = ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status;
        b.drawFieldPair("Numer zlecenia:", order.order_number, "Status:", statusLabel);
        b.drawFieldPair("Data przyjęcia:", fmtDate(order.received_at), "Zakończenie:", fmtDate(order.completed_at));
        if (order.estimated_completion_date) {
          b.drawField("Termin realizacji:", order.estimated_completion_date, b.ml + 2, b.cw);
          b.y += b.spacing;
        }
        break;
      }

      /* ═══════════════ PROBLEM DESCRIPTION ═══════════════ */
      case "problem_description": {
        if (!order.problem_description && !order.client_description) break;
        b.drawSectionHeader("Opis zgłoszenia");
        if (order.problem_description) b.drawTextBlock("Zgłoszony problem:", order.problem_description);
        if (order.client_description) b.drawTextBlock("Opis klienta:", order.client_description);
        break;
      }

      /* ═══════════════ ACCESSORIES ═══════════════ */
      case "accessories": {
        if (!order.accessories_received) break;
        b.drawSectionHeader("Akcesoria przekazane");
        let accList: string[] = [];
        try {
          const parsed = JSON.parse(order.accessories_received);
          if (Array.isArray(parsed)) accList = parsed;
        } catch {
          accList = order.accessories_received.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
        if (accList.length) {
          for (const acc of accList) {
            b.checkPage(5);
            b.setFont("normal", 8.5, PdfBuilder.DARK);
            doc.text(`•  ${acc}`, b.ml + 4, b.y);
            b.y += 4.5;
          }
          b.y += 1;
        } else {
          b.drawField("Akcesoria:", order.accessories_received, b.ml + 2, b.cw);
          b.y += b.spacing;
        }
        break;
      }

      /* ═══════════════ VISUAL CONDITION ═══════════════ */
      case "visual_condition": {
        if (!order.visual_condition) break;
        b.drawSectionHeader("Stan wizualny urządzenia");
        b.drawTextBlock("", order.visual_condition);
        break;
      }

      /* ═══════════════ DIAGNOSIS ═══════════════ */
      case "diagnosis": {
        if (!order.diagnosis) break;
        b.drawSectionHeader("Diagnoza");
        b.drawTextBlock("", order.diagnosis);
        break;
      }

      /* ═══════════════ REPAIR DESCRIPTION ═══════════════ */
      case "repair_description": {
        if (!order.repair_description) break;
        b.drawSectionHeader("Wykonane prace");
        b.drawTextBlock("", order.repair_description);
        break;
      }

      /* ═══════════════ PICKUP CODE ═══════════════ */
      case "pickup_code": {
        if (!order.pickup_code) break;
        b.drawSectionHeader("Kod odbioru");
        b.setFont("bold", 10, PdfBuilder.DARK);
        doc.text(order.pickup_code, b.ml + 2, b.y);
        b.y += 7;
        break;
      }

      /* ═══════════════ INTERNAL NOTES ═══════════════ */
      case "internal_notes": {
        if (!order.internal_notes) break;
        b.drawSectionHeader("Notatki wewnętrzne");
        b.drawTextBlock("", order.internal_notes);
        break;
      }

      /* ═══════════════ FINANCIAL ═══════════════ */
      case "financial": {
        b.drawSectionHeader("Rozliczenie finansowe");
        b.checkPage(50);

        // ── Items table ──
        if (orderItems.length > 0) {
          const cols = { name: b.ml + 2, qty: b.ml + 90, unit: b.ml + 115, total: b.mr - 2 };

          // Table header
          doc.setFillColor(...PdfBuilder.PRIMARY);
          doc.rect(b.ml, b.y - 3.5, b.cw, 7, "F");
          b.setFont("bold", 7.5, PdfBuilder.WHITE);
          doc.text("Pozycja", cols.name, b.y);
          doc.text("Ilość", cols.qty, b.y, { align: "right" });
          doc.text("Cena jedn.", cols.unit, b.y, { align: "right" });
          doc.text("Wartość netto", cols.total, b.y, { align: "right" });
          b.y += 6;

          // Table rows
          orderItems.forEach((item: any, idx: number) => {
            b.checkPage(6);
            if (idx % 2 === 0) {
              doc.setFillColor(248, 249, 250);
              doc.rect(b.ml, b.y - 3.5, b.cw, 6, "F");
            }
            if (b.showBorders) {
              doc.setDrawColor(233, 236, 239);
              doc.setLineWidth(0.15);
              doc.line(b.ml, b.y + 2.5, b.mr, b.y + 2.5);
            }
            b.setFont("normal", 8, PdfBuilder.DARK);
            doc.text(item.item_name_snapshot, cols.name, b.y);
            doc.text(item.quantity.toString(), cols.qty, b.y, { align: "right" });
            doc.text(formatCurrency(item.sale_net), cols.unit, b.y, { align: "right" });
            doc.text(formatCurrency(item.total_sale_net), cols.total, b.y, { align: "right" });
            b.y += 6;
          });
          b.y += 3;
        }

        // ── Summary box ──
        b.checkPage(30);
        const boxH = 28;
        const boxY = b.y;

        // Left column - breakdown
        doc.setFillColor(248, 249, 250);
        doc.setDrawColor(...PdfBuilder.BORDER);
        doc.setLineWidth(0.3);
        doc.roundedRect(b.ml, boxY, b.cw / 2 - 2, boxH, 1.5, 1.5, "FD");

        let iy = boxY + 5;
        b.setFont("normal", 7, PdfBuilder.GRAY); doc.text("Usługa (netto):", b.ml + 3, iy);
        b.setFont("normal", 8, PdfBuilder.DARK); doc.text(formatCurrency(financials.laborNet), b.ml + 40, iy);
        iy += 4.5;
        b.setFont("normal", 7, PdfBuilder.GRAY); doc.text("Części (netto):", b.ml + 3, iy);
        b.setFont("normal", 8, PdfBuilder.DARK); doc.text(formatCurrency(financials.partsCost), b.ml + 40, iy);
        iy += 4.5;
        b.setFont("normal", 7, PdfBuilder.GRAY); doc.text("Koszty dodatkowe:", b.ml + 3, iy);
        b.setFont("normal", 8, PdfBuilder.DARK); doc.text(formatCurrency(financials.extraCost), b.ml + 40, iy);
        iy += 5.5;
        doc.setDrawColor(...PdfBuilder.BORDER);
        doc.line(b.ml + 3, iy - 2, b.ml + b.cw / 2 - 6, iy - 2);
        b.setFont("bold", 8, PdfBuilder.DARK); doc.text("Razem netto:", b.ml + 3, iy);
        b.setFont("bold", 8.5, PdfBuilder.DARK); doc.text(formatCurrency(financials.revenue), b.ml + 40, iy);

        // Right column - total to pay
        const rightX = b.ml + b.cw / 2 + 2;
        const rightW = b.cw / 2 - 2;
        doc.setFillColor(...PdfBuilder.PRIMARY);
        doc.roundedRect(rightX, boxY, rightW, boxH, 1.5, 1.5, "F");

        b.setFont("normal", 7.5, PdfBuilder.WHITE);
        doc.text("DO ZAPŁATY (brutto):", rightX + 5, boxY + 7);
        b.setFont("bold", 15, PdfBuilder.WHITE);
        doc.text(formatCurrency(financials.revenue * 1.23), rightX + 5, boxY + 16);

        let payY = boxY + 22;
        b.setFont("normal", 7, [200, 210, 230] as [number, number, number]);
        if (order.payment_method) {
          doc.text(`Płatność: ${PAYMENT_METHOD_LABELS[order.payment_method as PaymentMethod] ?? order.payment_method}`, rightX + 5, payY);
          payY += 3.5;
        }
        doc.text(`Status: ${order.is_paid ? "✓ Opłacone" : "Nieopłacone"}`, rightX + 5, payY);

        b.y = boxY + boxH + 3;
        break;
      }

      /* ═══════════════ SIGNATURES ═══════════════ */
      case "signatures": {
        const sigBoxH = 18;
        const sigNeeded = sigBoxH + 6;
        b.checkPage(sigNeeded);
        b.y += 3;

        const boxW = 72;
        const boxLeft = b.ml;
        const boxRight = b.mr - boxW;

        // Left box - client
        doc.setDrawColor(...PdfBuilder.BORDER);
        doc.setLineWidth(0.2);
        doc.roundedRect(boxLeft, b.y, boxW, sigBoxH, 1, 1, "S");
        b.setFont("bold", 7, PdfBuilder.GRAY);
        doc.text("PODPIS KLIENTA", boxLeft + boxW / 2, b.y - 1.5, { align: "center" });
        if (order.client_signature_url) {
          try { doc.addImage(order.client_signature_url, "PNG", boxLeft + 2, b.y + 1, boxW - 4, sigBoxH - 4); } catch {}
          if (order.client_signed_at) {
            b.setFont("normal", 5.5, PdfBuilder.LIGHT_GRAY);
            doc.text(new Date(order.client_signed_at).toLocaleString("pl-PL"), boxLeft + boxW / 2, b.y + sigBoxH - 1, { align: "center" });
          }
        } else {
          b.setFont("normal", 6.5, PdfBuilder.LIGHT_GRAY);
          doc.text("Data i podpis", boxLeft + boxW / 2, b.y + sigBoxH - 3, { align: "center" });
        }

        // Right box - technician
        doc.roundedRect(boxRight, b.y, boxW, sigBoxH, 1, 1, "S");
        b.setFont("bold", 7, PdfBuilder.GRAY);
        doc.text("PODPIS SERWISANTA", boxRight + boxW / 2, b.y - 1.5, { align: "center" });
        if (order.technician_signature_url) {
          try { doc.addImage(order.technician_signature_url, "PNG", boxRight + 2, b.y + 1, boxW - 4, sigBoxH - 4); } catch {}
          if (order.technician_signed_at) {
            b.setFont("normal", 5.5, PdfBuilder.LIGHT_GRAY);
            doc.text(new Date(order.technician_signed_at).toLocaleString("pl-PL"), boxRight + boxW / 2, b.y + sigBoxH - 1, { align: "center" });
          }
        } else {
          b.setFont("normal", 6.5, PdfBuilder.LIGHT_GRAY);
          doc.text("Data i podpis", boxRight + boxW / 2, b.y + sigBoxH - 3, { align: "center" });
        }

        b.y += sigBoxH + 2;
        break;
      }

      /* ═══════════════ FOOTER ═══════════════ */
      case "footer": {
        const footerY = b.pageH - 7;
        doc.setDrawColor(...PdfBuilder.BORDER);
        doc.setLineWidth(0.1);
        doc.line(b.ml, footerY - 2, b.mr, footerY - 2);

        const footerText = s.footerText || `Dokument wygenerowany elektronicznie — ${company.company_name}`;
        b.setFont("normal", 6, PdfBuilder.LIGHT_GRAY);
        doc.text(footerText, b.pageW / 2, footerY, { align: "center" });
        break;
      }
    }
  }

  return doc;
}
