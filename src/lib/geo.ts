/**
 * Minimal geohash + Haversine utilities for server-side duplicate / hotspot logic.
 * No external dependencies.
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function encodeGeohash(
  lat: number,
  lng: number,
  precision: number = 7,
): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let hash = "";
  const latRange = [-90, 90];
  const lngRange = [-180, 180];

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) {
        idx = idx * 2 + 1;
        lngRange[0] = mid;
      } else {
        idx = idx * 2;
        lngRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) {
        idx = idx * 2 + 1;
        latRange[0] = mid;
      } else {
        idx = idx * 2;
        latRange[1] = mid;
      }
    }
    evenBit = !evenBit;
    bit++;
    if (bit === 5) {
      hash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return hash;
}

export function decodeGeohash(hash: string): { lat: number; lng: number } {
  let evenBit = true;
  const latRange = [-90, 90];
  const lngRange = [-180, 180];

  for (const char of hash) {
    const idx = BASE32.indexOf(char);
    for (let bits = 4; bits >= 0; bits--) {
      const bit = (idx >> bits) & 1;
      if (evenBit) {
        const mid = (lngRange[0] + lngRange[1]) / 2;
        if (bit) lngRange[0] = mid;
        else lngRange[1] = mid;
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        if (bit) latRange[0] = mid;
        else latRange[1] = mid;
      }
      evenBit = !evenBit;
    }
  }
  return {
    lat: (latRange[0] + latRange[1]) / 2,
    lng: (lngRange[0] + lngRange[1]) / 2,
  };
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function geohashNeighbourPrefixes(
  lat: number,
  lng: number,
  precision: number = 5,
): string[] {
  const center = encodeGeohash(lat, lng, precision);
  const offsets: Record<number, number> = {
    4: 0.2,
    5: 0.05,
    6: 0.012,
    7: 0.003,
  };
  const d = offsets[precision] || 0.05;

  const neighbors = new Set<string>();
  for (const dlat of [-d, 0, d]) {
    for (const dlng of [-d, 0, d]) {
      neighbors.add(
        encodeGeohash(lat + dlat, lng + dlng, precision).slice(0, precision),
      );
    }
  }
  neighbors.add(center.slice(0, precision));
  return Array.from(neighbors);
}
