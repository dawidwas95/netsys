import jsPDF from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import {
  ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, DEVICE_CATEGORY_LABELS,
  type OrderStatus, type PaymentMethod, type DeviceCategory,
} from "@/types/database";
import {
  type PdfSettings, type PdfSection, type PdfTemplateConfig, type CompanyInfo, type OrderPDFData,
  DEFAULT_SETTINGS, loadActiveTemplate, loadCompanySettings,
} from "./pdfEngine";

// Re-export for convenience
export type { OrderPDFData };

/* ──────────── Font cache (shared) ──────────── */
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
  if (fontCacheRegular) { doc.addFileToVFS("Roboto-Regular.ttf", fontCacheRegular); doc.addFont("Roboto-Regular.ttf", "Roboto", "normal"); }
  if (fontCacheBold) { doc.addFileToVFS("Roboto-Bold.ttf", fontCacheBold); doc.addFont("Roboto-Bold.ttf", "Roboto", "bold"); }
  if (fontCacheRegular || fontCacheBold) { doc.setFont("Roboto"); return true; }
  return false;
}

/* ──────────── QR Code helper ──────────── */
async function generateQRDataURL(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 200, margin: 1, errorCorrectionLevel: "M" });
}

/* ──────────── Helpers ──────────── */
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

const PRIMARY: [number, number, number] = [30, 64, 130];
const DARK: [number, number, number] = [33, 37, 41];
const GRAY: [number, number, number] = [108, 117, 125];
const LIGHT_GRAY: [number, number, number] = [173, 181, 189];
const BORDER: [number, number, number] = [206, 212, 218];
const WHITE: [number, number, number] = [255, 255, 255];

/* ──────────── Shared drawing functions ──────────── */
class DocBuilder {
  doc: jsPDF;
  ff: string;
  y: number;
  ml: number;
  mr: number;
  cw: number;
  pageW: number;
  pageH: number;
  fs: number;

  constructor(doc: jsPDF, ff: string, ml: number, mr: number, fs: number) {
    this.doc = doc;
    this.ff = ff;
    this.pageW = doc.internal.pageSize.getWidth();
    this.pageH = doc.internal.pageSize.getHeight();
    this.ml = ml;
    this.mr = mr;
    this.cw = mr - ml;
    this.fs = fs;
    this.y = 15;
  }

  checkPage(needed: number) {
    if (this.y + needed > this.pageH - 20) { this.doc.addPage(); this.y = 15; }
  }

  setFont(style: "normal" | "bold", size: number, color: [number, number, number] = DARK) {
    this.doc.setFont(this.ff, style);
    this.doc.setFontSize(size * this.fs);
    this.doc.setTextColor(...color);
  }

  drawHeader(company: CompanyInfo, title: string, orderNumber: string, dateLabel: string, dateValue: string, qrDataURL?: string) {
    // Top accent line
    this.doc.setFillColor(...PRIMARY);
    this.doc.rect(0, 0, this.pageW, 2, "F");
    this.y = 12;

    // Company info left
    this.setFont("bold", 13, PRIMARY);
    this.doc.text(company.company_name, this.ml, this.y);
    this.y += 4.5;
    this.setFont("normal", 7.5, GRAY);
    const addr = [company.address_street, company.address_postal_code, company.address_city].filter(Boolean).join(", ");
    if (addr) { this.doc.text(addr, this.ml, this.y); this.y += 3.5; }
    const contact = [company.phone ? `tel. ${company.phone}` : null, company.email].filter(Boolean).join("  |  ");
    if (contact) { this.doc.text(contact, this.ml, this.y); this.y += 3.5; }
    if (company.nip) { this.doc.text(`NIP: ${company.nip}`, this.ml, this.y); this.y += 3.5; }

    // QR code on right
    if (qrDataURL) {
      try { this.doc.addImage(qrDataURL, "PNG", this.mr - 24, 5, 22, 22); } catch {}
    }

    // Separator
    this.y += 3;
    this.doc.setDrawColor(...PRIMARY);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.ml, this.y, this.mr, this.y);
    this.y += 6;

