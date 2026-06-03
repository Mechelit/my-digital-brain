import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Network, Search, Github, Workflow, Sparkles, GitBranch, Boxes, Layers,
  FlaskConical, Activity as ActivityIcon, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { IntelligenceTab } from "@/components/ecosystem/IntelligenceTab";

export const Route = createFileRoute("/ecosystem")({ component: EcosystemPage });

const db = supabase as unknown as {
  from: (t: string) => ReturnType<typeof supabase.from>;
};

type Project = { id: string; name: string; description: string | null; purpose: string | null; github_repo: string | null; lovable_project: string | null; status: string; priority: string; created_at: string };
type Capability = { id: string; name: string; description: string | null; category: string | null; reusable: boolean };
type Asset = { id: string; name: string; category: string; description: string | null; status: string; created_at: string };
type Feature = { id: string; name: string; description: string | null; project_id: string | null; status: string; created_at: string; approved_at: string | null; retired_at: string | null };
type SandboxItem = { id: string; name: string; description: string | null; project_id: string | null; estimated_cost: number | null; estimated_build_time: string | null; used_assets: string[] | null; used_capabilities: string[] | null; status: string; created_at: string };
type WorkflowRow = { id: string; name: string; platform: string; description: string | null; status: string; project_id: string | null };
type Decision = { id: string; title: string; decision: string; reasoning: string | null; impact: string | null; project_id: string | null; created_at: string };
type ActivityEvent = { id: string; entity_type: string; entity_id: string | null; project_id: string | null; action: string; summary: string; source: string; created_at: string };

