import { z } from "zod";

export const DISTANCES = [
  { value: "5", title: "Under 5 km", text: "Travel's not my forte, keep it under 5." },
  { value: "15", title: "Under 15 km", text: "Alright, I'll push myself truly OUT, but not more than 15." },
  { value: "30", title: "Under 30 km", text: "Yeah, I'm feeling it, mister. Let's push it till 30." },
  { value: "60", title: "Under 60 km", text: "Go do the unthinkable. SKY is the limit, but mine is under 60 kms." },
  { value: "extended", title: "Beyond the Usual", text: "ATP, I could cross a border for you, LMAO! GO WILD, PLEASE!" },
] as const;
export const Distance = z.enum(["5", "15", "30", "60", "extended"]);
export type Distance = z.infer<typeof Distance>;
export const BriefSchema = z.object({
  mood: z.string().max(500).default(""),
  intent: z.enum(["food", "activity", "either"]).nullable().default(null),
  craving: z.string().max(300).default(""),
  when: z.string().max(40).default(""),
  company: z.string().max(60).default(""),
  spend: z.string().max(60).default(""),
  notes: z.array(z.string().max(300)).max(12).default([]),
  distance: Distance,
  transport: z.enum(["DRIVE", "TRANSIT", "WALK"]).default("DRIVE"),
});
export type Brief = z.infer<typeof BriefSchema>;
export type DraftBrief = Omit<Brief, "distance"> & { distance: Distance | null };
export const EMPTY_BRIEF: DraftBrief = { mood: "", intent: null, craving: "", when: "Now", company: "", spend: "", notes: [], distance: null, transport: "DRIVE" };

export function withinDistance(km: number, distance: Distance) {
  return Number.isFinite(km) && km >= 0 && (distance === "extended" || km <= Number(distance));
}
export function isIndia(components: { types: string[]; shortText?: string; short_name?: string }[]) {
  return components.some((c) => c.types.includes("country") && (c.shortText ?? c.short_name) === "IN");
}
export type OpeningPeriod = { open?: { day: number; hour?: number; minute?: number }; close?: { day: number; hour?: number; minute?: number } };
export function openAt(periods: OpeningPeriod[] | undefined, when: string, now = new Date()): boolean | null {
  if (!periods?.length) return null;
  const ist = new Date(now.getTime() + 330 * 60000);
  const slot = ({ Morning: 10, Afternoon: 14, Evening: 18, Night: 21 } as Record<string, number>)[when];
  let day = ist.getUTCDay();
  if (slot !== undefined && slot < ist.getUTCHours()) day = (day + 1) % 7;
  const target = day * 1440 + (slot ?? ist.getUTCHours()) * 60 + (slot === undefined ? ist.getUTCMinutes() : 0);
  return periods.some(({ open, close }) => {
    if (!open) return false;
    if (!close) return true;
    const start = open.day * 1440 + (open.hour ?? 0) * 60 + (open.minute ?? 0);
    let end = close.day * 1440 + (close.hour ?? 0) * 60 + (close.minute ?? 0);
    if (end <= start) end += 10080;
    return (target >= start && target < end) || (target + 10080 >= start && target + 10080 < end);
  });
}
export function mergeRefinement(original: Brief, patch: { intent?: Brief["intent"]; spend?: string | null; company?: string | null; distance?: Distance | null; craving?: string | null; when?: string | null }, feedback: string): Brief {
  return { ...original, intent: patch.intent ?? original.intent, spend: patch.spend ?? original.spend, company: patch.company ?? original.company, distance: patch.distance ?? original.distance, craving: patch.craving ?? original.craving, when: patch.when ?? original.when, notes: [...original.notes, feedback].slice(-12) };
}