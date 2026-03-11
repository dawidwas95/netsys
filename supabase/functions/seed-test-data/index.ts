import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)];
}
function uuid() {
  return crypto.randomUUID();
}
function date(yearFrom = 2024, yearTo = 2026) {
  const y = rand(yearFrom, yearTo);
  const m = String(rand(1, 12)).padStart(2, "0");
  const d = String(rand(1, 28)).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const firstNames = ["Jan","Anna","Piotr","Maria","Tomasz","Katarzyna","Michał","Agnieszka","Krzysztof","Monika","Andrzej","Ewa","Marek","Joanna","Paweł","Małgorzata","Adam","Barbara","Łukasz","Dorota","Marcin","Magdalena","Jakub","Aleksandra","Rafał","Karolina","Grzegorz","Natalia","Dariusz","Justyna"];
const lastNames = ["Nowak","Kowalski","Wiśniewski","Wójcik","Kowalczyk","Kamiński","Lewandowski","Zieliński","Szymański","Woźniak","Dąbrowski","Kozłowski","Jankowski","Mazur","Kwiatkowski","Krawczyk","Piotrowski","Grabowski","Pawłowski","Michalski","Zając","Król","Jabłoński","Wieczorek","Majewski","Adamczyk","Dudek","Nowicki","Stępień","Jaworski"];
const companyNames = ["Tech Solutions","InfoSerwis","NetBit","PC-Master","DataComp","ByteLogic","CompuFix","SerwisIT","MegaByte","DigiTech","CyberSerwis","ElektroNova","ProIT","SmartFix","TechNova","CloudNet","ServerPro","PrintService","NetAdmin","ITpartner"];
const cities = ["Warszawa","Kraków","Łódź","Wrocław","Poznań","Gdańsk","Szczecin","Bydgoszcz","Lublin","Białystok","Katowice","Gdynia","Częstochowa","Radom","Sosnowiec","Toruń","Kielce","Rzeszów","Gliwice","Zabrze"];
const streets = ["Marszałkowska","Piłsudskiego","Kościuszki","Mickiewicza","Słowackiego","Sienkiewicza","Konopnickiej","Kolejowa","Lipowa","Ogrodowa","Kwiatowa","Polna","Leśna","Krótka","Długa","Główna","Rynkowa","Szkolna","Kościelna","Parkowa"];
const deviceModels = ["Dell Latitude 5540","HP EliteBook 840","Lenovo ThinkPad T14","ASUS ZenBook 14","Acer Aspire 5","HP ProBook 450","Dell Inspiron 15","Lenovo IdeaPad 5","MSI Modern 14","Samsung Galaxy Book"];
const phoneModels = ["iPhone 15","iPhone 14","Samsung Galaxy S24","Samsung Galaxy A54","Xiaomi 14","Google Pixel 8","OnePlus 12","Huawei P60","Motorola Edge 40","Nothing Phone 2"];
const manufacturers = ["Dell","HP","Lenovo","ASUS","Acer","MSI","Samsung","Apple","Xiaomi","Google"];
const inventoryNames = ["Dysk SSD 500GB","Dysk SSD 1TB","RAM DDR4 8GB","RAM DDR4 16GB","RAM DDR5 16GB","Zasilacz 500W","Zasilacz 650W","Kabel HDMI 2m","Kabel USB-C","Pasta termoprzewodząca","Bateria laptopa","Ekran LCD 15.6","Klawiatura laptopa","Wentylator CPU","Płyta główna ATX","Karta graficzna GTX 1650","Karta sieciowa WiFi","Toner HP","Toner Brother","Pendrive 32GB"];
const orderStatuses = ["NEW","DIAGNOSIS","IN_PROGRESS","WAITING_CLIENT","READY_FOR_RETURN","COMPLETED","ARCHIVED"];
const priorities = ["LOW","NORMAL","HIGH","URGENT"];
const deviceCategories = ["DESKTOP","LAPTOP","PHONE","TABLET","PRINTER","SERVER","ROUTER"];
const serviceTypes = ["COMPUTER_SERVICE","PHONE_SERVICE"];
const intakeChannels = ["PHONE","EMAIL","IN_PERSON","REMOTE","OTHER"];
const paymentMethods = ["CASH","CARD","TRANSFER"];
const descriptions = ["Wymiana dysku SSD","Czyszczenie systemu","Naprawa zasilacza","Wymiana ekranu","Aktualizacja systemu","Usunięcie wirusów","Wymiana baterii","Naprawa klawiatury","Instalacja oprogramowania","Konfiguracja sieci","Wymiana matrycy","Rozbudowa RAM","Naprawa głośnika","Wymiana portu ładowania","Reinstalacja Windows","Odzyskiwanie danych","Konfiguracja serwera","Naprawa drukarki","Wymiana wentylatora","Diagnostyka sprzętu"];

// RUN_ID generated per-request inside handler

async function insertBatch(admin: any, table: string, rows: any[], chunkSize: number) {
  for (let c = 0; c < rows.length; c += chunkSize) {
    const chunk = rows.slice(c, c + chunkSize);
    const { error } = await admin.from(table).insert(chunk);
    if (error) throw new Error(`${table} insert error at ${c}: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "ADMIN")) throw new Error("Admin required");

    // Parse params
    const body = await req.json().catch(() => ({}));
    const phase = body.phase || "all";
    const progress: string[] = [];

    // PHASE: clients (30000)
    if (phase === "all" || phase === "clients") {
      const clientBatch: any[] = [];
      for (let i = 0; i < 30000; i++) {
        const isCompany = Math.random() > 0.4;
        const fn = pick(firstNames);
        const ln = pick(lastNames);
        clientBatch.push({
          id: uuid(),
          client_type: isCompany ? "COMPANY" : "PRIVATE",
          first_name: fn,
          last_name: ln,
          company_name: isCompany ? `${pick(companyNames)} ${ln}` : null,
          email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.pl`,
          phone: `+48${rand(500, 899)}${String(rand(100000, 999999))}`,
          nip: isCompany ? `${rand(100, 999)}${rand(100, 999)}${rand(10, 99)}${rand(10, 99)}` : null,
          address_street: pick(streets),
          address_building: String(rand(1, 150)),
          address_local: Math.random() > 0.5 ? String(rand(1, 50)) : null,
          address_postal_code: `${String(rand(10, 99))}-${String(rand(100, 999))}`,
          address_city: pick(cities),
          business_role: "CUSTOMER",
        });
      }
      await insertBatch(admin, "clients", clientBatch, 1000);
      progress.push(`✅ 30000 klientów`);
    }

    // PHASE: devices (5000)
    if (phase === "all" || phase === "devices") {
      // Fetch client IDs
      const { data: clientRows } = await admin.from("clients").select("id").limit(30000);
      const clientIds = (clientRows || []).map((r: any) => r.id);
      if (clientIds.length === 0) throw new Error("No clients found - run clients phase first");

      const deviceBatch: any[] = [];
      for (let i = 0; i < 5000; i++) {
        const cat = pick(deviceCategories);
        const isPhone = cat === "PHONE" || cat === "TABLET";
        deviceBatch.push({
          id: uuid(),
          client_id: pick(clientIds),
          device_category: cat,
          manufacturer: pick(manufacturers),
          model: isPhone ? pick(phoneModels) : pick(deviceModels),
          serial_number: `SN${rand(100000, 999999)}${rand(1000, 9999)}`,
          status: "ACTIVE",
        });
      }
      await insertBatch(admin, "devices", deviceBatch, 1000);
      progress.push(`✅ 5000 urządzeń`);
    }

    // PHASE: inventory (200)
    if (phase === "all" || phase === "inventory") {
      const invBatch: any[] = [];
      for (let i = 0; i < 200; i++) {
        const pNet = rand(10, 500);
        invBatch.push({
          id: uuid(),
          name: `${pick(inventoryNames)} #${i + 1}`,
          sku: `SKU-${String(i + 1).padStart(4, "0")}`,
          category: pick(["PARTS","ACCESSORIES","CONSUMABLES","CABLES","TOOLS"]),
          manufacturer: pick(manufacturers),
          stock_quantity: rand(0, 100),
          minimum_quantity: rand(1, 10),
          purchase_net: pNet,
          sale_net: Math.round(pNet * (1.3 + Math.random() * 0.5)),
          vat_rate: 23,
          unit: "szt.",
        });
      }
      await insertBatch(admin, "inventory_items", invBatch, 200);
      progress.push(`✅ 200 pozycji magazynowych`);
    }

    // PHASE: orders (10000)
    if (phase === "all" || phase === "orders") {
      const { data: clientRows } = await admin.from("clients").select("id").limit(30000);
      const clientIds = (clientRows || []).map((r: any) => r.id);
      const { data: deviceRows } = await admin.from("devices").select("id").limit(5000);
      const deviceIds = (deviceRows || []).map((r: any) => r.id);

      const orderBatch: any[] = [];
      for (let i = 0; i < 10000; i++) {
        const st = pick(orderStatuses);
        const totalNet = rand(50, 3000);
        orderBatch.push({
          id: uuid(),
          order_number: `SRV/${RUN_ID}/${String(i + 1).padStart(5, "0")}`,
          client_id: pick(clientIds),
          device_id: deviceIds.length > 0 ? pick(deviceIds) : null,
          service_type: pick(serviceTypes),
          status: st,
          priority: pick(priorities),
          intake_channel: pick(intakeChannels),
          problem_description: pick(descriptions),
          diagnosis: Math.random() > 0.3 ? `Diagnoza: ${pick(descriptions)}` : null,
          repair_description: Math.random() > 0.5 ? `Rozwiązanie: ${pick(descriptions)}` : null,
          total_net: totalNet,
          total_gross: Math.round(totalNet * 1.23),
          estimated_completion_date: date(2025, 2026),
          internal_notes: Math.random() > 0.6 ? "Uwagi do zlecenia testowego" : null,
          completed_at: st === "COMPLETED" || st === "ARCHIVED" ? `${date(2025, 2026)}T12:00:00Z` : null,
        });
      }
      await insertBatch(admin, "service_orders", orderBatch, 500);
      progress.push(`✅ 10000 zleceń serwisowych`);
    }

    // PHASE: documents (100000) - split into sub-phases
    if (phase === "all" || phase === "docs1" || phase === "docs2" || phase === "docs3" || phase === "docs4" || phase === "docs5") {
      const { data: clientRows } = await admin.from("clients").select("id,first_name,last_name,company_name,nip,address_street,address_city,address_postal_code").limit(30000);
      const clients = clientRows || [];
      const { data: orderRows } = await admin.from("service_orders").select("id").limit(10000);
      const orderIds = (orderRows || []).map((r: any) => r.id);

      const docTypes = ["SALES_INVOICE","PURCHASE_INVOICE","RECEIPT","PROFORMA"];
      const prefixMap: Record<string, string> = { PURCHASE_INVOICE: "FZ", SALES_INVOICE: "FS", RECEIPT: "PAR", PROFORMA: "PRO" };

      let startIdx = 0;
      let count = 100000;
      
      if (phase === "docs1") { startIdx = 0; count = 20000; }
      else if (phase === "docs2") { startIdx = 20000; count = 20000; }
      else if (phase === "docs3") { startIdx = 40000; count = 20000; }
      else if (phase === "docs4") { startIdx = 60000; count = 20000; }
      else if (phase === "docs5") { startIdx = 80000; count = 20000; }

      const docBatch: any[] = [];
      for (let i = startIdx; i < startIdx + count; i++) {
        const docType = pick(docTypes);
        const direction = docType === "PURCHASE_INVOICE" ? "EXPENSE" : "INCOME";
        const netAmt = rand(50, 10000);
        const vatAmt = Math.round(netAmt * 0.23);
        const grossAmt = netAmt + vatAmt;
        const cData = pick(clients);
        const payStatus = pick(["PAID","UNPAID","PARTIALLY_PAID"]);
        const prefix = prefixMap[docType] || "DOC";

        docBatch.push({
          document_number: `${prefix}/${RUN_ID}/${String(i + 1).padStart(6, "0")}`,
          document_type: docType,
          direction,
          client_id: cData.id,
          issue_date: date(2024, 2026),
          sale_date: date(2024, 2026),
          due_date: date(2025, 2026),
          net_amount: netAmt,
          vat_amount: vatAmt,
          gross_amount: grossAmt,
          vat_rate: 23,
          payment_status: payStatus,
          payment_method: pick(paymentMethods),
          paid_amount: payStatus === "PAID" ? grossAmt : payStatus === "PARTIALLY_PAID" ? Math.round(grossAmt * 0.5) : 0,
          related_order_id: Math.random() > 0.5 && orderIds.length > 0 ? pick(orderIds) : null,
          buyer_name: cData.company_name || `${cData.first_name} ${cData.last_name}`,
          buyer_nip: cData.nip || null,
          buyer_street: cData.address_street || null,
          buyer_city: cData.address_city || null,
          buyer_postal_code: cData.address_postal_code || null,
          notes: Math.random() > 0.7 ? "Dokument testowy" : null,
        });
      }
      await insertBatch(admin, "documents", docBatch, 1000);
      progress.push(`✅ ${count} dokumentów (od ${startIdx + 1})`);
    }

    // PHASE: cash & warehouse
    if (phase === "all" || phase === "extras") {
      const { data: orderRows } = await admin.from("service_orders").select("id").limit(10000);
      const orderIds = (orderRows || []).map((r: any) => r.id);
      const { data: clientRows } = await admin.from("clients").select("id").limit(30000);
      const clientIds = (clientRows || []).map((r: any) => r.id);

      // 2000 cash transactions
      const cashBatch: any[] = [];
      for (let i = 0; i < 2000; i++) {
        const amt = rand(10, 5000);
        cashBatch.push({
          transaction_type: pick(["IN","OUT"]),
          amount: amt,
          gross_amount: Math.round(amt * 1.23),
          vat_amount: Math.round(amt * 0.23),
          description: `Transakcja testowa #${i + 1}`,
          payment_method: pick(paymentMethods),
          transaction_date: date(2024, 2026),
          related_order_id: Math.random() > 0.5 && orderIds.length > 0 ? pick(orderIds) : null,
          source_type: "MANUAL",
        });
      }
      await insertBatch(admin, "cash_transactions", cashBatch, 1000);
      progress.push(`✅ 2000 transakcji kasowych`);

      // 1000 warehouse documents
      const whBatch: any[] = [];
      const whTypes = ["PZ","WZ","PW","RW"];
      for (let i = 0; i < 1000; i++) {
        whBatch.push({
          document_type: pick(whTypes),
          document_date: date(2024, 2026),
          client_id: Math.random() > 0.3 && clientIds.length > 0 ? pick(clientIds) : null,
          related_order_id: Math.random() > 0.5 && orderIds.length > 0 ? pick(orderIds) : null,
          notes: `Dokument magazynowy testowy #${i + 1}`,
        });
      }
      await insertBatch(admin, "warehouse_documents", whBatch, 500);
      progress.push(`✅ 1000 dokumentów magazynowych`);
    }

    return new Response(JSON.stringify({ success: true, progress }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
