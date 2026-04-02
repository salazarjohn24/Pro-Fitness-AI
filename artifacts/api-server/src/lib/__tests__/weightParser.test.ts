/**
 * weightParser.test.ts — Unit tests for parseWeightToKg.
 */

import { describe, it, expect } from "vitest";
import { parseWeightToKg } from "../weightParser";

const LBS_TO_KG = 0.453592;

function expectedKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 1000) / 1000;
}

describe("parseWeightToKg: kg inputs", () => {
  it("parses '60 kg'", () => expect(parseWeightToKg("60 kg")).toBe(60));
  it("parses '60kg'", () => expect(parseWeightToKg("60kg")).toBe(60));
  it("parses '60.5 kg'", () => expect(parseWeightToKg("60.5 kg")).toBe(60.5));
  it("parses '100 kg'", () => expect(parseWeightToKg("100 kg")).toBe(100));
  it("parses '#60 kg' (hash prefix)", () => expect(parseWeightToKg("#60 kg")).toBe(60));
});

describe("parseWeightToKg: lbs inputs", () => {
  it("parses '135 lbs'", () => expect(parseWeightToKg("135 lbs")).toBeCloseTo(expectedKg(135), 2));
  it("parses '135 lb'",  () => expect(parseWeightToKg("135 lb")).toBeCloseTo(expectedKg(135), 2));
  it("parses '135lbs'",  () => expect(parseWeightToKg("135lbs")).toBeCloseTo(expectedKg(135), 2));
  it("parses '225 lbs'", () => expect(parseWeightToKg("225 lbs")).toBeCloseTo(expectedKg(225), 2));
  it("parses '45 pound'", () => expect(parseWeightToKg("45 pound")).toBeCloseTo(expectedKg(45), 2));
  it("parses '45 pounds'", () => expect(parseWeightToKg("45 pounds")).toBeCloseTo(expectedKg(45), 2));
  it("parses '#135 lbs' (hash prefix)", () => expect(parseWeightToKg("#135 lbs")).toBeCloseTo(expectedKg(135), 2));
});

describe("parseWeightToKg: bare number (assumed lbs)", () => {
  it("parses '135'", () => expect(parseWeightToKg("135")).toBeCloseTo(expectedKg(135), 2));
  it("parses '225'", () => expect(parseWeightToKg("225")).toBeCloseTo(expectedKg(225), 2));
  it("parses '45.5'", () => expect(parseWeightToKg("45.5")).toBeCloseTo(expectedKg(45.5), 2));
  it("parses '#225' (hash prefix)", () => expect(parseWeightToKg("#225")).toBeCloseTo(expectedKg(225), 2));
});

describe("parseWeightToKg: bodyweight / zero inputs", () => {
  it("returns 0 for 'bodyweight'",  () => expect(parseWeightToKg("bodyweight")).toBe(0));
  it("returns 0 for 'bw'",          () => expect(parseWeightToKg("bw")).toBe(0));
  it("returns 0 for 'body weight'", () => expect(parseWeightToKg("body weight")).toBe(0));
  it("returns 0 for ''",            () => expect(parseWeightToKg("")).toBe(0));
  it("returns 0 for null",          () => expect(parseWeightToKg(null)).toBe(0));
  it("returns 0 for undefined",     () => expect(parseWeightToKg(undefined)).toBe(0));
  it("returns 0 for 'n/a'",         () => expect(parseWeightToKg("n/a")).toBe(0));
  it("returns 0 for 'none'",        () => expect(parseWeightToKg("none")).toBe(0));
});

describe("parseWeightToKg: unparseable inputs", () => {
  it("returns 0 for random text 'heavy'", () => expect(parseWeightToKg("heavy")).toBe(0));
  it("returns 0 for 'max'",               () => expect(parseWeightToKg("max")).toBe(0));
  it("returns 0 for 'bodyweight+20'",     () => expect(parseWeightToKg("bodyweight+20")).toBe(0));
});

describe("parseWeightToKg: precision", () => {
  it("rounds to 3 decimal places", () => {
    const result = parseWeightToKg("100 lbs");
    expect(result).toBe(Math.round(100 * LBS_TO_KG * 1000) / 1000);
    expect(result.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(3);
  });

  it("exact kg values have no floating-point drift", () => {
    expect(parseWeightToKg("60 kg")).toBe(60);
    expect(parseWeightToKg("100 kg")).toBe(100);
  });
});
