import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Mail, Copy, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncGmail } from "@/lib/gmail.functions";
import { InvoiceCard } from "@/components/InvoiceCard";

export const Route = createFileRoute("/inbox")({ component: () => <AppShell><InboxPage /></AppShell> });

function InboxPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const syncFn = useServerFn(syncGmail);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: emailInvoices = [] } = useQuery({
    queryKey: ["invoices-email", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices").select("*")
        .eq("source", "email")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const sync = useMutation({
    mutationFn: () => syncFn({} as any),
    onSuccess: (res: any) => {
      const { imported, skipped, scanned } = res;
      if (imported > 0) toast.success(`${imported} nieuwe factuur${imported>1?"en":""} uit Gmail geïmporteerd`);
      else toast.success(`Gmail gesynct (${scanned} gescand, ${skipped} al bekend)`);
      qc.invalidateQueries({ queryKey: ["invoices-email"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Sync mislukt"),
  });

  const alias = profile ? `${profile.inbox_alias}@inbox.brain.app` : "…";

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-12">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">Mail-inbox</h1>
      <p className="text-muted-foreground mb-8">Brain leest automatisch facturen uit je Gmail.</p>

      {/* Gmail */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">Gmail gekoppeld</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-primary" /> Doccle, facturen en PDF-bijlagen</p>
            </div>
          </div>
          <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className={`w-4 h-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`} />
            {sync.isPending ? "Bezig…" : "Sync nu"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Brain scant elk uur automatisch de laatste 60 dagen mail op PDF-facturen en Doccle-notificaties. Elke factuur verschijnt in je inbox ter bevestiging.
        </p>
      </div>

      {/* Recente import */}
      {emailInvoices.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">Recent uit Gmail</h2>
          <div className="space-y-2 mb-8">
            {emailInvoices.map((inv: any) => <InvoiceCard key={inv.id} invoice={inv} />)}
          </div>
        </>
      )}

      {/* Forward adres (placeholder) */}
      <div className="glass-card rounded-2xl p-6 opacity-70">
        <div className="flex items-center gap-3 mb-3">
          <Mail className="w-5 h-5 text-muted-foreground" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Doorstuur-adres (binnenkort)</span>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-sm bg-input rounded-lg px-4 py-2.5">{alias}</code>
          <Button size="icon" variant="secondary" onClick={() => { navigator.clipboard.writeText(alias); toast.success("Gekopieerd"); }}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
