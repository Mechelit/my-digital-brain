import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { extractInvoice } from "@/lib/invoices.functions";
import { Camera, Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/m/$token")({ component: MobileScanPage });

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });

function MobileScanPage() {
  const { token } = useParams({ from: "/m/$token" });
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const extract = useServerFn(extractInvoice);
  const camRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    supabase.from("mobile_scan_sessions").select("user_id, expires_at").eq("token", token).single().then(({ data }) => {
      if (!data || data.user_id !== user.id || new Date(data.expires_at) < new Date()) {
        setSessionOk(false);
      } else {
        setSessionOk(true);
      }
    });
  }, [token, user, loading, navigate]);

  const handle = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      setStage("Uploaden…");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("invoice-scans").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;

      setStage("AI leest de brief…");
      const base64 = await fileToBase64(file);
      const { invoice } = await extract({
        data: { imageBase64: base64, mimeType: file.type || "image/jpeg", scanPath: path },
      });

      await supabase.from("mobile_scan_sessions").update({
        status: "delivered", invoice_id: invoice.id,
      }).eq("token", token);

      toast.success("Verstuurd naar je laptop");
      setStage("Klaar! Kijk op je laptop.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mislukt");
      setBusy(false);
      setStage("");
    }
  };

  if (sessionOk === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-medium">Sessie verlopen of niet geldig</p>
          <p className="text-sm text-muted-foreground mt-2">Open opnieuw een scan-sessie op je laptop.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Brain className="w-6 h-6 text-primary" />
        <span className="text-lg font-semibold">brain · scan</span>
      </div>

      {busy ? (
        <div className="glass-card rounded-2xl p-10 text-center w-full max-w-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{stage}</p>
        </div>
      ) : (
        <>
          <Button size="lg" className="glow-ring h-16 px-8 text-base" onClick={() => camRef.current?.click()}>
            <Camera className="w-5 h-5 mr-2" /> Maak foto van brief
          </Button>
          <p className="text-xs text-muted-foreground mt-4">De foto wordt geanalyseerd en verschijnt op je laptop.</p>
        </>
      )}

      <input
        ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
      />
    </div>
  );
}
