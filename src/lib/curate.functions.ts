import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { curationPrice } from "./curation-policy";

import { BriefSchema as Brief, Distance, mergeRefinement, withinDistance } from "./scene";
export type { Brief } from "./scene";

// Short Aashray reaction + anything we can infer from what the user just said.
export const react = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        step: z.string().max(30),
        text: z.string().min(1).max(500),
        history: z.array(z.string().max(300)).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { aiJson, AASHRAY_VOICE } = await import("./ai.server");
    try {
      return await aiJson<{
        reply: string;
        intent: "food" | "activity" | "either" | null;
        spend: string | null;
        company: string | null;
        wants_change: boolean;
      }>({
        system:
          AASHRAY_VOICE +
          `\nYou're reacting to the user's latest message. The conversation step is "${data.step}".
Return a very short reply (1-6 words usually). Do NOT ask a question; the app asks the next question itself.
Also infer: intent (food/activity/either or null if unclear), spend preference (one of "Save me money","Reasonable spend","I'm willing to spend","Treat me today" or null),
company (Alone/Friends/Date/Family/Celebration or null), and wants_change (true if they're asking to change/refine existing plans).
PROFANITY / ABUSE: if the user swears at you, insults you, or goes out of line, do NOT be cheerful and do NOT give a warning or lecture.
Calmly roast them in one dry, blunt line (max ~10 words), then nudge back on track. E.g. "Wow. Bold. Anyway, where are we?" "Cute. Now answer the question." "Save it for the group chat. Focus."
Casual swearing about their day (e.g. "shit day") is not abuse — just match the energy normally.`,
        input: `Earlier lines: ${data.history.slice(-8).join(" | ") || "none"}\nUser now: ${data.text}`,
        schemaName: "reaction",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["reply", "intent", "spend", "company", "wants_change"],
          properties: {
            reply: { type: "string" },
            intent: { type: ["string", "null"], enum: ["food", "activity", "either", null] },
            spend: { type: ["string", "null"] },
            company: { type: ["string", "null"] },
            wants_change: { type: "boolean" },
          },
        },
      });
    } catch (e) {
      console.error(e);
      return { reply: "Okay.", intent: null, spend: null, company: null, wants_change: false };
    }
  });

export const locate = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .union([
        z.object({ address: z.string().min(2).max(200) }),
        z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
      ])
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { geocode, reverseLabel } = await import("./places.server");
    if ("address" in data) {
      const g = await geocode(data.address);
      if (!g) return { ok: false as const };
      // Round to ~1km so we never hold precise location.
      return { ok: true as const, label: g.label, lat: round(g.loc.lat), lng: round(g.loc.lng) };
    }
    const rounded = { lat: round(data.lat), lng: round(data.lng) };
    const label = await reverseLabel(rounded);
    if (!label) return { ok: false as const };
    return { ok: true as const, label, lat: round(data.lat), lng: round(data.lng) };
  });

function round(n: number) {
  return Math.round(n * 100) / 100;
}

const DeviceId = z.string().regex(/^[a-zA-Z0-9-]{16,64}$/);

async function usedCount(deviceId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("curations")
    .select("id", { count: "exact", head: true })
    .eq("device_id", deviceId);
  return count ?? 0;
}

export const curationStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ deviceId: DeviceId }).parse(d))
  .handler(async ({ data }) => ({ freeAvailable: true, price: curationPrice(await usedCount(data.deviceId)) }));

type Plan = {
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
  address: string;
  nextSteps: string;
  travelMinutes: number | null;
  roadKm: number | null;
  transport: "DRIVE" | "TRANSIT" | "WALK";
};

