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
import { ArrowLeft, Check, Trash2, Sparkles, ExternalLink, Loader2, CreditCard } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { categorizeInvoice, INVOICE_CATEGORIES } from "@/lib/invoice-ai.functions";
import { estimateEuro, formatMoney, formatWithEuroEstimate } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import QRCode from "qrcode";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

export const Route = createFileRoute("/invoice/$id")({
  component: () => (
    <AppShell>
      <InvoiceDetail />
    </AppShell>
  ),
});

function InvoiceDetail() {
  const { id } = useParams({ from: "/invoice/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Invoice>>({});
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [aiAccepted, setAiAccepted] = useState(false);

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
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data as Account[];
    },
  });

  useEffect(() => {
    if (invoice) setForm(invoice);
  }, [invoice]);

  useEffect(() => {
    if (!invoice?.scan_path) return;
    supabase.storage
      .from("invoice-scans")
      .createSignedUrl(invoice.scan_path, 3600)
      .then(({ data }) => {
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
    if (invoice?.scan_path)
      await supabase.storage.from("invoice-scans").remove([invoice.scan_path]);
    await supabase.from("invoices").delete().eq("id", id);
    navigate({ to: "/" });
  };

  const ignoreSender = async () => {
    const supplier = invoice?.supplier?.trim();
    if (!supplier) {
      toast.error("Geen leverancier ingevuld");
      return;
    }
    if (!confirm(`"${supplier}" voortaan negeren en deze factuur verwijderen?`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("ignored_suppliers").insert({ user_id: user.id, pattern: supplier });
    if (invoice?.scan_path)
      await supabase.storage.from("invoice-scans").remove([invoice.scan_path]);
    await supabase.from("invoices").delete().eq("id", id);
    toast.success(`"${supplier}" wordt voortaan genegeerd`);
    navigate({ to: "/" });
  };

  const confirmAndPay = async () => {
    const defaultAcc = accounts.find((a) => a.is_default) ?? accounts[0];
    const accountId = form.paid_from_account ?? defaultAcc?.id ?? null;
    await save.mutateAsync({
      ...form,
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_from_account: accountId,
    });
    toast.success("Gemarkeerd als betaald");
    navigate({ to: "/" });
  };

  if (!invoice) return null;

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-12">
      <button
        onClick={() => navigate({ to: "/" })}
        className="flex items-center gap-2 text-sm text-muted-foreground mb-6 hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Terug
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {form.is_refund ? "Terugbetaling / Creditnota" : "Factuur"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">
            {form.supplier || "Naam ontbreekt"}
            {form.amount != null ? (
              <span
                className={`ml-3 text-xl ${form.is_refund ? "text-emerald-400" : "text-muted-foreground"}`}
              >
                {form.is_refund ? "+" : ""}
                {formatWithEuroEstimate(form.amount as any, form.currency)}
              </span>
            ) : null}
          </h1>
        </div>
        <div className="flex gap-1">
          {invoice.source === "email" && (
            <Button size="sm" variant="ghost" onClick={ignoreSender} title="Afzender voortaan negeren">
              Negeer afzender
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={del}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <PayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        invoice={invoice}
        form={form}
        accounts={accounts}
        defaultAccountId={form.paid_from_account ?? accounts.find((a) => a.is_default)?.id ?? accounts[0]?.id ?? null}
        onConfirm={async (accountId) => {
          await save.mutateAsync({
            ...form,
            status: "paid",
            paid_at: new Date().toISOString(),
            paid_from_account: accountId,
          });
          setPayOpen(false);
          toast.success("Gemarkeerd als betaald");
          navigate({ to: "/" });
        }}
      />

      {scanUrl &&
        (() => {
          const isPdf = (invoice.scan_path ?? "").toLowerCase().endsWith(".pdf");
          return (
            <div className="glass-card rounded-2xl p-3 mb-6 space-y-2">
              <div className="flex items-center justify-between px-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Originele scan
                </p>
                <a
                  href={scanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  Openen <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {isPdf ? (
                <iframe
                  src={`${scanUrl}#view=FitH&toolbar=1`}
                  title="Factuur PDF"
                  className="w-full h-[80vh] min-h-[600px] rounded-xl bg-background border-0"
                />
              ) : (
                <img
                  src={scanUrl}
                  alt="Factuur scan"
                  className="w-full max-h-[520px] object-contain rounded-xl bg-background"
                />
              )}
            </div>
          );
        })()}

      <AISection
        invoice={invoice}
        onUpdated={() => qc.invalidateQueries({ queryKey: ["invoice", id] })}
        form={form}
        setForm={setForm}
        onMovedToContract={() => {
          qc.invalidateQueries({ queryKey: ["invoices"] });
          qc.invalidateQueries({ queryKey: ["contracts"] });
          navigate({ to: "/contracten" });
        }}
      />

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Leverancier">
            <Input
              value={form.supplier ?? ""}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            />
          </Field>
          <Field label={`Bedrag (${(form.currency || "EUR").toUpperCase()})`}>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={form.amount ?? ""}
                onChange={(e) =>
                  setForm({ ...form, amount: e.target.value ? parseFloat(e.target.value) : null })
                }
                className="flex-1"
              />
              <Input
                value={form.currency ?? "EUR"}
                onChange={(e) =>
                  setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })
                }
                className="w-20 font-mono uppercase"
              />
              {(form.currency || "EUR").toUpperCase() !== "EUR" && form.amount != null ? (
                <span className="self-center whitespace-nowrap text-xs text-muted-foreground">
                  ≈ {formatMoney(estimateEuro(form.amount as any, form.currency), "EUR")}
                </span>
              ) : null}
            </div>
          </Field>
        </div>
        <Field label="IBAN">
          <Input
            value={form.iban ?? ""}
            onChange={(e) =>
              setForm({ ...form, iban: e.target.value.toUpperCase().replace(/\s/g, "") })
            }
            className="font-mono"
          />
        </Field>
        <Field label="Gestructureerde mededeling">
          <Input
            value={form.structured_reference ?? ""}
            onChange={(e) => setForm({ ...form, structured_reference: e.target.value })}
            className="font-mono"
            placeholder="+++000/0000/00000+++"
          />
        </Field>
        {!form.structured_reference && (
          <Field label="Vrije mededeling">
            <Input
              value={form.free_reference ?? ""}
              onChange={(e) => setForm({ ...form, free_reference: e.target.value })}
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Factuurdatum">
            <Input
              type="date"
              value={form.invoice_date ?? ""}
              onChange={(e) => setForm({ ...form, invoice_date: e.target.value || null })}
            />
          </Field>
          <Field label="Vervaldatum">
            <Input
              type="date"
              value={form.due_date ?? ""}
              onChange={(e) => setForm({ ...form, due_date: e.target.value || null })}
            />
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
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {invoice.status === "paid" ? (
          <Button variant="secondary" className="w-full" disabled>
            <Check className="w-4 h-4 mr-2" /> Al betaald
          </Button>
        ) : form.is_refund ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => save.mutateAsync(form).then(() => toast.success("Opgeslagen"))}
          >
            Wijzigingen opslaan
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full h-14 text-base glow-ring"
            onClick={async () => {
              await save.mutateAsync(form);
              setAiAccepted(true);
              setPayOpen(true);
            }}
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Betaal {form.amount != null ? formatWithEuroEstimate(form.amount as any, form.currency) : ""}
          </Button>
        )}
      </div>

      {invoice.status === "paid" && (
        <div className="glass-card rounded-2xl p-6 mt-6 text-center">
          <Check className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          <p className="font-medium">Betaald</p>
        </div>
      )}
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

function AISection({
  invoice,
  form,
  setForm,
  onUpdated,
  onMovedToContract,
}: {
  invoice: Invoice;
  form: Partial<Invoice>;
  setForm: (f: Partial<Invoice>) => void;
  onUpdated: () => void;
  onMovedToContract: () => void;
}) {
  const runAI = useServerFn(categorizeInvoice);
  const mut = useMutation({
    mutationFn: () => runAI({ data: { id: invoice.id } }),
    onSuccess: (r) => {
      if (r.moved_to_contract) {
        toast.success("Verplaatst naar contracten");
        onMovedToContract();
        return;
      }
      setForm({
        ...form,
        category: r.category,
        ai_description: r.description,
        is_refund: r.is_refund ?? false,
      });
      onUpdated();
    },
    onError: (e: any) => toast.error(e.message ?? "AI-analyse mislukt"),
  });

  // Auto-analyse zodra factuur geladen is en nog geen AI-beschrijving heeft
  useEffect(() => {
    if (!invoice.ai_description && !mut.isPending && !mut.isSuccess && !mut.isError) {
      mut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id]);

  return (
    <div className="glass-card rounded-2xl p-6 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">AI-analyse</h2>
          {mut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
        <Button size="sm" variant="ghost" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? "Bezig…" : "Opnieuw"}
        </Button>
      </div>
      <Field label="Categorie">
        <select
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
          value={form.category ?? ""}
          onChange={(e) => setForm({ ...form, category: e.target.value || null })}
        >
          <option value="">— Geen categorie —</option>
          {INVOICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-3 px-1 cursor-pointer">
        <input
          type="checkbox"
          checked={!!form.is_refund}
          onChange={(e) => setForm({ ...form, is_refund: e.target.checked })}
          className="w-4 h-4 accent-primary"
        />
        <span className="text-sm">
          Dit is een <strong>terugbetaling / creditnota</strong> (geld komt binnen)
        </span>
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

function buildEpcQrPayload(opts: {
  beneficiary: string;
  iban: string;
  amount: number;
  remittance?: string | null;
  structured?: string | null;
  bic?: string | null;
}) {
  const amt = Math.max(0, Math.round(opts.amount * 100) / 100);
  const ref = (opts.structured ?? "").replace(/[^0-9]/g, "");
  const lines = [
    "BCD",
    "002",
    "1",
    "SCT",
    opts.bic ?? "",
    (opts.beneficiary || "").slice(0, 70),
    opts.iban.replace(/\s/g, "").toUpperCase(),
    `EUR${amt.toFixed(2)}`,
    "",
    ref ? ref : "",
    ref ? "" : (opts.remittance ?? "").slice(0, 140),
  ];
  return lines.join("\n");
}

function PayDialog({
  open,
  onOpenChange,
  invoice,
  form,
  accounts,
  defaultAccountId,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Invoice;
  form: Partial<Invoice>;
  accounts: Account[];
  defaultAccountId: string | null;
  onConfirm: (accountId: string | null) => Promise<void>;
}) {
  const [accountId, setAccountId] = useState<string | null>(defaultAccountId);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAccountId(defaultAccountId);
  }, [defaultAccountId, open]);

  const canQr =
    !!form.iban &&
    !!form.amount &&
    (form.currency ?? "EUR").toUpperCase() === "EUR" &&
    !!form.supplier;

  useEffect(() => {
    if (!open || !canQr) {
      setQr(null);
      return;
    }
    const payload = buildEpcQrPayload({
      beneficiary: form.supplier!,
      iban: form.iban!,
      amount: Number(form.amount),
      remittance: form.free_reference,
      structured: form.structured_reference,
      bic: form.bic,
    });
    QRCode.toDataURL(payload, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [open, canQr, form.iban, form.amount, form.supplier, form.structured_reference, form.free_reference, form.bic, form.currency]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Betaal {form.supplier ?? "factuur"}</DialogTitle>
          <DialogDescription>
            Scan de QR met je bank-app of doe de overschrijving handmatig.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {accounts.length > 0 && (
            <Field label="Vanaf rekening">
              <select
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
                value={accountId ?? ""}
                onChange={(e) => setAccountId(e.target.value || null)}
              >
                <option value="">— Geen —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.iban ? ` · ${a.iban}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {canQr && qr ? (
            <div className="flex flex-col items-center gap-2">
              <img src={qr} alt="EPC betaal QR" className="rounded-xl bg-white p-3" />
              <p className="text-xs text-muted-foreground text-center">
                Open je bank-app → Scan QR (KBC, Belfius, ING, Argenta, …)
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {!canQr
                ? "Vul IBAN, bedrag (EUR) en leverancier in voor een QR-code."
                : "QR genereren…"}
            </p>
          )}

          <div className="rounded-lg border border-border p-3 text-sm space-y-1 font-mono">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">IBAN</span>
              <span className="truncate">{form.iban || "—"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Bedrag</span>
              <span>
                {form.amount != null
                  ? formatMoney(form.amount as any, form.currency || "EUR")
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Mededeling</span>
              <span className="truncate">
                {form.structured_reference || form.free_reference || "—"}
              </span>
            </div>
          </div>

          <Button
            className="w-full h-12"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(accountId);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Check className="w-4 h-4 mr-2" />
            Ik heb betaald — markeer als betaald
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
