import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const CATEGORIES = [
  "Huur", "Nutsvoorzieningen", "Telecom & Internet", "Verzekeringen",
  "Auto & Mobiliteit", "Boodschappen", "Horeca", "Belastingen",
  "Abonnementen", "Gezondheid", "Kleding", "Reizen",
  "Zakelijk", "Bank & Financieel", "Onderhoud & Wonen", "Overig",
] as const;

const SYSTEM = `Je bent een expert in het analyseren van Belgische facturen, betalingen, creditnota's en terugbetalingen.
Geef terug:
- description: 1-2 zinnen Nederlands die uitlegt wat dit is en waarvoor (terug)betaald wordt
- category: kies EXACT één uit: ${CATEGORIES.join(", ")}
- is_refund: true als dit een creditnota / terugbetaling / refund is (geld komt naar de gebruiker), anders false

Output ALLEEN JSON: {"description": "...", "category": "...", "is_refund": false}`;

const Schema = z.object({
  description: z.string(),
  category: z.enum(CATEGORIES),
  is_refund: z.boolean().optional().default(false),
});

export const categorizeInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt");

    const { data: inv, error } = await supabase
      .from("invoices").select("*").eq("id", data.id).eq("user_id", userId).single();
    if (error || !inv) throw new Error("Factuur niet gevonden");

    const messages: any[] = [{ role: "system", content: SYSTEM }];
    const ctxText = `Leverancier: ${inv.supplier ?? "onbekend"}
Bedrag: ${inv.amount ?? "?"} ${inv.currency ?? "EUR"}
Mededeling: ${inv.structured_reference ?? inv.free_reference ?? "—"}
Notities: ${inv.notes ?? "—"}`;

    if (inv.scan_path) {
      const { data: blob } = await supabase.storage.from("invoice-scans").download(inv.scan_path);
      if (blob) {
        const buf = Buffer.from(await blob.arrayBuffer());
        const mime = inv.scan_path.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg";
        const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
        messages.push({
          role: "user",
          content: [
            { type: "text", text: ctxText + "\n\nAnalyseer deze factuur:" },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        });
      } else {
        messages.push({ role: "user", content: ctxText });
      }
    } else {
      messages.push({ role: "user", content: ctxText });
    }

    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`AI error: ${res.status}`);
    const j = await res.json();
    const parsed = Schema.parse(JSON.parse(j.choices?.[0]?.message?.content ?? "{}"));

    await supabase.from("invoices").update({
      category: parsed.category,
      ai_description: parsed.description,
    }).eq("id", data.id);

    return parsed;
  });

export const INVOICE_CATEGORIES = CATEGORIES;
