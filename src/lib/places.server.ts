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
    `${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=in`,
    { headers: headers() },
  );
  if (!r.ok) {
    console.error("geocode", r.status, await r.text());
    return null;
  }
  const j = (await r.json()) as {
    results?: { geometry: { location: LatLng }; formatted_address: string; address_components: { long_name: string; types: string[] }[] }[];
  };
  const first = j.results?.[0];
  if (!first) return null;
  const locality =
    first.address_components.find((c) => c.types.includes("sublocality"))?.long_name ??
    first.address_components.find((c) => c.types.includes("locality"))?.long_name ??
    first.formatted_address.split(",")[0];
  return { loc: first.geometry.location, label: locality ?? address };
}

export async function reverseLabel(loc: LatLng): Promise<string> {
  const r = await fetch(`${GATEWAY}/maps/api/geocode/json?latlng=${loc.lat},${loc.lng}`, {
    headers: headers(),
  });
  if (!r.ok) return "your area";
  const j = (await r.json()) as {
    results?: { address_components: { long_name: string; types: string[] }[] }[];
  };
  const comps = j.results?.[0]?.address_components ?? [];
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

export async function searchPlaces(query: string, center: LatLng, radiusKm: number, openNow: boolean): Promise<Place[]> {
  const r = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
    method: "POST",
    headers: headers({
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.primaryTypeDisplayName,places.currentOpeningHours.openNow,places.editorialSummary,places.googleMapsUri,places.businessStatus",
    }),
    body: JSON.stringify({
      textQuery: query,
      pageSize: 12,
      openNow: openNow || undefined,
      locationBias: {
        circle: { center: { latitude: center.lat, longitude: center.lng }, radius: Math.min(radiusKm * 1000, 50000) },
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
  };
  const j = (await r.json()) as { places?: Raw[] };
  return (j.places ?? [])
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
        distanceKm: Math.round(haversine(center, loc) * 10) / 10,
      };
    })
    .filter((p) => p.distanceKm <= radiusKm);
}