    // Document title
    this.setFont("bold", 14, DARK);
    this.doc.text(title, this.ml, this.y);
    this.y += 6;

    // Order info line
    this.setFont("bold", 9.5, PRIMARY);
    this.doc.text(`Nr: ${orderNumber}`, this.ml, this.y);
    this.setFont("normal", 8, GRAY);
    this.doc.text(`${dateLabel}: ${dateValue}`, this.mr - 2, this.y, { align: "right" });
    this.y += 4;
    this.doc.setDrawColor(...BORDER);
    this.doc.setLineWidth(0.15);
    this.doc.line(this.ml, this.y, this.mr, this.y);
    this.y += 6;
  }

  drawSectionTitle(title: string) {
    this.checkPage(14);
    this.y += 3;
    this.doc.setFillColor(...PRIMARY);
    this.doc.rect(this.ml, this.y - 4, 3, 7, "F");
    this.doc.setFillColor(248, 249, 250);
    this.doc.rect(this.ml + 3, this.y - 4, this.cw - 3, 7, "F");
    this.setFont("bold", 8.5, PRIMARY);
    this.doc.text(title.toUpperCase(), this.ml + 7, this.y + 0.5);
    this.y += 10;
  }

  drawField(label: string, value: string | null | undefined, x: number, width: number, labelW = 32) {
    this.checkPage(5);
    this.setFont("normal", 7.5, GRAY);
    this.doc.text(label, x, this.y);
    this.setFont("normal", 8.5, DARK);
    const val = value || "—";
    const lines: string[] = this.doc.splitTextToSize(val, width - labelW - 2);
    this.doc.text(lines, x + labelW, this.y);
    return lines.length * 3.8;
  }

  drawFieldPair(l1: string, v1: string | null | undefined, l2: string, v2: string | null | undefined) {
    const halfW = this.cw / 2 - 2;
    this.drawField(l1, v1, this.ml + 2, halfW);
    const savedY = this.y;
    this.drawField(l2, v2, this.ml + halfW + 6, halfW);
    this.y = savedY + 5;
  }

  drawTextBlock(label: string, text: string | null | undefined) {
    if (!text) return;
    this.checkPage(14);
    if (label) {
      this.setFont("bold", 7.5, GRAY);
      this.doc.text(label, this.ml + 2, this.y);
      this.y += 4;
    }
    this.setFont("normal", 8.5, DARK);
    const lines: string[] = this.doc.splitTextToSize(text, this.cw - 6);
    for (const line of lines) {
      this.checkPage(4.5);
      this.doc.text(line, this.ml + 2, this.y);
      this.y += 4;
    }
    this.y += 1;
  }

  drawClientSection(order: any) {
    this.drawSectionTitle("Dane klienta");
    this.drawFieldPair("Nazwa:", order.clients?.display_name, "Telefon:", order.clients?.phone);
    this.drawFieldPair("E-mail:", order.clients?.email, "NIP:", order.clients?.nip);
    const addr = [order.clients?.address_street, order.clients?.address_postal_code, order.clients?.address_city].filter(Boolean).join(", ");
    if (addr) { this.drawField("Adres:", addr, this.ml + 2, this.cw); this.y += 5; }
  }

  drawDeviceSection(order: any) {
    if (!order.devices) return;
    this.drawSectionTitle("Dane urządzenia");
    const d = order.devices;
    if (d.device_category) { this.drawField("Kategoria:", DEVICE_CATEGORY_LABELS[d.device_category as DeviceCategory] ?? d.device_category, this.ml + 2, this.cw); this.y += 5; }
    this.drawFieldPair("Producent:", d.manufacturer, "Model:", d.model);
    this.drawFieldPair("Nr seryjny:", d.serial_number, "IMEI:", d.imei);

    // Spec mini-table if laptop/desktop
    const specs = [
      d.cpu ? `CPU: ${d.cpu}` : null,
      d.ram_gb ? `RAM: ${d.ram_gb} GB${d.ram_type ? ` ${d.ram_type}` : ""}` : null,
      d.gpu ? `GPU: ${d.gpu}` : null,
      d.storage1_type ? `Dysk: ${d.storage1_type} ${d.storage1_size || ""}` : null,
      d.operating_system ? `System: ${d.operating_system}` : null,
    ].filter(Boolean) as string[];

    if (specs.length > 0) {
      this.y += 2;
      this.setFont("normal", 7.5, GRAY);
      this.doc.text("Specyfikacja:", this.ml + 2, this.y);
      this.y += 4;
      for (const spec of specs) {
        this.checkPage(4.5);
        this.setFont("normal", 8, DARK);
        this.doc.text(`•  ${spec}`, this.ml + 6, this.y);
        this.y += 4;
      }
    }
    this.y += 2;
  }

  drawSignatures(labels: string[], order?: any) {
    const minY = this.y + 8;
    const prefY = this.pageH - 38;
    let sigY = Math.max(minY, Math.min(prefY, 240));
    if (sigY > this.pageH - 35) { this.doc.addPage(); sigY = 25; }
    this.y = sigY;
    this.checkPage(28);

    const boxW = Math.min(72, (this.cw - (labels.length - 1) * 8) / labels.length);
    const totalW = labels.length * boxW + (labels.length - 1) * 8;
    const startX = this.ml + (this.cw - totalW) / 2;

    const sigFields = [
      { label: labels[0], urlKey: "client_signature_url", dateKey: "client_signed_at" },
      { label: labels[1], urlKey: "technician_signature_url", dateKey: "technician_signed_at" },
    ];

    for (let i = 0; i < labels.length; i++) {
      const x = startX + i * (boxW + 8);
      this.doc.setDrawColor(...BORDER);
      this.doc.setLineWidth(0.3);
      this.doc.roundedRect(x, this.y, boxW, 22, 1.5, 1.5, "S");
      this.setFont("bold", 7.5, GRAY);
      this.doc.text(labels[i].toUpperCase(), x + boxW / 2, this.y - 2, { align: "center" });

      const sf = sigFields[i];
      if (order && sf && order[sf.urlKey]) {
        try { this.doc.addImage(order[sf.urlKey], "PNG", x + 2, this.y + 1, boxW - 4, 18); } catch {}
        if (order[sf.dateKey]) {
          this.setFont("normal", 6, LIGHT_GRAY);
          this.doc.text(new Date(order[sf.dateKey]).toLocaleString("pl-PL"), x + boxW / 2, this.y + 21, { align: "center" });
        }
      } else {
        this.setFont("normal", 7, LIGHT_GRAY);
        this.doc.text("Data i podpis", x + boxW / 2, this.y + 18, { align: "center" });
      }
    }
    this.y += 26;
  }

  drawFooter(company: CompanyInfo, text?: string) {
    const footerY = this.pageH - 10;
    this.doc.setDrawColor(...BORDER);
    this.doc.setLineWidth(0.15);
    this.doc.line(this.ml, footerY - 3, this.mr, footerY - 3);
    const footerText = text || `Dokument wygenerowany elektronicznie — ${company.company_name}`;
    this.setFont("normal", 6.5, LIGHT_GRAY);
    this.doc.text(footerText, this.pageW / 2, footerY, { align: "center" });
  }
}

