import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { image_base64, mime_type } = await req.json();
    if (!image_base64) throw new Error("No image data provided");

    const systemPrompt = `You are an expert invoice OCR system. Analyze the provided invoice image and extract structured data.

Return a JSON object with these fields (use null for fields you cannot find or are uncertain about):

{
  "document_number": "string or null - the invoice number",
  "document_type": "PURCHASE_INVOICE or SALES_INVOICE or PROFORMA or RECEIPT or null",
  "issue_date": "YYYY-MM-DD or null",
  "sale_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "contractor_name": "string or null - company/person name",
  "contractor_nip": "string or null - tax ID (NIP), digits only",
  "net_amount": "number or null",
  "vat_amount": "number or null",
  "gross_amount": "number or null",
  "payment_method": "TRANSFER or CASH or CARD or null",
  "line_items": [
    {
      "name": "string",
      "quantity": "number",
      "unit": "string",
      "unit_net": "number",
      "vat_rate": "number",
      "total_gross": "number"
    }
  ],
  "confidence": {
    "document_number": "high or medium or low",
    "dates": "high or medium or low",
    "contractor": "high or medium or low",
    "amounts": "high or medium or low",
    "line_items": "high or medium or low"
  }
}

Rules:
- Extract Polish invoices (faktury). Dates in Polish format DD.MM.YYYY should be converted to YYYY-MM-DD.
- NIP should contain only digits (remove dashes/spaces).
- Amounts should be numbers without currency symbols.
- For line_items, extract what you can see. If uncertain, return empty array.
- Be conservative with confidence ratings. If text is blurry or partially visible, mark as "low".
- Return ONLY valid JSON, no markdown, no explanation.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract invoice data from this document image. Return only JSON." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mime_type || "image/jpeg"};base64,${image_base64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zbyt wiele zapytań. Spróbuj ponownie za chwilę." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Brak środków na koncie AI. Doładuj kredyty w ustawieniach." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Błąd usługi OCR" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Nie udało się odczytać danych z dokumentu. Spróbuj z lepszym zdjęciem." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-invoice error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
