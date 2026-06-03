import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

// Public webhook for Github / n8n / Supabase / Sandbox events.
// Configure HMAC secret as ECOSYSTEM_WEBHOOK_SECRET. Sender must send
// x-webhook-signature: sha256 hex of the raw body.
//
// Body shape:
// {
//   user_id: uuid (required),
//   source: "github" | "n8n" | "supabase" | "sandbox" | "manual",
//   entity_type: "commit" | "pull_request" | "workflow_run" | "feature" | ...,
//   entity_id?: uuid,
//   project_id?: uuid,
//   action: string (e.g. "created", "merged", "deployed"),
//   summary: string,
//   metadata?: object,
// }

const schema = z.object({
  user_id: z.string().uuid(),
  source: z.string().min(1).max(64).default("manual"),
  entity_type: z.string().min(1).max(64),
  entity_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  action: z.string().min(1).max(64),
  summary: z.string().min(1).max(2000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const jsonHeaders = { "Content-Type": "application/json" } as const;

export const Route = createFileRoute("/api/public/hooks/ecosystem-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.ECOSYSTEM_WEBHOOK_SECRET;
        const body = await request.text();

        if (secret) {
          const sig = request.headers.get("x-webhook-signature") ?? "";
          const expected = createHmac("sha256", secret).update(body).digest("hex");
          const a = Buffer.from(sig);
          const b = Buffer.from(expected);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let payload: unknown;
        try { payload = JSON.parse(body); } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.format() }, { status: 400, headers: jsonHeaders });
        }
        const e = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("activity_events").insert({
          user_id: e.user_id,
          entity_type: e.entity_type,
          entity_id: e.entity_id ?? null,
          project_id: e.project_id ?? null,
          action: e.action,
          summary: e.summary,
          metadata: (e.metadata ?? {}) as never,
          source: e.source,
        });
        if (error) {
          return Response.json({ error: error.message }, { status: 500, headers: jsonHeaders });
        }
        return Response.json({ ok: true }, { headers: jsonHeaders });
      },
    },
  },
});
