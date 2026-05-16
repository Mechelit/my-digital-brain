import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `You are an expert at reading Belgian invoices, payment letters, bills, refunds and credit notes. Extract structured payment data from the PDF/image.

Return ONLY a JSON object with these fields (use null when missing):
- supplier: company/organisation name
- amount: number (decimal), the amount (always POSITIVE, even for refunds — the is_refund flag indicates direction)
- is_refund: boolean — true if this is a credit note ("creditnota"), refund, terugbetaling, reimbursement, or money flowing TO the user instead of FROM
- currency: ISO code, usually "EUR"
- iban: Belgian/EU IBAN, no spaces, uppercase
- bic: BIC code if shown
- structured_reference: Belgian OGM "+++123/4567/89012+++"
- free_reference: free-form payment reference
- invoice_date: ISO date YYYY-MM-DD
- due_date: ISO date YYYY-MM-DD (vervaldatum)
- notes: short summary (max 100 chars)

Output JSON only, no markdown.`;

const ExtractionSchema = z.object({
  supplier: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  is_refund: z.boolean().nullable().optional(),
  currency: z.string().nullable().optional(),
  iban: z.string().nullable().optional(),
  bic: z.string().nullable().optional(),
  structured_reference: z.string().nullable().optional(),
  free_reference: z.string().nullable().optional(),
  invoice_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

async function gmailFetch(path: string) {
  const lovKey = process.env.LOVABLE_API_KEY;
  const gmKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovKey || !gmKey) throw new Error("Gmail-connector niet gekoppeld");
  const res = await fetch(`${GMAIL_GATEWAY}${path}`, {
    headers: {
      Authorization: `Bearer ${lovKey}`,
      "X-Connection-Api-Key": gmKey,
    },
  });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`);
  return res.json();
}

function findPdfParts(payload: any): Array<{ filename: string; attachmentId: string; mimeType: string }> {
  const out: any[] = [];
  const walk = (part: any) => {
    if (!part) return;
    if (part.filename && part.body?.attachmentId) {
      const mt = (part.mimeType || "").toLowerCase();
      if (mt === "application/pdf" || part.filename.toLowerCase().endsWith(".pdf")) {
        out.push({ filename: part.filename, attachmentId: part.body.attachmentId, mimeType: "application/pdf" });
      }
    }
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  };
  walk(payload);
  return out;
}

function decodeB64Url(b64: string) {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 ? norm + "=".repeat(4 - (norm.length % 4)) : norm;
  return Buffer.from(pad, "base64");
}

export const syncGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt");

    // Zoek recente mails: factuur/rekening/invoice/credit/refund of van Doccle (met of zonder PDF)
    const query = encodeURIComponent('newer_than:90d (from:doccle.be OR from:doccle.com OR from:doccle.eu OR doccle OR ((has:attachment filename:pdf) AND (subject:factuur OR subject:rekening OR subject:invoice OR subject:receipt OR subject:creditnota OR subject:"credit note" OR subject:refund OR subject:terugbetaling)))');
    const list = await gmailFetch(`/users/me/messages?maxResults=25&q=${query}`);
    const ids: string[] = (list.messages ?? []).map((m: any) => m.id);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Load ignore lists once
    const [{ data: ignoredEmails }, { data: ignoredSuppliers }] = await Promise.all([
      supabase.from("ignored_emails").select("external_id").eq("user_id", userId),
      supabase.from("ignored_suppliers").select("pattern").eq("user_id", userId),
    ]);
    const ignoredExternalIds = new Set((ignoredEmails ?? []).map((r: any) => r.external_id));
    const ignoredPatterns: string[] = (ignoredSuppliers ?? []).map((r: any) => (r.pattern ?? "").toLowerCase()).filter(Boolean);
    const matchesIgnoredSupplier = (...fields: (string | null | undefined)[]) =>
      ignoredPatterns.some((p) => fields.some((f) => f && f.toLowerCase().includes(p)));

    for (const messageId of ids) {
      try {
        const externalId = `gmail:${messageId}`;
        if (ignoredExternalIds.has(externalId)) { skipped++; continue; }
        // Dedupe
        const { data: existing } = await supabase
          .from("invoices").select("id").eq("user_id", userId).eq("external_id", externalId).maybeSingle();
        if (existing) { skipped++; continue; }

        const msg = await gmailFetch(`/users/me/messages/${messageId}?format=full`);
        const headers: any[] = msg.payload?.headers ?? [];
        const subject = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value ?? "";
        const from = headers.find((h: any) => h.name?.toLowerCase() === "from")?.value ?? "";
        const isDoccle = /doccle/i.test(from) || /doccle/i.test(subject);

        // Skip if sender/subject matches an ignored supplier (e.g. KBC overzichten)
        if (matchesIgnoredSupplier(from, subject)) { skipped++; continue; }

        const pdfs = findPdfParts(msg.payload);
        if (pdfs.length === 0 && !isDoccle) { skipped++; continue; }

        let scanPath: string | null = null;
        let parsed: z.infer<typeof ExtractionSchema> = {};

        if (pdfs.length > 0) {
          const pdf = pdfs[0];
          const att = await gmailFetch(`/users/me/messages/${messageId}/attachments/${pdf.attachmentId}`);
          const bytes = decodeB64Url(att.data);
          if (bytes.length > 8 * 1024 * 1024) { skipped++; continue; }

          scanPath = `${userId}/gmail/${messageId}-${pdf.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          await supabase.storage.from("invoice-scans").upload(scanPath, bytes, { contentType: "application/pdf", upsert: true });

          const dataUrl = `data:application/pdf;base64,${bytes.toString("base64")}`;
          const aiRes = await fetch(AI_GATEWAY, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: [
                  { type: "text", text: `Email subject: ${subject}\nFrom: ${from}\n\nExtract payment data from this PDF.` },
                  { type: "image_url", image_url: { url: dataUrl } },
                ]},
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (aiRes.ok) {
            const j = await aiRes.json();
            try { parsed = ExtractionSchema.parse(JSON.parse(j.choices?.[0]?.message?.content ?? "{}")); } catch {}
          }
        }

        const isRefund = !!parsed.is_refund || /credit\s*nota|creditnota|refund|terugbetal/i.test(subject);

        const supplierFinal = parsed.supplier ?? from.replace(/<.*>/, "").trim() ?? null;

        // Re-check ignore list against AI-extracted supplier
        if (matchesIgnoredSupplier(supplierFinal)) { skipped++; continue; }

        // Skip mails that clearly are not invoices (no amount AND no IBAN AND not a refund)
        if (!isRefund && parsed.amount == null && !parsed.iban) { skipped++; continue; }

        await supabase.from("invoices").insert({
          user_id: userId,
          source: "email",
          status: "pending",
          is_refund: isRefund,
          external_id: `gmail:${messageId}`,
          supplier: supplierFinal,
          amount: parsed.amount ?? null,
          currency: parsed.currency ?? "EUR",
          iban: parsed.iban?.replace(/\s+/g, "").toUpperCase() ?? null,
          bic: parsed.bic ?? null,
          structured_reference: parsed.structured_reference ?? null,
          free_reference: parsed.free_reference ?? null,
          invoice_date: parsed.invoice_date ?? null,
          due_date: parsed.due_date ?? null,
          notes: parsed.notes ?? subject.slice(0, 100),
          scan_path: scanPath,
          raw_extraction: {
            ...parsed,
            email_subject: subject,
            email_from: from,
            gmail_message_id: messageId,
            doccle_notification: isDoccle && pdfs.length === 0 ? true : undefined,
          } as any,
        });
        imported++;
      } catch (e: any) {
        errors.push(`${messageId}: ${e.message}`);
      }
    }

    return { imported, skipped, scanned: ids.length, errors };
  });
