import { useEffect, useRef, useState } from "react";
import { ArrowRight, Volume2, VolumeX, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import coverArt from "@/assets/scene-cover.jpg";

export type StormSound = { mute: (muted: boolean) => void; stop: () => void };
// Called by the confirmation click so browsers permit sound without autoplay.
export function startStormSound(): StormSound | null {
  try {
    const context = new AudioContext();
    void context.resume();
    const master = context.createGain();
    master.gain.value = 0.32;
    master.connect(context.destination);
    const buffer = context.createBuffer(1, context.sampleRate * 9, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let rumble = 0;
    for (let i = 0; i < samples.length; i++) {
      rumble = (rumble + (Math.random() * 2 - 1) * 0.045) / 1.045;
      const t = i / context.sampleRate;
      const envelope = Math.min(t * 5, 1) * Math.exp(-t / 2.4);
      samples[i] = rumble * 6 * envelope + (Math.random() * 2 - 1) * 0.045 * Math.min(t, 1) * Math.max(0, 1 - t / 9);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(master);
    source.start();
    let stopped = false;
    return { mute: (muted) => { if (!stopped) master.gain.setTargetAtTime(muted ? 0 : 0.32, context.currentTime, 0.08); }, stop: () => { if (stopped) return; stopped = true; void context.close().catch(() => {}); } };
  } catch { return null; }
}

export function StormFinale({ name, sound, onClose }: { name: string; sound: StormSound | null; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const strikeRef = useRef<(x: number, y: number) => void>(() => {});
  const [muted, setMuted] = useState(false);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
    const before = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      cleanupTimer.current = setTimeout(() => sound?.stop(), 0);
      document.body.style.overflow = overflow;
      if (before instanceof HTMLElement) before.focus();
    };
  }, [sound]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tokens = getComputedStyle(canvas);
    const rainColor = tokens.getPropertyValue("--secondary").trim();
    const boltColor = tokens.getPropertyValue("--coral").trim();
    let width = innerWidth, height = innerHeight, frame = 0;
    let bolt: { x: number; y: number; born: number } | null = { x: width * .72, y: height * .4, born: performance.now() };
    let lastStrike = 0;
    const resize = () => {
      width = innerWidth; height = innerHeight;
      const ratio = Math.min(devicePixelRatio, 2);
      canvas.width = width * ratio; canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize(); window.addEventListener("resize", resize);
    strikeRef.current = (x, y) => {
      if (performance.now() - lastStrike < 1200) return;
      lastStrike = performance.now(); bolt = { x, y, born: performance.now() };
    };
    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = rainColor; ctx.lineWidth = 1; ctx.globalAlpha = .3;
      for (let i = 0; i < 100; i++) {
        const x = ((i * 137.5) % width) - 35;
        const y = reduced ? (i * 97) % height : ((now * (.16 + (i % 4) * .02) + i * 97) % (height + 100)) - 50;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 12, y + 36); ctx.stroke();
      }
      if (bolt && now - bolt.born < (reduced ? 5000 : 1800)) {
        ctx.globalAlpha = reduced ? .8 : Math.max(0, 1 - (now - bolt.born) / 1800);
        ctx.strokeStyle = boltColor; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(bolt.x - 70, 0);
        for (let i = 1; i <= 8; i++) ctx.lineTo(bolt.x + (i % 2 ? 28 : -28), bolt.y * i / 8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (!reduced) frame = requestAnimationFrame(draw);
    };
    draw(performance.now());
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, []);
  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Scene locked in" tabIndex={-1} className="storm-finale" onPointerDown={(e) => strikeRef.current(e.clientX, e.clientY)} onKeyDown={(e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Tab") {
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button");
      const first = buttons?.[0], last = buttons?.[buttons.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}>
    <img src={coverArt} alt="" className="storm-art" width={1536} height={1024} />
    <canvas ref={canvasRef} className="storm-canvas" aria-hidden="true" />
    <div className="storm-top"><span className="font-mono">SCENEKYAHAI / THE DECISION</span><div className="flex gap-2">
      <Button variant="ghost" size="icon" aria-label={muted ? "Unmute storm" : "Mute storm"} title={muted ? "Unmute storm" : "Mute storm"} onClick={() => { sound?.mute(!muted); setMuted(!muted); }}>{muted ? <VolumeX /> : <Volume2 />}</Button>
      <Button variant="ghost" size="icon" aria-label="Close storm" title="Close storm" onClick={onClose}><X /></Button>
    </div></div>
    <div className="storm-copy"><p className="font-mono storm-eyebrow">PLAN LOCKED. BED REJECTED.</p><h1>Consider it<br /><span>decided.</span></h1><p className="storm-plan">{name}</p><p className="font-sign storm-sign">Your plot twist has arrived.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button className="storm-continue h-12" onClick={onClose}>Your scene<ArrowRight /></Button><Button variant="outline" className="storm-strike h-12" onClick={() => strikeRef.current(innerWidth * .75, innerHeight * .6)}><Zap />One more thunderbolt</Button></div></div>
    <span className="storm-bottom font-mono">FT. AASHRAY / GO MAKE IT HAPPEN.</span>
  </div>;
}