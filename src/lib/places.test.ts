import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGeocode, searchPlaces } from "./places.server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const indiaResult = {
  status: "OK",
  results: [{
    geometry: { location: { lat: 12.9784, lng: 77.6408 } },
    formatted_address: "Indiranagar, Bengaluru, Karnataka, India",
    address_components: [
      { long_name: "Indiranagar", types: ["sublocality"] },
      { long_name: "India", short_name: "IN", types: ["country"] },
    ],
  }],
};

describe("location lookup results", () => {
  it("returns real coordinates and a locality for a valid Indian result", () => {
    expect(parseGeocode(indiaResult, "fallback")).toEqual({
      ok: true,
      loc: { lat: 12.9784, lng: 77.6408 },
      label: "Indiranagar",
    });
  });

  it("distinguishes an unknown place from a provider failure", () => {
    expect(parseGeocode({ status: "ZERO_RESULTS", results: [] }, "fallback")).toEqual({ ok: false, reason: "not_found" });
    expect(parseGeocode({ status: "REQUEST_DENIED", error_message: " denied " }, "fallback")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("rejects Google's generic country fallback instead of using a dummy India location", () => {
    expect(parseGeocode({
      status: "OK",
      results: [{
        geometry: { location: { lat: 20.5937, lng: 78.9629 } },
        formatted_address: "India",
        types: ["country", "political"],
        address_components: [{ long_name: "India", short_name: "IN", types: ["country", "political"] }],
      }],
    }, "fallback")).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects an explicitly foreign result without throwing on incomplete components", () => {
    expect(parseGeocode({
      status: "OK",
      results: [{ geometry: { location: { lat: 27.7, lng: 85.3 } }, address_components: [{ short_name: "NP", types: ["country"] }] }],
    }, "fallback")).toEqual({ ok: false, reason: "outside_india" });
    expect(parseGeocode({ status: "OK", results: [{ address_components: [{ long_name: "Unknown" }] }] }, "fallback")).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("place search failures", () => {
  it("throws a provider failure instead of pretending the area has no venues", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-gateway-key");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-connection-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("temporarily unavailable", { status: 503 })));
    await expect(searchPlaces("cafés in Indiranagar", { lat: 12.98, lng: 77.64 }, 5, "Now")).rejects.toThrow("Places search failed (503)");
  });
});
