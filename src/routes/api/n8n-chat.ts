import { createFileRoute } from "@tanstack/react-router";

const N8N_WEBHOOK_URL = "https://mila-ai-brain.app.n8n.cloud/webhook/sovereign-mind";

export const Route = createFileRoute("/api/n8n-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const incoming = (await request.json()) as Record<string, unknown>;
          const message = String(incoming.message ?? incoming.chatInput ?? incoming.text ?? incoming.input ?? "");
          const userId = String(incoming.user_id ?? incoming.userId ?? incoming.sessionId ?? "mila-sovereign-user");
          const body = {
            ...incoming,
            message,
            chatInput: message,
            input: message,
            user_id: userId,
            userId,
            sessionId: userId,
            source: "brain-dashboard",
            origin: request.headers.get("origin") || "lovable-preview",
          };

          const upstream = await fetch(N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "text/plain, application/json;q=0.5" },
            body: JSON.stringify(body),
          });

          if (!upstream.ok || !upstream.body) {
            const text = await upstream.text().catch(() => "");
            return new Response(`n8n fout ${upstream.status}: ${text}`, {
              status: upstream.status || 502,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }

          const contentType = upstream.headers.get("content-type") || "text/plain; charset=utf-8";
          return new Response(upstream.body, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "no-cache, no-transform",
              "X-Accel-Buffering": "no",
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Onbekende n8n fout";
          return new Response(`Webhook fout: ${message}`, {
            status: 502,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
