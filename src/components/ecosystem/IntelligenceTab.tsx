import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Brain, Plus, X, Lightbulb, AlertTriangle, Link2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const db = supabase as unknown as {
  from: (t: string) => ReturnType<typeof supabase.from>;
};

type Project = { id: string; name: string; description: string | null };
type Capability = { id: string; name: string; description: string | null; category: string | null; grouping: string | null };
type Asset = { id: string; name: string; category: string; description: string | null; status: string };
type Feature = { id: string; name: string; description: string | null; project_id: string | null; status: string };
type ProjectAsset = { project_id: string; asset_id: string };
type ProjectCapability = { project_id: string; capability_id: string };
type CapabilityAsset = { id: string; capability_id: string; asset_id: string };
type RiskItem = { title: string; severity: "low" | "medium" | "high"; note?: string };
type OpportunityItem = { title: string; severity: "low" | "medium" | "high"; note?: string };
type Intel = {
  id: string;
  project_id: string;
  user_id: string;
  summary: string | null;
  technologies: string[];
  data_sources: string[];
  risks: RiskItem[];
  opportunities: OpportunityItem[];
  last_analyzed_at: string | null;
};

export function IntelligenceTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 grid place-items-center">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Intelligence</h2>
          <p className="text-sm text-muted-foreground">
            De redeneerlaag van Mila — kennis per project, koppelingen tussen capabilities en assets, en hergebruikssignalen.
          </p>
        </div>
      </div>

      <Tabs defaultValue="project" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="project">Project Intelligence</TabsTrigger>
          <TabsTrigger value="asset">Asset Intelligence</TabsTrigger>
          <TabsTrigger value="capability">Capability Intelligence</TabsTrigger>
          <TabsTrigger value="reuse">Reuse Opportunities</TabsTrigger>
        </TabsList>
        <TabsContent value="project" className="mt-6"><ProjectIntelligence /></TabsContent>
        <TabsContent value="asset" className="mt-6"><AssetIntelligence /></TabsContent>
        <TabsContent value="capability" className="mt-6"><CapabilityIntelligence /></TabsContent>
        <TabsContent value="reuse" className="mt-6"><ReuseOpportunities /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- shared queries ---------------- */
function useProjects() {
  return useQuery({
    queryKey: ["intel-projects"],
    queryFn: async () => {
      const { data, error } = await db.from("projects").select("id,name,description").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Project[];
    },
  });
}
function useCapabilities() {
  return useQuery({
    queryKey: ["intel-capabilities"],
    queryFn: async () => {
      const { data, error } = await db.from("capabilities").select("id,name,description,category,grouping").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Capability[];
    },
  });
}
function useAssets() {
  return useQuery({
    queryKey: ["intel-assets"],
    queryFn: async () => {
      const { data, error } = await db.from("assets").select("id,name,category,description,status").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Asset[];
    },
  });
}
function useFeatures() {
  return useQuery({
    queryKey: ["intel-features"],
    queryFn: async () => {
      const { data, error } = await db.from("features").select("id,name,description,project_id,status");
      if (error) throw error;
      return (data ?? []) as unknown as Feature[];
    },
  });
}
function useProjectAssets() {
  return useQuery({
    queryKey: ["intel-project-assets"],
    queryFn: async () => {
      const { data, error } = await db.from("project_assets").select("project_id,asset_id");
      if (error) throw error;
      return (data ?? []) as unknown as ProjectAsset[];
    },
  });
}
function useProjectCapabilities() {
  return useQuery({
    queryKey: ["intel-project-capabilities"],
    queryFn: async () => {
      const { data, error } = await db.from("project_capabilities").select("project_id,capability_id");
      if (error) throw error;
      return (data ?? []) as unknown as ProjectCapability[];
    },
  });
}
function useCapabilityAssets() {
  return useQuery({
    queryKey: ["intel-capability-assets"],
    queryFn: async () => {
      const { data, error } = await db.from("capability_assets").select("id,capability_id,asset_id");
      if (error) throw error;
      return (data ?? []) as unknown as CapabilityAsset[];
    },
  });
}

