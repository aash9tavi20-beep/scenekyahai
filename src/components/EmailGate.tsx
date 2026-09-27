import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function EmailGate({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const clean = email.trim().toLowerCase();

  async function send() {
    setErr(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return setErr("That's not an email.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: clean });
    setBusy(false);
    if (error) return setErr("Couldn't email you. " + error.message);
    setSent(true);
  }
  async function verify() {
    setErr(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: clean, token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setErr("Wrong code.");
    onDone();
  }

  return (
    <div className="pop-in border-2 border-foreground bg-card p-4">
      <p className="text-sm text-muted-foreground">Your first one's free. I just need your email.</p>
      {!sent ? (
        <div className="mt-3 flex gap-2">
          <input
            type="email"
            inputMode="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@whatever.com"
            className="min-w-0 flex-1 border-2 border-foreground bg-background px-3 py-3 font-mono outline-none focus:border-accent"
          />
          <button disabled={busy} onClick={send} className="bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "…" : "Email me"}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code"
            className="min-w-0 flex-1 border-2 border-foreground bg-background px-3 py-3 font-mono tracking-widest outline-none focus:border-accent"
          />
          <button disabled={busy} onClick={verify} className="bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "…" : "Go"}
          </button>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}
