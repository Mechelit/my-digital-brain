import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractJsonWithClaude, type ClaudeAttachment } from "@/lib/claude";

const CATEGORIES = [
  "Huur", "Nutsvoorzieningen", "Telecom & Internet", "Verzekeringen",
  "Auto & Mobiliteit", "Boodschappen", "Horeca", "Belastingen",
  "Abonnementen", "Gezondheid", "Kleding", "Reizen",
  "Zakelijk", "Bank & Financieel", "Onderhoud & Wonen", "Overig",
] as const;

const CONTRACT_TYPES = ["huur", "abonnement", "verzekering", "lening", "werk", "ander"] as const;

const SYSTEM = `Je bent een expert in het analyseren van Belgische facturen, betalingen, creditnota's, terugbetalingen en contracten.

Geef terug:
- description: 1-2 zinnen Nederlands die uitlegt wat dit is
- category: kies EXACT één uit: ${CATEGORIES.join(", ")}
- is_refund: true als dit een creditnota / terugbetaling / refund is (geld komt naar de gebruiker)
- is_contract: true ALLEEN als het document zélf een CONTRACT / OVEREENKOMST is (bv. huurovereenkomst, abonnementscontract, verzekeringspolis, leningsovereenkomst). Een gewone maandelijkse huurfactuur is GEEN contract.
- contract_type: indien is_contract=true, kies uit: ${CONTRACT_TYPES.join(", ")}

Output ALLEEN JSON: {"description":"...","category":"...","is_refund":false,"is_contract":false,"contract_type":null}`;

const Schema = z.object({
  description: z.string(),
  category: z.enum(CATEGORIES),
  is_refund: z.boolean().optional().default(false),
  is_contract: z.boolean().optional().default(false),
  contract_type: z.enum(CONTRACT_TYPES).nullable().optional(),
});

export const categorizeInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: inv, error } = await supabase
      .from("invoices").select("*").eq("id", data.id).eq("user_id", userId).single();
    if (error || !inv) throw new Error("Factuur niet gevonden");

    const ctxText = `Leverancier: ${inv.supplier ?? "onbekend"}
Bedrag: ${inv.amount ?? "?"} ${inv.currency ?? "EUR"}
Mededeling: ${inv.structured_reference ?? inv.free_reference ?? "—"}
Notities: ${inv.notes ?? "—"}`;

    let attachment: ClaudeAttachment | null = null;
    if (inv.scan_path) {
      const { data: blob } = await supabase.storage.from("invoice-scans").download(inv.scan_path);
      if (blob) {
        const buf = Buffer.from(await blob.arrayBuffer());
        const mime = inv.scan_path.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg";
        attachment = { base64: buf.toString("base64"), mimeType: mime };
      }
    }

    const parsed = Schema.parse(
      await extractJsonWithClaude({
        system: SYSTEM,
        text: attachment ? `${ctxText}\n\nAnalyseer dit document:` : ctxText,
        attachment,
      }),
    );

    // Auto-move contracts naar contracten-tabel
    if (parsed.is_contract) {
      let newFilePath: string | null = null;
      if (inv.scan_path) {
        const { data: blob } = await supabase.storage.from("invoice-scans").download(inv.scan_path);
        if (blob) {
          const ext = inv.scan_path.split(".").pop() ?? "bin";
          newFilePath = `${userId}/${Date.now()}-contract.${ext}`;
          await supabase.storage.from("contracts").upload(newFilePath, blob, {
            contentType: blob.type || "application/octet-stream",
            upsert: false,
          });
          await supabase.storage.from("invoice-scans").remove([inv.scan_path]);
        }
      }

      const { data: contract } = await supabase
        .from("contracts")
        .insert({
          user_id: userId,
          name: inv.supplier ?? "Contract",
          type: parsed.contract_type ?? "ander",
          counterparty: inv.supplier ?? null,
          monthly_amount: inv.amount ?? null,
          currency: inv.currency ?? "EUR",
          notes: parsed.description,
          file_path: newFilePath,
        })
        .select("id")
        .single();

      await supabase.from("invoices").delete().eq("id", data.id);

      return {
        ...parsed,
        moved_to_contract: true as const,
        contract_id: contract?.id ?? null,
      };
    }

    await supabase.from("invoices").update({
      category: parsed.category,
      ai_description: parsed.description,
      is_refund: parsed.is_refund ?? false,
    }).eq("id", data.id);

    return { ...parsed, moved_to_contract: false as const, contract_id: null };
  });

export const INVOICE_CATEGORIES = CATEGORIES;
