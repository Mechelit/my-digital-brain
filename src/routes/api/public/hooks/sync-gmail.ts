import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { extractJsonWithClaude } from "@/lib/claude";

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

const SYSTEM_PROMPT = `You are an expert at reading Belgian invoices, payment letters, and bills. Extract structured payment data.

Return ONLY JSON with these fields (null when missing):
- supplier, amount (number), currency (ISO), iban (no spaces, uppercase), bic
- structured_reference (Belgian OGM "+++123/4567/89012+++")
- free_reference, invoice_date (YYYY-MM-DD), due_date (YYYY-MM-DD)
- notes (max 100 chars)

Output JSON only.`;

async function gmailFetch(path: string) {
  const lov = process.env.LOVABLE_API_KEY!;
  const gm = process.env.GOOGLE_MAIL_API_KEY!;
  const res = await fetch(`${GMAIL_GATEWAY}${path}`, {
    headers: { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": gm },
  });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`);
  return res.json();
}

function findPdfParts(payload: any): Array<{ filename: string; attachmentId: string }> {
  const out: any[] = [];
  const walk = (part: any) => {
    if (!part) return;
    if (part.filename && part.body?.attachmentId) {
      const mt = (part.mimeType || "").toLowerCase();
      if (mt === "application/pdf" || part.filename.toLowerCase().endsWith(".pdf")) {
        out.push({ filename: part.filename, attachmentId: part.body.attachmentId });
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

export const Route = createFileRoute("/api/public/hooks/sync-gmail")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("apikey") || request.headers.get("authorization")?.replace("Bearer ", "");
        if (!auth || auth !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const lov = process.env.LOVABLE_API_KEY;
        const gm = process.env.GOOGLE_MAIL_API_KEY;
        if (!lov || !gm) return Response.json({ error: "Gmail niet gekoppeld" }, { status: 400 });

        const { data: profiles } = await admin.from("profiles").select("id");
        if (!profiles?.length) return Response.json({ ok: true, imported: 0 });

        // Gmail is project-scoped — alle import gaat naar de eerste user
        const userId = profiles[0].id;

        const q = encodeURIComponent('newer_than:7d (has:attachment filename:pdf OR from:doccle.be OR from:doccle.com OR subject:factuur OR subject:rekening OR subject:invoice)');
        const list = await gmailFetch(`/users/me/messages?maxResults=25&q=${q}`);
        const ids: string[] = (list.messages ?? []).map((m: any) => m.id);

        let imported = 0;
        for (const messageId of ids) {
          try {
            const extId = `gmail:${messageId}`;
            const { data: existing } = await admin
              .from("invoices").select("id").eq("user_id", userId).eq("external_id", extId).maybeSingle();
            if (existing) continue;
            const { data: ignored } = await admin
              .from("ignored_emails").select("external_id").eq("user_id", userId).eq("external_id", extId).maybeSingle();
            if (ignored) continue;

            const msg = await gmailFetch(`/users/me/messages/${messageId}?format=full`);
            const pdfs = findPdfParts(msg.payload);
            if (pdfs.length === 0) continue;
            const headers: any[] = msg.payload?.headers ?? [];
            const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
            const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";

            const pdf = pdfs[0];
            const att = await gmailFetch(`/users/me/messages/${messageId}/attachments/${pdf.attachmentId}`);
            const bytes = decodeB64Url(att.data);
            if (bytes.length > 8 * 1024 * 1024) continue;

            const scanPath = `${userId}/gmail/${messageId}-${pdf.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
            await admin.storage.from("invoice-scans").upload(scanPath, bytes, { contentType: "application/pdf", upsert: true });

            let parsed: any = {};
            try {
              parsed = await extractJsonWithClaude({
                system: SYSTEM_PROMPT,
                text: `Subject: ${subject}\nFrom: ${from}`,
                attachment: { base64: bytes.toString("base64"), mimeType: "application/pdf" },
              });
            } catch (e) {
              console.error("claude extract error", messageId, e);
            }

            await admin.from("invoices").insert({
              user_id: userId,
              source: "email",
              status: "pending",
              external_id: `gmail:${messageId}`,
              supplier: parsed.supplier ?? from.replace(/<.*>/, "").trim() ?? null,
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
              raw_extraction: { ...parsed, email_subject: subject, email_from: from },
            });
            imported++;
          } catch (e) {
            console.error("gmail-sync error", messageId, e);
          }
        }

        return Response.json({ ok: true, scanned: ids.length, imported });
      },
    },
  },
});
