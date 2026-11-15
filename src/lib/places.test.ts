import { describe, expect, it } from "vitest";
import { parseGeocode } from "./places.server";

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
