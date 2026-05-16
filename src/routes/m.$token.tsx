import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { mobileGetSession, mobileScanExtract, mobileMarkPaid } from "@/lib/mobile-scan.functions";
import { Camera, Loader2, Brain, Check, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { estimateEuro, formatMoney, formatWithEuroEstimate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/m/$token")({ component: MobileScanPage });

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });

function buildEpcQr(inv: any): string | null {
  if (!inv?.iban || !inv?.amount) return null;
  const amount = (estimateEuro(inv.amount, inv.currency) ?? Number(inv.amount)).toFixed(2);
  const ref = (inv.structured_reference || "").replace(/[^0-9]/g, "");
  const lines = [
    "BCD",
    "002",
    "1",
    "SCT",
    inv.bic || "",
    (inv.supplier || "Begunstigde").slice(0, 70),
    inv.iban.replace(/\s/g, ""),
    `EUR${amount}`,
    "",
    ref || "",
    ref ? "" : (inv.free_reference || inv.notes || "").slice(0, 140),
    "",
  ];
  return lines.join("\n");
}

function MobileScanPage() {
  const { token } = useParams({ from: "/m/$token" });
  const getSession = useServerFn(mobileGetSession);
  const scan = useServerFn(mobileScanExtract);
  const markPaid = useServerFn(mobileMarkPaid);
  const camRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [invoice, setInvoice] = useState<any>(null);
  const [valid, setValid] = useState<boolean | null>(null);
  const [qr, setQr] = useState<string>("");
  const [paid, setPaid] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; iban: string | null; is_default: boolean }>>([]);
  const [accountId, setAccountId] = useState<string>("");

  useEffect(() => {
    getSession({ data: { token } })
      .then((r) => {
        setValid(true);
        if (r.invoice) {
          setInvoice(r.invoice);
          setPaid(r.invoice.status === "paid");
        }
        setAccounts(r.accounts ?? []);
        setAccountId((r.accounts ?? []).find((a: any) => a.is_default)?.id ?? r.accounts?.[0]?.id ?? "");
      })
      .catch(() => setValid(false));
  }, [token]);

  useEffect(() => {
    const payload = buildEpcQr(invoice);
    if (!payload) {
      setQr("");
      return;
    }
    QRCode.toDataURL(payload, { width: 280, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [invoice]);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      setStage("Uploaden…");
      const base64 = await fileToBase64(file);
      setStage("AI leest de brief…");
      const { invoice: inv } = await scan({
        data: { token, imageBase64: base64, mimeType: file.type || "image/jpeg" },
      });
      setInvoice(inv);
      setPaid(inv.status === "paid");
      toast.success("Factuur ingelezen");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mislukt");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const onPay = async () => {
    if (!invoice) return;
    try {
      await markPaid({ data: { token, invoiceId: invoice.id, accountId: accountId || null } });
      setPaid(true);
      toast.success("Gemarkeerd als betaald");
    } catch (e: any) {
      toast.error(e.message ?? "Mislukt");
    }
  };

  if (valid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-medium">Sessie verlopen of niet geldig</p>
          <p className="text-sm text-muted-foreground mt-2">
            Open opnieuw een scan-sessie op je laptop.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-10">
      <div className="flex items-center gap-2 mb-8">
        <Brain className="w-6 h-6 text-primary" />
        <span className="text-lg font-semibold">brain · scan</span>
      </div>

      {busy ? (
        <div className="glass-card rounded-2xl p-10 text-center w-full max-w-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{stage}</p>
        </div>
      ) : invoice ? (
        <div className="w-full max-w-sm space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Factuur</p>
            <h2 className="text-xl font-semibold mt-1">{invoice.supplier || "Onbekend"}</h2>
            <p className="text-3xl font-semibold mt-2">
              {formatWithEuroEstimate(invoice.amount, invoice.currency)}
            </p>
            {invoice.iban && (
              <p className="text-xs font-mono text-muted-foreground mt-2">{invoice.iban}</p>
            )}
            {invoice.structured_reference && (
              <p className="text-xs font-mono text-muted-foreground">
                {invoice.structured_reference}
              </p>
            )}
          </div>

          {qr && !paid && (
            <div className="glass-card rounded-2xl p-5 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                Betaal met je bank-app
              </p>
              <img src={qr} alt="EPC betaal-QR" className="rounded-xl bg-white p-3 mx-auto" />
              <p className="text-xs text-muted-foreground mt-3">
                Open je banking-app (KBC, Belfius, BNP, ING, Argenta…) → scannen → bevestigen.
              </p>
            </div>
          )}

          {paid ? (
            <div className="glass-card rounded-2xl p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-2">
                <Check className="w-6 h-6 text-success" />
              </div>
              <p className="font-medium">Afgevinkt als betaald</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.length > 0 && (
                <select
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.iban ? ` · ${a.iban}` : ""}
                    </option>
                  ))}
                </select>
              )}
              <Button className="w-full glow-ring h-12" onClick={onPay}>
                <CreditCard className="w-4 h-4 mr-2" /> Markeer als betaald
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setInvoice(null);
            }}
          >
            Nog een brief scannen
          </Button>
        </div>
      ) : (
        <>
          <Button
            size="lg"
            className="glow-ring h-16 px-8 text-base"
            onClick={() => camRef.current?.click()}
          >
            <Camera className="w-5 h-5 mr-2" /> Maak foto van brief
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            De foto wordt geanalyseerd en verschijnt op je laptop.
          </p>
        </>
      )}

      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (file) void handle(file);
        }}
      />
    </div>
  );
}
