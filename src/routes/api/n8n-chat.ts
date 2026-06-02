import { createFileRoute } from "@tanstack/react-router";
const N8N_WEBHOOK_URL = "https://mila-ai-brain.app.n8n.cloud/webhook/sovereign-mind";
const jsonHeaders = { "Content-Type": "application/json" } as const;
function normalizeN8nResponse(data: unknown) {
  const payload = Array.isArray(data) ? data[0] : data;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const text = obj.reply ?? obj.text ?? obj.answer ?? obj.output ?? obj.response;
    const defaultStarted = obj.message === "Workflow was started";
    if (typeof text === "string" && text.trim()) return { ...obj, reply: text };
    if (typeof obj.message === "string" && obj.message.trim() && !defaultStarted) return { ...obj, reply: obj.message };
    if (defaultStarted) {
      return {
        reply:
          "n8n heeft de workflow gestart, maar stuurt nog geen chat-antwoord terug. Zet in je n8n Webhook node 'Respond' op 'Using Respond to Webhook node' of 'When Last Node Finishes', en laat je laatste node JSON teruggeven zoals { \"reply\": \"...\" }.",
        n8nStatus: "started_without_response",
      };
    }
    return obj;
  }
  if (typeof payload === "string" && payload.trim()) return { reply: payload };
  return { reply: "n8n gaf een lege response terug." };
}
export const Route = createFileRoute("/api/n8n-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const incoming = (await request.json()) as Record<string, unknown>;
          const body = { ...incoming, source: "brain-dashboard", origin: request.headers.get("origin") || "lovable-preview" };

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 60000);

          const response = await fetch(N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          }).finally(() => clearTimeout(timeout));

          const contentType = response.headers.get("content-type") || "";
          const raw = contentType.includes("application/json") ? await response.json() : await response.text();

          if (!response.ok) {
            return Response.json(
              { reply: `n8n fout ${response.status}: ${typeof raw === "string" ? raw : JSON.stringify(raw)}` },
              { status: response.status, headers: jsonHeaders },
            );
          }

          return Response.json(normalizeN8nResponse(raw), { headers: jsonHeaders });
        } catch (error) {
          const message = error instanceof Error && error.name === "AbortError"
            ? "n8n duurde te lang om te antwoorden."
            : error instanceof Error
              ? error.message
              : "Onbekende n8n fout";
          return Response.json({ reply: `Webhook fout: ${message}` }, { status: 502, headers: jsonHeaders });
        }
      },
    },
  },
});
