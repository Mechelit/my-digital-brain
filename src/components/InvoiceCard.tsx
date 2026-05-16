import type { Database } from "@/integrations/supabase/types";
import { Link } from "@tanstack/react-router";
import { Calendar, FileText, Check } from "lucide-react";
import { formatWithEuroEstimate } from "@/lib/format";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

const statusStyles: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  confirmed: "bg-primary/15 text-primary",
  paid: "bg-success/15 text-success",
  archived: "bg-muted text-muted-foreground",
};
const statusLabel: Record<string, string> = {
  pending: "Te bevestigen",
  confirmed: "Bevestigd",
  paid: "Betaald",
  archived: "Archief",
};

export function InvoiceCard({
  invoice,
  selectable,
  selected,
  onToggleSelect,
}: {
  invoice: Invoice;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const overdue =
    invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== "paid";

  const inner = (
    <>
      {selectable ? (
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
            selected ? "bg-primary border-primary" : "bg-accent border-border"
          }`}
        >
          {selected ? (
            <Check className="w-5 h-5 text-primary-foreground" />
          ) : (
            <FileText className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      ) : (
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{invoice.supplier ?? "Onbekende leverancier"}</p>
          <span
            className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${statusStyles[invoice.status]}`}
          >
            {statusLabel[invoice.status]}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {invoice.due_date && (
            <span className={`flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}>
              <Calendar className="w-3 h-3" />
              {new Date(invoice.due_date).toLocaleDateString("nl-BE")}
            </span>
          )}
          {invoice.iban && <span className="font-mono">{invoice.iban.slice(0, 8)}…</span>}
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold tabular-nums">
          {formatWithEuroEstimate(invoice.amount as any, invoice.currency)}
        </p>
      </div>
    </>
  );

  if (selectable) {
    return (
      <button
        type="button"
        onClick={() => onToggleSelect?.(invoice.id)}
        className={`w-full text-left glass-card rounded-xl p-4 flex items-center gap-4 transition-colors ${
          selected ? "border-primary/60" : "hover:border-primary/40"
        }`}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      to="/invoice/$id"
      params={{ id: invoice.id }}
      className="glass-card rounded-xl p-4 flex items-center gap-4 hover:border-primary/40 transition-colors group"
    >
      {inner}
    </Link>
  );
}
