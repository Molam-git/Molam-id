// Geo service tests
import { encode, decode, getPrecisionMeters, getPrecisionForLevel } from "../src/geo/geohash";
import { calculateDistance } from "../src/geo/fraud";

describe("Geohash", () => {
  test("should encode latitude/longitude to geohash", () => {
    // Dakar, Senegal
    const geohash = encode(14.6928, -17.4467, 6);
    expect(geohash).toBe("ed52jt");
  });

  test("should decode geohash to approximate coordinates", () => {
    const geohash = "ed52jt";
    const { latitude, longitude } = decode(geohash);

    // Should be approximately Dakar (within 1km)
    expect(latitude).toBeCloseTo(14.6928, 1);
    expect(longitude).toBeCloseTo(-17.4467, 1);
  });

  test("should get precision in meters", () => {
    expect(getPrecisionMeters(1)).toBe(5000000);
    expect(getPrecisionMeters(6)).toBe(610);
    expect(getPrecisionMeters(8)).toBe(19);
  });

  test("should get precision for privacy level", () => {
    expect(getPrecisionForLevel("country")).toBe(2);
    expect(getPrecisionForLevel("region")).toBe(3);
    expect(getPrecisionForLevel("city")).toBe(5);
    expect(getPrecisionForLevel("precise")).toBe(7);
  });
});

describe("Fraud detection", () => {
  test("should calculate distance between two points", () => {
    // Dakar to Abidjan
    const dakar = { lat: 14.6928, lon: -17.4467 };
    const abidjan = { lat: 5.3599, lon: -4.0083 };

    const distance = calculateDistance(dakar.lat, dakar.lon, abidjan.lat, abidjan.lon);

    // Distance should be approximately 2000 km
    expect(distance).toBeGreaterThan(1900);
    expect(distance).toBeLessThan(2100);
  });

  test("should calculate zero distance for same location", () => {
    const distance = calculateDistance(14.6928, -17.4467, 14.6928, -17.4467);
    expect(distance).toBe(0);
  });
});

describe("Country detection", () => {
  // These tests would require database setup
  test.skip("should detect Senegal from phone number", () => {
    // TODO: Implement with database
  });

  test.skip("should detect country from MCC", () => {
    // TODO: Implement with database
  });
});
