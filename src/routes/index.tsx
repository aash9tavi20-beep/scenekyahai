import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { react, locate, curate, type Brief } from "@/lib/curate.functions";
import { PhoneGate } from "@/components/PhoneGate";
import { PlanCards, type Plan } from "@/components/PlanCards";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MoveYourWay365 — ft. Aashray" },
      { name: "description", content: "Tell me how you feel. I'll figure out where you should go and what you should eat." },
      { property: "og:title", content: "MoveYourWay365 — ft. Aashray" },
      { property: "og:description", content: "Tell me how you feel. I'll figure out where you should go and what you should eat." },
    ],
  }),
  component: Home,
});

type Step = "mood" | "location" | "when" | "intent" | "craving" | "spend" | "auth" | "curating" | "results" | "paywall" | "stuck";
type Msg = { from: "me" | "app"; text: string };
type Loc = { label: string; lat: number; lng: number };

const QUESTIONS: Partial<Record<Step, string>> = {
  location: "Where are we?",
  when: "When?",
  intent: "Food or something to do?",
  craving: "What are we craving?",
  spend: "How much damage?",
};
const SPEND = ["Save me money", "Reasonable spend", "I'm willing to spend", "Treat me today"];
const WHEN = ["Now", "Morning", "Afternoon", "Evening", "Night"];

const emptyBrief: Brief = { mood: "", intent: null, craving: "", when: "", company: "", spend: "", notes: [] };

