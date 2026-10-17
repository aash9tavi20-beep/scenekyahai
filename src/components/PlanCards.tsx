import { useState } from "react";
import { ArrowUpRight, Check, Clock, MapPin, LayoutGrid, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
export type Plan = {
  label: "A" | "B" | "C"; name: string; category: string; distanceKm: number; spend: string; open: boolean | null;
  description: string; whyItFits: string; lat: number; lng: number; mapsUri: string | null;
  address: string; nextSteps: string; travelMinutes: number | null; roadKm: number | null; transport: "DRIVE" | "TRANSIT" | "WALK";
};
function directions(p: Plan) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=${p.transport === "TRANSIT" ? "transit" : p.transport === "WALK" ? "walking" : "driving"}`;
}
export function PlanCards({ plans, selected, onSelect, when }: { plans: Plan[]; selected?: string | null; onSelect?: (label: string) => void; when?: string }) {
  const [view, setView] = useState<"cards" | "map">("cards");
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as string | undefined;
  const mapUrl = key && `https://maps.googleapis.com/maps/api/staticmap?size=640x400&scale=2&${plans.map((p) => `markers=label:${p.label}|${p.lat},${p.lng}`).join("&")}&key=${key}`;
  return <div className="pop-in">
    <div className="mb-5 flex gap-2"><Button variant={view === "cards" ? "default" : "outline"} onClick={() => setView("cards")}><LayoutGrid />Scenes</Button><Button variant={view === "map" ? "default" : "outline"} onClick={() => setView("map")}><Map />Map</Button></div>
    {view === "map" && mapUrl ? <div className="mb-6 overflow-hidden rounded-md border border-border"><img src={mapUrl} crossOrigin="anonymous" referrerPolicy="strict-origin-when-cross-origin" alt="Your scenes on a map" className="w-full" />{plans.map((p) => <Button key={p.label} asChild variant="ghost" className="h-auto w-full justify-between rounded-none border-t border-border p-4"><a href={directions(p)} target="_blank" rel="noreferrer"><span>{p.label} · {p.name}</span><span>{p.distanceKm} km<ArrowUpRight className="ml-2 inline" /></span></a></Button>)}</div> : view === "map" ? <p className="mb-6 text-sm text-muted-foreground">Map isn't available here. Each scene still has directions.</p> : null}
    <div className={`grid items-stretch gap-5 ${plans.length > 1 ? "lg:grid-cols-3" : "max-w-xl"}`}>{plans.map((p) => <article key={p.label + p.name} className={`flex flex-col rounded-lg border bg-card p-5 ${selected === p.label ? "border-primary ring-1 ring-primary" : "border-border"}`}>
      <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase text-primary">Plan {p.label}</span><span className="text-xs text-muted-foreground">{p.open === true ? when === "Now" ? "Open now" : `Open for ${when?.toLowerCase() ?? "your slot"}` : "Check hours"}</span></div>
      <p className="mt-5 text-xs uppercase text-muted-foreground">{p.category}</p><h3 className="mt-2 text-2xl font-bold leading-tight">{p.name}</h3><p className="mt-3 text-sm leading-relaxed">{p.description}</p>
      <p className="my-5 font-sign text-2xl text-primary">{p.whyItFits}</p>
      <div className="space-y-3 border-y border-border py-4 text-sm"><p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-primary" /><span>{p.address}<span className="mt-1 block text-xs text-muted-foreground">{p.distanceKm} km away · {p.distanceKm > 60 ? "Longer excursion" : "Straight-line distance"}</span></span></p>{p.travelMinutes !== null ? <p className="flex items-center gap-2"><Clock size={16} className="text-primary" />About {p.travelMinutes >= 60 ? `${Math.floor(p.travelMinutes / 60)}h ${p.travelMinutes % 60}m` : `${p.travelMinutes} min`} · {p.transport === "TRANSIT" ? "public transport" : p.transport === "WALK" ? "walking" : "driving"}{p.roadKm !== null ? ` · ${p.roadKm} km route` : ""}</p> : <p className="text-xs text-muted-foreground">Travel time unavailable. Check your route before leaving.</p>}<p className="font-semibold">{p.spend}<span className="ml-2 text-xs font-normal text-muted-foreground">approx. / person</span></p></div>
      <p className="mb-5 mt-4 text-xs leading-relaxed text-muted-foreground">{p.nextSteps}</p><div className="mt-auto space-y-2"><Button asChild className="h-11 w-full"><a href={directions(p)} target="_blank" rel="noreferrer">Make it happen<ArrowUpRight /></a></Button>{onSelect && <Button variant={selected === p.label ? "secondary" : "outline"} className="w-full" aria-pressed={selected === p.label} onClick={() => onSelect(p.label)}>{selected === p.label ? <Check /> : null}{selected === p.label ? "This is my scene" : "Choose this scene"}</Button>}</div>
    </article>)}</div>
  </div>;
}
