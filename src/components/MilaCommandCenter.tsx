import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  Heart,
  Palette,
  TrendingUp,
  Compass,
  Sparkles,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { estimateEuro, formatMoney } from "@/lib/format";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

const WORLDS = [
  { key: "business", label: "Business", icon: Briefcase, to: "/financien", hue: 175 },
  { key: "leven", label: "Leven", icon: Heart, to: "/inbox", hue: 340 },
  { key: "creatie", label: "Creatie", icon: Palette, to: "/contracten", hue: 280 },
  { key: "groei", label: "Groei", icon: TrendingUp, to: "/accounts", hue: 130 },
  { key: "onderzoeken", label: "Onderzoeken", icon: Compass, to: "/scan", hue: 45 },
] as const;

type Insight = { id: string; text: string; tone: "calm" | "warn" | "urgent"; to?: string };

export function MilaCommandCenter() {
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

  const insights = useMemo<Insight[]>(() => {
    const list: Insight[] = [];
    const pending = invoices.filter((i) => i.status === "pending" || i.status === "confirmed");
    const total = pending.reduce((s, i) => s + (estimateEuro(i.amount as any, i.currency) ?? 0), 0);
    if (pending.length > 0) {
      list.push({
        id: "invoices",
        text: `${pending.length} ${pending.length === 1 ? "factuur wacht" : "facturen wachten"} op je — ${formatMoney(total, "EUR")}`,
        tone: pending.length > 3 ? "urgent" : "warn",
        to: "/financien",
      });
    }
    return list.slice(0, 3);
  }, [invoices]);

  const hour = now.getHours();
  const greeting =
    hour < 6 ? "Goeienacht" : hour < 12 ? "Goeiemorgen" : hour < 18 ? "Hallo" : "Goeienavond";
  const name =
    user?.user_metadata?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";

  return (
    <div className="relative min-h-[calc(100vh-6rem)] flex flex-col items-center justify-center px-5 md:px-8 py-10 overflow-hidden">
      {/* Soft ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, oklch(0.78 0.14 175 / 0.18), transparent 70%), radial-gradient(ellipse 50% 40% at 50% 90%, oklch(0.7 0.18 30 / 0.10), transparent 70%)",
        }}
      />

      {/* Greeting */}
      <header className="text-center mb-10 md:mb-14">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {now.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-3 text-2xl md:text-3xl font-light tracking-tight text-foreground/90">
          {greeting}
          {name && `, ${name}`}.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Mila is hier.</p>
      </header>

      {/* Orbit */}
      <div className="relative w-full max-w-[640px] aspect-square flex items-center justify-center">
        {/* Rings */}
        <div aria-hidden className="absolute inset-[12%] rounded-full border border-border/40" />
        <div aria-hidden className="absolute inset-[2%] rounded-full border border-border/20" />
        <div
          aria-hidden
          className="absolute inset-[12%] rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, oklch(0.78 0.14 175 / 0.25) 60deg, transparent 120deg, transparent 360deg)",
            animation: "spin 28s linear infinite",
            maskImage: "radial-gradient(closest-side, transparent 95%, black 100%)",
            WebkitMaskImage: "radial-gradient(closest-side, transparent 95%, black 100%)",
          }}
        />

        {/* MILA core */}
        <div className="relative z-10 flex items-center justify-center">
          <div
            aria-hidden
            className="absolute w-56 h-56 md:w-72 md:h-72 rounded-full blur-3xl opacity-70"
            style={{
              background:
                "radial-gradient(circle, oklch(0.85 0.16 175 / 0.55), oklch(0.6 0.18 280 / 0.25) 60%, transparent 75%)",
            }}
          />
          <div
            className="relative w-36 h-36 md:w-44 md:h-44 rounded-full flex items-center justify-center"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, oklch(0.95 0.06 175 / 0.9), oklch(0.78 0.14 175 / 0.85) 40%, oklch(0.45 0.14 260 / 0.85) 100%)",
              boxShadow:
                "0 0 60px oklch(0.78 0.14 175 / 0.45), inset 0 1px 0 oklch(1 0 0 / 0.3), inset 0 -20px 40px oklch(0 0 0 / 0.25)",
            }}
          >
            <div className="absolute inset-0 rounded-full animate-pulse opacity-40"
              style={{ boxShadow: "0 0 80px 10px oklch(0.85 0.16 175 / 0.4)" }}
            />
            <span className="relative text-2xl md:text-3xl font-light tracking-[0.25em] text-primary-foreground/90 select-none">
              MILA
            </span>
          </div>
        </div>

        {/* Worlds positioned around */}
        {WORLDS.map((w, i) => {
          const angle = (i / WORLDS.length) * 2 * Math.PI - Math.PI / 2;
          const radius = 44; // % from center
          const x = 50 + Math.cos(angle) * radius;
          const y = 50 + Math.sin(angle) * radius;
          const Icon = w.icon;
          return (
            <Link
              key={w.key}
              to={w.to}
              className="group absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-105"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center backdrop-blur-xl border border-border/60 transition-all group-hover:border-primary/50"
                  style={{
                    background: `radial-gradient(circle at 30% 25%, oklch(0.85 0.08 ${w.hue} / 0.25), oklch(0.22 0.013 250 / 0.85) 70%)`,
                    boxShadow:
                      "0 8px 32px -8px oklch(0 0 0 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.06)",
                  }}
                >
                  <Icon
                    className="w-6 h-6 md:w-7 md:h-7"
                    style={{ color: `oklch(0.85 0.12 ${w.hue})` }}
                  />
                </div>
                <span className="text-[11px] md:text-xs uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                  {w.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Insights — max 3, only if critical */}
      {insights.length > 0 && (
        <section className="mt-12 md:mt-16 w-full max-w-md space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground text-center mb-3">
            Mila merkt op
          </p>
          {insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </section>
      )}

      {insights.length === 0 && (
        <p className="mt-12 text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary/70" />
          Alles is rustig. Geniet ervan.
        </p>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const toneColor =
    insight.tone === "urgent"
      ? "oklch(0.7 0.18 30)"
      : insight.tone === "warn"
        ? "oklch(0.78 0.16 80)"
        : "oklch(0.78 0.14 175)";
  const content = (
    <div
      className={cn(
        "glass-card rounded-2xl px-4 py-3 flex items-center gap-3 transition-all hover:translate-y-[-1px]",
      )}
    >
      <span
        className="w-2 h-2 rounded-full flex-none"
        style={{ background: toneColor, boxShadow: `0 0 12px ${toneColor}` }}
      />
      <p className="text-sm text-foreground/90 flex-1">{insight.text}</p>
    </div>
  );
  return insight.to ? <Link to={insight.to}>{content}</Link> : content;
}