function Home() {
  const reactFn = useServerFn(react);
  const locateFn = useServerFn(locate);
  const curateFn = useServerFn(curate);

  const [started, setStarted] = useState(false);
  const [step, setStep] = useState<Step>("mood");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [brief, setBrief] = useState<Brief>(emptyBrief);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, step, plans, thinking]);

  const say = (text: string) => setMsgs((m) => [...m, { from: "app", text }]);
  const me = (text: string) => setMsgs((m) => [...m, { from: "me", text }]);
  const history = () => msgs.map((m) => `${m.from === "me" ? "U" : "A"}: ${m.text}`);

  function nextFrom(b: Brief, l: Loc | null): Step {
    if (!l) return "location";
    if (!b.when) return "when";
    if (!b.intent) return "intent";
    if ((b.intent === "food" || b.intent === "either") && !b.craving) return "craving";
    if (!b.spend) return "spend";
    return "auth";
  }

  async function advance(b: Brief, l: Loc | null) {
    const n = nextFrom(b, l);
    if (n === "auth") {
      const { data } = await supabase.auth.getSession();
      if (data.session) return run(b, l!);
      say("Give me one more thing.");
      setStep("auth");
      return;
    }
    const q = QUESTIONS[n];
    if (q) setTimeout(() => say(q), 350);
    setStep(n);
  }

  async function reactTo(text: string, stepName: string, b: Brief) {
    setThinking(true);
    const r = await reactFn({ data: { step: stepName, text, history: history() } });
    setThinking(false);
    say(r.reply);
    return {
      ...b,
      intent: b.intent ?? (r.intent === "food" ? "food" : null),
      spend: b.spend || r.spend || "",
      company: b.company || r.company || "",
    };
  }

  async function submitText(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    me(text);

    if (step === "mood") {
      const b = await reactTo(text, "mood", { ...brief, mood: text });
      setBrief(b);
      return advance(b, loc);
    }
    if (step === "location") {
      setThinking(true);
      const r = await locateFn({ data: { address: text } });
      setThinking(false);
      if (!r.ok) return say("Never heard of it. Try again.");
      const l = { label: r.label, lat: r.lat, lng: r.lng };
      setLoc(l);
      say("Cool.");
      return advance(brief, l);
    }
    if (step === "craving") {
      const b = await reactTo(text, "craving", { ...brief, craving: text });
      setBrief(b);
      return advance(b, loc);
    }
    if (step === "intent") {
      const b = await reactTo(text, "food or activity", brief);
      const fixed = { ...b, intent: b.intent ?? "either" };
      setBrief(fixed);
      return advance(fixed, loc);
    }
    if (step === "results" || step === "stuck") {
      const r = await reactTo(text, "refining existing plans", brief);
      const b = { ...r, notes: [...brief.notes, text].slice(-10) };
      setBrief(b);
      return run(b, loc!, true);
    }
    // any other step: treat as extra context
    const b = { ...brief, notes: [...brief.notes, text].slice(-10) };
    setBrief(b);
    say("Noted.");
  }

  function pick(value: string, field: "when" | "spend" | "intent") {
    me(value);
    let b: Brief;
    if (field === "intent") {
      const v = value.startsWith("Food") ? "food" : value.startsWith("Something") ? "activity" : "either";
      b = { ...brief, intent: v };
      say(v === "food" ? "Obviously." : v === "activity" ? "We're going." : "Fair. I'll figure it out.");
    } else {
      b = { ...brief, [field]: value };
      if (field === "spend")
        say(
          { "Save me money": "Respect. We're going cheap.", "Treat me today": "Finally. Honesty.", "I'm willing to spend": "Oh, we're feeling important." }[value] ?? "Done.",
        );
      else say(value === "Night" ? "Interesting." : value === "Now" ? "We're going." : "Done.");
    }
    setBrief(b);
    advance(b, loc);
  }

  function useMyLocation() {
    me("Use my location");
    if (!navigator.geolocation) return say("Can't find you. Type it.");
    setThinking(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const r = await locateFn({ data: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
        setThinking(false);
        if (!r.ok) return say("Can't find you. Type it.");
        const l = { label: r.label, lat: r.lat, lng: r.lng };
        setLoc(l);
        say(`${r.label}. Cool.`);
        advance(brief, l);
      },
      () => {
        setThinking(false);
        say("Fine. Type it.");
      },
      { maximumAge: 600000, timeout: 10000 },
    );
  }

  async function run(b: Brief, l: Loc, refine = false) {
    setStep("curating");
    setThinking(true);
    if (!refine) setTimeout(() => say("Give me a minute."), 250);
    try {
      const r = await curateFn({ data: { brief: b, lat: l.lat, lng: l.lng, label: l.label, previous: refine ? seen : [] } });
      setThinking(false);
      if (r.status === "ok") {
        setPlans(r.plans);
        setSeen((s) => [...s, ...r.plans.map((p) => p.name)].slice(-9));
        if (r.barrier > 15) say(`Had to go ${r.barrier} km. Worth it.`);
        say(r.line);
        setStep("results");
      } else if (r.status === "payment_required") {
        say("Your free one's done. This one's ₹50.");
        setStep("paywall");
      } else {
        say(r.message);
        setStep("stuck");
      }
    } catch (e) {
      console.error(e);
      setThinking(false);
      say("Something broke. Not your fault. Try again.");
      setStep("stuck");
    }
  }

  const showTextInput = ["mood", "location", "craving", "intent", "results", "stuck"].includes(step);
  const placeholder =
    step === "mood" ? "Spill it out." : step === "location" ? "Area, city…" : step === "craving" ? "Something spicy…" : step === "intent" ? "Or just say it" : "Make it cheaper. Outdoors. Whatever.";

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-5 pb-40 pt-5">
      <header className="flex items-start justify-between">
        <button onClick={() => location.reload()} className="text-lg font-extrabold tracking-tight">
          MoveYourWay<span className="text-accent">365</span>
        </button>
        <span className="-rotate-6 font-sign text-2xl leading-none">ft. Aashray</span>
      </header>

      {!started ? (
        <Landing onStart={() => { setStarted(true); say("So... what's up with your mood today?"); }} />
      ) : (
        <main className="mt-8 flex-1 space-y-3">
          {msgs.map((m, i) =>
            m.from === "app" ? (
              <p key={i} className="pop-in max-w-[85%] text-2xl font-extrabold leading-tight tracking-tight">{m.text}</p>
            ) : (
              <p key={i} className="pop-in ml-auto max-w-[80%] w-fit bg-primary px-3 py-2 text-right text-primary-foreground">{m.text}</p>
            ),
          )}
          {thinking && <p className="animate-pulse font-mono text-sm text-muted-foreground">…</p>}

          {step === "location" && !thinking && (
            <div className="pop-in flex flex-wrap gap-2">
              <button onClick={useMyLocation} className="border-2 border-foreground bg-card px-4 py-2 font-semibold">📍 Use my current location</button>
              <span className="self-center font-mono text-xs text-muted-foreground">or type it below</span>
            </div>
          )}
          {step === "when" && <Chips options={WHEN} onPick={(v) => pick(v, "when")} />}
          {step === "intent" && <Chips options={["Food", "Something to do", "Surprise me"]} onPick={(v) => pick(v, "intent")} />}
          {step === "spend" && <Chips options={SPEND} onPick={(v) => pick(v, "spend")} />}
          {step === "auth" && <PhoneGate onDone={() => { say("Done."); run(brief, loc!); }} />}
          {step === "paywall" && (
            <div className="pop-in space-y-2">
              <button disabled className="w-full bg-primary py-4 text-lg font-bold text-primary-foreground opacity-60">₹50 | Curate my experience</button>
              <p className="font-mono text-xs text-muted-foreground">Payments aren't switched on yet. Nothing will be charged.</p>
            </div>
          )}
          {plans.length > 0 && (step === "results" || step === "curating") && <PlanCards plans={plans} />}
          {step === "results" && <p className="font-mono text-xs text-muted-foreground">Not feeling it? Tell me. {loc && <>· near {loc.label} · <button className="underline" onClick={() => { setLoc(null); setStep("location"); say("Where are we?"); }}>change</button></>}</p>}
          <div ref={endRef} />
        </main>
      )}

      {started && showTextInput && (
        <form onSubmit={submitText} className="fixed inset-x-0 bottom-0 bg-background/95 px-5 pb-5 pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-xl gap-2">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              className="min-w-0 flex-1 border-2 border-foreground bg-card px-4 py-4 text-lg outline-none placeholder:text-muted-foreground focus:border-accent"
            />
            <button disabled={thinking || !input.trim()} className="bg-primary px-5 text-xl font-bold text-primary-foreground disabled:opacity-40">→</button>
          </div>
        </form>
      )}
    </div>
  );
}