export const curate = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        deviceId: DeviceId,
        brief: Brief,
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        label: z.string().max(100),
        previous: z.array(z.string().max(120)).max(9).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const successfulCurations = await usedCount(data.deviceId);
    const freeAvailable = successfulCurations === 0;

    const { aiJson, AASHRAY_VOICE } = await import("./ai.server");
    const { searchPlaces, reverseLabel, travelDetails } = await import("./places.server");
    const center = { lat: round(data.lat), lng: round(data.lng) };
    if (!(await reverseLabel(center))) return { status: "empty" as const, message: "India only for now. Pick a starting spot here." };
    const b = data.brief;
    const briefText = `Mood: ${b.mood}\nWants: ${b.intent ?? "unclear"}\nCraving: ${b.craving || "-"}\nWhen: ${b.when || "now"}\nCompany: ${b.company || "-"}\nSpend: ${b.spend || "-"}\nRefinements: ${b.notes.join("; ") || "-"}\nDistance: ${b.distance === "extended" ? "Intercity/interstate within India; consider transport and feasibility, not an arbitrary 60 km cap" : `Hard maximum ${b.distance} km`}\nTransport: ${b.transport}\nArea: ${data.label}, India\nAvoid repeating: ${data.previous.join(", ") || "-"}`;

    let queries: { a: string; b: string; c: string };
    try {
      queries = await aiJson({
        system:
          "Turn this person's brief into three Google Places text search queries. A = most direct interpretation, B = a different interpretation, C = something unexpected (can be an activity, park, bookstore, gaming, art, etc). Respect cuisine, budget, mood and feedback. All venues MUST be in India. For nearby choices include the area in each query. For extended travel choose feasible Indian destination cities based on starting area, transport, available time and budget, and include their names instead. Do not default every option to a restaurant. Short queries.",
        input: briefText,
        schemaName: "queries",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["a", "b", "c"],
          properties: { a: { type: "string" }, b: { type: "string" }, c: { type: "string" } },
        },
      });
    } catch (e) {
      console.error(e);
      return { status: "failed" as const, message: "Brain froze. Try again." };
    }

    const barrier = b.distance === "extended" ? null : Number(b.distance);
    const searches = await Promise.allSettled([queries.a, queries.b, queries.c].map((q) => searchPlaces(q, center, barrier, b.when || "Now")));
    let pool = searches.map((result) => {
      if (result.status === "fulfilled") return result.value;
      console.error("curation place search failed", result.reason);
      return [];
    });
    pool = pool.map((list) => list.filter((p) => !data.previous.includes(p.name) && withinDistance(p.distanceKm, b.distance)));
    if (pool.every((l) => l.length === 0)) {
      return { status: "empty" as const, message: "Nothing useful within your limits. Change the scene?" };
    }

    const candidates = pool.map((list, i) =>
      list.slice(0, 8).map((p, j) => ({
        key: `${"ABC"[i]}${j}`,
        name: p.name,
        type: p.primaryType ?? p.types[0],
        rating: p.rating,
        reviews: p.ratingCount,
        price: p.priceLevel,
        openAtRequestedTime: p.openAtTime,
        address: p.address,
        km: p.distanceKm,
        about: p.summary,
      })),
    );

    let picks: { plans: { key: string; category: string; spend: string; description: string; why: string }[]; line: string };
    try {
      picks = await aiJson({
        system:
          AASHRAY_VOICE +
          `\nPick exactly one venue per plan. Plan A from A* keys, Plan B from B*, Plan C from C*. Prioritise mood fit > experience fit > practical relevance > distance. Don't just pick the most popular.
Never pick one that is openAtRequestedTime=false. Respect all budget, craving and feedback constraints. Unknown hours must be described as unverified, never claimed open. Extended excursions must fit available time and transport; include transport costs in approximate spend. Never invent bookings, events or prices as verified facts. For each: category (2-3 words), spend (approximate in ₹ for one person, e.g. "₹400–600"), description (max 12 words, plain), why (max 8 words, extremely human, e.g. "Quiet enough." "Good food. Low effort.").
Also "line": what you say when showing them, 1-4 words ("This works." "Okay. Options.").`,
        input: `${briefText}\n\nCandidates:\n${JSON.stringify(candidates)}`,
        schemaName: "picks",
        effort: "medium",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["plans", "line"],
          properties: {
            line: { type: "string" },
            plans: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["key", "category", "spend", "description", "why"],
                properties: {
                  key: { type: "string" },
                  category: { type: "string" },
                  spend: { type: "string" },
                  description: { type: "string" },
                  why: { type: "string" },
                },
              },
            },
          },
        },
      });
    } catch (e) {
      console.error(e);
      return { status: "failed" as const, message: "Brain froze. Try again." };
    }

    const flat = new Map<string, (typeof pool)[number][number]>(pool.flatMap((l, i) => l.slice(0, 8).map((p, j) => [`${"ABC"[i]}${j}`, p] as const)));
    const plans: Plan[] = [];
    for (const pk of picks.plans) {
      const p = flat.get(pk.key);
      const label = (["A", "B", "C"] as const)[plans.length];
      if (!p || !label || p.openAtTime === false || plans.some((x) => x.name === p.name)) continue;
      plans.push({
        label,
        name: p.name,
        category: pk.category,
        distanceKm: Math.round(p.distanceKm * 10) / 10,
        spend: pk.spend,
        open: p.openAtTime,
        address: p.address,
        nextSteps: "Check hours and availability in Maps before leaving. Book ahead if required.",
        travelMinutes: null,
        roadKm: null,
        transport: b.transport,
        description: pk.description,
        whyItFits: pk.why,
        lat: p.lat,
        lng: p.lng,
        mapsUri: p.mapsUri ?? null,
      });
      if (plans.length === 3) break;
    }
    if (plans.length < 2) {
      return { status: "empty" as const, message: "Not enough good stuff nearby. Want me to try something else?" };
    }

    await Promise.all(plans.map(async (plan) => {
      const travel = await travelDetails(center, plan, b.transport);
      plan.travelMinutes = travel?.minutes ?? null;
      plan.roadKm = travel?.roadKm ?? null;
    }));
    // Successful curation — only now does it count.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("curations").insert({
      device_id: data.deviceId,
      was_free: freeAvailable,
      price_inr: curationPrice(successfulCurations),
      summary: { area: data.label, plans: plans.map((p) => p.name) },
    });
    if (error) console.error("curation insert", error);

    return { status: "ok" as const, line: picks.line, barrier, plans };
  });

