// Directe Claude API (Anthropic Messages) — geen Lovable gateway, geen tussenpartij.
// Eén plek voor alle AI-extractie/categorisatie in MILA.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// Model: uitvoering = sonnet (snel, vision + PDF). Complex werk kan later op opus.
const MODEL = "claude-sonnet-4-6";

export type ClaudeAttachment = { base64: string; mimeType: string };

const IMAGE_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function attachmentBlock(att: ClaudeAttachment) {
  const mime = (att.mimeType || "").toLowerCase();
  if (mime === "application/pdf" || mime.endsWith("pdf")) {
    return {
      type: "document" as const,
      source: { type: "base64" as const, media_type: "application/pdf", data: att.base64 },
    };
  }
  const media_type = IMAGE_MEDIA_TYPES.has(mime) ? mime : "image/jpeg";
  return {
    type: "image" as const,
    source: { type: "base64" as const, media_type, data: att.base64 },
  };
}

/**
 * Stuurt een prompt + optioneel document/afbeelding naar Claude en geeft de
 * geparste JSON terug. De system prompt moet "Output JSON only" afdwingen.
 */
export async function extractJsonWithClaude(opts: {
  system: string;
  text: string;
  attachment?: ClaudeAttachment | null;
  maxTokens?: number;
}): Promise<any> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY ontbreekt");

  const content: any[] = [{ type: "text", text: opts.text }];
  if (opts.attachment) content.push(attachmentBlock(opts.attachment));

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: [{ role: "user", content }],
    }),
  });

  if (res.status === 401) throw new Error("Claude API: ongeldige of ontbrekende CLAUDE_API_KEY.");
  if (res.status === 429) throw new Error("Claude API: rate limit bereikt, probeer zo nog eens.");
  if (!res.ok) throw new Error(`Claude API fout: ${res.status} ${await res.text()}`);

  const json = await res.json();
  const text: string = (json.content ?? [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("");
  return parseJsonLoose(text);
}

/** Tolerant JSON-parsen: strip markdown-fences en isoleer het buitenste object. */
export function parseJsonLoose(raw: string): any {
  if (!raw) return {};
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  return JSON.parse(s);
}
