import { describe, expect, it } from "vitest";
import { BriefSchema, EMPTY_BRIEF, isIndia, mergeRefinement, openAt, withinDistance } from "./scene";

describe("distance limits", () => {
  it("requires a distance before curation", () => { expect(BriefSchema.safeParse(EMPTY_BRIEF).success).toBe(false); });
  it("caps option A at 5 km", () => { expect(withinDistance(5, "5")).toBe(true); expect(withinDistance(5.001, "5")).toBe(false); });
  it("caps option B at 15 km", () => { expect(withinDistance(15, "15")).toBe(true); expect(withinDistance(15.001, "15")).toBe(false); });
  it("caps option C at 30 km", () => { expect(withinDistance(30, "30")).toBe(true); expect(withinDistance(30.001, "30")).toBe(false); });
  it("caps option D at 60 km", () => { expect(withinDistance(60, "60")).toBe(true); expect(withinDistance(60.001, "60")).toBe(false); });
  it("does not arbitrarily cap extended trips at 60 km", () => { expect(withinDistance(480, "extended")).toBe(true); });
});
it("accepts verified India only and rejects foreign or unknown countries", () => {
  expect(isIndia([{ types: ["country"], shortText: "IN" }])).toBe(true);
  expect(isIndia([{ types: ["country"], short_name: "NP" }])).toBe(false);
  expect(isIndia([])).toBe(false);
});
it("handles missing address component types without losing the India boundary", () => {
  expect(isIndia([{ shortText: "560038" }, { types: ["country"], shortText: "IN" }])).toBe(true);
  expect(isIndia([{ shortText: "IN" }])).toBe(false);
  expect(isIndia([{ shortText: "560038" }, { types: ["country"], shortText: "NP" }])).toBe(false);
});
it("preserves unrelated preferences when refining", () => {
  const original = BriefSchema.parse({ ...EMPTY_BRIEF, distance: "15", mood: "Sad day", craving: "Spicy", company: "Alone", spend: "Treat me today" });
  const updated = mergeRefinement(original, { spend: "Save me money" }, "Make it cheaper");
  expect(updated.spend).toBe("Save me money"); expect(updated.mood).toBe("Sad day"); expect(updated.craving).toBe("Spicy"); expect(updated.company).toBe("Alone"); expect(updated.distance).toBe("15"); expect(updated.notes).toEqual(["Make it cheaper"]);
});
it("never treats unknown hours as verified open", () => { expect(openAt(undefined, "Evening")).toBeNull(); });
it("checks requested opening time, not just open now", () => {
  const periods = [{ open: { day: 6, hour: 9 }, close: { day: 6, hour: 17 } }];
  expect(openAt(periods, "Afternoon", new Date("2026-10-17T06:00:00Z"))).toBe(true);
  expect(openAt(periods, "Evening", new Date("2026-10-17T06:00:00Z"))).toBe(false);
});