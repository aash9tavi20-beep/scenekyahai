import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, MapPin, Sparkles, SlidersHorizontal, RotateCcw, Navigation, Coffee, Compass, Heart, Loader2 } from "lucide-react";
import { react, locate, curate, refineBrief } from "@/lib/curate.functions";
import { DISTANCES, EMPTY_BRIEF, type Brief, type DraftBrief } from "@/lib/scene";
import { PlanCards, type Plan } from "@/components/PlanCards";
import { Button } from "@/components/ui/button";
import scenes from "@/assets/scenes.jpg";
import upiQr from "@/assets/upi-qr.jpeg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "SceneKyaHai — Here to curate your Taqdeer & your Bad-Decisions" },
    { name: "description", content: "Find your scene across India. Mood-led experiences, your distance, your kind of day. Ft. Aashray." },
    { property: "og:title", content: "SceneKyaHai — Ft. Aashray" },
    { property: "og:description", content: "Here to curate your Taqdeer & your Bad-Decisions. Personal experiences across India." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Home,
});
function deviceId() {
  const key = "myw365_device";
  let id: string | null = null;
  try { id = localStorage.getItem(key); } catch { /* Cookie fallback. */ }
  id ??= document.cookie.match(/myw365_device=([\w-]+)/)?.[1] ?? crypto.randomUUID();
  try { localStorage.setItem(key, id); } catch { /* Cookie fallback. */ }
  document.cookie = `${key}=${id}; max-age=${60 * 60 * 24 * 730}; path=/; samesite=lax`;
  return id;
}
type Loc = { label: string; lat: number; lng: number };
type Step = "mood" | "location" | "when" | "intent" | "craving" | "company" | "spend" | "distance" | "results" | "refine" | "satisfaction" | "sorted" | "paywall" | "curating" | "stuck";
const QUESTIONS = { mood: "So, what's the scene?", location: "Where are we starting?", when: "When are we escaping?", intent: "Food or something to do?", craving: "What are we craving?", company: "Who's in on this?", spend: "How much damage?", distance: "How far are we taking this scene?" };
const SPEND = ["Save me money", "Reasonable spend", "I'm willing to spend", "Treat me today"];
const REFINEMENTS = ["Make it cheaper", "Find something closer", "Make it more adventurous", "Keep it relaxed", "Change the type of activity", "Find something more suitable for my mood", "Give me completely different options"];
const STEPS: Step[] = ["mood", "location", "when", "intent", "craving", "company", "spend", "distance"];
const UPI_LINK = "upi://pay?pa=aash9tavi20@oksbi&pn=SceneKyaHai&am=50&cu=INR&tn=SceneKyaHai%20curation";

