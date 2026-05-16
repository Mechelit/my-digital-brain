import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_PROMPT = `You are an expert at reading Belgian invoices, payment letters, bills, credit notes and refunds.
Return ONLY a JSON object with these fields (use null when missing):
- supplier, amount (number), currency, iban (no spaces, uppercase), bic,
- structured_reference (normalize to "+++123/4567/89012+++"),
- free_reference, invoice_date (YYYY-MM-DD), due_date (YYYY-MM-DD), notes (max 100 chars),
- category (short Dutch category), ai_description (1 Dutch sentence), is_refund (true for refund/credit note/money coming in).
Output JSON only, no markdown fences.`;

const Extraction = z.object({
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
  category: z.string().nullable().optional(),
  ai_description: z.string().nullable().optional(),
  is_refund: z.boolean().nullable().optional(),
});

async function loadSession(token: string) {
  const { data, error } = await supabaseAdmin
    .from("mobile_scan_sessions")
    .select("*")
    .eq("token", token)
    .single();
  if (error || !data) throw new Error("Sessie niet gevonden");
  if (new Date(data.expires_at) < new Date()) throw new Error("Sessie verlopen");
  return data;
}

export const mobileGetSession = createServerFn({ method: "POST" })
  .inputValidator((i: { token: string }) => i)
  .handler(async ({ data }) => {
    const s = await loadSession(data.token);
    let invoice: any = null;
    if (s.invoice_id) {
      const { data: inv } = await supabaseAdmin.from("invoices").select("*").eq("id", s.invoice_id).single();
      invoice = inv;
    }
    const { data: accounts } = await supabaseAdmin
      .from("accounts")
      .select("id,name,iban,is_default")
      .eq("user_id", s.user_id)
      .order("is_default", { ascending: false });
    return { status: s.status, invoice, accounts: accounts ?? [] };
  });

export const mobileScanExtract = createServerFn({ method: "POST" })
  .inputValidator((i: { token: string; imageBase64: string; mimeType: string }) => i)
  .handler(async ({ data }) => {
    const session = await loadSession(data.token);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt");

    // Upload to storage as the owner
    const ext = (data.mimeType.split("/")[1] || "jpg").split("+")[0];
    const path = `${session.user_id}/${crypto.randomUUID()}.${ext}`;
    const buffer = Uint8Array.from(atob(data.imageBase64), (c) => c.charCodeAt(0));
    const { error: upErr } = await supabaseAdmin.storage
      .from("invoice-scans")
      .upload(path, buffer, { contentType: data.mimeType, upsert: false });
    if (upErr) throw new Error(`Upload mislukt: ${upErr.message}`);

    // AI extract
    const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
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
    if (!res.ok) throw new Error(`AI fout: ${res.status}`);
    const json = await res.json();
    let parsed: z.infer<typeof Extraction> = {};
    try {
      parsed = Extraction.parse(JSON.parse(json.choices?.[0]?.message?.content ?? "{}"));
    } catch {}

    const { data: inserted, error } = await supabaseAdmin
      .from("invoices")
      .insert({
        user_id: session.user_id,
        source: "mobile_scan",
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
        category: parsed.category ?? null,
        ai_description: parsed.ai_description ?? null,
        is_refund: parsed.is_refund ?? false,
        scan_path: path,
        raw_extraction: parsed,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("mobile_scan_sessions")
      .update({ status: "delivered", invoice_id: inserted.id })
      .eq("token", data.token);

    return { invoice: inserted };
  });

export const mobileMarkPaid = createServerFn({ method: "POST" })
  .inputValidator((i: { token: string; invoiceId: string; accountId?: string | null }) => i)
  .handler(async ({ data }) => {
    const session = await loadSession(data.token);
    const { data: inv } = await supabaseAdmin
      .from("invoices")
      .select("user_id")
      .eq("id", data.invoiceId)
      .single();
    if (!inv || inv.user_id !== session.user_id) throw new Error("Niet jouw factuur");

    const accountQuery = supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("user_id", session.user_id);
    const { data: selectedAcc } = data.accountId
      ? await accountQuery.eq("id", data.accountId).maybeSingle()
      : await accountQuery.order("is_default", { ascending: false }).limit(1).maybeSingle();

    const { error } = await supabaseAdmin
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_from_account: selectedAcc?.id ?? null,
      })
      .eq("id", data.invoiceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
