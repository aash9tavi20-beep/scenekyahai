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

export async function geocode(address: string): Promise<{ loc: LatLng; label: string } | null> {
  const r = await fetch(
    `${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=country:IN&region=in`,
    { headers: headers() },
  );
  if (!r.ok) {
    console.error("geocode", r.status, await r.text());
    return null;
  }
  const j = (await r.json()) as {
    results?: { geometry: { location: LatLng }; formatted_address: string; address_components: { long_name: string; short_name: string; types: string[] }[] }[];
  };
  const first = j.results?.[0];
  if (!first || !isIndia(first.address_components)) return null;
  const locality =
    first.address_components.find((c) => c.types.includes("sublocality"))?.long_name ??
    first.address_components.find((c) => c.types.includes("locality"))?.long_name ??
    first.formatted_address.split(",")[0];
  return { loc: first.geometry.location, label: locality ?? address };
}

export async function reverseLabel(loc: LatLng): Promise<string | null> {
  const r = await fetch(`${GATEWAY}/maps/api/geocode/json?latlng=${loc.lat},${loc.lng}`, {
    headers: headers(),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as {
    results?: { address_components: { long_name: string; short_name: string; types: string[] }[] }[];
  };
  const comps = j.results?.[0]?.address_components ?? [];
  if (!isIndia(comps)) return null;
  return (
    comps.find((c) => c.types.includes("sublocality"))?.long_name ??
    comps.find((c) => c.types.includes("locality"))?.long_name ??
    "your area"
  );
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
