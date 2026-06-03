import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, Search, Github, Workflow, Sparkles, GitBranch } from "lucide-react";

export const Route = createFileRoute("/ecosystem")({ component: EcosystemPage });

type Project = {
  id: string;
  name: string;
  description: string | null;
  purpose: string | null;
  github_repo: string | null;
  lovable_project: string | null;
  status: string;
  priority: string;
  created_at: string;
};

type Capability = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  reusable: boolean;
};

type ProjectCapability = {
  id: string;
  project_id: string;
  capability_id: string;
  notes: string | null;
};

type WorkflowRow = {
  id: string;
  name: string;
  platform: string;
  description: string | null;
  status: string;
  project_id: string | null;
};

type Decision = {
  id: string;
  title: string;
  decision: string;
  reasoning: string | null;
  impact: string | null;
  project_id: string | null;
  created_at: string;
};

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
              De fundering van het Mila-ecosysteem. Projecten, capabilities, workflows en architectuurkeuzes op één plek.
            </p>
          </div>
        </header>

        <Tabs defaultValue="projects" className="w-full">
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="decisions">Decisions</TabsTrigger>
          </TabsList>
          <TabsContent value="projects" className="mt-6"><ProjectsTab /></TabsContent>
          <TabsContent value="capabilities" className="mt-6"><CapabilitiesTab /></TabsContent>
          <TabsContent value="workflows" className="mt-6"><WorkflowsTab /></TabsContent>
          <TabsContent value="decisions" className="mt-6"><DecisionsTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

/* ---------------- Projects ---------------- */
function ProjectsTab() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<Project | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["eco-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects" as never)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Project[];
    },
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        (p.github_repo ?? "").toLowerCase().includes(needle) ||
        (p.description ?? "").toLowerCase().includes(needle)
      );
    });
  }, [projects, q, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek op naam, repo, beschrijving…"
            className="pl-9"
          />
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Geen projecten gevonden.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="text-left rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{p.name}</h3>
                <Badge variant={p.priority === "high" ? "default" : "secondary"}>{p.priority}</Badge>
              </div>
              {p.github_repo && (
                <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                  <Github className="w-3 h-3" /> {p.github_repo}
                </p>
              )}
              {p.description && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.description}</p>
              )}
              <div className="mt-3 text-xs text-muted-foreground">
                Status: <span className="text-foreground">{p.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && <ProjectDetail project={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectDetail({ project }: { project: Project }) {
  const { data: caps = [] } = useQuery({
    queryKey: ["eco-project-caps", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_capabilities" as never)
        .select("id, notes, capability:capabilities(id, name, category)")
        .eq("project_id", project.id);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        notes: string | null;
        capability: { id: string; name: string; category: string | null } | null;
      }>;
    },
  });

  const { data: wfs = [] } = useQuery({
    queryKey: ["eco-project-wfs", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflows" as never)
        .select("*")
        .eq("project_id", project.id);
      if (error) throw error;
      return (data ?? []) as unknown as WorkflowRow[];
    },
  });

  const { data: decs = [] } = useQuery({
    queryKey: ["eco-project-decs", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decisions" as never)
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Decision[];
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {project.name}
          <Badge variant="secondary">{project.status}</Badge>
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        {project.github_repo && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Github className="w-4 h-4" /> {project.github_repo}
          </div>
        )}
        {project.purpose && (
          <div><div className="text-xs uppercase text-muted-foreground mb-1">Purpose</div>{project.purpose}</div>
        )}
        {project.description && (
          <div><div className="text-xs uppercase text-muted-foreground mb-1">Beschrijving</div>{project.description}</div>
        )}
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1">Capabilities ({caps.length})</div>
          {caps.length === 0 ? <p className="text-muted-foreground">Geen capabilities gekoppeld.</p> : (
            <div className="flex flex-wrap gap-2">
              {caps.map((c) => c.capability && <Badge key={c.id} variant="outline">{c.capability.name}</Badge>)}
            </div>
          )}
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1">Workflows ({wfs.length})</div>
          {wfs.length === 0 ? <p className="text-muted-foreground">Geen workflows.</p> : (
            <ul className="space-y-1">{wfs.map((w) => <li key={w.id}>• {w.name} <span className="text-muted-foreground">({w.platform})</span></li>)}</ul>
          )}
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1">Decisions ({decs.length})</div>
          {decs.length === 0 ? <p className="text-muted-foreground">Nog geen architectuurkeuzes vastgelegd.</p> : (
            <ul className="space-y-2">{decs.map((d) => (
              <li key={d.id} className="border-l-2 border-primary/40 pl-3">
                <div className="font-medium">{d.title}</div>
                <div className="text-muted-foreground">{d.decision}</div>
              </li>
            ))}</ul>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------- Capabilities ---------------- */
function CapabilitiesTab() {
  const { data: caps = [], isLoading } = useQuery({
    queryKey: ["eco-capabilities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capabilities" as never)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Capability[];
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["eco-cap-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_capabilities" as never)
        .select("id, capability_id, project:projects(id, name)");
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        capability_id: string;
        project: { id: string; name: string } | null;
      }>;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Laden…</p>;
  if (caps.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
          Nog geen capabilities. Voeg ze toe naarmate je ecosysteem groeit.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {caps.map((c) => {
        const projects = links.filter((l) => l.capability_id === c.id);
        return (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                {c.name}
                {c.reusable && <Badge variant="outline">herbruikbaar</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {c.category && <div className="text-xs text-muted-foreground">{c.category}</div>}
              {c.description && <p className="text-muted-foreground">{c.description}</p>}
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Gebruikt in</div>
                {projects.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {projects.map((p) => p.project && <Badge key={p.id} variant="secondary">{p.project.name}</Badge>)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------- Workflows ---------------- */
function WorkflowsTab() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["eco-workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflows" as never)
        .select("*, project:projects(id, name)")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Array<WorkflowRow & { project: { id: string; name: string } | null }>;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Laden…</p>;
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Workflow className="w-8 h-8 mx-auto mb-3 opacity-50" />
          Nog geen workflows gekoppeld. Voeg je n8n workflows hier toe.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((w) => (
        <div key={w.id} className="flex items-center justify-between border border-border rounded-lg p-4 bg-card">
          <div>
            <div className="font-medium">{w.name}</div>
            <div className="text-xs text-muted-foreground">
              {w.platform} {w.project ? `· ${w.project.name}` : ""}
            </div>
            {w.description && <p className="text-sm text-muted-foreground mt-1">{w.description}</p>}
          </div>
          <Badge variant={w.status === "active" ? "default" : "secondary"}>{w.status}</Badge>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Decisions ---------------- */
function DecisionsTab() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["eco-decisions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decisions" as never)
        .select("*, project:projects(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Array<Decision & { project: { id: string; name: string } | null }>;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Laden…</p>;
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <GitBranch className="w-8 h-8 mx-auto mb-3 opacity-50" />
          Nog geen beslissingen vastgelegd. Documenteer architectuurkeuzes hier.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((d) => (
        <Card key={d.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{d.title}</CardTitle>
              <span className="text-xs text-muted-foreground">
                {new Date(d.created_at).toLocaleDateString("nl-BE")}
              </span>
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
  );
}
