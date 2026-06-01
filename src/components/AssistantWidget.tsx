import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, Send, Paperclip, X, Sparkles, Volume2, VolumeX, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const N8N_WEBHOOK_URL = "https://mila-ai-brain.app.n8n.cloud/webhook/sovereign-mind";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text?: string;
  files?: { name: string; size: number }[];
  audio?: boolean;
  preview?: { html?: string; imageUrl?: string };
  ts: number;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [ttsOn, setTtsOn] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const speak = useCallback((t: string) => {
    if (!ttsOn || !t || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = "nl-NL";
      u.rate = 1;
      const voices = window.speechSynthesis.getVoices();
      const nl = voices.find((v) => v.lang?.toLowerCase().startsWith("nl"));
      if (nl) u.voice = nl;
      window.speechSynthesis.speak(u);
    } catch {}
  }, [ttsOn]);

  const handleResponse = useCallback((data: any) => {
    // Accept various shapes from n8n
    const payload = Array.isArray(data) ? data[0] : data;
    const reply =
      payload?.reply ??
      payload?.text ??
      payload?.message ??
      payload?.output ??
      (typeof payload === "string" ? payload : "");
    const preview = payload?.preview ?? (payload?.previewHtml ? { html: payload.previewHtml } : payload?.previewUrl ? { imageUrl: payload.previewUrl } : undefined);

    if (reply || preview) {
      setMessages((m) => [...m, { id: uid(), role: "assistant", text: reply || undefined, preview, ts: Date.now() }]);
      if (reply) speak(String(reply));
    } else {
      setMessages((m) => [...m, { id: uid(), role: "assistant", text: "Verzonden naar n8n ✓", ts: Date.now() }]);
    }
  }, [speak]);

  // Keywords that trigger the full n8n agent (tools, memory, database)
  const AGENT_KEYWORDS = ["todo", "to-do", "taak", "lijst", "herinnering", "email", "inbox", "mail", "factuur", "invoice", "weet je", "ken je", "herinner", "wat weet", "wie ben ik", "over mij", "mijn naam", "onthoud", "manus", "deploy", "bouw", "maak aan", "aanmaken", "remember", "know about", "about me"];

  const send = useCallback(async (opts?: { audioBlob?: Blob }) => {
    const hasText = text.trim().length > 0;
    const hasFiles = files.length > 0;
    const hasAudio = !!opts?.audioBlob;
    if (!hasText && !hasFiles && !hasAudio) return;

    const userMsg: Msg = {
      id: uid(),
      role: "user",
      text: hasText ? text : undefined,
      files: hasFiles ? files.map((f) => ({ name: f.name, size: f.size })) : undefined,
      audio: hasAudio,
      ts: Date.now(),
    };
    setMessages((m) => [...m, userMsg]);
    setText("");
    setFiles([]);
    setSending(true);

    const msgText = userMsg.text || "";
    const msgLower = msgText.toLowerCase();
    const needsAgent = AGENT_KEYWORDS.some((k) => msgLower.includes(k)) || msgText.length > 200 || hasFiles || hasAudio;

    try {
      const fd = new FormData();
      if (hasText) fd.append("message", userMsg.text!);
      if (hasText) fd.append("text", userMsg.text!);
      files.forEach((f, i) => fd.append(`file_${i}`, f, f.name));
      if (opts?.audioBlob) fd.append("audio", opts.audioBlob, `voice-${Date.now()}.webm`);
      fd.append("ts", String(Date.now()));
      fd.append("source", "brain-dashboard");
      fd.append("user_id", "mila-sovereign-user");

      if (!needsAgent) {
        // ── FAST STREAMING PATH ──────────────────────────────────────────
        const streamingMsgId = uid();
        setMessages((m) => [...m, { id: streamingMsgId, role: "assistant", text: "", ts: Date.now() }]);

        const res = await fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { Accept: "text/event-stream" },
          body: fd,
        });

        const ct = res.headers.get("content-type") || "";

        if (ct.includes("text/event-stream") && res.body) {
          // True streaming — update message token by token
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullText = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const raw = line.slice(6).trim();
                if (raw === "[DONE]") break;
                try {
                  const parsed = JSON.parse(raw);
                  const token = parsed?.choices?.[0]?.delta?.content || "";
                  if (token) {
                    fullText += token;
                    setMessages((m) =>
                      m.map((msg) => msg.id === streamingMsgId ? { ...msg, text: fullText } : msg)
                    );
                  }
                } catch {}
              }
            }
          }
          if (fullText) speak(fullText);
        } else {
          // Non-streaming fallback
          const data = ct.includes("application/json") ? await res.json() : await res.text();
          if (!res.ok) throw new Error(typeof data === "string" ? data : `HTTP ${res.status}`);
          const reply = (data as any)?.reply || (typeof data === "string" ? data : "Geen antwoord.");
          setMessages((m) => m.map((msg) => msg.id === streamingMsgId ? { ...msg, text: reply } : msg));
          if (reply) speak(String(reply));
        }
      } else {
        // ── AGENT PATH via n8n ───────────────────────────────────────────
        const res = await fetch(N8N_WEBHOOK_URL, { method: "POST", body: fd });
        const ct = res.headers.get("content-type") || "";
        let data: any = null;
        if (ct.includes("application/json")) data = await res.json();
        else {
          const txt = await res.text();
          try { data = JSON.parse(txt); } catch { data = txt; }
        }
        if (!res.ok) throw new Error(typeof data === "string" ? data : `HTTP ${res.status}`);
        handleResponse(data);
      }
    } catch (e: any) {
      const message = e?.message === "Failed to fetch"
        ? "Kan MILA niet bereiken. Controleer of de workflow live staat."
        : e?.message || "Verbindingsfout";
      toast.error(message);
      setMessages((m) => [...m, { id: uid(), role: "assistant", text: `⚠️ ${message}`, ts: Date.now() }]);
    } finally {
      setSending(false);
    }
  }, [text, files, handleResponse, speak]);

  // === Audio recording + visualizer ===
  const stopVisualizer = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setAudioLevel(0);
  };

  const tickVisualizer = () => {
    const an = analyserRef.current;
    if (!an) return;
    const arr = new Uint8Array(an.frequencyBinCount);
    an.getByteTimeDomainData(arr);
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      const v = (arr[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / arr.length);
    setAudioLevel(Math.min(1, rms * 2.5));
    rafRef.current = requestAnimationFrame(tickVisualizer);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "" });
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        stopVisualizer();
        audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;
        analyserRef.current = null;
        if (blob.size > 0) await send({ audioBlob: blob });
      };
      mr.start();

      const Ctx: typeof AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;
      tickVisualizer();
      setRecording(true);
    } catch (e: any) {
      toast.error("Microfoon geweigerd: " + (e?.message || ""));
    }
  };

  const stopRecording = () => {
    setRecording(false);
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) setFiles((f) => [...f, ...dropped]);
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open assistent"
        className={cn(
          "fixed bottom-5 right-5 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all",
          "bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground hover:scale-105 active:scale-95"
        )}
        style={{ boxShadow: "0 10px 40px -10px hsl(var(--primary) / 0.6)" }}
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* Panel */}
      <div
        className={cn(
          "fixed z-50 right-3 left-3 bottom-24 md:left-auto md:right-6 md:bottom-24 md:w-[420px] max-w-[calc(100vw-1.5rem)] origin-bottom-right transition-all",
          open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        <div className="rounded-3xl border border-border/60 bg-background/85 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col h-[min(640px,80vh)]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">Assistent</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Direct verbonden met n8n</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setTtsOn((v) => !v)} title={ttsOn ? "Spraak uit" : "Spraak aan"}>
                {ttsOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && !recording && (
              <div className="text-center text-sm text-muted-foreground py-10">
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-primary/60" />
                Typ, spreek of sleep een bestand hierheen.
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  {m.audio && <p className="text-xs opacity-70 mb-1">🎙️ Spraakbericht verzonden</p>}
                  {m.files?.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs opacity-80 mb-1">
                      <FileText className="w-3 h-3" /> {f.name}
                    </div>
                  ))}
                  {m.text && <div>{m.text}</div>}
                  {m.preview?.imageUrl && (
                    <img src={m.preview.imageUrl} alt="preview" className="mt-2 rounded-lg border border-border max-w-full" />
                  )}
                  {m.preview?.html && (
                    <iframe
                      title="design-preview"
                      sandbox="allow-same-origin"
                      srcDoc={m.preview.html}
                      className="mt-2 w-full h-64 rounded-lg border border-border bg-background"
                    />
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Bezig…
                </div>
              </div>
            )}
          </div>

          {/* Recording orb overlay */}
          {recording && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex flex-col items-center justify-center gap-6 z-10">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full bg-primary/20 blur-2xl"
                  style={{ transform: `scale(${1 + audioLevel * 1.2})`, transition: "transform 80ms ease-out" }}
                />
                <div
                  className="absolute rounded-full bg-primary/30"
                  style={{
                    width: 120 + audioLevel * 80,
                    height: 120 + audioLevel * 80,
                    transition: "all 80ms ease-out",
                    filter: "blur(8px)",
                  }}
                />
                <div
                  className="relative rounded-full bg-gradient-to-br from-primary via-primary/80 to-primary/40 shadow-2xl flex items-center justify-center"
                  style={{
                    width: 80 + audioLevel * 40,
                    height: 80 + audioLevel * 40,
                    transition: "all 80ms ease-out",
                    boxShadow: `0 0 ${30 + audioLevel * 60}px hsl(var(--primary) / ${0.4 + audioLevel * 0.6})`,
                  }}
                >
                  <Mic className="w-7 h-7 text-primary-foreground" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground animate-pulse">Ik luister…</p>
              <Button onClick={stopRecording} size="lg" className="rounded-full px-8">
                Stop & verstuur
              </Button>
            </div>
          )}

          {/* Composer */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "border-t border-border/60 p-3 space-y-2 transition-colors",
              dragOver && "bg-primary/5"
            )}
          >
            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-muted rounded-full px-2.5 py-1 text-xs">
                    <FileText className="w-3 h-3" />
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button onClick={() => setFiles((arr) => arr.filter((_, j) => j !== i))} className="opacity-60 hover:opacity-100">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-1.5">
              <label className="flex-none">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json,.png,.jpg,.jpeg,.webp,image/*"
                  onChange={(e) => {
                    const list = Array.from(e.target.files || []);
                    if (list.length) setFiles((f) => [...f, ...list]);
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-accent cursor-pointer text-muted-foreground">
                  <Paperclip className="w-4 h-4" />
                </span>
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder={dragOver ? "Laat los om bestand toe te voegen…" : "Typ een bericht of sleep bestanden…"}
                rows={1}
                className="flex-1 resize-none bg-muted/40 rounded-2xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 max-h-32 min-h-[36px]"
              />
              <Button
                size="icon"
                variant={recording ? "destructive" : "ghost"}
                className="h-9 w-9 rounded-full flex-none"
                onClick={recording ? stopRecording : startRecording}
                title="Spraak"
              >
                <Mic className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                className="h-9 w-9 rounded-full flex-none"
                onClick={() => send()}
                disabled={sending || (!text.trim() && files.length === 0)}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
