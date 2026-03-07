import jsPDF from "jspdf";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  DEVICE_CATEGORY_LABELS,
  type OrderStatus,
  type PaymentMethod,
  type DeviceCategory,
} from "@/types/database";

interface OrderPDFData {
  order: any;
  orderItems: any[];
  financials: {
    revenue: number;
    totalCost: number;
    profit: number;
    laborNet: number;
  };
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

export function generateOrderPDF({ order, orderItems, financials }: OrderPDFData) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Helper
  function addLine(label: string, value: string, x = 14) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, x + 45, y);
    y += 5;
  }

  function addSection(title: string) {
    y += 4;
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y - 4, pageWidth - 28, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, 16, y);
    y += 8;
  }

  // === HEADER ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("🔧 SerwisP ro", 14, y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("System zarządzania serwisem", 14, y + 5);

  // Order number right-aligned
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(order.order_number, pageWidth - 14, y, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Wygenerowano: ${new Date().toLocaleDateString("pl-PL")}`, pageWidth - 14, y + 5, { align: "right" });

  y += 15;

  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 5;

  // === ORDER INFO ===
  addSection("Dane zlecenia");
  addLine("Numer zlecenia:", order.order_number);
  addLine("Data przyjęcia:", new Date(order.received_at).toLocaleDateString("pl-PL"));
  addLine("Status:", ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status);
  if (order.estimated_completion_date) {
    addLine("Termin:", order.estimated_completion_date);
  }

  // === CLIENT ===
  addSection("Dane klienta");
  if (order.clients?.display_name) addLine("Nazwa:", order.clients.display_name);
  if (order.clients?.phone) addLine("Telefon:", order.clients.phone);
  if (order.clients?.email) addLine("E-mail:", order.clients.email);

  // === DEVICE ===
  if (order.devices) {
    addSection("Dane urządzenia");
    if (order.devices.device_category) {
      addLine("Kategoria:", DEVICE_CATEGORY_LABELS[order.devices.device_category as DeviceCategory] ?? order.devices.device_category);
    }
    if (order.devices.manufacturer) addLine("Producent:", order.devices.manufacturer);
    if (order.devices.model) addLine("Model:", order.devices.model);
    if (order.devices.serial_number) addLine("Nr seryjny:", order.devices.serial_number);
    if (order.devices.imei) addLine("IMEI:", order.devices.imei);
  }

  // === DESCRIPTION ===
  if (order.problem_description || order.diagnosis || order.repair_description) {
    addSection("Opis serwisowy");

    if (order.problem_description) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Opis zgłoszenia:", 14, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(order.problem_description, pageWidth - 28);
      doc.text(lines, 14, y);
      y += lines.length * 4 + 3;
    }

    if (order.diagnosis) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Diagnoza:", 14, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(order.diagnosis, pageWidth - 28);
      doc.text(lines, 14, y);
      y += lines.length * 4 + 3;
    }

    if (order.repair_description) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Opis naprawy:", 14, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(order.repair_description, pageWidth - 28);
      doc.text(lines, 14, y);
      y += lines.length * 4 + 3;
    }
  }

  if (order.accessories_received) {
    addSection("Akcesoria");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(order.accessories_received, 14, y);
    y += 6;
  }

  // === ITEMS ===
  if (orderItems.length > 0) {
    addSection("Pozycje zlecenia");

    // Table header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Nazwa", 14, y);
    doc.text("Ilość", 100, y);
    doc.text("Cena", 120, y);
    doc.text("Wartość", 150, y);
    y += 2;
    doc.line(14, y, pageWidth - 14, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    orderItems.forEach((item) => {
      doc.text(item.item_name_snapshot, 14, y);
      doc.text(item.quantity.toString(), 100, y);
      doc.text(formatCurrency(item.sale_net), 120, y);
      doc.text(formatCurrency(item.total_sale_net), 150, y);
      y += 5;
    });
  }

  // === FINANCIALS ===
  addSection("Podsumowanie finansowe");
  addLine("Kwota usługi:", formatCurrency(financials.laborNet));
  if (orderItems.length > 0) {
    const itemsTotal = orderItems.reduce((s, i) => s + i.total_sale_net, 0);
    addLine("Pozycje:", formatCurrency(itemsTotal));
  }
  addLine("Przychód:", formatCurrency(financials.revenue));
  if (order.payment_method) {
    addLine("Forma płatności:", PAYMENT_METHOD_LABELS[order.payment_method as PaymentMethod] ?? order.payment_method);
  }
  addLine("Status płatności:", order.is_paid ? "Opłacone" : "Nieopłacone");

  // === SIGNATURES ===
  y = Math.max(y + 15, 240);

  doc.setDrawColor(100, 100, 100);
  doc.line(14, y, 80, y);
  doc.line(pageWidth - 80, y, pageWidth - 14, y);

  y += 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Podpis klienta", 14, y);
  doc.text("Podpis serwisanta", pageWidth - 80, y);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Dokument wygenerowany automatycznie — SerwisP ro — ${new Date().toLocaleString("pl-PL")}`, 14, 290);

  return doc;
}
