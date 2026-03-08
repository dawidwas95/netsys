import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import {
  ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, DEVICE_CATEGORY_LABELS,
  type OrderStatus, type PaymentMethod, type DeviceCategory,
} from "@/types/database";

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
  margins: { top: 15, right: 15, bottom: 20, left: 15 },
  fontScale: 1.0,
  showLogo: true,
  showCompanyData: true,
  logoAlignment: "left",
  clientDeviceLayout: "side-by-side",
  showTableBorders: true,
  showSectionSeparators: true,
  compactSpacing: false,
  footerText: "Dziękujemy za skorzystanie z usług W3-Support",
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
  { id: "pickup_code", label: "Kod odbioru", enabled: true },
  { id: "internal_notes", label: "Notatki wewnętrzne", enabled: false },
  { id: "signatures", label: "Podpisy", enabled: true },
  { id: "footer", label: "Stopka", enabled: true },
];

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

// Font cache
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

interface OrderPDFData {
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
  const enabledSections = new Set(config.sections.filter(sec => sec.enabled).map(sec => sec.id));

  const doc = new jsPDF("p", "mm", "a4");
  const hasFont = await setupFonts(doc);
  const fontFamily = hasFont ? "Roboto" : "helvetica";

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ml = s.margins.left;
  const mr = pageW - s.margins.right;
  const cw = mr - ml;
  const fs = s.fontScale;
  const spacing = s.compactSpacing ? 3 : 5;

  const primary: [number, number, number] = [37, 99, 235];
  const dark: [number, number, number] = [30, 30, 30];
  const gray: [number, number, number] = [120, 120, 120];
  const lightBg: [number, number, number] = [245, 245, 245];
  const border: [number, number, number] = [210, 210, 210];

  let y = s.margins.top;

  function checkPage(needed: number) {
    if (y + needed > pageH - s.margins.bottom - 10) { doc.addPage(); y = s.margins.top; }
  }

  function setNormal(size: number) {
    doc.setFont(fontFamily, "normal"); doc.setFontSize(size * fs); doc.setTextColor(...dark);
  }
  function setBold(size: number) {
    doc.setFont(fontFamily, "bold"); doc.setFontSize(size * fs); doc.setTextColor(...dark);
  }
  function setGray(size: number) {
    doc.setFont(fontFamily, "normal"); doc.setFontSize(size * fs); doc.setTextColor(...gray);
  }

  function drawSectionTitle(title: string) {
    checkPage(14);
    y += spacing;
    if (s.showSectionSeparators) {
      doc.setFillColor(...lightBg);
      doc.setDrawColor(...border);
      doc.roundedRect(ml, y - 4.5, cw, 8, 1.5, 1.5, "FD");
    }
    doc.setFont(fontFamily, "bold"); doc.setFontSize(8.5 * fs); doc.setTextColor(...primary);
    doc.text(title.toUpperCase(), ml + 3, y + 0.5);
    doc.setTextColor(...dark);
    y += 9;
  }

  function drawField(label: string, value: string | undefined | null, x: number, width: number) {
    checkPage(6);
    setGray(7.5);
    doc.text(label, x, y);
    setNormal(8.5);
    const val = value || "—";
    const lines = doc.splitTextToSize(val, width - 38);
    doc.text(lines, x + 36, y);
    return lines.length * 3.5;
  }

  function drawFieldPair(l1: string, v1: string | null | undefined, l2: string, v2: string | null | undefined) {
    const halfW = cw / 2 - 1;
    drawField(l1, v1, ml + 2, halfW);
    drawField(l2, v2, ml + halfW + 4, halfW);
    y += spacing;
  }

  function drawTextBlock(label: string, text: string | null | undefined) {
    if (!text) return;
    checkPage(15);
    setBold(8); doc.setTextColor(...gray);
    doc.text(label, ml + 2, y); y += 4;
    setNormal(8.5);
    const lines = doc.splitTextToSize(text, cw - 4);
    lines.forEach((line: string) => { checkPage(4.5); doc.text(line, ml + 2, y); y += 4; });
    y += 2;
  }