export const refineBrief = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ brief: Brief, feedback: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const { aiJson, AASHRAY_VOICE } = await import("./ai.server");
    try {
      const patch = await aiJson<{ reply: string; intent: "food" | "activity" | "either" | null; spend: string | null; company: string | null; distance: z.infer<typeof Distance> | null; craving: string | null; when: string | null }>({
        system: AASHRAY_VOICE + "\nInterpret refinement feedback. Return null for unchanged fields. Preserve hard distance unless user explicitly changes it; closer should tighten it. Spending uses Save me money/Reasonable spend/I'm willing to spend/Treat me today. Reply in 1-6 words. Feedback always remains in notes. Never discard mood, transport, or unrelated preferences.",
        input: JSON.stringify(data), schemaName: "refinement", schema: { type: "object", additionalProperties: false, required: ["reply", "intent", "spend", "company", "distance", "craving", "when"], properties: { reply: { type: "string" }, intent: { type: ["string", "null"], enum: ["food", "activity", "either", null] }, distance: { type: ["string", "null"], enum: ["5", "15", "30", "60", "extended", null] }, spend: { type: ["string", "null"] }, company: { type: ["string", "null"] }, craving: { type: ["string", "null"] }, when: { type: ["string", "null"] } } },
      });
      const updated = Brief.parse(mergeRefinement(data.brief, patch, data.feedback));
      return { brief: updated, reply: patch.reply };
    } catch { return { brief: mergeRefinement(data.brief, {}, data.feedback), reply: "Fair. Changing the scene." }; }
  });
