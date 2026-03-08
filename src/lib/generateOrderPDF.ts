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
    partsCost: number;
    extraCost: number;
  };
  companyName?: string;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

export function generateOrderPDF({ order, orderItems, financials, companyName = "W3-Support" }: OrderPDFData) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 15;
  const marginRight = pageWidth - 15;
  const contentWidth = marginRight - marginLeft;
  let y = 12;

  // Colors
  const primaryColor: [number, number, number] = [37, 99, 235];
  const darkText: [number, number, number] = [30, 30, 30];
  const grayText: [number, number, number] = [120, 120, 120];
  const lightGray: [number, number, number] = [245, 245, 245];
  const borderGray: [number, number, number] = [220, 220, 220];

  function checkPage(needed: number) {
    if (y + needed > 275) {
      doc.addPage();
      y = 15;
    }
  }

  // === HEADER BAR ===
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(companyName, marginLeft, 13);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("System zarządzania serwisem", marginLeft, 19);
  doc.text(`Wygenerowano: ${new Date().toLocaleDateString("pl-PL")} ${new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`, marginLeft, 24);

  // Order number - right side
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(order.order_number, marginRight, 13, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const statusLabel = ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status;
  doc.text(`Status: ${statusLabel}`, marginRight, 20, { align: "right" });

  y = 36;
  doc.setTextColor(...darkText);

  // === SECTION HELPER ===
  function addSection(title: string) {
    checkPage(20);
    y += 3;
    doc.setFillColor(...lightGray);
    doc.roundedRect(marginLeft, y - 4.5, contentWidth, 8, 1, 1, "F");
    doc.setDrawColor(...borderGray);
    doc.roundedRect(marginLeft, y - 4.5, contentWidth, 8, 1, 1, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...primaryColor);
    doc.text(title.toUpperCase(), marginLeft + 3, y + 0.5);
    doc.setTextColor(...darkText);
    y += 8;
  }

  function addField(label: string, value: string, col: "left" | "right" | "full" = "full") {
    checkPage(6);
    const x = col === "right" ? marginLeft + contentWidth / 2 + 2 : marginLeft + 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...grayText);
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...darkText);
    doc.text(value || "—", x + 35, y);
    if (col !== "right") y += 5;
  }

  function addFieldPair(label1: string, val1: string, label2: string, val2: string) {
    addField(label1, val1, "left");
    addField(label2, val2, "right");
    y += 5;
  }

  // === ORDER INFO ===
  addSection("Dane zlecenia");
  addFieldPair("Numer zlecenia:", order.order_number, "Status:", statusLabel);
  addFieldPair(
    "Data przyjęcia:",
    new Date(order.received_at).toLocaleDateString("pl-PL"),
    "Data zakończenia:",
    order.completed_at ? new Date(order.completed_at).toLocaleDateString("pl-PL") : "—"
  );
  if (order.estimated_completion_date) {
    addField("Termin realizacji:", order.estimated_completion_date);
  }

  // === CLIENT ===
  addSection("Dane klienta");
  if (order.clients?.display_name) addField("Nazwa:", order.clients.display_name);
  if (order.clients?.phone) addField("Telefon:", order.clients.phone);
  if (order.clients?.email) addField("E-mail:", order.clients.email);

  // === DEVICE ===
  if (order.devices) {
    addSection("Dane urządzenia");
    if (order.devices.device_category) {
      addField("Kategoria:", DEVICE_CATEGORY_LABELS[order.devices.device_category as DeviceCategory] ?? order.devices.device_category);
    }
    if (order.devices.manufacturer || order.devices.model) {
      addFieldPair("Producent:", order.devices.manufacturer || "—", "Model:", order.devices.model || "—");
    }
    if (order.devices.serial_number || order.devices.imei) {
      addFieldPair("Nr seryjny:", order.devices.serial_number || "—", "IMEI:", order.devices.imei || "—");
    }
  }

  // === DESCRIPTION ===
  const hasDesc = order.problem_description || order.diagnosis || order.repair_description;
  if (hasDesc) {
    addSection("Opis serwisowy");

    function addTextBlock(label: string, text: string) {
      checkPage(15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...grayText);
      doc.text(label, marginLeft + 2, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...darkText);
      const lines = doc.splitTextToSize(text, contentWidth - 4);
      doc.text(lines, marginLeft + 2, y);
      y += lines.length * 4 + 3;
    }

    if (order.problem_description) addTextBlock("Opis zgłoszenia:", order.problem_description);
    if (order.diagnosis) addTextBlock("Diagnoza:", order.diagnosis);
    if (order.repair_description) addTextBlock("Opis naprawy:", order.repair_description);
  }

  if (order.accessories_received || order.visual_condition) {
    addSection("Dodatkowe informacje");
    if (order.accessories_received) {
      let accList: string[] = [];
      try {
        const parsed = JSON.parse(order.accessories_received);
        if (Array.isArray(parsed)) accList = parsed;
      } catch {
        accList = order.accessories_received.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
      if (accList.length > 0) {
        checkPage(10);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...grayText);
        doc.text("Akcesoria przekazane:", marginLeft + 2, y);
        y += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...darkText);
        accList.forEach((acc: string) => {
          checkPage(5);
          doc.text(`• ${acc}`, marginLeft + 4, y);
          y += 4;
        });
        y += 1;
      } else {
        addField("Akcesoria:", order.accessories_received);
      }
    }
    if (order.visual_condition) addField("Stan wizualny:", order.visual_condition);
  }

  // === ITEMS TABLE ===
  if (orderItems.length > 0) {
    addSection("Pozycje zlecenia");
    checkPage(15);

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(marginLeft, y - 3.5, contentWidth, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...grayText);
    doc.text("Nazwa", marginLeft + 2, y);
    doc.text("Ilość", marginLeft + 85, y, { align: "right" });
    doc.text("Cena jedn.", marginLeft + 110, y, { align: "right" });
    doc.text("Wartość", marginLeft + 140, y, { align: "right" });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...darkText);

    orderItems.forEach((item: any, idx: number) => {
      checkPage(6);
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(marginLeft, y - 3.5, contentWidth, 5.5, "F");
      }
      doc.text(item.item_name_snapshot, marginLeft + 2, y);
      doc.text(item.quantity.toString(), marginLeft + 85, y, { align: "right" });
      doc.text(formatCurrency(item.sale_net), marginLeft + 110, y, { align: "right" });
      doc.text(formatCurrency(item.total_sale_net), marginLeft + 140, y, { align: "right" });
      y += 5.5;
    });

    // Total row
    doc.setDrawColor(...borderGray);
    doc.line(marginLeft, y - 1, marginRight, y - 1);
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Suma pozycji:", marginLeft + 2, y);
    const itemsTotal = orderItems.reduce((s: number, i: any) => s + i.total_sale_net, 0);
    doc.text(formatCurrency(itemsTotal), marginLeft + 140, y, { align: "right" });
    y += 5;
  }

  // === FINANCIALS ===
  addSection("Podsumowanie finansowe");
  checkPage(35);

  // Financial summary box
  doc.setFillColor(250, 252, 255);
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginLeft, y - 2, contentWidth, 30, 2, 2, "FD");
  doc.setLineWidth(0.1);

  const finY = y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  doc.setTextColor(...grayText);
  doc.text("Cena usługi:", marginLeft + 4, finY + 3);
  doc.setTextColor(...darkText);
  doc.text(formatCurrency(financials.laborNet), marginLeft + 50, finY + 3);

  doc.setTextColor(...grayText);
  doc.text("Koszt części:", marginLeft + 4, finY + 8);
  doc.setTextColor(...darkText);
  doc.text(formatCurrency(financials.partsCost), marginLeft + 50, finY + 8);

  doc.setTextColor(...grayText);
  doc.text("Koszt dodatkowy:", marginLeft + 4, finY + 13);
  doc.setTextColor(...darkText);
  doc.text(formatCurrency(financials.partsCost), marginLeft + 50, finY + 13);

  // Right column
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text("KWOTA DO ZAPŁATY:", marginLeft + 90, finY + 5);
  doc.setFontSize(14);
  doc.text(formatCurrency(financials.revenue), marginLeft + 90, finY + 13);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grayText);
  if (order.payment_method) {
    doc.text(`Forma płatności: ${PAYMENT_METHOD_LABELS[order.payment_method as PaymentMethod] ?? order.payment_method}`, marginLeft + 90, finY + 20);
  }
  doc.text(`Status: ${order.is_paid ? "Opłacone" : "Nieopłacone"}`, marginLeft + 90, finY + 25);

  y = finY + 35;

  // === SIGNATURES ===
  const sigY = Math.max(y + 10, 245);
  checkPage(40);

  doc.setDrawColor(...borderGray);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(marginLeft, sigY, marginLeft + 65, sigY);
  doc.line(marginRight - 65, sigY, marginRight, sigY);
  doc.setLineDashPattern([], 0);

  doc.setFontSize(7.5);
  doc.setTextColor(...grayText);
  doc.text("Podpis klienta", marginLeft + 15, sigY + 5);
  doc.text("Podpis serwisanta", marginRight - 50, sigY + 5);

  // Footer line
  doc.setDrawColor(...borderGray);
  doc.line(marginLeft, 284, marginRight, 284);
  doc.setFontSize(6.5);
  doc.setTextColor(180, 180, 180);
  doc.text(
    `Dokument wygenerowany automatycznie — ${companyName} — ${new Date().toLocaleString("pl-PL")}`,
    pageWidth / 2,
    289,
    { align: "center" }
  );

  return doc;
}