/* ═══════════════════════════════════════════════════
   1. INTAKE PROTOCOL (Protokół przyjęcia sprzętu)
   ═══════════════════════════════════════════════════ */

export const INTAKE_SECTIONS: PdfSection[] = [
  { id: "header", label: "Nagłówek", enabled: true },
  { id: "client_data", label: "Dane klienta", enabled: true },
  { id: "device_data", label: "Dane urządzenia", enabled: true },
  { id: "problem_description", label: "Opis usterki", enabled: true },
  { id: "visual_condition", label: "Stan wizualny", enabled: true },
  { id: "accessories", label: "Akcesoria", enabled: true },
  { id: "terms", label: "Warunki serwisu", enabled: true },
  { id: "signatures", label: "Podpisy", enabled: true },
  { id: "footer", label: "Stopka", enabled: true },
];

export async function generateIntakePDF({ order }: { order: any }) {
  const [templateConfig, company] = await Promise.all([
    loadActiveTemplate("INTAKE_PROTOCOL"),
    loadCompanySettings(),
  ]);
  const config = templateConfig ?? { settings: DEFAULT_SETTINGS, sections: INTAKE_SECTIONS };

  const doc = new jsPDF("p", "mm", "a4");
  const hasFont = await setupFonts(doc);
  const ff = hasFont ? "Roboto" : "helvetica";
  const b = new DocBuilder(doc, ff, config.settings.margins.left, doc.internal.pageSize.getWidth() - config.settings.margins.right, config.settings.fontScale);

  const qr = await generateQRDataURL(`${window.location.origin}/orders/${order.id}?scan=true`);

  for (const sec of config.sections) {
    if (!sec.enabled) continue;
    switch (sec.id) {
      case "header":
        b.drawHeader(company, "PROTOKÓŁ PRZYJĘCIA SPRZĘTU", order.order_number, "Data przyjęcia", fmtDate(order.received_at), qr);
        break;

      case "client_data":
        b.drawClientSection(order);
        break;

      case "device_data":
        b.drawDeviceSection(order);
        break;

      case "problem_description":
        if (!order.problem_description && !order.client_description) break;
        b.drawSectionTitle("Opis zgłoszenia");
        if (order.problem_description) b.drawTextBlock("Zgłoszony problem:", order.problem_description);
        if (order.client_description) b.drawTextBlock("Opis klienta:", order.client_description);
        break;

      case "visual_condition":
        if (!order.visual_condition) break;
        b.drawSectionTitle("Stan wizualny urządzenia");
        b.drawTextBlock("", order.visual_condition);
        break;

      case "accessories": {
        if (!order.accessories_received) break;
        b.drawSectionTitle("Akcesoria przekazane z urządzeniem");
        let accList: string[] = [];
        try { const p = JSON.parse(order.accessories_received); if (Array.isArray(p)) accList = p; }
        catch { accList = order.accessories_received.split(",").map((s: string) => s.trim()).filter(Boolean); }
        if (accList.length) {
          for (const acc of accList) { b.checkPage(5); b.setFont("normal", 8.5, DARK); doc.text(`•  ${acc}`, b.ml + 4, b.y); b.y += 4.5; }
        } else {
          b.drawField("Akcesoria:", order.accessories_received, b.ml + 2, b.cw); b.y += 5;
        }
        b.y += 2;
        break;
      }

      // lock_code removed — internal field, never printed in customer documents

      case "terms":
        b.drawSectionTitle("Warunki serwisu");
        b.setFont("normal", 7, GRAY);
        const terms = [
          "1. Serwis nie ponosi odpowiedzialności za dane pozostawione na nośnikach urządzenia.",
          "2. Termin realizacji ustalany jest indywidualnie po przeprowadzeniu diagnostyki.",
          "3. Klient zobowiązany jest do odbioru sprzętu w terminie 30 dni od powiadomienia o zakończeniu naprawy.",
          "4. Nieodebranie sprzętu w terminie 90 dni od powiadomienia skutkuje naliczeniem opłaty za przechowywanie.",
          "5. Akceptacja niniejszego protokołu oznacza zgodę na powyższe warunki.",
        ];
        for (const t of terms) {
          b.checkPage(4.5);
          const lines: string[] = doc.splitTextToSize(t, b.cw - 4);
          for (const line of lines) { doc.text(line, b.ml + 2, b.y); b.y += 3.5; }
          b.y += 1;
        }
        b.y += 2;
        break;

      case "signatures":
        b.drawSignatures(["Podpis klienta", "Podpis serwisanta"], order);
        break;

      case "footer":
        b.drawFooter(company, config.settings.footerText);
        break;
    }
  }

  return doc;
}

