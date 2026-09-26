import { useState } from "react";

export type Plan = {
  label: "A" | "B" | "C";
  name: string;
  category: string;
  distanceKm: number;
  spend: string;
  open: boolean | null;
  description: string;
  whyItFits: string;
  lat: number;
  lng: number;
  mapsUri: string | null;
};

const tilt = ["-rotate-[0.6deg]", "rotate-[0.4deg]", "-rotate-[0.2deg]"];

function directions(p: Plan) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.name)}&destination_place_id=&travelmode=driving&query=${p.lat},${p.lng}`;
}

export function PlanCards({ plans }: { plans: Plan[] }) {
  const [view, setView] = useState<"cards" | "map">("cards");
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as string | undefined;
  const mapUrl =
    key &&
    `https://maps.googleapis.com/maps/api/staticmap?size=640x520&scale=2&style=feature:poi|visibility:off&${plans
      .map((p) => `markers=color:0x1a1a1a|label:${p.label}|${p.lat},${p.lng}`)
      .join("&")}&key=${key}`;

  return (
    <div className="pop-in space-y-4">
      <div className="flex gap-1 font-mono text-xs">
        {(["cards", "map"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`border-2 border-foreground px-3 py-1 uppercase ${view === v ? "bg-primary text-primary-foreground" : ""}`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "map" && mapUrl ? (
        <div className="border-2 border-foreground">
          <img src={mapUrl} alt="Your three plans on a map" className="w-full" />
          <div className="divide-y-2 divide-foreground border-t-2 border-foreground">
            {plans.map((p) => (
              <a key={p.label} href={p.mapsUri ?? directions(p)} target="_blank" rel="noreferrer" className="flex justify-between px-3 py-2 text-sm">
                <span><b>{p.label}</b> · {p.name}</span>
                <span className="font-mono">{p.distanceKm} km →</span>
              </a>
            ))}
          </div>
        </div>
      ) : (
        plans.map((p, i) => (
          <article key={p.label + p.name} className={`border-2 border-foreground bg-card p-4 shadow-[5px_5px_0_0_var(--color-foreground)] ${tilt[i]}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-widest">Plan {p.label}</span>
              <span className={`font-mono text-xs ${p.open === false ? "text-destructive" : ""}`}>
                {p.open === true ? "● open" : p.open === false ? "closed" : "check hours"}
              </span>
            </div>
            <h3 className="mt-2 text-2xl font-extrabold leading-tight">{p.name}</h3>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {p.category} · {p.distanceKm} km · {p.spend}
            </p>
            <p className="mt-3 text-sm">{p.description}</p>
            <p className="mt-3 font-sign text-2xl leading-none text-accent">{p.whyItFits}</p>
            <a
              href={p.mapsUri ?? directions(p)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Take me there →
            </a>
          </article>
        ))
      )}
    </div>
  );
}
