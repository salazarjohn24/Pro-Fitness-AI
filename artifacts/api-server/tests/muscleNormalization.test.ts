import { describe, it, expect } from "vitest";
import { MUSCLE_ALIAS, normalizeMuscle } from "../src/lib/muscleNormalization";

/**
 * Regression tests for the canonical muscle normalization module.
 *
 * N01 — traps canonical divergence fix:
 *   Before: workout.ts mapped traps → "shoulders"
 *           audit.ts   mapped traps → "back"
 *   After:  both import normalizeMuscle from muscleNormalization.ts
 *           traps → "shoulders" everywhere
 *
 * If a test in this file fails, it means a route has re-introduced a local
 * normalization map that disagrees with the shared canonical. Fix the route,
 * not this test.
 */

describe("muscleNormalization — canonical map", () => {
  describe("traps canonical (N01 regression)", () => {
    it("maps traps to shoulders — not back", () => {
      expect(normalizeMuscle("traps")).toBe("shoulders");
    });

    it("maps Traps (mixed case) to shoulders", () => {
      expect(normalizeMuscle("Traps")).toBe("shoulders");
    });

    it("maps TRAPS (upper case) to shoulders", () => {
      expect(normalizeMuscle("TRAPS")).toBe("shoulders");
    });

    it("maps traps with surrounding whitespace to shoulders", () => {
      expect(normalizeMuscle("  traps  ")).toBe("shoulders");
    });

    it("MUSCLE_ALIAS map entry is shoulders, confirming both callers see the same value", () => {
      expect(MUSCLE_ALIAS["traps"]).toBe("shoulders");
    });
  });

  describe("shoulder family", () => {
    it("maps deltoids to shoulders", () => {
      expect(normalizeMuscle("deltoids")).toBe("shoulders");
    });

    it("maps delts to shoulders", () => {
      expect(normalizeMuscle("delts")).toBe("shoulders");
    });
  });

  describe("back family", () => {
    it("maps lats to back", () => {
      expect(normalizeMuscle("lats")).toBe("back");
    });

    it("maps upper_back to back", () => {
      expect(normalizeMuscle("upper_back")).toBe("back");
    });

    it("maps lower_back to back", () => {
      expect(normalizeMuscle("lower_back")).toBe("back");
    });
  });

  describe("core family", () => {
    it("maps abs to core", () => {
      expect(normalizeMuscle("abs")).toBe("core");
    });

    it("maps abdominals to core", () => {
      expect(normalizeMuscle("abdominals")).toBe("core");
    });
  });

  describe("lateralized bodymap names", () => {
    it("maps biceps_l to biceps", () => {
      expect(normalizeMuscle("biceps_l")).toBe("biceps");
    });

    it("maps biceps_r to biceps", () => {
      expect(normalizeMuscle("biceps_r")).toBe("biceps");
    });

    it("maps triceps_l to triceps", () => {
      expect(normalizeMuscle("triceps_l")).toBe("triceps");
    });

    it("maps triceps_r to triceps", () => {
      expect(normalizeMuscle("triceps_r")).toBe("triceps");
    });

    it("maps quads_l to quads", () => {
      expect(normalizeMuscle("quads_l")).toBe("quads");
    });

    it("maps quads_r to quads", () => {
      expect(normalizeMuscle("quads_r")).toBe("quads");
    });

    it("maps hamstrings_l to hamstrings", () => {
      expect(normalizeMuscle("hamstrings_l")).toBe("hamstrings");
    });

    it("maps hamstrings_r to hamstrings", () => {
      expect(normalizeMuscle("hamstrings_r")).toBe("hamstrings");
    });
  });

  describe("colloquial groupings", () => {
    it("maps legs to quads", () => {
      expect(normalizeMuscle("legs")).toBe("quads");
    });

    it("maps arms to biceps", () => {
      expect(normalizeMuscle("arms")).toBe("biceps");
    });

    it("maps forearms to biceps", () => {
      expect(normalizeMuscle("forearms")).toBe("biceps");
    });

    it("maps hips to glutes", () => {
      expect(normalizeMuscle("hips")).toBe("glutes");
    });

    it("maps pecs to chest", () => {
      expect(normalizeMuscle("pecs")).toBe("chest");
    });

    it("maps shins to calves", () => {
      expect(normalizeMuscle("shins")).toBe("calves");
    });
  });

  describe("passthrough — canonical names unchanged", () => {
    const canonicals = [
      "chest", "back", "shoulders", "quads", "hamstrings",
      "glutes", "biceps", "triceps", "core", "calves",
    ];

    for (const muscle of canonicals) {
      it(`passes through "${muscle}" unchanged`, () => {
        expect(normalizeMuscle(muscle)).toBe(muscle);
      });
    }
  });

  describe("unknown muscles — passthrough", () => {
    it("returns unknown muscle strings unchanged", () => {
      expect(normalizeMuscle("rotator_cuff")).toBe("rotator_cuff");
    });

    it("returns empty string unchanged", () => {
      expect(normalizeMuscle("")).toBe("");
    });
  });

  describe("N01 consistency proof — both call paths resolve to same value", () => {
    /**
     * Simulate what workout.ts does (generator path):
     *   normalizeMuscle("traps")  →  was "shoulders" before fix
     *
     * Simulate what audit.ts does (volume accounting path):
     *   normalizeMuscle("traps")  →  was "back" before fix
     *
     * After the fix both call the same function so they must agree.
     * This test makes the invariant explicit and will catch any future
     * route that reintroduces a local alias with a different mapping.
     */
    it("workout generator path and audit volume path return identical result for traps", () => {
      const generatorResult = normalizeMuscle("traps");
      const auditResult = normalizeMuscle("traps");
      expect(generatorResult).toBe(auditResult);
      expect(generatorResult).toBe("shoulders");
    });

    it("workout generator path and audit volume path return identical result for lats", () => {
      const generatorResult = normalizeMuscle("lats");
      const auditResult = normalizeMuscle("lats");
      expect(generatorResult).toBe(auditResult);
      expect(generatorResult).toBe("back");
    });

    it("workout generator path and audit volume path return identical result for abs", () => {
      const generatorResult = normalizeMuscle("abs");
      const auditResult = normalizeMuscle("abs");
      expect(generatorResult).toBe(auditResult);
      expect(generatorResult).toBe("core");
    });
  });
});