/* ═══════════════════════════════════════════════════
   2. PICKUP PROTOCOL (Protokół odbioru sprzętu)
   ═══════════════════════════════════════════════════ */

export const PICKUP_SECTIONS: PdfSection[] = [
  { id: "header", label: "Nagłówek", enabled: true },
  { id: "client_data", label: "Dane klienta", enabled: true },
  { id: "device_data", label: "Dane urządzenia", enabled: true },
  { id: "diagnosis", label: "Diagnoza", enabled: true },
  { id: "repair_description", label: "Opis naprawy", enabled: true },
  { id: "financial", label: "Rozliczenie", enabled: true },
  { id: "confirmation", label: "Potwierdzenie odbioru", enabled: true },
  { id: "signatures", label: "Podpisy", enabled: true },
  { id: "footer", label: "Stopka", enabled: true },
];

export async function generatePickupPDF({ order, orderItems, financials }: OrderPDFData) {
  const [templateConfig, company] = await Promise.all([
    loadActiveTemplate("PICKUP_PROTOCOL"),
    loadCompanySettings(),
  ]);
  const config = templateConfig ?? { settings: DEFAULT_SETTINGS, sections: PICKUP_SECTIONS };

  const doc = new jsPDF("p", "mm", "a4");
  const hasFont = await setupFonts(doc);
  const ff = hasFont ? "Roboto" : "helvetica";
  const b = new DocBuilder(doc, ff, config.settings.margins.left, doc.internal.pageSize.getWidth() - config.settings.margins.right, config.settings.fontScale);

  const qr = await generateQRDataURL(`${window.location.origin}/orders/${order.id}?scan=true`);

  for (const sec of config.sections) {
    if (!sec.enabled) continue;
    switch (sec.id) {
      case "header":
        b.drawHeader(company, "PROTOKÓŁ ODBIORU SPRZĘTU", order.order_number, "Data zakończenia", fmtDate(order.completed_at || order.received_at), qr);
        break;

      case "client_data":
        b.drawClientSection(order);
        break;

      case "device_data":
        b.drawDeviceSection(order);
        break;

      case "diagnosis":
        if (!order.diagnosis) break;
        b.drawSectionTitle("Diagnoza");
        b.drawTextBlock("", order.diagnosis);
        break;

      case "repair_description":
        if (!order.repair_description) break;
        b.drawSectionTitle("Wykonane prace");
        b.drawTextBlock("", order.repair_description);
        break;

      case "financial": {
        b.drawSectionTitle("Rozliczenie finansowe");
        b.checkPage(50);

        // Items table
        if (orderItems.length > 0) {
          const cols = { name: b.ml + 2, qty: b.ml + 90, unit: b.ml + 115, total: b.mr - 2 };
          doc.setFillColor(...PRIMARY);
          doc.rect(b.ml, b.y - 3.5, b.cw, 7, "F");
          b.setFont("bold", 7.5, WHITE);
          doc.text("Pozycja", cols.name, b.y);
          doc.text("Ilość", cols.qty, b.y, { align: "right" });
          doc.text("Cena jedn.", cols.unit, b.y, { align: "right" });
          doc.text("Wartość netto", cols.total, b.y, { align: "right" });
          b.y += 6;

          orderItems.forEach((item: any, idx: number) => {
            b.checkPage(6);
            if (idx % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(b.ml, b.y - 3.5, b.cw, 6, "F"); }
            doc.setDrawColor(233, 236, 239); doc.setLineWidth(0.15); doc.line(b.ml, b.y + 2.5, b.mr, b.y + 2.5);
            b.setFont("normal", 8, DARK);
            doc.text(item.item_name_snapshot, cols.name, b.y);
            doc.text(item.quantity.toString(), cols.qty, b.y, { align: "right" });
            doc.text(formatCurrency(item.sale_net), cols.unit, b.y, { align: "right" });
            doc.text(formatCurrency(item.total_sale_net), cols.total, b.y, { align: "right" });
            b.y += 6;
          });
          b.y += 3;
        }

        // Summary
        b.checkPage(40);
        const boxY = b.y;
        const halfW = b.cw / 2 - 2;

        // Left - breakdown
        doc.setFillColor(248, 249, 250);
        doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
        doc.roundedRect(b.ml, boxY, halfW, 32, 2, 2, "FD");
        let iy = boxY + 6;
        b.setFont("normal", 7.5, GRAY); doc.text("Usługa (netto):", b.ml + 4, iy);
        b.setFont("normal", 8.5, DARK); doc.text(formatCurrency(financials.laborNet), b.ml + 42, iy); iy += 5.5;
        b.setFont("normal", 7.5, GRAY); doc.text("Części (netto):", b.ml + 4, iy);
        b.setFont("normal", 8.5, DARK); doc.text(formatCurrency(financials.partsCost), b.ml + 42, iy); iy += 5.5;
        b.setFont("normal", 7.5, GRAY); doc.text("Koszty dodatkowe:", b.ml + 4, iy);
        b.setFont("normal", 8.5, DARK); doc.text(formatCurrency(financials.extraCost), b.ml + 42, iy); iy += 7;
        doc.setDrawColor(...BORDER); doc.line(b.ml + 4, iy - 2.5, b.ml + halfW - 6, iy - 2.5);
        b.setFont("bold", 8.5, DARK); doc.text("Razem netto:", b.ml + 4, iy);
        b.setFont("bold", 9, DARK); doc.text(formatCurrency(financials.revenue), b.ml + 42, iy);

        // Right - total
        const rx = b.ml + halfW + 4;
        doc.setFillColor(...PRIMARY);
        doc.roundedRect(rx, boxY, halfW, 32, 2, 2, "F");
        b.setFont("normal", 8, WHITE); doc.text("DO ZAPŁATY (brutto):", rx + 6, boxY + 9);
        b.setFont("bold", 18, WHITE); doc.text(formatCurrency(financials.revenue * 1.23), rx + 6, boxY + 20);
        b.setFont("normal", 7.5, [200, 210, 230] as [number, number, number]);
        if (order.payment_method) doc.text(`Płatność: ${PAYMENT_METHOD_LABELS[order.payment_method as PaymentMethod] ?? order.payment_method}`, rx + 6, boxY + 27);
        doc.text(`Status: ${order.is_paid ? "✓ Opłacone" : "Nieopłacone"}`, rx + 6, boxY + 31);

        b.y = boxY + 37;
        break;
      }

      case "confirmation":
        b.drawSectionTitle("Potwierdzenie odbioru");
        b.setFont("normal", 8, DARK);
        const confText = `Niniejszym potwierdzam odbiór sprzętu wymienionego w niniejszym protokole. ` +
          `Sprzęt został sprawdzony w mojej obecności i nie wnoszę zastrzeżeń co do wykonanej usługi.`;
        const confLines: string[] = doc.splitTextToSize(confText, b.cw - 6);
        for (const line of confLines) { doc.text(line, b.ml + 2, b.y); b.y += 4; }
        b.y += 4;
        break;

      case "signatures":
        b.drawSignatures(["Podpis klienta (odbiór)"], order);
        break;

      case "footer":
        b.drawFooter(company, config.settings.footerText);
        break;
    }
  }

  return doc;
}
