import { describe, expect, it } from "vitest";
import { canRequestStaticMap } from "./PlanCards";

describe("static map request eligibility", () => {
  it("allows local development and authorized Lovable HTTPS origins", () => {
    expect(canRequestStaticMap(true, "localhost", "http:")).toBe(true);
    expect(canRequestStaticMap(true, "scenekyahai.lovable.app", "https:")).toBe(true);
  });

  it("blocks credential-bearing preview hosts instead of exposing them to Google", () => {
    expect(canRequestStaticMap(true, "project-devserver-secret.lovableproject.com", "https:")).toBe(false);
  });

  it("blocks unauthorized domains and pre-hydration requests", () => {
    expect(canRequestStaticMap(true, "example.com", "https:")).toBe(false);
    expect(canRequestStaticMap(false, "scenekyahai.lovable.app", "https:")).toBe(false);
  });
});
