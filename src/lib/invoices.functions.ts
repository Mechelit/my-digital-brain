import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ExtractionSchema = z.object({
  supplier: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  iban: z.string().nullable().optional(),
  bic: z.string().nullable().optional(),
  structured_reference: z.string().nullable().optional(),
  free_reference: z.string().nullable().optional(),
  invoice_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type InvoiceExtraction = z.infer<typeof ExtractionSchema>;

const SYSTEM_PROMPT = `You are an expert at reading Belgian invoices, payment letters, and bills (facturen, rekeningen). Extract structured payment data from the image.

Return ONLY a JSON object with these fields (use null when missing):
- supplier: company/organisation name sending the bill
- amount: number (decimal, e.g. 123.45), the amount due
- currency: ISO code, usually "EUR"
- iban: Belgian or EU IBAN, no spaces, uppercase (e.g. "BE68539007547034")
- bic: BIC code if shown
- structured_reference: Belgian OGM/gestructureerde mededeling, format "+++123/4567/89012+++" or "***123/4567/89012***", normalize to "+++123/4567/89012+++"
- free_reference: free-form payment reference if no structured one
- invoice_date: ISO date YYYY-MM-DD
- due_date: ISO date YYYY-MM-DD (vervaldatum / te betalen tegen)
- notes: short single-line summary (max 100 chars)

Output JSON only, no markdown fences.`;

export const extractInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imageBase64: string; mimeType: string; scanPath: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt");

    const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the payment data from this Belgian bill/invoice." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("AI gateway: rate limit bereikt, probeer zo nog eens.");
    if (res.status === 402) throw new Error("AI gateway: credits op. Voeg credits toe in workspace settings.");
    if (!res.ok) throw new Error(`AI gateway fout: ${res.status} ${await res.text()}`);

    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";

    let parsed: InvoiceExtraction;
    try {
      parsed = ExtractionSchema.parse(JSON.parse(content));
    } catch {
      parsed = {};
    }

    const { data: inserted, error } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        source: "scan",
        status: "pending",
        supplier: parsed.supplier ?? null,
        amount: parsed.amount ?? null,
        currency: parsed.currency ?? "EUR",
        iban: parsed.iban?.replace(/\s+/g, "").toUpperCase() ?? null,
        bic: parsed.bic ?? null,
        structured_reference: parsed.structured_reference ?? null,
        free_reference: parsed.free_reference ?? null,
        invoice_date: parsed.invoice_date ?? null,
        due_date: parsed.due_date ?? null,
        notes: parsed.notes ?? null,
        scan_path: data.scanPath,
        raw_extraction: parsed,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { invoice: inserted };
  });

export const claimMobileScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session, error } = await supabase
      .from("mobile_scan_sessions")
      .select("*")
      .eq("token", data.token)
      .single();
    if (error || !session) throw new Error("Sessie niet gevonden of verlopen");
    if (session.user_id !== userId) throw new Error("Niet jouw sessie");
    return { session };
  });