/* ---------------- 1. Project Intelligence ---------------- */
function ProjectIntelligence() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: features = [] } = useFeatures();
  const [projectId, setProjectId] = useState<string>("");

  const activeId = projectId || projects[0]?.id || "";

  const { data: intel } = useQuery({
    queryKey: ["intel-project", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await db
        .from("project_intelligence")
        .select("*")
        .eq("project_id", activeId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as Intel | null;
    },
  });

  const { data: projectWorkflows = [] } = useQuery({
    queryKey: ["intel-workflows", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await db.from("workflows").select("id,name,platform,status").eq("project_id", activeId);
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; platform: string; status: string }[];
    },
  });

  const projectFeatures = features.filter((f) => f.project_id === activeId);

  const upsert = useMutation({
    mutationFn: async (patch: Partial<Intel>) => {
      if (!user || !activeId) throw new Error("Geen project");
      const payload = {
        user_id: user.id,
        project_id: activeId,
        summary: patch.summary ?? intel?.summary ?? null,
        technologies: patch.technologies ?? intel?.technologies ?? [],
        data_sources: patch.data_sources ?? intel?.data_sources ?? [],
        risks: patch.risks ?? intel?.risks ?? [],
        opportunities: patch.opportunities ?? intel?.opportunities ?? [],
        last_analyzed_at: new Date().toISOString(),
      };
      const { error } = await db.from("project_intelligence").upsert(payload, { onConflict: "project_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intel-project", activeId] });
      toast.success("Kennis opgeslagen");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (projects.length === 0) {
    return <EmptyState text="Nog geen projecten. Maak er eerst een aan onder Projects." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select value={activeId} onValueChange={setProjectId}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Kies project" /></SelectTrigger>
          <SelectContent>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {intel?.last_analyzed_at && (
          <span className="text-xs text-muted-foreground">
            Laatst bijgewerkt: {new Date(intel.last_analyzed_at).toLocaleString("nl-BE")}
          </span>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Samenvatting</CardTitle></CardHeader>
        <CardContent>
          <SummaryEditor
            value={intel?.summary ?? ""}
            onSave={(v) => upsert.mutate({ summary: v })}
          />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <TagListCard
          title="Technologieën"
          values={intel?.technologies ?? []}
          placeholder="bv. React, Supabase, n8n"
          onChange={(v) => upsert.mutate({ technologies: v })}
        />
        <TagListCard
          title="Databronnen"
          values={intel?.data_sources ?? []}
          placeholder="bv. Gmail API, Postgres, OpenAI"
          onChange={(v) => upsert.mutate({ data_sources: v })}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <StructuredListCard
          title="Risico's"
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          items={intel?.risks ?? []}
          severityLabel="Ernst"
          onChange={(v) => upsert.mutate({ risks: v as RiskItem[] })}
        />
        <StructuredListCard
          title="Kansen"
          icon={<Lightbulb className="w-4 h-4 text-emerald-500" />}
          items={intel?.opportunities ?? []}
          severityLabel="Impact"
          onChange={(v) => upsert.mutate({ opportunities: v as OpportunityItem[] })}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Workflows</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {projectWorkflows.length === 0 && <p className="text-sm text-muted-foreground">Nog geen workflows gekoppeld aan dit project.</p>}
            {projectWorkflows.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{w.name}</span>
                <Badge variant="outline">{w.platform}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Componenten / Features</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {projectFeatures.length === 0 && <p className="text-sm text-muted-foreground">Nog geen features.</p>}
            {projectFeatures.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{f.name}</span>
                <Badge variant="secondary">{f.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  // sync when project changes
  if (value !== draft && draft === "") setDraft(value);
  return (
    <div className="space-y-2">
      <Textarea
        rows={4}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Wat doet dit project? Waarom bestaat het? Welke beslissingen zijn cruciaal?"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => onSave(draft)}>Opslaan</Button>
      </div>
    </div>
  );
}

function TagListCard({
  title, values, placeholder, onChange,
}: { title: string; values: string[]; placeholder: string; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              {v}
              <button onClick={() => onChange(values.filter((x) => x !== v))} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {values.length === 0 && <p className="text-xs text-muted-foreground">Nog niets toegevoegd.</p>}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            placeholder={placeholder}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                onChange([...values, input.trim()]);
                setInput("");
              }
            }}
          />
          <Button
            size="sm"
            onClick={() => {
              if (!input.trim()) return;
              onChange([...values, input.trim()]);
              setInput("");
            }}
          ><Plus className="w-4 h-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StructuredListCard({
  title, icon, items, severityLabel, onChange,
}: {
  title: string;
  icon: React.ReactNode;
  items: { title: string; severity?: string; impact?: string; note?: string }[];
  severityLabel: string;
  onChange: (v: { title: string; severity: "low" | "medium" | "high"; note?: string }[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ title: string; severity: "low" | "medium" | "high"; note: string }>({
    title: "", severity: "medium", note: "",
  });
  const key = "severity";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">{icon}{title}</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="w-4 h-4" /></Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{title} toevoegen</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Titel" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <Select value={draft.severity} onValueChange={(v) => setDraft({ ...draft, severity: v as "low" | "medium" | "high" })}>
                <SelectTrigger><SelectValue placeholder={severityLabel} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Laag</SelectItem>
                  <SelectItem value="medium">Gemiddeld</SelectItem>
                  <SelectItem value="high">Hoog</SelectItem>
                </SelectContent>
              </Select>
              <Textarea placeholder="Toelichting (optioneel)" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </div>
            <DialogFooter>
              <Button onClick={() => {
                if (!draft.title.trim()) return;
                onChange([
                  ...items.map((i) => ({
                    title: i.title,
                    severity: ((i as Record<string, unknown>)[key] as "low" | "medium" | "high") ?? "medium",
                    note: i.note,
                  })),
                  { title: draft.title.trim(), severity: draft.severity, note: draft.note.trim() || undefined },
                ]);
                setDraft({ title: "", severity: "medium", note: "" });
                setOpen(false);
              }}>Toevoegen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nog niets vastgelegd.</p>}
        {items.map((it, idx) => {
          const sev = ((it as Record<string, unknown>)[key] as string) ?? "medium";
          return (
            <div key={idx} className="rounded-md border px-3 py-2 text-sm flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{it.title}</div>
                {it.note && <div className="text-xs text-muted-foreground mt-1">{it.note}</div>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={sev === "high" ? "destructive" : sev === "medium" ? "default" : "secondary"}>{sev}</Badge>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const next = items
                      .filter((_, i) => i !== idx)
                      .map((i) => ({
                        title: i.title,
                        severity: ((i as Record<string, unknown>)[key] as "low" | "medium" | "high") ?? "medium",
                        note: i.note,
                      }));
                    onChange(next);
                  }}
                ><X className="w-3 h-3" /></button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ---------------- 2. Asset Intelligence ---------------- */
function AssetIntelligence() {
  const { data: assets = [] } = useAssets();
  const { data: projects = [] } = useProjects();
  const { data: caps = [] } = useCapabilities();
  const { data: projectAssets = [] } = useProjectAssets();
  const { data: capAssets = [] } = useCapabilityAssets();

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const capsById = useMemo(() => new Map(caps.map((c) => [c.id, c])), [caps]);

  if (assets.length === 0) return <EmptyState text="Nog geen assets. Voeg er eerst toe onder Assets." />;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {assets.map((a) => {
        const usedInProjects = projectAssets.filter((pa) => pa.asset_id === a.id).map((pa) => projectsById.get(pa.project_id)).filter(Boolean) as Project[];
        const linkedCaps = capAssets.filter((ca) => ca.asset_id === a.id).map((ca) => capsById.get(ca.capability_id)).filter(Boolean) as Capability[];
        return (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>{a.name}</span>
                <Badge variant="outline">{a.category}</Badge>
              </CardTitle>
              {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Capabilities ({linkedCaps.length})</p>
                <div className="flex flex-wrap gap-1">
                  {linkedCaps.length === 0 && <span className="text-xs text-muted-foreground">Nog niet gekoppeld</span>}
                  {linkedCaps.map((c) => <Badge key={c.id} variant="secondary" className="text-xs">{c.name}</Badge>)}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Projecten ({usedInProjects.length})</p>
                <div className="flex flex-wrap gap-1">
                  {usedInProjects.length === 0 && <span className="text-xs text-muted-foreground">Nog niet gebruikt</span>}
                  {usedInProjects.map((p) => <Badge key={p.id} variant="outline" className="text-xs">{p.name}</Badge>)}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------- 3. Capability Intelligence ---------------- */
function CapabilityIntelligence() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: caps = [] } = useCapabilities();
  const { data: assets = [] } = useAssets();
  const { data: capAssets = [] } = useCapabilityAssets();

  const grouped = useMemo(() => {
    const map = new Map<string, Capability[]>();
    for (const c of caps) {
      const key = c.grouping?.trim() || c.category?.trim() || "Overig";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [caps]);

  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const link = useMutation({
    mutationFn: async ({ capability_id, asset_id }: { capability_id: string; asset_id: string }) => {
      if (!user) throw new Error("Niet ingelogd");
      const { error } = await db.from("capability_assets").insert({ user_id: user.id, capability_id, asset_id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intel-capability-assets"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("capability_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intel-capability-assets"] }),
  });

  if (caps.length === 0) return <EmptyState text="Nog geen capabilities. Voeg er eerst toe onder Capabilities." />;

  return (
    <div className="space-y-8">
      {grouped.map(([groupName, groupCaps]) => (
        <div key={groupName} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{groupName}</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {groupCaps.map((c) => {
              const linked = capAssets.filter((ca) => ca.capability_id === c.id);
              return (
                <Card key={c.id}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{c.name}</span>
                      <LinkAssetDialog
                        assets={assets.filter((a) => !linked.some((l) => l.asset_id === a.id))}
                        onPick={(asset_id) => link.mutate({ capability_id: c.id, asset_id })}
                      />
                    </CardTitle>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                  </CardHeader>
                  <CardContent>
                    {linked.length === 0 && <p className="text-sm text-muted-foreground">Nog geen assets gekoppeld.</p>}
                    <div className="flex flex-wrap gap-2">
                      {linked.map((l) => {
                        const a = assetsById.get(l.asset_id);
                        if (!a) return null;
                        return (
                          <Badge key={l.id} variant="secondary" className="gap-1">
                            {a.name}
                            <button onClick={() => unlink.mutate(l.id)} className="hover:text-destructive">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function LinkAssetDialog({ assets, onPick }: { assets: Asset[]; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Link2 className="w-4 h-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Asset koppelen</DialogTitle></DialogHeader>
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Alle assets zijn al gekoppeld.</p>
        ) : (
          <Select value={val} onValueChange={setVal}>
            <SelectTrigger><SelectValue placeholder="Kies asset" /></SelectTrigger>
            <SelectContent>
              {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button disabled={!val} onClick={() => { onPick(val); setVal(""); setOpen(false); }}>Koppelen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- 4. Reuse Opportunities ---------------- */
function ReuseOpportunities() {
  const { data: projects = [] } = useProjects();
  const { data: features = [] } = useFeatures();
  const { data: projectAssets = [] } = useProjectAssets();
  const { data: projectCaps = [] } = useProjectCapabilities();
  const { data: caps = [] } = useCapabilities();
  const { data: assets = [] } = useAssets();
  const { data: capAssets = [] } = useCapabilityAssets();

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const capsById = useMemo(() => new Map(caps.map((c) => [c.id, c])), [caps]);
  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  /* a. Vergelijkbare projecten — delen ≥2 capabilities of ≥2 assets */
  const similar = useMemo(() => {
    const capsByProject = new Map<string, Set<string>>();
    for (const pc of projectCaps) {
      if (!capsByProject.has(pc.project_id)) capsByProject.set(pc.project_id, new Set());
      capsByProject.get(pc.project_id)!.add(pc.capability_id);
    }
    const assetsByProject = new Map<string, Set<string>>();
    for (const pa of projectAssets) {
      if (!assetsByProject.has(pa.project_id)) assetsByProject.set(pa.project_id, new Set());
      assetsByProject.get(pa.project_id)!.add(pa.asset_id);
    }
    const out: { a: Project; b: Project; sharedCaps: string[]; sharedAssets: string[] }[] = [];
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const a = projects[i], b = projects[j];
        const ac = capsByProject.get(a.id) ?? new Set();
        const bc = capsByProject.get(b.id) ?? new Set();
        const aa = assetsByProject.get(a.id) ?? new Set();
        const ba = assetsByProject.get(b.id) ?? new Set();
        const sharedCaps = [...ac].filter((x) => bc.has(x));
        const sharedAssets = [...aa].filter((x) => ba.has(x));
        if (sharedCaps.length + sharedAssets.length >= 2) {
          out.push({ a, b, sharedCaps, sharedAssets });
        }
      }
    }
    return out.slice(0, 10);
  }, [projects, projectCaps, projectAssets]);

  /* b. Dubbele functionaliteiten — Jaccard over feature-namen */
  const duplicates = useMemo(() => {
    const tokenize = (s: string) =>
      new Set(s.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 2));
    const out: { a: Feature; b: Feature; score: number }[] = [];
    for (let i = 0; i < features.length; i++) {
      for (let j = i + 1; j < features.length; j++) {
        const a = features[i], b = features[j];
        if (a.project_id === b.project_id) continue;
        const ta = tokenize(a.name + " " + (a.description ?? ""));
        const tb = tokenize(b.name + " " + (b.description ?? ""));
        const inter = [...ta].filter((x) => tb.has(x)).length;
        const union = new Set([...ta, ...tb]).size;
        const score = union ? inter / union : 0;
        if (score >= 0.5) out.push({ a, b, score });
      }
    }
    return out.sort((x, y) => y.score - x.score).slice(0, 10);
  }, [features]);

  /* c. Herbruikbare componenten — production-features die slechts in 1 project zitten */
  const reusable = useMemo(() => {
    const byName = new Map<string, Feature[]>();
    for (const f of features) {
      if (f.status !== "production") continue;
      const key = f.name.toLowerCase().trim();
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(f);
    }
    return Array.from(byName.entries())
      .filter(([, list]) => list.length === 1 && list[0].project_id)
      .map(([, list]) => list[0])
      .slice(0, 10);
  }, [features]);

  /* d. Aanbevolen koppelingen — project heeft capability X, maar geen asset uit groep X */
  const recommendations = useMemo(() => {
    const assetGroupByAsset = new Map<string, string>();
    for (const ca of capAssets) {
      const cap = capsById.get(ca.capability_id);
      const group = cap?.grouping?.trim();
      if (group) assetGroupByAsset.set(ca.asset_id, group);
    }
    const projectAssetGroups = new Map<string, Set<string>>();
    for (const pa of projectAssets) {
      const group = assetGroupByAsset.get(pa.asset_id);
      if (!group) continue;
      if (!projectAssetGroups.has(pa.project_id)) projectAssetGroups.set(pa.project_id, new Set());
      projectAssetGroups.get(pa.project_id)!.add(group);
    }
    const out: { project: Project; capability: Capability; suggestedAsset: Asset }[] = [];
    for (const pc of projectCaps) {
      const cap = capsById.get(pc.capability_id);
      if (!cap?.grouping) continue;
      const owned = projectAssetGroups.get(pc.project_id);
      if (owned?.has(cap.grouping)) continue;
      const candidate = capAssets.find((ca) => ca.capability_id === pc.capability_id);
      if (!candidate) continue;
      const asset = assetsById.get(candidate.asset_id);
      const project = projectsById.get(pc.project_id);
      if (asset && project) out.push({ project, capability: cap, suggestedAsset: asset });
    }
    // unieke combinaties
    const seen = new Set<string>();
    return out.filter((r) => {
      const k = `${r.project.id}-${r.capability.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 10);
  }, [projectCaps, capAssets, capsById, assetsById, projectsById, projectAssets]);

  const noData = similar.length + duplicates.length + reusable.length + recommendations.length === 0;

  return (
    <div className="space-y-6">
      {noData && <EmptyState text="Nog te weinig data om patronen te zien. Koppel capabilities en assets aan je projecten — Mila signaleert dan automatisch hergebruik." />}

      <Section title="Vergelijkbare projecten" icon={<Sparkles className="w-4 h-4" />}>
        {similar.length === 0 && <Empty />}
        {similar.map((s, i) => (
          <Insight
            key={i}
            text={
              <>
                <strong>{s.a.name}</strong> en <strong>{s.b.name}</strong> delen{" "}
                {s.sharedCaps.length > 0 && <>{s.sharedCaps.length} capabilit{s.sharedCaps.length === 1 ? "y" : "ies"}</>}
                {s.sharedCaps.length > 0 && s.sharedAssets.length > 0 && " en "}
                {s.sharedAssets.length > 0 && <>{s.sharedAssets.length} asset{s.sharedAssets.length === 1 ? "" : "s"}</>}
                . Overweeg gemeenschappelijke componenten.
              </>
            }
          />
        ))}
      </Section>

      <Section title="Dubbele functionaliteiten" icon={<AlertTriangle className="w-4 h-4" />}>
        {duplicates.length === 0 && <Empty />}
        {duplicates.map((d, i) => (
          <Insight
            key={i}
            text={
              <>
                Feature <strong>{d.a.name}</strong> ({projectsById.get(d.a.project_id ?? "")?.name ?? "?"}) lijkt sterk op{" "}
                <strong>{d.b.name}</strong> ({projectsById.get(d.b.project_id ?? "")?.name ?? "?"}). Overweeg te bundelen.
              </>
            }
          />
        ))}
      </Section>

      <Section title="Herbruikbare componenten" icon={<Lightbulb className="w-4 h-4" />}>
        {reusable.length === 0 && <Empty />}
        {reusable.map((f) => (
          <Insight
            key={f.id}
            text={
              <>
                <strong>{f.name}</strong> uit {projectsById.get(f.project_id ?? "")?.name ?? "?"} draait in production en kan in andere projecten hergebruikt worden.
              </>
            }
          />
        ))}
      </Section>

      <Section title="Aanbevolen koppelingen" icon={<Link2 className="w-4 h-4" />}>
        {recommendations.length === 0 && <Empty />}
        {recommendations.map((r, i) => (
          <Insight
            key={i}
            text={
              <>
                <strong>{r.project.name}</strong> gebruikt capability <em>{r.capability.name}</em> maar nog geen asset uit groep{" "}
                <em>{r.capability.grouping}</em>. Overweeg <strong>{r.suggestedAsset.name}</strong>.
              </>
            }
          />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}
function Insight({ text }: { text: React.ReactNode }) {
  return <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm leading-relaxed">{text}</div>;
}
function Empty() {
  return <p className="text-sm text-muted-foreground">Niets te melden.</p>;
}
function EmptyState({ text }: { text: string }) {
  return (
    <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{text}</CardContent></Card>
  );
}