  // Render sections in order
  for (const section of config.sections) {
    if (!section.enabled) continue;

    switch (section.id) {
      case "company_header": {
        if (s.showCompanyData) {
          doc.setFillColor(...primary);
          doc.rect(0, 0, pageW, 26, "F");
          doc.setTextColor(255, 255, 255);
          setBold(16); doc.setTextColor(255, 255, 255);
          const logoX = s.logoAlignment === "center" ? pageW / 2 : s.logoAlignment === "right" ? mr : ml;
          const align = s.logoAlignment === "center" ? "center" : s.logoAlignment === "right" ? "right" : "left";
          doc.text(company.company_name, logoX, 11, { align });
          setNormal(7.5); doc.setTextColor(220, 230, 255);
          const infoLine = [company.phone, company.email, company.nip ? `NIP: ${company.nip}` : null].filter(Boolean).join("  •  ");
          if (infoLine) doc.text(infoLine, logoX, 17, { align });
          const addrLine = [company.address_street, company.address_postal_code, company.address_city].filter(Boolean).join(", ");
          if (addrLine) doc.text(addrLine, logoX, 22, { align });
          y = 32;
        }
        break;
      }
      case "document_title": {
        checkPage(12);
        setBold(13);
        doc.text("POTWIERDZENIE PRZYJĘCIA DO SERWISU", ml, y);
        y += 5;
        setGray(8);
        doc.text(`Wygenerowano: ${new Date().toLocaleDateString("pl-PL")} ${new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`, ml, y);
        y += 7;
        break;
      }
      case "order_details": {
        drawSectionTitle("Dane zlecenia");
        const statusLabel = ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status;
        drawFieldPair("Numer zlecenia:", order.order_number, "Status:", statusLabel);
        drawFieldPair("Data przyjęcia:", new Date(order.received_at).toLocaleDateString("pl-PL"),
          "Zakończenie:", order.completed_at ? new Date(order.completed_at).toLocaleDateString("pl-PL") : "—");
        if (order.estimated_completion_date) {
          drawField("Termin realizacji:", order.estimated_completion_date, ml + 2, cw); y += spacing;
        }
        break;
      }
      case "client_data": {
        drawSectionTitle("Dane klienta");
        if (s.clientDeviceLayout === "side-by-side" && enabledSections.has("device_data") && order.devices) {
          // Side-by-side: client left, device right
          const halfW = cw / 2 - 2;
          const startY = y;
          if (order.clients?.display_name) { drawField("Nazwa:", order.clients.display_name, ml + 2, halfW); y += spacing; }
          if (order.clients?.phone) { drawField("Telefon:", order.clients.phone, ml + 2, halfW); y += spacing; }
          if (order.clients?.email) { drawField("E-mail:", order.clients.email, ml + 2, halfW); y += spacing; }
          if (order.clients?.nip) { drawField("NIP:", order.clients.nip, ml + 2, halfW); y += spacing; }
          const clientEndY = y;
          // Device on right side
          y = startY;
          const dx = ml + halfW + 6;
          if (order.devices.device_category) { drawField("Kategoria:", DEVICE_CATEGORY_LABELS[order.devices.device_category as DeviceCategory] ?? order.devices.device_category, dx, halfW); y += spacing; }
          if (order.devices.manufacturer) { drawField("Producent:", order.devices.manufacturer, dx, halfW); y += spacing; }
          if (order.devices.model) { drawField("Model:", order.devices.model, dx, halfW); y += spacing; }
          if (order.devices.serial_number) { drawField("Nr seryjny:", order.devices.serial_number, dx, halfW); y += spacing; }
          if (order.devices.imei) { drawField("IMEI:", order.devices.imei, dx, halfW); y += spacing; }
          y = Math.max(y, clientEndY) + 2;
          // Mark device_data as already rendered
          enabledSections.delete("device_data");
        } else {
          if (order.clients?.display_name) { drawField("Nazwa:", order.clients.display_name, ml + 2, cw); y += spacing; }
          if (order.clients?.phone) { drawField("Telefon:", order.clients.phone, ml + 2, cw); y += spacing; }
          if (order.clients?.email) { drawField("E-mail:", order.clients.email, ml + 2, cw); y += spacing; }
          if (order.clients?.nip) { drawField("NIP:", order.clients.nip, ml + 2, cw); y += spacing; }
        }
        break;
      }
      case "device_data": {
        if (!order.devices) break;
        drawSectionTitle("Dane urządzenia");
        if (order.devices.device_category) { drawField("Kategoria:", DEVICE_CATEGORY_LABELS[order.devices.device_category as DeviceCategory] ?? order.devices.device_category, ml + 2, cw); y += spacing; }
        drawFieldPair("Producent:", order.devices.manufacturer, "Model:", order.devices.model);
        drawFieldPair("Nr seryjny:", order.devices.serial_number, "IMEI:", order.devices.imei);
        break;
      }
      case "device_spec": {
        if (!order.devices) break;
        const d = order.devices;
        const hasSpec = d.cpu || d.ram_gb || d.gpu || d.storage1_type || d.motherboard;
        if (!hasSpec) break;
        drawSectionTitle("Specyfikacja techniczna");
        if (d.cpu) { drawField("Procesor:", d.cpu, ml + 2, cw); y += spacing; }
        if (d.ram_gb) { drawField("RAM:", `${d.ram_gb} GB${d.ram_type ? ` (${d.ram_type})` : ""}`, ml + 2, cw); y += spacing; }
        if (d.gpu) { drawField("GPU:", d.gpu, ml + 2, cw); y += spacing; }
        if (d.storage1_type) { drawField("Dysk 1:", `${d.storage1_type} ${d.storage1_size || ""}`, ml + 2, cw); y += spacing; }
        if (d.storage2_type) { drawField("Dysk 2:", `${d.storage2_type} ${d.storage2_size || ""}`, ml + 2, cw); y += spacing; }
        if (d.motherboard) { drawField("Płyta gł.:", d.motherboard, ml + 2, cw); y += spacing; }
        if (d.psu) { drawField("Zasilacz:", d.psu, ml + 2, cw); y += spacing; }
        if (d.operating_system) { drawField("System:", d.operating_system, ml + 2, cw); y += spacing; }
        break;
      }
      case "problem_description": {
        if (!order.problem_description) break;
        drawSectionTitle("Opis usterki");
        drawTextBlock("Zgłoszenie klienta:", order.problem_description);
        if (order.client_description) drawTextBlock("Opis klienta:", order.client_description);
        break;
      }
      case "accessories": {
        if (!order.accessories_received) break;
        drawSectionTitle("Akcesoria");
        let accList: string[] = [];
        try {
          const parsed = JSON.parse(order.accessories_received);
          if (Array.isArray(parsed)) accList = parsed;
        } catch {
          accList = order.accessories_received.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
        if (accList.length) {
          accList.forEach((acc: string) => { checkPage(5); setNormal(8.5); doc.text(`•  ${acc}`, ml + 4, y); y += 4; });
          y += 2;
        } else {
          drawField("Akcesoria:", order.accessories_received, ml + 2, cw); y += spacing;
        }
        break;
      }
      case "visual_condition": {
        if (!order.visual_condition) break;
        drawSectionTitle("Stan wizualny");
        drawTextBlock("Opis stanu:", order.visual_condition);
        break;
      }
      case "diagnosis": {
        if (!order.diagnosis) break;
        drawSectionTitle("Diagnoza");
        drawTextBlock("", order.diagnosis);
        break;
      }
      case "repair_description": {
        if (!order.repair_description) break;
        drawSectionTitle("Opis naprawy");
        drawTextBlock("", order.repair_description);
        break;
      }
      case "pickup_code": {
        if (!order.lock_code) break;
        drawSectionTitle("Kod odbioru / hasło");
        setBold(10);
        doc.text(order.lock_code, ml + 2, y);
        y += 7;
        break;
      }
      case "internal_notes": {
        if (!order.internal_notes) break;
        drawSectionTitle("Notatki wewnętrzne");
        drawTextBlock("", order.internal_notes);
        break;
      }
      case "financial": {
        drawSectionTitle("Rozliczenie");
        checkPage(40);
        // Items table
        if (orderItems.length > 0) {
          doc.setFillColor(240, 240, 240);
          doc.rect(ml, y - 3.5, cw, 6, "F");
          if (s.showTableBorders) { doc.setDrawColor(...border); doc.rect(ml, y - 3.5, cw, 6, "S"); }
          setBold(7); doc.setTextColor(...gray);
          doc.text("Nazwa", ml + 2, y);
          doc.text("Ilość", ml + 85, y, { align: "right" });
          doc.text("Cena jedn.", ml + 115, y, { align: "right" });
          doc.text("Wartość", mr - 2, y, { align: "right" });
          y += 5;
          orderItems.forEach((item: any, idx: number) => {
            checkPage(6);
            if (idx % 2 === 0) { doc.setFillColor(250, 250, 252); doc.rect(ml, y - 3.5, cw, 5.5, "F"); }
            if (s.showTableBorders) { doc.setDrawColor(235, 235, 235); doc.rect(ml, y - 3.5, cw, 5.5, "S"); }
            setNormal(8);
            doc.text(item.item_name_snapshot, ml + 2, y);
            doc.text(item.quantity.toString(), ml + 85, y, { align: "right" });
            doc.text(formatCurrency(item.sale_net), ml + 115, y, { align: "right" });
            doc.text(formatCurrency(item.total_sale_net), mr - 2, y, { align: "right" });
            y += 5.5;
          });
          y += 3;
        }
        // Summary box
        checkPage(35);
        doc.setFillColor(248, 250, 255);
        doc.setDrawColor(...primary); doc.setLineWidth(0.3);
        doc.roundedRect(ml, y - 2, cw, 32, 2, 2, "FD");
        doc.setLineWidth(0.1);
        const fy = y;
        setGray(8); doc.text("Usługa (netto):", ml + 4, fy + 4); setNormal(8.5); doc.text(formatCurrency(financials.laborNet), ml + 50, fy + 4);
        setGray(8); doc.text("Koszt części:", ml + 4, fy + 9); setNormal(8.5); doc.text(formatCurrency(financials.partsCost), ml + 50, fy + 9);
        setGray(8); doc.text("Koszt dodatkowy:", ml + 4, fy + 14); setNormal(8.5); doc.text(formatCurrency(financials.extraCost), ml + 50, fy + 14);
        // Right: total
        setBold(9); doc.setTextColor(...primary);
        doc.text("DO ZAPŁATY (brutto):", ml + 95, fy + 6);
        doc.setFontSize(15 * fs);
        doc.text(formatCurrency(financials.revenue * 1.23), ml + 95, fy + 15);
        setGray(8);
        if (order.payment_method) doc.text(`Płatność: ${PAYMENT_METHOD_LABELS[order.payment_method as PaymentMethod] ?? order.payment_method}`, ml + 95, fy + 22);
        doc.text(`Status: ${order.is_paid ? "Opłacone" : "Nieopłacone"}`, ml + 95, fy + 27);
        y = fy + 37;
        break;
      }
      case "signatures": {
        const sigY = Math.max(y + 8, 250);
        checkPage(30);
        doc.setDrawColor(...border);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(ml, sigY, ml + 70, sigY);
        doc.line(mr - 70, sigY, mr, sigY);
        doc.setLineDashPattern([], 0);
        setGray(7.5);
        doc.text("Podpis klienta", ml + 18, sigY + 5);
        doc.text("Podpis serwisanta", mr - 52, sigY + 5);
        y = sigY + 10;
        break;
      }
      case "footer": {
        doc.setDrawColor(...border);
        doc.line(ml, pageH - 12, mr, pageH - 12);
        doc.setFontSize(6.5 * fs); doc.setTextColor(180, 180, 180);
        doc.setFont(fontFamily, "normal");
        const footerText = s.footerText || `Dokument wygenerowany automatycznie — ${company.company_name}`;
        doc.text(footerText, pageW / 2, pageH - 8, { align: "center" });
        break;
      }
    }
  }

  return doc;
}
