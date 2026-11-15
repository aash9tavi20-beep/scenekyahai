import { isIndia, openAt, type OpeningPeriod } from "./scene";
const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function headers(extra: Record<string, string> = {}) {
  const lk = process.env["LOVABLE_API_KEY"];
  const gk = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lk || !gk) throw new Error("Places not configured");
  return {
    Authorization: `Bearer ${lk}`,
    "X-Connection-Api-Key": gk,
    "Content-Type": "application/json",
    ...extra,
  };
}

export type LatLng = { lat: number; lng: number };
export type LocationFailure = "not_found" | "outside_india" | "unavailable";
export type LocationLookup =
  | { ok: true; loc: LatLng; label: string }
  | { ok: false; reason: LocationFailure };

type GeocodePayload = {
  status?: string;
  error_message?: string;
  results?: {
    geometry?: { location?: LatLng };
    formatted_address?: string;
    types?: string[];
    address_components?: { long_name?: string; short_name?: string; shortText?: string; types?: string[] }[];
  }[];
};

export function parseGeocode(payload: GeocodePayload, fallbackLabel: string): LocationLookup {
  if (payload.status === "ZERO_RESULTS") return { ok: false, reason: "not_found" };
  if (payload.status && payload.status !== "OK") return { ok: false, reason: "unavailable" };
  const first = payload.results?.[0];
  if (!first) return { ok: false, reason: "not_found" };
  if (first.types?.length && first.types.every((type) => type === "country" || type === "political")) return { ok: false, reason: "not_found" };
  const components = first.address_components ?? [];
  const country = components.find((component) => component.types?.includes("country"));
  if (country && (country.short_name ?? country.shortText) !== "IN") return { ok: false, reason: "outside_india" };
  if (!isIndia(components)) return { ok: false, reason: "not_found" };
  const location = first.geometry?.location;
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return { ok: false, reason: "not_found" };
  const label =
    components.find((component) => component.types?.includes("sublocality"))?.long_name ??
    components.find((component) => component.types?.includes("locality"))?.long_name ??
    first.formatted_address?.split(",")[0] ??
    fallbackLabel;
  return { ok: true, loc: location, label };
}

async function lookupLocation(query: string, fallbackLabel: string): Promise<LocationLookup> {
  try {
    const response = await fetch(`${GATEWAY}/maps/api/geocode/json?${query}`, { headers: headers() });
    if (!response.ok) {
      const body = await response.text();
      if (response.status === 403) console.error("Google Maps geocoding denied; check the server key restrictions", body);
      else console.error("Google Maps geocoding request failed", response.status, body);
      return { ok: false, reason: "unavailable" };
    }
    const payload = (await response.json()) as GeocodePayload;
    const result = parseGeocode(payload, fallbackLabel);
    if (!result.ok && result.reason === "unavailable") console.error("Google Maps geocoding provider error", payload.status, payload.error_message);
    return result;
  } catch (error) {
    console.error("Google Maps geocoding request threw", error);
    return { ok: false, reason: "unavailable" };
  }
}

export function geocode(address: string): Promise<LocationLookup> {
  return lookupLocation(`address=${encodeURIComponent(address)}&region=in`, address);
}

export function reverseLocation(loc: LatLng): Promise<LocationLookup> {
  return lookupLocation(`latlng=${loc.lat},${loc.lng}`, "your area");
}

export async function reverseLabel(loc: LatLng): Promise<string | null> {
  const result = await reverseLocation(loc);
  return result.ok ? result.label : null;
}

export type Place = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number | undefined;
  ratingCount?: number | undefined;
  priceLevel?: string | undefined;
  types: string[];
  primaryType?: string | undefined;
  openNow?: boolean | undefined;
  summary?: string | undefined;
  mapsUri?: string | undefined;
  distanceKm: number;
  openAtTime: boolean | null;
};

export function haversine(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export async function searchPlaces(query: string, center: LatLng, radiusKm: number | null, when: string): Promise<Place[]> {
  const r = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
    method: "POST",
    headers: headers({
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.primaryTypeDisplayName,places.currentOpeningHours.openNow,places.regularOpeningHours.periods,places.addressComponents,places.editorialSummary,places.googleMapsUri,places.businessStatus",
    }),
    body: JSON.stringify({
      textQuery: query,
      pageSize: 12,
      openNow: when === "Now" || undefined,
      regionCode: "IN",
      locationBias: radiusKm === null ? undefined : {
        circle: { center: { latitude: center.lat, longitude: center.lng }, radius: Math.min((radiusKm ?? 50) * 1000, 50000) },
      },
    }),
  });
  if (!r.ok) {
    console.error("places", r.status, await r.text());
    return [];
  }
  type Raw = {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    location: { latitude: number; longitude: number };
    rating?: number;
    userRatingCount?: number;
    priceLevel?: string;
    types?: string[];
    primaryTypeDisplayName?: { text: string };
    currentOpeningHours?: { openNow?: boolean };
    editorialSummary?: { text: string };
    googleMapsUri?: string;
    businessStatus?: string;
    addressComponents?: { types: string[]; shortText?: string }[];
    regularOpeningHours?: { periods?: OpeningPeriod[] };
  };
  const j = (await r.json()) as { places?: Raw[] };
  return (j.places ?? [])
    .filter((p) => Number.isFinite(p.location?.latitude) && Number.isFinite(p.location?.longitude))
    .filter((p) => isIndia(p.addressComponents ?? []))
    .filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY" && p.businessStatus !== "CLOSED_TEMPORARILY")
    .map((p) => {
      const loc = { lat: p.location.latitude, lng: p.location.longitude };
      return {
        id: p.id,
        name: p.displayName?.text ?? "Somewhere",
        address: p.formattedAddress ?? "",
        lat: loc.lat,
        lng: loc.lng,
        rating: p.rating,
        ratingCount: p.userRatingCount,
        priceLevel: p.priceLevel,
        types: p.types ?? [],
        primaryType: p.primaryTypeDisplayName?.text,
        openNow: p.currentOpeningHours?.openNow,
        summary: p.editorialSummary?.text,
        mapsUri: p.googleMapsUri,
        distanceKm: haversine(center, loc),
        openAtTime: when === "Now" ? p.currentOpeningHours?.openNow ?? null : openAt(p.regularOpeningHours?.periods, when),
      };
    })
    .filter((p) => (radiusKm === null || p.distanceKm <= radiusKm) && p.openAtTime !== false);
}

export async function travelDetails(center: LatLng, destination: LatLng, mode: "DRIVE" | "TRANSIT" | "WALK"): Promise<{ minutes: number; roadKm: number } | null> {
  try {
    const r = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
      method: "POST", headers: headers({ "X-Goog-FieldMask": "routes.duration,routes.distanceMeters" }),
      body: JSON.stringify({ origin: { location: { latLng: { latitude: center.lat, longitude: center.lng } } }, destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } }, travelMode: mode }),
    });
    if (!r.ok) { console.error("travel unavailable", r.status); return null; }
    const data = await r.json() as { routes?: { duration?: string; distanceMeters?: number }[] };
    const route = data.routes?.[0];
    if (!route?.duration || !/^\d+(\.\d+)?s$/.test(route.duration)) return null;
    return { minutes: Math.ceil(parseFloat(route.duration) / 60), roadKm: Math.round((route.distanceMeters ?? 0) / 100) / 10 };
  } catch { return null; }
}
