import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Mail, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/inbox")({ component: () => <AppShell><InboxPage /></AppShell> });

function InboxPage() {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  const alias = profile ? `${profile.inbox_alias}@inbox.brain.app` : "…";

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-12">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">Mail-inbox</h1>
      <p className="text-muted-foreground mb-8">
        Stuur facturen naar dit adres en ze landen automatisch in je brain.
      </p>

      <div className="glass-card rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <Mail className="w-5 h-5 text-primary" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Jouw adres</span>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-lg bg-input rounded-lg px-4 py-3">{alias}</code>
          <Button
            size="icon"
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(alias);
              toast.success("Gekopieerd");
            }}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Tip: voeg toe als contact in je gsm onder "Brain", dan kan je vanuit Mail/Gmail/Outlook met één tap doorsturen.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6 border-warning/30">
        <p className="text-sm">
          <span className="font-semibold">Volgende stap nodig:</span> de e-mail-naar-brain verwerking moet aan een
          inkomende e-mail service gekoppeld worden (bv. Cloudflare Email Routing of Resend Inbound).
          Dat doen we als jij zegt: "zet de mail-inbox live". Dan ontvangen we PDF-bijlagen en lopen ze door dezelfde
          AI-extractie als de scan.
        </p>
      </div>
    </div>
  );
}
