import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/scan/desktop/$token")({
  component: () => (
    <AppShell>
      <DesktopWaiter />
    </AppShell>
  ),
});

function DesktopWaiter() {
  const { token } = useParams({ from: "/scan/desktop/$token" });
  const navigate = useNavigate();
  const [qr, setQr] = useState("");
  const [delivered, setDelivered] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const url = typeof window !== "undefined" ? `${window.location.origin}/m/${token}` : "";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!url) return;
    // generate QR immediately, non-blocking
    QRCode.toDataURL(url, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "L",
      color: { dark: "#0d1216", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => {});
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    const onDelivered = (id: string) => {
      if (cancelled) return;
      setDelivered(true);
      setInvoiceId(id);
      navigate({ to: "/invoice/$id", params: { id } });
    };
    const verifySession = async () => {
      const { data } = await supabase
        .from("mobile_scan_sessions")
        .select("status,invoice_id")
        .eq("token", token)
        .maybeSingle();
      if (cancelled) return;
      setReady(!!data);
      if (data?.status === "delivered" && data.invoice_id) onDelivered(data.invoice_id);
    };
    void verifySession();

    const channel = supabase
      .channel(`scan-${token}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mobile_scan_sessions",
          filter: `token=eq.${token}`,
        },
        (payload) => {
          const row = payload.new as { status: string; invoice_id: string | null };
          if (row.status === "delivered" && row.invoice_id) onDelivered(row.invoice_id);
        },
      )
      .subscribe();
    const poll = window.setInterval(async () => {
      const { data } = await supabase
        .from("mobile_scan_sessions")
        .select("status,invoice_id")
        .eq("token", token)
        .maybeSingle();
      if (!cancelled && data) setReady(true);
      if (data?.status === "delivered" && data.invoice_id) onDelivered(data.invoice_id);
    }, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [token, navigate]);

  return (
    <div className="max-w-xl mx-auto px-5 md:px-8 py-12">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">Scan met je gsm</h1>
      <p className="text-muted-foreground mb-8">
        Open de camera van je telefoon en scan deze QR. De foto landt automatisch hier.
      </p>

      <div className="glass-card rounded-2xl p-8 flex flex-col items-center">
        {!ready ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">QR-sessie openen…</p>
          </div>
        ) : delivered ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-success" />
            </div>
            <p className="font-medium">Ontvangen — even openen…</p>
            {invoiceId ? (
              <Button
                className="mt-4"
                variant="secondary"
                onClick={() => navigate({ to: "/invoice/$id", params: { id: invoiceId } })}
              >
                Open factuur nu
              </Button>
            ) : null}
          </div>
        ) : qr ? (
          <>
            <img src={qr} alt="QR-code" className="rounded-xl bg-white p-3" />
            <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
              <Smartphone className="w-3 h-3" />
              Wachten op telefoon…
            </p>
            <a href={url} target="_blank" rel="noreferrer" className="mt-4 w-full">
              <Button variant="secondary" className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" /> Open telefoonlink
              </Button>
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
}
