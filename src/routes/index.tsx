import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { InvoiceCard } from "@/components/InvoiceCard";
import { Button } from "@/components/ui/button";
import { Camera, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";
import { estimateEuro, formatMoney } from "@/lib/format";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const pending = invoices.filter((i) => i.status === "pending" || i.status === "confirmed");
  const paid = invoices.filter((i) => i.status === "paid");
  const totalDue = pending.reduce(
    (s, i) => s + (estimateEuro(i.amount as any, i.currency) ?? 0),
    0,
  );

  const hour = now.getHours();
  const greeting =
    hour < 6 ? "Goeienacht" : hour < 12 ? "Goeiemorgen" : hour < 18 ? "Hallo" : "Goeienavond";
  const name = user?.user_metadata?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-12">
      <header className="mb-10">
        <p className="text-sm text-muted-foreground">
          {now.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-1">
          {greeting}
          {name && `, ${name}`}.
        </h1>
      </header>

      <section className="grid grid-cols-2 gap-3 mb-10">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Openstaand</p>
          <p className="text-2xl font-semibold mt-2 tabular-nums">{formatMoney(totalDue, "EUR")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {pending.length} {pending.length === 1 ? "factuur" : "facturen"}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Betaald</p>
          <p className="text-2xl font-semibold mt-2 tabular-nums">{paid.length}</p>
          <p className="text-xs text-muted-foreground mt-1">deze maand</p>
        </div>
      </section>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Te bevestigen & te betalen</h2>
        <Link to="/scan">
          <Button size="sm" variant="secondary">
            <Camera className="w-4 h-4 mr-2" />
            Scan
          </Button>
        </Link>
      </div>

      {pending.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Niets openstaand. Lekker rustig.</p>
          <Link to="/scan">
            <Button className="mt-5">Eerste factuur scannen</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((inv) => (
            <InvoiceCard key={inv.id} invoice={inv} />
          ))}
        </div>
      )}

      {paid.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mt-10 mb-4">Recent betaald</h2>
          <div className="space-y-2">
            {paid.slice(0, 5).map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