function EcosystemPage() {
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 grid place-items-center">
            <Network className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ecosystem</h1>
            <p className="text-sm text-muted-foreground">
              De levende kennislaag van Mila. Alles wat gebouwd, getest of beslist wordt komt hier vanzelf samen.
            </p>
          </div>
        </header>

        <Tabs defaultValue="projects" className="w-full">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="decisions">Decisions</TabsTrigger>
            <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          </TabsList>
          <TabsContent value="projects" className="mt-6"><ProjectsTab /></TabsContent>
          <TabsContent value="capabilities" className="mt-6"><CapabilitiesTab /></TabsContent>
          <TabsContent value="assets" className="mt-6"><AssetsTab /></TabsContent>
          <TabsContent value="features" className="mt-6"><FeaturesTab /></TabsContent>
          <TabsContent value="workflows" className="mt-6"><WorkflowsTab /></TabsContent>
          <TabsContent value="decisions" className="mt-6"><DecisionsTab /></TabsContent>
          <TabsContent value="sandbox" className="mt-6"><SandboxTab /></TabsContent>
          <TabsContent value="activity" className="mt-6"><ActivityTab /></TabsContent>
          <TabsContent value="intelligence" className="mt-6"><IntelligenceTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

/* ---------------- Helpers ---------------- */
function useProjects() {
  return useQuery({
    queryKey: ["eco-projects"],
    queryFn: async () => {
      const { data, error } = await db.from("projects").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Project[];
    },
  });
}

function statusBadge(s: string) {
  const map: Record<string, "default" | "secondary" | "outline"> = {
    active: "default", production: "default", approved: "default",
    paused: "secondary", testing: "secondary", sandbox: "secondary", building: "secondary", draft: "secondary",
    rejected: "outline", retired: "outline", archived: "outline",
  };
  return <Badge variant={map[s] ?? "secondary"}>{s}</Badge>;
}

/* ---------------- Projects ---------------- */
function ProjectsTab() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<Project | null>(null);
  const { data: projects = [], isLoading } = useProjects();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (!needle) return true;
      return p.name.toLowerCase().includes(needle) || (p.github_repo ?? "").toLowerCase().includes(needle) || (p.description ?? "").toLowerCase().includes(needle);
    });
  }, [projects, q, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek op naam, repo, beschrijving…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Laden…</p>
        : filtered.length === 0 ? <p className="text-sm text-muted-foreground">Geen projecten gevonden.</p>
        : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => setSelected(p)}
                className="text-left rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{p.name}</h3>
                  <Badge variant={p.priority === "high" ? "default" : "secondary"}>{p.priority}</Badge>
                </div>
                {p.github_repo && (
                  <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Github className="w-3 h-3" /> {p.github_repo}
                  </p>
                )}
                {p.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                <div className="mt-3 text-xs text-muted-foreground">Status: <span className="text-foreground">{p.status}</span></div>
              </button>
            ))}
          </div>
        )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selected && <ProjectDetail project={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectDetail({ project }: { project: Project }) {
  const wrap = async <T,>(t: string, build: (b: ReturnType<typeof supabase.from>) => any) => {
    const { data, error } = await build(db.from(t));
    if (error) throw error; return (data ?? []) as T;
  };
  const caps = useQuery({ queryKey: ["pd-caps", project.id], queryFn: () => wrap<Array<{ id: string; capability: { id: string; name: string } | null }>>("project_capabilities", (b) => b.select("id, capability:capabilities(id, name)").eq("project_id", project.id)) });
  const assets = useQuery({ queryKey: ["pd-assets", project.id], queryFn: () => wrap<Array<{ id: string; asset: { id: string; name: string; category: string } | null }>>("project_assets", (b) => b.select("id, asset:assets(id, name, category)").eq("project_id", project.id)) });
  const features = useQuery({ queryKey: ["pd-features", project.id], queryFn: () => wrap<Feature[]>("features", (b) => b.select("*").eq("project_id", project.id)) });
  const wfs = useQuery({ queryKey: ["pd-wfs", project.id], queryFn: () => wrap<WorkflowRow[]>("workflows", (b) => b.select("*").eq("project_id", project.id)) });
  const decs = useQuery({ queryKey: ["pd-decs", project.id], queryFn: () => wrap<Decision[]>("decisions", (b) => b.select("*").eq("project_id", project.id).order("created_at", { ascending: false })) });
  const sandbox = useQuery({ queryKey: ["pd-sandbox", project.id], queryFn: () => wrap<SandboxItem[]>("sandbox_items", (b) => b.select("*").eq("project_id", project.id)) });
  const acts = useQuery({ queryKey: ["pd-acts", project.id], queryFn: () => wrap<ActivityEvent[]>("activity_events", (b) => b.select("*").eq("project_id", project.id).order("created_at", { ascending: false }).limit(30)) });

  const reusable = (caps.data ?? []).filter(() => true); // capabilities are tagged reusable globally
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">{project.name} {statusBadge(project.status)}</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 text-sm mt-2">
        {project.github_repo && <div className="flex items-center gap-2 text-muted-foreground"><Github className="w-4 h-4" /> {project.github_repo}</div>}
        {project.purpose && <Block title="Purpose">{project.purpose}</Block>}
        {project.description && <Block title="Beschrijving">{project.description}</Block>}

        <Block title={`Capabilities (${caps.data?.length ?? 0})`}>
          {(caps.data ?? []).length === 0 ? <Empty>Geen capabilities gekoppeld.</Empty> : (
            <div className="flex flex-wrap gap-2">{caps.data!.map((c) => c.capability && <Badge key={c.id} variant="outline">{c.capability.name}</Badge>)}</div>
          )}
        </Block>

        <Block title={`Assets (${assets.data?.length ?? 0})`}>
          {(assets.data ?? []).length === 0 ? <Empty>Geen tools gekoppeld.</Empty> : (
            <div className="flex flex-wrap gap-2">{assets.data!.map((a) => a.asset && <Badge key={a.id} variant="secondary">{a.asset.name} <span className="opacity-60 ml-1">· {a.asset.category}</span></Badge>)}</div>
          )}
        </Block>

        <Block title={`Features (${features.data?.length ?? 0})`}>
          {(features.data ?? []).length === 0 ? <Empty>Nog geen features.</Empty> : (
            <ul className="space-y-1">{features.data!.map((f) => (
              <li key={f.id} className="flex items-center justify-between">
                <span>{f.name}</span>{statusBadge(f.status)}
              </li>
            ))}</ul>
          )}
        </Block>

        <Block title={`Workflows (${wfs.data?.length ?? 0})`}>
          {(wfs.data ?? []).length === 0 ? <Empty>Geen workflows.</Empty> : (
            <ul className="space-y-1">{wfs.data!.map((w) => <li key={w.id}>• {w.name} <span className="text-muted-foreground">({w.platform})</span></li>)}</ul>
          )}
        </Block>

        <Block title={`Sandbox (${sandbox.data?.length ?? 0})`}>
          {(sandbox.data ?? []).length === 0 ? <Empty>Niets in sandbox.</Empty> : (
            <ul className="space-y-1">{sandbox.data!.map((s) => (
              <li key={s.id} className="flex items-center justify-between"><span>{s.name}</span>{statusBadge(s.status)}</li>
            ))}</ul>
          )}
        </Block>

        <Block title={`Architectuurbeslissingen (${decs.data?.length ?? 0})`}>
          {(decs.data ?? []).length === 0 ? <Empty>Nog geen beslissingen.</Empty> : (
            <ul className="space-y-2">{decs.data!.map((d) => (
              <li key={d.id} className="border-l-2 border-primary/40 pl-3">
                <div className="font-medium">{d.title}</div>
                <div className="text-muted-foreground">{d.decision}</div>
              </li>
            ))}</ul>
          )}
        </Block>

        <Block title={`Activiteiten (${acts.data?.length ?? 0})`}>
          {(acts.data ?? []).length === 0 ? <Empty>Nog geen activiteit.</Empty> : (
            <ul className="space-y-1 text-xs">{acts.data!.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 text-muted-foreground">
                <span>{a.summary}</span>
                <span>{new Date(a.created_at).toLocaleString("nl-BE")}</span>
              </li>
            ))}</ul>
          )}
        </Block>

        <Block title={`Herbruikbare componenten (${reusable.length})`}>
          {reusable.length === 0 ? <Empty>—</Empty> : (
            <div className="flex flex-wrap gap-2">{reusable.map((c) => c.capability && <Badge key={c.id} variant="outline">{c.capability.name}</Badge>)}</div>
          )}
        </Block>
      </div>
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="text-xs uppercase text-muted-foreground mb-1.5">{title}</div>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) { return <p className="text-muted-foreground">{children}</p>; }