function Home() {
  const reactFn = useServerFn(react), locateFn = useServerFn(locate), curateFn = useServerFn(curate), refineFn = useServerFn(refineBrief);
  const [step, setStep] = useState<Step>("mood"), [brief, setBrief] = useState<DraftBrief>({ ...EMPTY_BRIEF }), [loc, setLoc] = useState<Loc | null>(null);
  const [address, setAddress] = useState(""), [busy, setBusy] = useState(false), [reply, setReply] = useState("No grand plans. Just a good scene."), [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]), [plans, setPlans] = useState<Plan[]>([]), [seen, setSeen] = useState<string[]>([]), [feedback, setFeedback] = useState(""), [selected, setSelected] = useState<string | null>(null), [pendingRefine, setPendingRefine] = useState(false);
  const questionStep = STEPS.includes(step), progress = STEPS.indexOf(step);
  function go(next: Step) { setError(""); setStep(next); }
  function back() {
    let i = STEPS.indexOf(step) - 1;
    if (STEPS[i] === "craving" && brief.intent === "activity") i--;
    if (i >= 0) go(STEPS[i] ?? "mood");
  }
  async function reaction(text: string) {
    try {
      const r = await reactFn({ data: { step, text, history: history.slice(-20) } });
      setReply(r.reply); setHistory((h) => [...h, `U: ${text.slice(0, 280)}`, `A: ${r.reply.slice(0, 280)}`].slice(-20));
      return r;
    } catch { setReply("Fair. Keep going."); return null; }
  }
  async function findLocation(current?: { lat: number; lng: number }) {
    setBusy(true); setError("");
    try {
      const r = await locateFn({ data: current ?? { address: address.trim() } });
      if (!r.ok) { setError("Couldn't place that in India. Try an area and city."); return; }
      setLoc({ label: r.label, lat: r.lat, lng: r.lng }); setAddress(r.label); setReply("Cool. Now we've got a starting point."); go("when");
    } catch { setError("Location took a detour. Try again."); }
    finally { setBusy(false); }
  }
  function useLocation() {
    if (!navigator.geolocation) { setError("Type your area instead."); return; }
    setBusy(true); setError("");
    navigator.geolocation.getCurrentPosition((p) => { void findLocation({ lat: Math.round(p.coords.latitude * 100) / 100, lng: Math.round(p.coords.longitude * 100) / 100 }); }, () => { setBusy(false); setError("No worries. Type your area instead."); }, { timeout: 10000, maximumAge: 600000 });
  }
  async function next() {
    if (busy) return;
    if (step === "location") { if (loc && address === loc.label) go("when"); else await findLocation(); return; }
    if (step === "distance") { if (!brief.distance || !loc) return; await run({ ...brief, distance: brief.distance }, loc); return; }
    setBusy(true);
    if (step === "mood" || step === "craving") {
      const r = await reaction(step === "mood" ? brief.mood : brief.craving || "No particular craving");
      if (r && step === "mood") setBrief((b) => ({ ...b, company: b.company || r.company || "" }));
    } else setReply(step === "spend" && brief.spend === "Save me money" ? "Respect. We're going cheap." : "Okay. Getting somewhere.");
    setBusy(false);
    const i = STEPS.indexOf(step);
    go(step === "intent" && brief.intent === "activity" ? "company" : STEPS[i + 1] ?? "distance");
  }
  async function run(b: Brief, l: Loc, refinement = false, paid = false) {
    setBrief(b); setPendingRefine(refinement); setBusy(true); go("curating");
    try {
      const r = await curateFn({ data: { deviceId: deviceId(), brief: b, lat: l.lat, lng: l.lng, label: l.label, previous: refinement ? seen : [], paid } });
      if (r.status === "ok") { setPlans(r.plans); setSeen((s) => [...s, ...r.plans.map((p) => p.name)].slice(-9)); setSelected(null); setReply(r.line); setFeedback(""); go("results"); }
      else if (r.status === "payment_required") go("paywall");
      else { setError(r.message); setStep("stuck"); }
    } catch { setError("The scene hit a snag. Your curation hasn't counted. Try again."); setStep("stuck"); }
    finally { setBusy(false); }
  }
  async function refine() {
    if (!feedback.trim() || !brief.distance || !loc || busy) return;
    setBusy(true); setError("");
    try {
      const r = await refineFn({ data: { brief: { ...brief, distance: brief.distance }, feedback: feedback.trim() } });
      setReply(r.reply); await run(r.brief, loc, true);
    } catch { setError("Couldn't change the scene. Try again."); }
    finally { setBusy(false); }
  }
  function sorted() {
    if (!selected) { setError("Pick the plan you're taking first."); return; }
    if (feedback.trim()) { go("refine"); return; }
    setReply("Sorted. Go make it happen."); go("sorted");
  }
  const canNext = step === "mood" ? !!brief.mood.trim() : step === "location" ? address.trim().length >= 2 : step === "intent" ? !!brief.intent : step === "spend" ? !!brief.spend : step === "distance" ? !!brief.distance : true;
  const activePlan = plans.find((p) => p.label === selected);
  return <div className="min-h-dvh bg-background">
    <header className="scene-header">
      <Button variant="ghost" className="px-0 text-xl font-extrabold text-primary hover:bg-transparent" onClick={() => go("mood")}>SceneKyaHai<span className="text-secondary-foreground">.</span></Button>
      <div className="flex items-center gap-6"><span className="hidden text-xs text-muted-foreground sm:block">A LITTLE LESS THINKING. A LITTLE MORE LIVING.</span><span className="font-sign text-2xl text-primary">Ft. Aashray</span></div>
    </header>
    <main className={`scene-main ${questionStep ? "question-main" : ""}`}>
      {questionStep ? <>
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />YOUR SCENE, YOUR CALL</span><span>{progress + 1} / {brief.intent === "activity" ? 7 : 8}</span></div>
        <div className="mt-3 flex gap-1.5" aria-label="Curation progress">{STEPS.filter((s) => s !== "craving" || brief.intent !== "activity").map((s) => <span key={s} className={`h-1 flex-1 rounded-full ${STEPS.indexOf(s) <= progress ? "bg-primary" : "bg-border"}`} />)}</div>
        <section key={step} className="step-content pop-in">
          {step === "mood" && <><p className="mb-5 text-sm font-medium text-primary">Here to curate your Taqdeer &amp; your Bad-Decisions</p><h1 className="scene-heading">{QUESTIONS.mood}</h1><p className="mt-4 text-muted-foreground">Bored? Confused? Had a day? Spill it out.</p></>}
          {step !== "mood" && <><p className="mb-4 font-sign text-2xl text-primary">{reply}</p><h1 className="scene-heading">{QUESTIONS[step as keyof typeof QUESTIONS]}</h1></>}
          {step === "mood" && <><textarea aria-label="Your mood" className="scene-input mt-6 min-h-28" maxLength={500} value={brief.mood} onChange={(e) => setBrief({ ...brief, mood: e.target.value })} placeholder="Spill it out." /><div className="mt-3 flex flex-wrap gap-2">{["Bored out of my mind", "Had a rough day", "Feeling spontaneous"].map((m, i) => { const Icon = [Coffee, Heart, Compass][i] ?? Compass; return <Button key={m} variant="secondary" className="h-auto whitespace-normal px-3 py-2 text-xs" onClick={() => setBrief({ ...brief, mood: m })}><Icon />{m}</Button>; })}</div></>}
          {step === "location" && <><p className="mt-4 text-muted-foreground">An area and city. India only, for now.</p><Button variant="secondary" className="mt-6 h-12 w-full" disabled={busy} onClick={useLocation}><Navigation />Use my current location</Button><div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />OR<span className="h-px flex-1 bg-border" /></div><input aria-label="Starting location" className="scene-input" placeholder="Area, city…" value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} />{loc && <p className="mt-3 flex items-center gap-2 text-sm text-primary"><MapPin size={15} />{loc.label}</p>}</>}
          {step === "when" && <><p className="mt-4 text-muted-foreground">Later slots mean the next occurrence. We'll check the hours.</p><Choices options={["Now", "Morning", "Afternoon", "Evening", "Night"]} value={brief.when} onSelect={(when) => setBrief({ ...brief, when })} /></>}
          {step === "intent" && <Choices options={["Food", "Something to do", "Surprise me"]} value={brief.intent === "food" ? "Food" : brief.intent === "activity" ? "Something to do" : brief.intent === "either" ? "Surprise me" : ""} onSelect={(v) => setBrief({ ...brief, intent: v === "Food" ? "food" : v === "Something to do" ? "activity" : "either" })} />}
          {step === "craving" && <><p className="mt-4 text-muted-foreground">Spicy, sweet, absolutely not another café. Your call.</p><textarea aria-label="Cuisine and craving" className="scene-input mt-6 min-h-28" placeholder="Something spicy…" value={brief.craving} maxLength={300} onChange={(e) => setBrief({ ...brief, craving: e.target.value })} /><p className="mt-2 text-xs text-muted-foreground">No particular craving? Keep going.</p></>}
          {step === "company" && <><p className="mt-4 text-muted-foreground">Optional. No need to make it a whole thing.</p><Choices options={["Alone", "Friends", "Date", "Family", "Celebration"]} value={brief.company} onSelect={(company) => setBrief({ ...brief, company: brief.company === company ? "" : company })} /><input aria-label="Occasion" className="scene-input mt-4" placeholder="Or a reason to get out…" maxLength={60} value={brief.company} onChange={(e) => setBrief({ ...brief, company: e.target.value })} /></>}
          {step === "spend" && <Choices options={SPEND} value={brief.spend} onSelect={(spend) => setBrief({ ...brief, spend })} />}
          {step === "distance" && <><p className="mt-3 text-sm leading-relaxed text-muted-foreground">From a quick escape around the corner to a questionable decision in another city. Tell me how far you're willing to go.</p><div className="mt-5 space-y-2" role="group" aria-label="Travel distance">{DISTANCES.map((d) => <Button key={d.value} variant="outline" aria-pressed={brief.distance === d.value} className={`distance-choice ${brief.distance === d.value ? "selected-choice" : ""}`} onClick={() => setBrief({ ...brief, distance: d.value })}><span className="min-w-0 flex-1"><span className="block font-semibold">{d.title}</span><span className="mt-1 block text-xs font-normal leading-snug">{d.text}</span></span><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary">{brief.distance === d.value && <Check size={12} />}</span></Button>)}</div>{brief.distance === "extended" && <><p className="mt-4 text-xs text-muted-foreground">Wild, not international. Across India, with travel that makes sense.</p><Choices options={["Car / cab", "Public transport", "On foot"]} value={brief.transport === "DRIVE" ? "Car / cab" : brief.transport === "TRANSIT" ? "Public transport" : "On foot"} onSelect={(v) => setBrief({ ...brief, transport: v === "On foot" ? "WALK" : v === "Public transport" ? "TRANSIT" : "DRIVE" })} /></>}<p className="mt-3 text-xs text-muted-foreground">{loc?.label} · {brief.spend} · {brief.when}. Nearby limits are straight-line radii.</p></>}
        </section>
        {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
        <div className="question-actions"><Button variant="ghost" disabled={progress === 0 || busy} onClick={back}><ArrowLeft />Back</Button><Button className="h-12 min-w-36" disabled={busy || !canNext} onClick={() => void next()}>{busy ? <Loader2 className="animate-spin" /> : step === "distance" ? <Sparkles /> : null}{busy ? "One second…" : step === "distance" ? "Curate My Scene" : "Continue"}{!busy && step !== "distance" && <ArrowRight />}</Button></div>
        {step === "mood" && <div className="scene-preview"><img src={scenes} alt="A courtyard café, an Udaipur lakeside stroll and a Western Ghats road" width={1536} height={640} /><div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs"><span className="font-semibold text-primary">First one's free. Then ₹50.</span><span className="text-muted-foreground">No subscription. No membership. No nonsense.</span></div></div>}
      </> : <>
        {step === "curating" && <section className="state-screen"><Loader2 className="mx-auto mb-6 animate-spin text-primary" size={30} /><h1 className="scene-heading">Give me a minute.</h1><p className="mt-4 text-muted-foreground">Finding a scene that actually makes sense.</p></section>}
        {step === "paywall" && <section className="mx-auto max-w-md py-8"><p className="font-sign text-2xl text-primary">Your free one's done.</p><h1 className="scene-heading mt-3">This scene's ₹50.</h1><img className="mx-auto my-6 w-52 rounded-md border border-border" src={upiQr.url} alt="Aashray's UPI QR — pay ₹50" /><Button asChild className="h-12 w-full"><a href={UPI_LINK}>Tap to pay ₹50<ArrowRight /></a></Button><p className="my-4 text-xs leading-relaxed text-muted-foreground">Scan with any UPI app. Payments aren't automatically verified; continuing confirms you've paid. Failed curations don't count.</p><Button variant="secondary" className="h-12 w-full" onClick={() => { if (loc && brief.distance) void run({ ...brief, distance: brief.distance }, loc, pendingRefine, true); }}>I've paid — curate</Button><Button variant="ghost" className="mt-4" onClick={() => go("distance")}><ArrowLeft />Change my preferences</Button></section>}
        {step === "stuck" && <section className="state-screen"><h1 className="scene-heading">Not the scene. Yet.</h1><p role="alert" className="mt-5 text-muted-foreground">{error}</p><div className="mt-6 flex justify-center gap-3"><Button variant="outline" onClick={() => go("distance")}>Change preferences</Button><Button onClick={() => { if (brief.distance && loc) void run({ ...brief, distance: brief.distance }, loc, pendingRefine); }}><RotateCcw />Try again</Button></div></section>}
        {(step === "results" || step === "sorted") && <><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-3 font-sign text-2xl text-primary">{reply}</p><h1 className="scene-heading">{step === "sorted" ? "You've got your scene." : "A few ways this could go."}</h1><p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={15} />{loc?.label} · {brief.distance === "extended" ? "Beyond the usual · India" : `Within ${brief.distance} km`}</p></div><Button variant="outline" onClick={() => go("distance")}><SlidersHorizontal />Edit preferences</Button></div><PlanCards plans={step === "sorted" && activePlan ? [activePlan] : plans} selected={selected} onSelect={setSelected} when={brief.when} />{step === "results" && <><section className="result-band"><div><h2 className="text-2xl font-bold">Not quite the scene?</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">Tell me what's missing. We'll fix the scene before you give up and return to your bed.</p></div><Button variant="outline" onClick={() => go("refine")}><SlidersHorizontal />Refine My Scene</Button></section><section className="result-band"><div><h2 className="text-2xl font-bold">So, have we found your scene?</h2><p className="mt-2 text-sm text-muted-foreground">Are we finally leaving the house, or are we going back to the drawing board?</p></div><Button onClick={() => go("satisfaction")}>Let's decide<ArrowRight /></Button></section></>}{step === "sorted" && <section className="result-band"><p className="font-sign text-2xl text-primary">Bed can wait.</p><Button variant="outline" onClick={() => go("refine")}>One more tweak</Button></section>}</>}
        {(step === "refine" || step === "satisfaction") && <section className="mx-auto max-w-2xl py-6"><Button variant="ghost" className="mb-6 pl-0" onClick={() => go("results")}><ArrowLeft />Your options</Button><h1 className="scene-heading">{step === "refine" ? "Not quite the scene?" : "So, have we found your scene?"}</h1><p className="mt-4 text-muted-foreground">{step === "refine" ? "Tell me what's missing. We'll fix the scene before you give up and return to your bed." : "Are we finally leaving the house, or are we going back to the drawing board?"}</p>{step === "refine" && <div className="mt-6 flex flex-wrap gap-2">{REFINEMENTS.map((r) => <Button key={r} variant={feedback.includes(r) ? "secondary" : "outline"} className="h-auto whitespace-normal py-2" onClick={() => setFeedback((f) => f.includes(r) ? f : [f, r].filter(Boolean).join(". "))}>{r}</Button>)}</div>}<textarea aria-label="Scene feedback" className="scene-input mt-6 min-h-32" maxLength={500} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={step === "refine" ? "Something more peaceful, but not another café…" : "Anything else I should know? Be specific. I'm listening."} />{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}{step === "refine" ? <Button className="mt-5 h-12 w-full" disabled={busy || !feedback.trim()} onClick={() => void refine()}>{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}Refine My Scene</Button> : <div className="mt-5 grid gap-3"><label className="text-sm font-medium" htmlFor="chosen-plan">Which scene are you taking?</label><select id="chosen-plan" className="scene-input" value={selected ?? ""} onChange={(e) => setSelected(e.target.value || null)}><option value="">Choose a plan</option>{plans.map((p) => <option key={p.label} value={p.label}>Plan {p.label} · {p.name}</option>)}</select><Button className="h-12" onClick={sorted}><Check />We're sorted.</Button><Button variant="secondary" className="h-12" onClick={() => go("refine")}>Almost. One more tweak.</Button><Button variant="outline" className="h-12" onClick={() => { if (feedback.trim()) setBrief((b) => ({ ...b, notes: [...b.notes, feedback.trim()].slice(-12) })); go("distance"); }}>Absolutely not. Start again.<RotateCcw /></Button>{feedback.trim() && <Button variant="link" disabled={busy} onClick={() => void refine()}>Use my feedback &amp; refine</Button>}</div>}</section>}
      </>}
    </main>
    <footer className="scene-footer"><span>SceneKyaHai. A scene, not an itinerary.</span><span>INDIA, FOR NOW. <span className="text-primary">YOUR CALL, ALWAYS.</span></span></footer>
  </div>;
}
function Choices({ options, value, onSelect }: { options: string[]; value: string; onSelect: (v: string) => void }) {
  return <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">{options.map((v) => <Button key={v} aria-pressed={v === value} variant="outline" onClick={() => onSelect(v)} className={`h-auto min-h-14 justify-between whitespace-normal px-4 py-3 text-left ${value === v ? "selected-choice" : ""}`}>{v}{value === v && <Check />}</Button>)}</div>;
}
