import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Mail, MailOpen, Send, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type OutlookEmail = {
  id: string;
  subject?: string;
  sender_name?: string;
  sender_email?: string;
  body_preview?: string;
  received_at?: string;
  is_read: boolean;
  is_replied: boolean;
  draft_reply?: string;
  draft_status: "none" | "pending_review" | "approved" | "sent" | "rejected";
};

export function EmailsWidget() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["outlook_emails", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outlook_emails")
        .select("*")
        .eq("is_read", false)
        .order("received_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as OutlookEmail[];
    },
  });

  const approveDraft = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("outlook_emails")
        .update({ draft_status: "approved" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outlook_emails"] });
      toast.success("Antwoord goedgekeurd — wordt verstuurd via n8n");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectDraft = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("outlook_emails")
        .update({ draft_status: "rejected", draft_reply: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outlook_emails"] });
      toast.info("Concept verwijderd");
    },
  });

  const formatDate = (dt?: string) => {
    if (!dt) return "";
    const d = new Date(dt);
    return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Outlook Inbox</h2>
        {emails.length > 0 && (
          <span className="ml-auto text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
            {emails.length} ongelezen
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : emails.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Geen ongelezen emails. Inbox is leeg.
        </p>
      ) : (
        <ul className="space-y-3">
          {emails.map((email) => (
            <li key={email.id} className="border border-border/40 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Mail className="w-3.5 h-3.5 text-primary mt-0.5 flex-none" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{email.subject || "(geen onderwerp)"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {email.sender_name || email.sender_email} · {formatDate(email.received_at)}
                  </p>
                  {email.body_preview && (
                    <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{email.body_preview}</p>
                  )}
                </div>
              </div>

              {/* Draft reply section */}
              {email.draft_status === "pending_review" && email.draft_reply && (
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>MILA concept — wacht op goedkeuring</span>
                  </div>
                  <p className="text-xs leading-relaxed">{email.draft_reply}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => approveDraft.mutate(email.id)}
                    >
                      <Send className="w-3 h-3 mr-1" /> Verstuur
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => rejectDraft.mutate(email.id)}
                    >
                      Verwijder concept
                    </Button>
                  </div>
                </div>
              )}

              {email.draft_status === "approved" && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <Send className="w-3 h-3" /> Goedgekeurd — wordt verstuurd
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