/* ---------------- Capabilities ---------------- */
function CapabilitiesTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: caps = [], isLoading } = useQuery({
    queryKey: ["eco-capabilities"],
    queryFn: async () => {
      const { data, error } = await db.from("capabilities").select("*").order("name");
      if (error) throw error; return (data ?? []) as unknown as Capability[];
    },
  });
  const { data: links = [] } = useQuery({
    queryKey: ["eco-cap-links"],
    queryFn: async () => {
      const { data, error } = await db.from("project_capabilities").select("id, capability_id, project:projects(id, name)");
      if (error) throw error; return (data ?? []) as unknown as Array<{ id: string; capability_id: string; project: { id: string; name: string } | null }>;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateDialog
          title="Nieuwe capability"
          fields={[
            { name: "name", label: "Naam", required: true },
            { name: "category", label: "Categorie" },
            { name: "description", label: "Beschrijving", textarea: true },
          ]}
          onSubmit={async (v) => {
            if (!user) return;
            const { error } = await db.from("capabilities").insert({ ...v, user_id: user.id } as never);
            if (error) throw error;
            qc.invalidateQueries({ queryKey: ["eco-capabilities"] });
          }}
        />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Laden…</p>
        : caps.length === 0 ? <EmptyCard icon={<Sparkles className="w-8 h-8" />}>Nog geen capabilities.</EmptyCard>
        : (
          <div className="grid sm:grid-cols-2 gap-4">
            {caps.map((c) => {
              const projects = links.filter((l) => l.capability_id === c.id);
              return (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      {c.name}{c.reusable && <Badge variant="outline">herbruikbaar</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    {c.category && <div className="text-xs text-muted-foreground">{c.category}</div>}
                    {c.description && <p className="text-muted-foreground">{c.description}</p>}
                    <div>
                      <div className="text-xs uppercase text-muted-foreground mb-1">Gebruikt in</div>
                      {projects.length === 0 ? <span className="text-muted-foreground">—</span> : (
                        <div className="flex flex-wrap gap-1">{projects.map((p) => p.project && <Badge key={p.id} variant="secondary">{p.project.name}</Badge>)}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}

/* ---------------- Assets ---------------- */
const ASSET_CATEGORIES = ["AI", "Database", "Automation", "Video", "Voice", "Analytics", "Infrastructure", "Communication"];

function AssetsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["eco-assets"],
    queryFn: async () => {
      const { data, error } = await db.from("assets").select("*").order("category").order("name");
      if (error) throw error; return (data ?? []) as unknown as Asset[];
    },
  });

  const grouped = useMemo(() => {
    const m: Record<string, Asset[]> = {};
    assets.forEach((a) => { (m[a.category] ||= []).push(a); });
    return m;
  }, [assets]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateDialog
          title="Nieuwe asset"
          fields={[
            { name: "name", label: "Naam", required: true },
            { name: "category", label: "Categorie", select: ASSET_CATEGORIES, required: true },
            { name: "description", label: "Beschrijving", textarea: true },
          ]}
          onSubmit={async (v) => {
            if (!user) return;
            const { error } = await db.from("assets").insert({ ...v, user_id: user.id } as never);
            if (error) throw error;
            qc.invalidateQueries({ queryKey: ["eco-assets"] });
          }}
        />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Laden…</p>
        : assets.length === 0 ? <EmptyCard icon={<Boxes className="w-8 h-8" />}>Nog geen assets.</EmptyCard>
        : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div className="text-xs uppercase text-muted-foreground mb-2">{cat}</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((a) => (
                    <div key={a.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{a.name}</div>
                        {statusBadge(a.status)}
                      </div>
                      {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

/* ---------------- Features ---------------- */
const FEATURE_STATUS = ["sandbox", "testing", "approved", "production", "retired"];

function FeaturesTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["eco-features"],
    queryFn: async () => {
      const { data, error } = await db.from("features").select("*, project:projects(id, name)").order("created_at", { ascending: false });
      if (error) throw error; return (data ?? []) as unknown as Array<Feature & { project: { id: string; name: string } | null }>;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateDialog
          title="Nieuwe feature"
          fields={[
            { name: "name", label: "Naam", required: true },
            { name: "project_id", label: "Project", select: projects.map((p) => ({ value: p.id, label: p.name })) },
            { name: "status", label: "Status", select: FEATURE_STATUS, required: true },
            { name: "description", label: "Beschrijving", textarea: true },
          ]}
          onSubmit={async (v) => {
            if (!user) return;
            const { error } = await db.from("features").insert({ ...v, user_id: user.id } as never);
            if (error) throw error;
            qc.invalidateQueries({ queryKey: ["eco-features"] });
          }}
        />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Laden…</p>
        : rows.length === 0 ? <EmptyCard icon={<Layers className="w-8 h-8" />}>Nog geen features.</EmptyCard>
        : (
          <div className="space-y-2">
            {rows.map((f) => (
              <div key={f.id} className="flex items-center justify-between border border-border rounded-lg p-4 bg-card">
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{f.project?.name ?? "Geen project"} · {new Date(f.created_at).toLocaleDateString("nl-BE")}</div>
                  {f.description && <p className="text-sm text-muted-foreground mt-1">{f.description}</p>}
                </div>
                {statusBadge(f.status)}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

/* ---------------- Workflows ---------------- */
function WorkflowsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["eco-workflows"],
    queryFn: async () => {
      const { data, error } = await db.from("workflows").select("*, project:projects(id, name)").order("name");
      if (error) throw error; return (data ?? []) as unknown as Array<WorkflowRow & { project: { id: string; name: string } | null }>;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateDialog
          title="Nieuwe workflow"
          fields={[
            { name: "name", label: "Naam", required: true },
            { name: "platform", label: "Platform", select: ["n8n", "github-actions", "supabase", "lovable", "ander"], required: true },
            { name: "project_id", label: "Project", select: projects.map((p) => ({ value: p.id, label: p.name })) },
            { name: "description", label: "Beschrijving", textarea: true },
          ]}
          onSubmit={async (v) => {
            if (!user) return;
            const { error } = await db.from("workflows").insert({ ...v, user_id: user.id } as never);
            if (error) throw error;
            qc.invalidateQueries({ queryKey: ["eco-workflows"] });
          }}
        />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Laden…</p>
        : rows.length === 0 ? <EmptyCard icon={<Workflow className="w-8 h-8" />}>Geen workflows gekoppeld.</EmptyCard>
        : (
          <div className="space-y-2">
            {rows.map((w) => (
              <div key={w.id} className="flex items-center justify-between border border-border rounded-lg p-4 bg-card">
                <div>
                  <div className="font-medium">{w.name}</div>
                  <div className="text-xs text-muted-foreground">{w.platform}{w.project ? ` · ${w.project.name}` : ""}</div>
                  {w.description && <p className="text-sm text-muted-foreground mt-1">{w.description}</p>}
                </div>
                {statusBadge(w.status)}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

/* ---------------- Decisions ---------------- */
function DecisionsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["eco-decisions"],
    queryFn: async () => {
      const { data, error } = await db.from("decisions").select("*, project:projects(id, name)").order("created_at", { ascending: false });
      if (error) throw error; return (data ?? []) as unknown as Array<Decision & { project: { id: string; name: string } | null }>;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateDialog
          title="Nieuwe architectuurkeuze"
          fields={[
            { name: "title", label: "Titel", required: true },
            { name: "decision", label: "Beslissing", required: true, textarea: true },
            { name: "reasoning", label: "Reden", textarea: true },
            { name: "impact", label: "Impact", textarea: true },
            { name: "project_id", label: "Project", select: projects.map((p) => ({ value: p.id, label: p.name })) },
          ]}
          onSubmit={async (v) => {
            if (!user) return;
            const { error } = await db.from("decisions").insert({ ...v, user_id: user.id } as never);
            if (error) throw error;
            qc.invalidateQueries({ queryKey: ["eco-decisions"] });
          }}
        />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Laden…</p>
        : rows.length === 0 ? <EmptyCard icon={<GitBranch className="w-8 h-8" />}>Nog geen beslissingen.</EmptyCard>
        : (
          <div className="space-y-4">
            {rows.map((d) => (
              <Card key={d.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{d.title}</CardTitle>
                    <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString("nl-BE")}</span>
                  </div>
                  {d.project && <div className="text-xs text-muted-foreground">{d.project.name}</div>}
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div><span className="text-xs uppercase text-muted-foreground">Beslissing: </span>{d.decision}</div>
                  {d.reasoning && <div><span className="text-xs uppercase text-muted-foreground">Reden: </span>{d.reasoning}</div>}
                  {d.impact && <div><span className="text-xs uppercase text-muted-foreground">Impact: </span>{d.impact}</div>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}

/* ---------------- Sandbox ---------------- */
const SANDBOX_STATUS = ["draft", "building", "testing", "waiting_approval", "approved", "rejected", "production"];

function SandboxTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["eco-sandbox"],
    queryFn: async () => {
      const { data, error } = await db.from("sandbox_items").select("*, project:projects(id, name)").order("created_at", { ascending: false });
      if (error) throw error; return (data ?? []) as unknown as Array<SandboxItem & { project: { id: string; name: string } | null }>;
    },
  });

  const promote = useMutation({
    mutationFn: async (s: SandboxItem) => {
      if (!user) return;
      const { error: uErr } = await db.from("sandbox_items").update({ status: "production" } as never).eq("id", s.id);
      if (uErr) throw uErr;
      const { error: fErr } = await db.from("features").insert({
        user_id: user.id, project_id: s.project_id, name: s.name,
        description: s.description, status: "production", approved_at: new Date().toISOString(),
      } as never);
      if (fErr) throw fErr;
    },
    onSuccess: () => {
      toast.success("Feature verplaatst naar Production");
      qc.invalidateQueries({ queryKey: ["eco-sandbox"] });
      qc.invalidateQueries({ queryKey: ["eco-features"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Kon niet promoten"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateDialog
          title="Nieuwe sandbox-functionaliteit"
          fields={[
            { name: "name", label: "Naam", required: true },
            { name: "project_id", label: "Project", select: projects.map((p) => ({ value: p.id, label: p.name })) },
            { name: "status", label: "Status", select: SANDBOX_STATUS, required: true },
            { name: "estimated_cost", label: "Geschatte kosten (€)", type: "number" },
            { name: "estimated_build_time", label: "Geschatte bouwtijd (bv. 2u, 1 dag)" },
            { name: "description", label: "Beschrijving", textarea: true },
          ]}
          onSubmit={async (v) => {
            if (!user) return;
            const payload: any = { ...v, user_id: user.id };
            if (payload.estimated_cost === "" || payload.estimated_cost == null) delete payload.estimated_cost;
            else payload.estimated_cost = Number(payload.estimated_cost);
            const { error } = await db.from("sandbox_items").insert(payload);
            if (error) throw error;
            qc.invalidateQueries({ queryKey: ["eco-sandbox"] });
          }}
        />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Laden…</p>
        : rows.length === 0 ? <EmptyCard icon={<FlaskConical className="w-8 h-8" />}>Sandbox is leeg. Nieuwe ideeën beginnen hier.</EmptyCard>
        : (
          <div className="grid sm:grid-cols-2 gap-4">
            {rows.map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    {statusBadge(s.status)}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.project?.name ?? "Geen project"}</div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  {s.description && <p className="text-muted-foreground">{s.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {s.estimated_cost != null && <span>€ {Number(s.estimated_cost).toFixed(0)}</span>}
                    {s.estimated_build_time && <span>{s.estimated_build_time}</span>}
                  </div>
                  {s.status !== "production" && (
                    <Button size="sm" variant="outline" onClick={() => promote.mutate(s)}>Promoten naar Production</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}

/* ---------------- Activity ---------------- */
function ActivityTab() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["eco-activity"],
    queryFn: async () => {
      const { data, error } = await db.from("activity_events")
        .select("*, project:projects(id, name)")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Array<ActivityEvent & { project: { id: string; name: string } | null }>;
    },
  });

  const grouped = useMemo(() => {
    const m: Record<string, typeof rows> = {};
    rows.forEach((r) => { const d = new Date(r.created_at).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" }); (m[d] ||= [] as any).push(r); });
    return m;
  }, [rows]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Laden…</p>;
  if (rows.length === 0) return <EmptyCard icon={<ActivityIcon className="w-8 h-8" />}>Nog geen activiteit. Alles wat in Ecosystem gebeurt komt hier automatisch terecht.</EmptyCard>;

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([day, items]) => (
        <div key={day}>
          <div className="text-xs uppercase text-muted-foreground mb-2">{day}</div>
          <ul className="space-y-2">
            {items.map((a) => (
              <li key={a.id} className="flex items-start gap-3 border-l-2 border-primary/30 pl-3">
                <div className="flex-1">
                  <div className="text-sm">{a.summary}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.entity_type} · {a.action} · {a.source}{a.project ? ` · ${a.project.name}` : ""}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(a.created_at).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Reusable bits ---------------- */
function EmptyCard({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-muted-foreground">
        <div className="mx-auto mb-3 opacity-50 w-fit">{icon}</div>
        {children}
      </CardContent>
    </Card>
  );
}

type FieldDef = {
  name: string; label: string; required?: boolean; textarea?: boolean; type?: string;
  select?: string[] | Array<{ value: string; label: string }>;
};

function CreateDialog({ title, fields, onSubmit }: {
  title: string; fields: FieldDef[]; onSubmit: (values: Record<string, any>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    for (const f of fields) if (f.required && !values[f.name]) { toast.error(`${f.label} is verplicht`); return; }
    setBusy(true);
    try { await onSubmit(values); setOpen(false); setValues({}); toast.success("Opgeslagen"); }
    catch (e: any) { toast.error(e.message ?? "Mislukt"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Toevoegen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground">{f.label}{f.required && " *"}</label>
              {f.select ? (
                <Select value={values[f.name] ?? ""} onValueChange={(v) => setValues({ ...values, [f.name]: v })}>
                  <SelectTrigger><SelectValue placeholder={`Kies ${f.label.toLowerCase()}`} /></SelectTrigger>
                  <SelectContent>
                    {(f.select as any[]).map((opt) => {
                      const v = typeof opt === "string" ? opt : opt.value;
                      const l = typeof opt === "string" ? opt : opt.label;
                      return <SelectItem key={v} value={v}>{l}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              ) : f.textarea ? (
                <Textarea value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              ) : (
                <Input type={f.type ?? "text"} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuleer</Button>
          <Button onClick={handle} disabled={busy}>{busy ? "Opslaan…" : "Opslaan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