function Chips({ options, onPick }: { options: string[]; onPick: (v: string) => void }) {
  return (
    <div className="pop-in flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} onClick={() => onPick(o)} className="border-2 border-foreground bg-card px-4 py-2 font-semibold active:translate-y-0.5 hover:bg-primary hover:text-primary-foreground">
          {o}
        </button>
      ))}
    </div>
  );
}

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mt-16">
        <h1 className="text-[3.4rem] font-extrabold leading-[0.9] tracking-tighter sm:text-7xl">
          Have A Minute?
          <br />
          <span className="ml-6 inline-block -rotate-1 bg-primary px-2 text-primary-foreground">We're Only Here</span>
          <br />
          You Curate.
        </h1>
        <p className="mt-8 text-xl">Tell me what's up.</p>
        <button onClick={onStart} className="mt-8 w-full border-2 border-foreground bg-accent py-5 text-xl font-extrabold text-accent-foreground shadow-[6px_6px_0_0_var(--color-foreground)] active:translate-x-1 active:translate-y-1 active:shadow-none sm:w-auto sm:px-10">
          Start talking →
        </button>
      </section>

      <section className="mt-24 ml-auto max-w-xs rotate-1 border-2 border-foreground p-4">
        <p className="font-extrabold">Your first move is on us.</p>
        <p className="mt-2 text-sm">
          Your first experience is free. After that, it's ₹50 every time we curate one for you.
          No subscription. No membership. No nonsense.
        </p>
      </section>
    </main>
  );
}
