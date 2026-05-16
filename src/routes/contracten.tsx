import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Upload, ExternalLink, Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Contract = Database["public"]["Tables"]["contracts"]["Row"];
type ContractType = Database["public"]["Enums"]["contract_type"];

const TYPES: { value: ContractType; label: string }[] = [
  { value: "huur", label: "Huurovereenkomst" },
  { value: "abonnement", label: "Abonnement" },
  { value: "verzekering", label: "Verzekering" },
  { value: "lening", label: "Lening" },
  { value: "werk", label: "Werk / opdracht" },
  { value: "ander", label: "Ander" },
];

export const Route = createFileRoute("/contracten")({
  component: () => (
    <AppShell>
      <ContractsPage />
    </AppShell>
  ),
});

function ContractsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Partial<Contract>>({
    type: "huur",
    currency: "EUR",
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .order("type")
        .order("name");
      if (error) throw error;
      return data as Contract[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Niet ingelogd");
      if (!form.name?.trim()) throw new Error("Naam is verplicht");
      setUploading(true);
      let filePath: string | null = null;
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from("contracts").upload(path, file);
        if (error) throw error;
        filePath = path;
      }
      const { error } = await supabase.from("contracts").insert({
        user_id: user.id,
        name: form.name!.trim(),
        type: (form.type as ContractType) ?? "ander",
        counterparty: form.counterparty || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        monthly_amount: form.monthly_amount ? Number(form.monthly_amount) : null,
        currency: form.currency || "EUR",
        notes: form.notes || null,
        file_path: filePath,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contract opgeslagen");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      setAdding(false);
      setForm({ type: "huur", currency: "EUR" });
      setFile(null);
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setUploading(false),
  });

  const del = async (c: Contract) => {
    if (!confirm(`"${c.name}" verwijderen?`)) return;
    if (c.file_path) await supabase.storage.from("contracts").remove([c.file_path]);
    await supabase.from("contracts").delete().eq("id", c.id);
    qc.invalidateQueries({ queryKey: ["contracts"] });
  };

  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from("contracts").createSignedUrl(path, 3600);
    if (data) window.open(data.signedUrl, "_blank");
  };

  // Group by type
  const grouped = TYPES.map((t) => ({
    ...t,
    items: contracts.filter((c) => c.type === t.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-8 md:py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Contracten</h1>
          <p className="text-muted-foreground mt-1">Huurovereenkomsten, abonnementen, verzekeringen — apart van facturen.</p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nieuw contract
          </Button>
        )}
      </div>

      {adding && (
        <div className="glass-card rounded-2xl p-6 mb-8 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Naam *</Label>
              <Input
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="bv. Huur appartement Antwerpen"
              />
            </div>
            <div>
              <Label>Type</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.type ?? "huur"}
                onChange={(e) => setForm({ ...form, type: e.target.value as ContractType })}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tegenpartij</Label>
              <Input
                value={form.counterparty ?? ""}
                onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
                placeholder="bv. Verhuurder Jan Janssens"
              />
            </div>
            <div>
              <Label>Maandelijks bedrag</Label>
              <Input
                type="number"
                step="0.01"
                value={form.monthly_amount ?? ""}
                onChange={(e) => setForm({ ...form, monthly_amount: e.target.value as any })}
              />
            </div>
            <div>
              <Label>Startdatum</Label>
              <Input
                type="date"
                value={form.start_date ?? ""}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Einddatum</Label>
              <Input
                type="date"
                value={form.end_date ?? ""}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Notities</Label>
              <Input
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Document (PDF, foto, screenshot)</Label>
              <label className="flex items-center gap-2 mt-1 px-3 py-2 border border-dashed border-border rounded-md cursor-pointer hover:border-primary/40">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {file ? file.name : "Klik om bestand te kiezen"}
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { setAdding(false); setFile(null); setForm({ type: "huur", currency: "EUR" }); }}>Annuleren</Button>
            <Button onClick={() => save.mutate()} disabled={uploading}>
              {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Opslaan
            </Button>
          </div>
        </div>
      )}

      {grouped.length === 0 && !adding && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nog geen contracten opgeslagen.</p>
        </div>
      )}

      <div className="space-y-8">
        {grouped.map((group) => (
          <section key={group.value}>
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{group.label}</h2>
            <div className="space-y-2">
              {group.items.map((c) => (
                <ContractRow key={c.id} contract={c} onOpen={openFile} onDelete={del} userId={user?.id} onUploaded={() => qc.invalidateQueries({ queryKey: ["contracts"] })} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ContractRow({
  contract: c,
  onOpen,
  onDelete,
  userId,
  onUploaded,
}: {
  contract: Contract;
  onOpen: (p: string) => void;
  onDelete: (c: Contract) => void;
  userId?: string;
  onUploaded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const ensurePreview = async () => {
    if (!c.file_path || previewUrl) return;
    const { data } = await supabase.storage.from("contracts").createSignedUrl(c.file_path, 3600);
    if (data) setPreviewUrl(data.signedUrl);
  };

  const handleCardClick = async () => {
    if (!c.file_path) return;
    setOpen((v) => !v);
    await ensurePreview();
  };

  const handleUpload = async (file: File) => {
    if (!userId) return;
    setUploading(true);
    try {
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("contracts").upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("contracts").update({ file_path: path }).eq("id", c.id);
      if (dbErr) throw dbErr;
      toast.success("Document toegevoegd");
      onUploaded();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const isImage = c.file_path && /\.(png|jpe?g|webp|gif|heic)$/i.test(c.file_path);

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="p-4 flex items-center gap-4">
        <button
          type="button"
          onClick={handleCardClick}
          className="flex items-center gap-4 flex-1 min-w-0 text-left hover:opacity-80 transition disabled:cursor-default"
          disabled={!c.file_path}
        >
          <FileText className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{c.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {[
                c.counterparty,
                c.monthly_amount ? `${formatMoney(Number(c.monthly_amount), c.currency)}/maand` : null,
                c.start_date ? `vanaf ${c.start_date}` : null,
                c.end_date ? `tot ${c.end_date}` : null,
                !c.file_path ? "geen document" : null,
              ].filter(Boolean).join(" · ")}
            </div>
          </div>
        </button>
        {c.file_path ? (
          <Button size="sm" variant="ghost" onClick={() => onOpen(c.file_path!)} title="Open in nieuw tabblad">
            <ExternalLink className="w-4 h-4" />
          </Button>
        ) : (
          <label className="inline-flex">
            <Button size="sm" variant="ghost" asChild>
              <span className="cursor-pointer">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              </span>
            </Button>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </label>
        )}
        <Button size="sm" variant="ghost" onClick={() => onDelete(c)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      {open && c.file_path && previewUrl && (
        <div className="border-t border-border bg-background/40">
          {isImage ? (
            <img src={previewUrl} alt={c.name} className="w-full max-h-[70vh] object-contain" />
          ) : (
            <iframe src={previewUrl} title={c.name} className="w-full h-[70vh]" />
          )}
        </div>
      )}
    </div>
  );
}
