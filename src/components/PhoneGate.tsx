import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function PhoneGate({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const full = "+91" + phone.replace(/\D/g, "").slice(-10);

  async function send() {
    setErr(null);
    if (full.length !== 13) return setErr("Ten digits. Come on.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: full });
    setBusy(false);
    if (error) return setErr("Couldn't text you. " + error.message);
    setSent(true);
  }
  async function verify() {
    setErr(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: full, token: code.trim(), type: "sms" });
    setBusy(false);
    if (error) return setErr("Wrong code.");
    onDone();
  }

  return (
    <div className="pop-in border-2 border-foreground bg-card p-4">
      <p className="text-sm text-muted-foreground">Your first one's free. I just need your number.</p>
      {!sent ? (
        <div className="mt-3 flex gap-2">
          <span className="flex items-center border-2 border-foreground px-2 font-mono text-sm">+91</span>
          <input
            inputMode="numeric"
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98xxxxxxxx"
            className="min-w-0 flex-1 border-2 border-foreground bg-background px-3 py-3 font-mono outline-none focus:border-accent"
          />
          <button disabled={busy} onClick={send} className="bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "…" : "Text me"}
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
