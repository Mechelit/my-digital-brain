import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Brain, Camera, Inbox, LayoutDashboard, LogOut, Wallet, Coins } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { syncGmail } from "@/lib/gmail.functions";

const SYNC_THROTTLE_MS = 2 * 60 * 1000; // max 1x per 2 minuten

const nav = [
  { to: "/", icon: LayoutDashboard, label: "Brain" },
  { to: "/scan", icon: Camera, label: "Scan" },
  { to: "/inbox", icon: Inbox, label: "Mail-inbox" },
  { to: "/accounts", icon: Wallet, label: "Rekeningen" },
  { to: "/financien", icon: Coins, label: "Financiën" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user && location.pathname !== "/login" && !location.pathname.startsWith("/m/")) {
      navigate({ to: "/login" });
    }
  }, [loading, user, location.pathname, navigate]);

  const sync = useServerFn(syncGmail);
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const key = `lastGmailSync:${user.id}`;
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < SYNC_THROTTLE_MS) return;
    localStorage.setItem(key, String(Date.now()));
    sync({})
      .then((r: any) => {
        if (r?.imported > 0) {
          qc.invalidateQueries({ queryKey: ["invoices"] });
        }
      })
      .catch(() => {});
  }, [user?.id, sync, qc]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">…</div>;
  }
  if (!user) return null;

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-sidebar p-5">
        <Link to="/" className="flex items-center gap-2 mb-10">
          <Brain className="w-6 h-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight">brain</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {nav.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/login" });
          }}
        >
          <LogOut className="w-4 h-4 mr-2" /> Uitloggen
        </Button>
      </aside>

      <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-border bg-sidebar/95 backdrop-blur z-40">
        <div className="flex justify-around py-2">
          {nav.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-md text-xs ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
