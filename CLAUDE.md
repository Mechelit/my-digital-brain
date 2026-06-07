# MILA — Digital Operating System (Iris Geudens / Findout BV)

## Wat dit is
MILA is het digitale operating system van Iris: één command center waarin facturen, contracten, mail, scans, accounts en project-intelligence samenkomen, aangestuurd door een AI-laag.

## Tech Stack (zoals het er nu echt staat)
- Frontend: React 19 + TanStack Start/Router/Query + Tailwind CSS v4 + shadcn/ui (Radix) + lucide-react
- Backend: TanStack Start server routes + Nitro (`src/server.ts`, `src/routes/api/**`)
- Database: Supabase (public schema, project: `wogxetbzzqzbdhrgmdch`) via `@supabase/supabase-js`
- Auth: Lovable Cloud auth (`@lovable.dev/cloud-auth-js`, `src/hooks/use-auth.ts`)
- Deployment: Cloudflare (`wrangler.jsonc`, `@cloudflare/vite-plugin`)
- Package manager: bun (`bun.lock`, `bunfig.toml`)
- AI: Claude API — `claude-opus-4-8` (complex), `claude-sonnet-4-6` (uitvoering)
- Memory: Mem0 (user_id: `mila-sovereign-user`)

> Afwijking t.o.v. de standaard MILA-stack (Vercel, geen Lovable): deze repo draait op Cloudflare + Lovable Cloud auth. Niet wegmoffelen — beslissen of we migreren of dit zo houden. Status: open vraag voor Iris.

## Datamodel (Supabase public schema)
`accounts`, `activity_events`, `assets`, `capabilities`, `capability_assets`, `contracts`, `decisions`, `deposits`, `features`, `ignored_emails`, `ignored_suppliers`, `invoices`, `mobile_scan_sessions`, `outlook_emails`, `profiles`, `project_assets`, `project_capabilities`, `project_intelligence`, `projects`, `recurring_expenses`, `sandbox_items`, `todos`, `workflows`

## Command center — de 5 werelden
`MilaCommandCenter` toont MILA-core met vijf werelden eromheen:
- Business → `/financien`
- Leven → `/inbox`
- Creatie → `/contracten`
- Groei → `/accounts`
- Onderzoeken → `/scan`

## Nodes (taken)

Statusconventie: `todo` / `in progress` / `done` / `failed`.
`done` = code staat er volledig én is geverifieerd. Alles wat gebouwd is maar nog niet in deze omgeving getest is, staat op `in progress (niet geverifieerd)` tot we draaien en testen.

### Node 1 — Command center / dashboard
Status: in progress (niet geverifieerd)
Doel: startscherm met greeting, vijf werelden en max 3 insights uit live data.
Bestand: `src/routes/index.tsx`, `src/components/MilaCommandCenter.tsx`, `src/components/AppShell.tsx`
Test: app draait, ingelogd, dashboard rendert; openstaande facturen verschijnen als insight met juist totaal.

### Node 2 — Financiën (facturen)
Status: in progress (niet geverifieerd)
Doel: facturen tonen, status beheren, totaal in EUR; AI-extractie van factuurdata.
Bestand: `src/routes/financien.tsx`, `src/routes/invoice.$id.tsx`, `src/components/InvoiceCard.tsx`, `src/lib/invoices.functions.ts`, `src/lib/invoice-ai.functions.ts`, tabel `invoices`
Test: factuur opent op `/invoice/:id`; pending/confirmed worden correct geteld; AI-extractie levert bruikbare velden.

### Node 3 — Inbox (mail-sync)
Status: in progress (niet geverifieerd)
Doel: Gmail + Outlook mail syncen en tonen; ruis filteren via ignored_emails/ignored_suppliers.
Bestand: `src/routes/inbox.tsx`, `src/components/EmailsWidget.tsx`, `src/lib/gmail.functions.ts`, `src/routes/api/public/hooks/sync-gmail.ts`, tabellen `outlook_emails`, `ignored_emails`, `ignored_suppliers`
Test: sync-hook haalt mail op; inbox toont items; genegeerde afzenders verschijnen niet.

### Node 4 — Contracten
Status: in progress (niet geverifieerd)
Doel: contracten beheren en tonen.
Bestand: `src/routes/contracten.tsx`, tabel `contracts`
Test: contracten laden en zijn zichtbaar voor de ingelogde gebruiker.

### Node 5 — Scan (mobiel → desktop)
Status: in progress (niet geverifieerd)
Doel: mobiel document scannen en koppelen aan een desktop-sessie via token.
Bestand: `src/routes/scan.tsx`, `src/routes/m.$token.tsx`, `src/routes/scan.desktop.$token.tsx`, `src/lib/mobile-scan.functions.ts`, tabel `mobile_scan_sessions`
Test: QR/token koppelt mobiel aan desktop; gescande output komt aan in de juiste sessie.

### Node 6 — Accounts
Status: in progress (niet geverifieerd)
Doel: accounts/koppelingen beheren.
Bestand: `src/routes/accounts.tsx`, tabel `accounts`
Test: accounts laden en zijn te beheren.

### Node 7 — Ecosystem / project-intelligence
Status: in progress (niet geverifieerd)
Doel: projecten, capabilities, features en intelligence samenbrengen; events verwerken.
Bestand: `src/routes/ecosystem.tsx`, `src/components/ecosystem/IntelligenceTab.tsx`, `src/routes/api/public/hooks/ecosystem-event.ts`, tabellen `projects`, `capabilities`, `features`, `project_intelligence`, `activity_events`, `decisions`, `workflows`
Test: ecosystem-pagina toont projecten en intelligence; inkomende events worden weggeschreven.

### Node 8 — AI-laag / chat (n8n)
Status: in progress (niet geverifieerd)
Doel: MILA-chat/assistant endpoint.
Bestand: `src/routes/api/n8n-chat.ts`, `src/components/AssistantWidget.tsx`, `src/components/TodosWidget.tsx`, tabel `todos`
Test: chat-endpoint antwoordt; assistant-widget toont respons; todos koppelen.

## Technische regels
- Supabase: altijd public schema. Custom schema enkel via HTTP Request + `Accept-Profile` header.
- Claude-modellen verifiëren via web search vóór gebruik. Geldig nu: `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`. Haiku 4.6/4.7/4.8 bestaan niet.
- Mem0 body: `{"messages":[{"role":"user","content":"..."}],"user_id":"mila-sovereign-user"}`
- `src/integrations/supabase/types.ts` en `src/integrations/supabase/client.ts` zijn gegenereerd — niet handmatig editen.
- Geen secrets committen. `.env` blijft lokaal/gitignored.
- Nooit verder naar de volgende node als de huidige niet werkt.

## Sessielog
- 2026-06-07 — CTO-agent geïnitialiseerd. Codebase verkend (TanStack Start + Supabase + Cloudflare + Lovable). CLAUDE.md aangemaakt als ruggengraat, met de 8 bestaande feature-gebieden als nodes. Open vraag genoteerd: Cloudflare/Lovable vs de standaard Vercel-stack. Nog niets gebouwd of getest in deze sessie.
