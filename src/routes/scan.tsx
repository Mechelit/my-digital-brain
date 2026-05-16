import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { extractInvoice } from "@/lib/invoices.functions";
import { toast } from "sonner";
import { Camera, Upload, Loader2, Monitor, Smartphone, QrCode, Clipboard } from "lucide-react";

export const Route = createFileRoute("/scan")({
  component: () => (
    <AppShell>
      <ScanPage />
    </AppShell>
  ),
});

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      resolve(s.split(",")[1] ?? "");
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });

function ScanPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const extract = useServerFn(extractInvoice);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(window.matchMedia("(min-width: 768px) and (pointer: fine)").matches);
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        toast.success("Screenshot geplakt");
        void handleFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Bestand te groot (max 15MB)");
      return;
    }
    setBusy(true);
    try {
      setStage("Uploaden…");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("invoice-scans").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;

      setStage("AI leest de brief…");
      const base64 = await fileToBase64(file);
      const { invoice } = await extract({
        data: { imageBase64: base64, mimeType: file.type || "image/jpeg", scanPath: path },
      });

      toast.success("Factuur ingelezen");
      navigate({ to: "/invoice/$id", params: { id: invoice.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan mislukt");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const startMobileSession = async () => {
    if (loading) {
      toast.info("Even wachten — sessie laadt nog");
      return;
    }
    const currentUser = user ?? (await supabase.auth.getUser()).data.user;
    if (!currentUser) {
      toast.error("Even wachten — sessie laadt nog");
      return;
    }
    const token = crypto.randomUUID().replace(/-/g, "");
    setBusy(true);
    setStage("QR-sessie maken…");
    const { error } = await supabase
      .from("mobile_scan_sessions")
      .insert({ user_id: currentUser.id, token, status: "open" });
    if (error) {
      setBusy(false);
      setStage("");
      toast.error("Sessie aanmaken mislukt: " + error.message);
      return;
    }
    toast.success("Scan-sessie klaar");
    navigate({ to: "/scan/desktop/$token", params: { token } });
  };

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-12">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">Scan een brief</h1>
      <p className="text-muted-foreground mb-8">
        Maak een foto van de factuur of upload een PDF/afbeelding. AI haalt automatisch IBAN,
        bedrag, mededeling en vervaldatum eruit.
      </p>

      {busy ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">{stage}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {!isDesktop && (
            <button
              onClick={() => camRef.current?.click()}
              className="glass-card rounded-2xl p-8 text-left hover:border-primary/40 transition-colors group"
            >
              <Camera className="w-8 h-8 text-primary mb-4" />
              <h2 className="font-semibold mb-1">Foto maken</h2>
              <p className="text-sm text-muted-foreground">Camera opent direct, richt op de brief.</p>
            </button>
          )}

          <button
            onClick={() => fileRef.current?.click()}
            className="glass-card rounded-2xl p-8 text-left hover:border-primary/40 transition-colors group"
          >
            <Upload className="w-8 h-8 text-primary mb-4" />
            <h2 className="font-semibold mb-1">Bestand of screenshot uploaden</h2>
            <p className="text-sm text-muted-foreground">PDF, screenshot of foto uit Doccle, mail, etc.</p>
          </button>

          <button
            type="button"
            onClick={startMobileSession}
            disabled={busy || loading}
            className="md:col-span-2 glass-card rounded-2xl p-6 text-left hover:border-primary/40 transition-colors flex items-center gap-4 disabled:opacity-50"
          >
            <div className="flex items-center gap-1.5">
              <Monitor className="w-6 h-6 text-muted-foreground" />
              <QrCode className="w-5 h-5 text-primary" />
              <Smartphone className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold">
                {isDesktop ? "Scannen vanaf je gsm (aanbevolen)" : "Scannen vanaf je gsm"}
              </h2>
              <p className="text-sm text-muted-foreground">
                QR tonen — scan met je telefoon, betaal er meteen mee.
              </p>
            </div>
          </button>
        </div>
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
          if (file) void handleFile(file);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
