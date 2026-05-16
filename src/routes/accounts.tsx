import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Wallet, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

export const Route = createFileRoute("/accounts")({ component: () => <AppShell><AccountsPage /></AppShell> });

function AccountsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [iban, setIban] = useState("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("is_default", { ascending: false });
      if (error) throw error;
      return data as Account[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("accounts").insert({
        user_id: user.id, name, iban: iban.toUpperCase().replace(/\s/g, "") || null,
        is_default: accounts.length === 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName(""); setIban("");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Rekening toegevoegd");
    },
  });

  const setDefault = async (id: string) => {
    if (!user) return;
    await supabase.from("accounts").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("accounts").update({ is_default: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["accounts"] });
  };

  const del = async (id: string) => {
    await supabase.from("accounts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["accounts"] });
  };

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-12">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">Rekeningen</h1>
      <p className="text-muted-foreground mb-8">Waarvan worden facturen betaald? (zichtbaar bij elke betaling)</p>

      <div className="space-y-2 mb-8">
        {accounts.map((a) => (
          <div key={a.id} className="glass-card rounded-xl p-4 flex items-center gap-4">
            <Wallet className="w-5 h-5 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-medium flex items-center gap-2">
                {a.name}
                {a.is_default && <span className="text-[10px] uppercase tracking-wider bg-primary/15 text-primary px-1.5 py-0.5 rounded">Standaard</span>}
              </p>
              {a.iban && <p className="text-xs font-mono text-muted-foreground">{a.iban}</p>}
            </div>
            {!a.is_default && (
              <Button size="icon" variant="ghost" onClick={() => setDefault(a.id)} title="Maak standaard">
                <Star className="w-4 h-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => del(a.id)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
        className="glass-card rounded-2xl p-6 space-y-4"
      >
        <h2 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" />Nieuwe rekening</h2>
        <div>
          <Label>Naam</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="bv. KBC zichtrekening" required />
        </div>
        <div>
          <Label>IBAN (optioneel)</Label>
          <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="BE68 5390 0754 7034" className="font-mono" />
        </div>
        <Button type="submit" disabled={add.isPending || !name}>Toevoegen</Button>
      </form>
    </div>
  );
}
