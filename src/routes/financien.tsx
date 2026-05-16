import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Repeat, Lock, Plus, Trash2, Pencil, Check, X, PieChart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/financien")({
  component: () => <AppShell><FinancienPage /></AppShell>,
});

const fmt = (n: number) => new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);

function FinancienPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const accounts = useQuery({
    queryKey: ["accounts-balance"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("balance", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const recurring = useQuery({
    queryKey: ["recurring"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("recurring_expenses").select("*").order("day_of_month");
      if (error) throw error;
      return data ?? [];
    },
  });

  const deposits = useQuery({
    queryKey: ["deposits"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("deposits").select("*").order("amount", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const paidInvoices = useQuery({
    queryKey: ["paid-invoices-by-cat"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id,supplier,amount,category,paid_at,is_refund")
        .eq("status", "paid")
        .not("amount", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const byCategory = (() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const inv of paidInvoices.data ?? []) {
      const cat = (inv as any).category || "Niet gecategoriseerd";
      const sign = (inv as any).is_refund ? -1 : 1;
      const cur = m.get(cat) ?? { total: 0, count: 0 };
      cur.total += sign * Number((inv as any).amount ?? 0);
      cur.count += 1;
      m.set(cat, cur);
    }
    return [...m.entries()].sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total));
  })();
  const totalSpent = byCategory.reduce((s, [, v]) => s + v.total, 0);


  const totalBalance = (accounts.data ?? []).reduce((s, a: any) => s + Number(a.balance ?? 0), 0);
  const monthlyEquivalent = (r: any) => {
    const a = Number(r.amount);
    switch (r.frequency ?? "monthly") {
      case "quarterly": return a / 3;
      case "biannual": return a / 6;
      case "yearly": return a / 12;
      default: return a;
    }
  };
  const totalRecurring = (recurring.data ?? []).reduce((s, r: any) => s + monthlyEquivalent(r), 0);
  const totalDeposits = (deposits.data ?? []).reduce((s, d: any) => s + Number(d.amount), 0);
  const netWorth = totalBalance + totalDeposits;

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-12 space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Financiën</h1>
        <p className="text-muted-foreground mt-1">Saldo, vaste kosten en waarborgen.</p>
      </header>

      {/* Overzicht */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Totaal vermogen</p>
          <p className="text-2xl font-semibold mt-2 tabular-nums">{fmt(netWorth)}</p>
          <p className="text-xs text-muted-foreground mt-1">incl. waarborgen</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Liquide</p>
          <p className="text-2xl font-semibold mt-2 tabular-nums">{fmt(totalBalance)}</p>
          <p className="text-xs text-muted-foreground mt-1">{accounts.data?.length ?? 0} rekeningen</p>
        </div>
        <div className="glass-card rounded-2xl p-5 col-span-2 md:col-span-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Maandelijks vast</p>
          <p className="text-2xl font-semibold mt-2 tabular-nums">{fmt(totalRecurring)}</p>
          <p className="text-xs text-muted-foreground mt-1">{recurring.data?.length ?? 0} kosten</p>
        </div>
      </section>

      {/* Rekeningen met saldo */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" />Rekeningen</h2>
        <div className="space-y-2">
          {(accounts.data ?? []).map((a: any) => (
            <AccountRow key={a.id} account={a} onChanged={() => qc.invalidateQueries({ queryKey: ["accounts-balance"] })} />
          ))}
        </div>
      </section>

      {/* Maandelijkse kosten */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Repeat className="w-4 h-4 text-primary" />Vaste kosten</h2>
        <p className="text-xs text-muted-foreground mb-3 px-1">Per kwartaal/jaar wordt omgerekend naar maandelijks equivalent.</p>
        {(["prive", "zakelijk"] as const).map((scope) => {
          const items = (recurring.data ?? []).filter((r: any) => (r.scope ?? "prive") === scope);
          const subtotal = items.reduce((s, r: any) => s + monthlyEquivalent(r), 0);
          return (
            <div key={scope} className="mb-5">
              <div className="flex items-baseline justify-between mb-2 px-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{scope === "prive" ? "Privé" : "Zakelijk"}</p>
                <p className="text-xs tabular-nums text-muted-foreground">{fmt(subtotal)}/maand</p>
              </div>
              <div className="space-y-2">
                {items.length === 0 && <p className="text-xs text-muted-foreground px-1 italic">Geen kosten</p>}
                {items.map((r: any) => {
                  const freq = r.frequency ?? "monthly";
                  const freqLabel = freq === "monthly" ? "/maand" : freq === "quarterly" ? "/kwartaal" : freq === "biannual" ? "/halfjaar" : "/jaar";
                  const monthly = monthlyEquivalent(r);
                  return (
                    <div key={r.id} className="glass-card rounded-xl p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {freq === "monthly" && `Elke ${r.day_of_month}${ord(r.day_of_month)} v/d maand`}
                          {freq === "quarterly" && `Per kwartaal · dag ${r.day_of_month}`}
                          {freq === "biannual" && `2× per jaar · dag ${r.day_of_month}`}
                          {freq === "yearly" && `Jaarlijks${r.month_of_year ? ` · ${monthName(r.month_of_year)}` : ""}`}
                          {freq !== "monthly" && ` · ≈ ${fmt(monthly)}/maand`}
                        </p>
                      </div>
                      <p className="tabular-nums font-semibold text-right">
                        {fmt(Number(r.amount))}
                        <span className="block text-[10px] font-normal text-muted-foreground">{freqLabel}</span>
                      </p>
                      <Button size="icon" variant="ghost" onClick={async () => {
                        await supabase.from("recurring_expenses").delete().eq("id", r.id);
                        qc.invalidateQueries({ queryKey: ["recurring"] });
                      }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <AddRecurring onAdded={() => qc.invalidateQueries({ queryKey: ["recurring"] })} userId={user?.id} />
      </section>

      {/* Waarborgen */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Lock className="w-4 h-4 text-primary" />Waarborgen</h2>
        <div className="space-y-2">
          {(deposits.data ?? []).map((d: any) => (
            <div key={d.id} className="glass-card rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{d.name}</p>
                {d.counterparty && <p className="text-xs text-muted-foreground">bij {d.counterparty}</p>}
              </div>
              <p className="tabular-nums font-semibold">{fmt(Number(d.amount))}</p>
              <Button size="icon" variant="ghost" onClick={async () => {
                await supabase.from("deposits").delete().eq("id", d.id);
                qc.invalidateQueries({ queryKey: ["deposits"] });
              }}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          <div className="glass-card rounded-xl p-4 flex items-center gap-4 opacity-80">
            <div className="flex-1"><p className="text-sm text-muted-foreground">Totaal vastgezet</p></div>
            <p className="tabular-nums font-semibold">{fmt(totalDeposits)}</p>
          </div>
        </div>
        <AddDeposit onAdded={() => qc.invalidateQueries({ queryKey: ["deposits"] })} userId={user?.id} />
      </section>

      {/* Uitgaven per categorie */}
      <section>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2"><PieChart className="w-4 h-4 text-primary" />Uitgaven per categorie</h2>
        <p className="text-xs text-muted-foreground mb-3">Op basis van betaalde facturen, automatisch gecategoriseerd door AI.</p>
        {byCategory.length === 0 ? (
          <div className="glass-card rounded-xl p-4 text-sm text-muted-foreground">
            Nog geen betaalde facturen. Open een factuur en klik "Analyseer" om te categoriseren.
          </div>
        ) : (
          <div className="space-y-2">
            {byCategory.map(([cat, v]) => {
              const pct = totalSpent ? (v.total / totalSpent) * 100 : 0;
              return (
                <div key={cat} className="glass-card rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{cat}</p>
                      <p className="text-xs text-muted-foreground">{v.count} {v.count === 1 ? "factuur" : "facturen"}</p>
                    </div>
                    <p className="tabular-nums font-semibold">{fmt(v.total)}</p>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between px-2 pt-2 text-sm">
              <span className="text-muted-foreground">Totaal uitgegeven</span>
              <span className="font-semibold tabular-nums">{fmt(totalSpent)}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ord(n: number) {
  if (n === 1) return "ste";
  if (n === 8) return "ste";
  return "de";
}

function AccountRow({ account, onChanged }: { account: any; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(account.balance ?? 0));
  const save = async () => {
    const num = parseFloat(val.replace(",", "."));
    if (isNaN(num)) return toast.error("Ongeldig bedrag");
    const { error } = await supabase.from("accounts").update({ balance: num }).eq("id", account.id);
    if (error) return toast.error(error.message);
    toast.success("Saldo bijgewerkt");
    setEditing(false);
    onChanged();
  };
  return (
    <div className="glass-card rounded-xl p-4 flex items-center gap-4">
      <Wallet className="w-5 h-5 text-primary" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">{account.name}</p>
        {account.iban && <p className="text-xs font-mono text-muted-foreground">{account.iban}</p>}
      </div>
      {editing ? (
        <>
          <Input value={val} onChange={(e) => setVal(e.target.value)} className="w-32 text-right tabular-nums" autoFocus />
          <Button size="icon" variant="ghost" onClick={save}><Check className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => { setEditing(false); setVal(String(account.balance)); }}><X className="w-4 h-4" /></Button>
        </>
      ) : (
        <>
          <p className="tabular-nums font-semibold">{fmt(Number(account.balance ?? 0))}</p>
          <Button size="icon" variant="ghost" onClick={() => setEditing(true)}><Pencil className="w-4 h-4" /></Button>
        </>
      )}
    </div>
  );
}

function monthName(m: number) {
  return ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"][m-1] ?? "";
}

function AddRecurring({ onAdded, userId }: { onAdded: () => void; userId?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("1");
  const [month, setMonth] = useState("1");
  const [scope, setScope] = useState<"prive" | "zakelijk">("prive");
  const [frequency, setFrequency] = useState<"monthly"|"quarterly"|"biannual"|"yearly">("monthly");
  const add = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase.from("recurring_expenses").insert({
        user_id: userId,
        name,
        amount: parseFloat(amount.replace(",", ".")),
        day_of_month: parseInt(day),
        scope,
        frequency,
        month_of_year: frequency === "yearly" ? parseInt(month) : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setName(""); setAmount(""); setDay("1"); setMonth("1"); setScope("prive"); setFrequency("monthly"); setOpen(false);
      toast.success("Vaste kost toegevoegd");
      onAdded();
    },
  });
  if (!open) return <Button variant="ghost" size="sm" className="mt-3" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Vaste kost</Button>;
  const freqOpts: Array<["monthly"|"quarterly"|"biannual"|"yearly", string]> = [
    ["monthly","Maandelijks"], ["quarterly","Per kwartaal"], ["biannual","2× per jaar"], ["yearly","Jaarlijks"],
  ];
  return (
    <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="glass-card rounded-xl p-4 mt-3 space-y-3">
      <div className="flex gap-2">
        {(["prive", "zakelijk"] as const).map((s) => (
          <Button key={s} type="button" size="sm" variant={scope === s ? "default" : "secondary"} onClick={() => setScope(s)}>
            {s === "prive" ? "Privé" : "Zakelijk"}
          </Button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {freqOpts.map(([f,label]) => (
          <Button key={f} type="button" size="sm" variant={frequency === f ? "default" : "secondary"} onClick={() => setFrequency(f)}>
            {label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Naam</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div><Label>Bedrag (€) <span className="text-xs text-muted-foreground">per {frequency === "monthly" ? "maand" : frequency === "quarterly" ? "kwartaal" : frequency === "biannual" ? "halfjaar" : "jaar"}</span></Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
        <div><Label>Dag van de maand</Label><Input type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} /></div>
        {frequency === "yearly" && (
          <div className="col-span-2"><Label>Maand</Label>
            <select value={month} onChange={(e)=>setMonth(e.target.value)} className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm">
              {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{monthName(m)}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2"><Button type="submit" disabled={add.isPending}>Toevoegen</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuleren</Button></div>
    </form>
  );
}

function AddDeposit({ onAdded, userId }: { onAdded: () => void; userId?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [amount, setAmount] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase.from("deposits").insert({
        user_id: userId, name, counterparty: counterparty || null, amount: parseFloat(amount.replace(",", ".")),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName(""); setCounterparty(""); setAmount(""); setOpen(false);
      toast.success("Waarborg toegevoegd");
      onAdded();
    },
  });
  if (!open) return <Button variant="ghost" size="sm" className="mt-3" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Waarborg</Button>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="glass-card rounded-xl p-4 mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Naam</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="bv. Waarborg auto" required /></div>
        <div><Label>Bij wie</Label><Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="bv. MHC Mobility" /></div>
        <div className="col-span-2"><Label>Bedrag (€)</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      </div>
      <div className="flex gap-2"><Button type="submit" disabled={add.isPending}>Toevoegen</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuleren</Button></div>
    </form>
  );
}
