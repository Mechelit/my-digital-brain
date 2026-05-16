import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Check, Trash2, Sparkles, ExternalLink } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { categorizeInvoice, INVOICE_CATEGORIES } from "@/lib/invoice-ai.functions";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

export const Route = createFileRoute("/invoice/$id")({ component: () => <AppShell><InvoiceDetail /></AppShell> });

function InvoiceDetail() {
  const { id } = useParams({ from: "/invoice/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Invoice>>({});
  const [scanUrl, setScanUrl] = useState<string | null>(null);

  const { data: invoice } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Invoice;
    },
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("is_default", { ascending: false });
      if (error) throw error;
      return data as Account[];
    },
  });

  useEffect(() => {
    if (invoice) setForm(invoice);
  }, [invoice]);

  useEffect(() => {
    if (!invoice?.scan_path) return;
    supabase.storage.from("invoice-scans").createSignedUrl(invoice.scan_path, 3600).then(({ data }) => {
      if (data) setScanUrl(data.signedUrl);
    });
  }, [invoice?.scan_path]);

  const save = useMutation({
    mutationFn: async (patch: Partial<Invoice>) => {
      const { error } = await supabase.from("invoices").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const del = async () => {
    if (!confirm("Factuur verwijderen?")) return;
    if (invoice?.scan_path) await supabase.storage.from("invoice-scans").remove([invoice.scan_path]);
    await supabase.from("invoices").delete().eq("id", id);
    navigate({ to: "/" });
  };

  const confirmAndPay = async () => {
    const defaultAcc = accounts.find((a) => a.is_default) ?? accounts[0];
    await save.mutateAsync({
      ...form,
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_from_account: defaultAcc?.id ?? null,
    });
    toast.success("Gemarkeerd als betaald");
    navigate({ to: "/" });
  };

  if (!invoice) return null;

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-12">
      <button onClick={() => navigate({ to: "/" })} className="flex items-center gap-2 text-sm text-muted-foreground mb-6 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Terug
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Factuur</p>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">{form.supplier || "Naam ontbreekt"}</h1>
        </div>
        <Button size="sm" variant="ghost" onClick={del}><Trash2 className="w-4 h-4" /></Button>
      </div>

      {scanUrl && (
        <div className="glass-card rounded-2xl p-3 mb-6 space-y-2">
          <div className="flex items-center justify-between px-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Originele scan</p>
            <a href={scanUrl} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
              Openen <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <iframe src={scanUrl} className="w-full h-[420px] rounded-xl bg-background" title="Factuur scan" />
        </div>
      )}

      <AISection invoice={invoice} onUpdated={() => qc.invalidateQueries({ queryKey: ["invoice", id] })} form={form} setForm={setForm} />

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Leverancier">
            <Input value={form.supplier ?? ""} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          </Field>
          <Field label="Bedrag (€)">
            <Input type="number" step="0.01" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value ? parseFloat(e.target.value) : null })} />
          </Field>
        </div>
        <Field label="IBAN">
          <Input value={form.iban ?? ""} onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase().replace(/\s/g, "") })} className="font-mono" />
        </Field>
        <Field label="Gestructureerde mededeling">
          <Input value={form.structured_reference ?? ""} onChange={(e) => setForm({ ...form, structured_reference: e.target.value })} className="font-mono" placeholder="+++000/0000/00000+++" />
        </Field>
        {!form.structured_reference && (
          <Field label="Vrije mededeling">
            <Input value={form.free_reference ?? ""} onChange={(e) => setForm({ ...form, free_reference: e.target.value })} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Factuurdatum">
            <Input type="date" value={form.invoice_date ?? ""} onChange={(e) => setForm({ ...form, invoice_date: e.target.value || null })} />
          </Field>
          <Field label="Vervaldatum">
            <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value || null })} />
          </Field>
        </div>
        {accounts.length > 0 && (
          <Field label="Te betalen vanaf">
            <select
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
              value={form.paid_from_account ?? ""}
              onChange={(e) => setForm({ ...form, paid_from_account: e.target.value || null })}
            >
              <option value="">— Geen rekening —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}
        <Button variant="secondary" className="w-full" onClick={() => save.mutateAsync(form).then(() => toast.success("Opgeslagen"))}>
          Wijzigingen opslaan
        </Button>
      </div>

      <div className="glass-card rounded-2xl p-6 mt-4">
        <h2 className="font-semibold mb-1">Bevestig & betaal</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {accounts.length === 0
            ? "Voeg eerst een rekening toe om bij te houden waarvandaan je betaalt."
            : "Echte bankbetaling via Ponto/Tink (PSD2) komt in fase 2. Voor nu: bevestig dat je betaald hebt en het wordt afgevinkt in je financiën."}
        </p>
        <Button className="w-full glow-ring" disabled={invoice.status === "paid"} onClick={confirmAndPay}>
          <Check className="w-4 h-4 mr-2" />
          {invoice.status === "paid" ? "Al betaald" : "Markeer als betaald"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function AISection({ invoice, form, setForm, onUpdated }: { invoice: Invoice; form: Partial<Invoice>; setForm: (f: Partial<Invoice>) => void; onUpdated: () => void }) {
  const runAI = useServerFn(categorizeInvoice);
  const mut = useMutation({
    mutationFn: () => runAI({ data: { id: invoice.id } }),
    onSuccess: (r) => {
      setForm({ ...form, category: r.category, ai_description: r.description, is_refund: r.is_refund ?? false });
      onUpdated();
      toast.success(r.is_refund ? "Herkend als terugbetaling" : "AI-analyse klaar");
    },
    onError: (e: any) => toast.error(e.message ?? "AI-analyse mislukt"),
  });

  return (
    <div className="glass-card rounded-2xl p-6 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">AI-analyse</h2>
        </div>
        <Button size="sm" variant="secondary" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? "Analyseren..." : invoice.ai_description ? "Opnieuw" : "Analyseer"}
        </Button>
      </div>
      <Field label="Categorie">
        <select
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
          value={form.category ?? ""}
          onChange={(e) => setForm({ ...form, category: e.target.value || null })}
        >
          <option value="">— Geen categorie —</option>
          {INVOICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-3 px-1 cursor-pointer">
        <input
          type="checkbox"
          checked={!!form.is_refund}
          onChange={(e) => setForm({ ...form, is_refund: e.target.checked })}
          className="w-4 h-4 accent-primary"
        />
        <span className="text-sm">Dit is een <strong>terugbetaling / creditnota</strong> (geld komt binnen)</span>
      </label>
      <Field label="Beschrijving">
        <textarea
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm min-h-[70px]"
          value={form.ai_description ?? ""}
          onChange={(e) => setForm({ ...form, ai_description: e.target.value })}
          placeholder="Korte uitleg waar de betaling voor is..."
        />
      </Field>
    </div>
  );
}
