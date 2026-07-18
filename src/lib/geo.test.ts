import { describe, expect, test } from "bun:test";
import {
  decodeGeohash,
  encodeGeohash,
  haversineDistance,
  geohashNeighbourPrefixes,
} from "./geo";

describe("encodeGeohash / decodeGeohash", () => {
  test("round-trips near Lagos (known city point)", () => {
    const lat = 6.5244;
    const lng = 3.3792;
    const hash = encodeGeohash(lat, lng, 7);
    expect(hash).toHaveLength(7);
    expect(typeof hash).toBe("string");
    expect(/^[0-9bcdefghjkmnpqrstuvwxyz]+$/.test(hash)).toBe(true);

    const decoded = decodeGeohash(hash);
    // precision 7 ≈ ±76m → allow ~0.01°
    expect(Math.abs(decoded.lat - lat)).toBeLessThan(0.01);
    expect(Math.abs(decoded.lng - lng)).toBeLessThan(0.01);
  });

  test("round-trips near San Francisco", () => {
    const lat = 37.7749;
    const lng = -122.4194;
    const hash = encodeGeohash(lat, lng, 8);
    const decoded = decodeGeohash(hash);
    expect(Math.abs(decoded.lat - lat)).toBeLessThan(0.001);
    expect(Math.abs(decoded.lng - lng)).toBeLessThan(0.001);
  });

  test("higher precision yields longer hash and finer decode", () => {
    const a = encodeGeohash(10, 20, 4);
    const b = encodeGeohash(10, 20, 7);
    expect(a).toHaveLength(4);
    expect(b).toHaveLength(7);
    expect(b.startsWith(a)).toBe(true);
  });
});

describe("haversineDistance", () => {
  test("same point is ~0 meters", () => {
    expect(haversineDistance(6.5, 3.3, 6.5, 3.3)).toBeLessThan(1);
  });

  test("known rough distance: Lagos to nearby point ~1km", () => {
    // ~0.009° lat ≈ 1km
    const d = haversineDistance(6.5244, 3.3792, 6.5334, 3.3792);
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1200);
  });

  test("is symmetric", () => {
    const a = haversineDistance(0, 0, 1, 1);
    const b = haversineDistance(1, 1, 0, 0);
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });
});

describe("geohashNeighbourPrefixes", () => {
  test("returns center and neighboring prefixes", () => {
    const prefixes = geohashNeighbourPrefixes(6.5244, 3.3792, 5);
    expect(prefixes.length).toBeGreaterThanOrEqual(1);
    const center = encodeGeohash(6.5244, 3.3792, 5);
    expect(prefixes).toContain(center);
    for (const p of prefixes) {
      expect(p).toHaveLength(5);
    }
  });
});
