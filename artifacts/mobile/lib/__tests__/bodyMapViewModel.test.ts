/**
 * bodyMapViewModel.test.ts — Step 10: body-map view model unit tests.
 *
 * Covers:
 *   - Normalization (max = 1.0, others relative)
 *   - Emphasis tier assignment
 *   - Region grouping and ordering
 *   - Row capping at BODY_MAP_MAX_ROWS
 *   - Empty / null / zero vector handling
 *   - hasLowData propagation
 *   - Deterministic output (same vector → same model)
 *   - Mode/sourceLabel passthrough
 *   - Unknown muscle keys (graceful fallback)
 *   - Workout vs. history mode shapes
 */

import { describe, it, expect } from "vitest";
import {
  buildBodyMapViewModel,
  EMPTY_BODY_MAP,
  BODY_MAP_MAX_ROWS,
  EMPHASIS_LOW_THRESHOLD,
  EMPHASIS_HIGH_THRESHOLD,
} from "../viewModels/bodyMapViewModel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVector(overrides: Record<string, number> = {}): Record<string, number> {
  return {
    quads:           80,
    hamstrings:      60,
    glutes:          50,
    chest:           40,
    upper_back_lats: 30,
    shoulders:       20,
    core:            15,
    calves:          10,
    ...overrides,
  };
}

const BASE_OPTIONS = {
  mode:        "workout" as const,
  sourceLabel: "This workout",
};

// ---------------------------------------------------------------------------
// 1. Basic construction
// ---------------------------------------------------------------------------

describe("buildBodyMapViewModel", () => {
  it("returns hasData=false for null input", () => {
    const vm = buildBodyMapViewModel(null, BASE_OPTIONS);
    expect(vm.hasData).toBe(false);
    expect(vm.rows).toHaveLength(0);
  });

  it("returns hasData=false for undefined input", () => {
    const vm = buildBodyMapViewModel(undefined, BASE_OPTIONS);
    expect(vm.hasData).toBe(false);
  });

  it("returns hasData=false for empty object", () => {
    const vm = buildBodyMapViewModel({}, BASE_OPTIONS);
    expect(vm.hasData).toBe(false);
  });

  it("returns hasData=false when all scores are 0", () => {
    const vm = buildBodyMapViewModel({ quads: 0, chest: 0 }, BASE_OPTIONS);
    expect(vm.hasData).toBe(false);
  });

  it("returns hasData=true when at least one muscle is scored", () => {
    const vm = buildBodyMapViewModel({ quads: 50 }, BASE_OPTIONS);
    expect(vm.hasData).toBe(true);
  });

  it("passes through mode and sourceLabel", () => {
    const vm = buildBodyMapViewModel(makeVector(), {
      mode:        "cumulative",
      sourceLabel: "Past 30 days",
    });
    expect(vm.mode).toBe("cumulative");
    expect(vm.sourceLabel).toBe("Past 30 days");
  });

  it("hasLowData defaults to false", () => {
    const vm = buildBodyMapViewModel(makeVector(), BASE_OPTIONS);
    expect(vm.hasLowData).toBe(false);
  });

  it("hasLowData is propagated when set to true", () => {
    const vm = buildBodyMapViewModel(makeVector(), {
      ...BASE_OPTIONS,
      hasLowData: true,
    });
    expect(vm.hasLowData).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Normalization
// ---------------------------------------------------------------------------

describe("normalization", () => {
  it("top-ranked muscle always has normalizedScore = 1.0", () => {
    const vm = buildBodyMapViewModel(makeVector(), BASE_OPTIONS);
    const topRow = vm.rows.find((r) => r.rank === 1);
    expect(topRow).toBeDefined();
    expect(topRow!.normalizedScore).toBe(1.0);
  });

  it("normalizes a single-muscle vector to 1.0", () => {
    const vm = buildBodyMapViewModel({ quads: 42 }, BASE_OPTIONS);
    expect(vm.rows[0].normalizedScore).toBe(1.0);
  });

  it("computes proportional normalizedScores correctly", () => {
    const vm = buildBodyMapViewModel({ quads: 100, chest: 50 }, BASE_OPTIONS);
    const quadsRow = vm.rows.find((r) => r.key === "quads")!;
    const chestRow = vm.rows.find((r) => r.key === "chest")!;
    expect(quadsRow.normalizedScore).toBe(1.0);
    expect(chestRow.normalizedScore).toBeCloseTo(0.5, 5);
  });

  it("preserves rawScore unchanged", () => {
    const vec = { quads: 77, hamstrings: 33 };
    const vm = buildBodyMapViewModel(vec, BASE_OPTIONS);
    expect(vm.rows.find((r) => r.key === "quads")?.rawScore).toBe(77);
    expect(vm.rows.find((r) => r.key === "hamstrings")?.rawScore).toBe(33);
  });
});

// ---------------------------------------------------------------------------
// 3. Emphasis tiers
// ---------------------------------------------------------------------------

describe("emphasis tiers", () => {
  it("tier is 'high' when normalizedScore >= EMPHASIS_HIGH_THRESHOLD", () => {
    // top muscle always normalized to 1.0
    const vm = buildBodyMapViewModel({ quads: 100 }, BASE_OPTIONS);
    expect(vm.rows[0].emphasisTier).toBe("high");
  });

  it("tier is 'medium' for normalizedScore in [LOW, HIGH)", () => {
    // 50% of max → 0.5 → medium
    const vm = buildBodyMapViewModel({ quads: 100, chest: 50 }, BASE_OPTIONS);
    const chestRow = vm.rows.find((r) => r.key === "chest")!;
    expect(chestRow.normalizedScore).toBe(0.5);
    expect(chestRow.emphasisTier).toBe("medium");
  });

  it("tier is 'low' for normalizedScore < EMPHASIS_LOW_THRESHOLD", () => {
    // 20% of max → 0.2 → low
    const vm = buildBodyMapViewModel({ quads: 100, core: 20 }, BASE_OPTIONS);
    const coreRow = vm.rows.find((r) => r.key === "core")!;
    expect(coreRow.normalizedScore).toBeCloseTo(0.2, 5);
    expect(coreRow.emphasisTier).toBe("low");
  });

  it("threshold constants match the tier assignments", () => {
    // just below LOW threshold
    const fraction = EMPHASIS_LOW_THRESHOLD - 0.01;
    const vm = buildBodyMapViewModel(
      { quads: 100, chest: Math.round(fraction * 100) },
      BASE_OPTIONS
    );
    const chestRow = vm.rows.find((r) => r.key === "chest")!;
    expect(chestRow.emphasisTier).toBe("low");
  });

  it("muscles with score = 0 are excluded from rows", () => {
    const vm = buildBodyMapViewModel({ quads: 100, chest: 0 }, BASE_OPTIONS);
    const chestRow = vm.rows.find((r) => r.key === "chest");
    expect(chestRow).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Row ordering and capping
// ---------------------------------------------------------------------------

describe("row ordering and capping", () => {
  it("rows are ordered by normalizedScore descending", () => {
    const vm = buildBodyMapViewModel(makeVector(), BASE_OPTIONS);
    for (let i = 0; i < vm.rows.length - 1; i++) {
      expect(vm.rows[i].normalizedScore).toBeGreaterThanOrEqual(
        vm.rows[i + 1].normalizedScore
      );
    }
  });

  it("rank is 1-based and matches order", () => {
    const vm = buildBodyMapViewModel(makeVector(), BASE_OPTIONS);
    vm.rows.forEach((row, idx) => {
      expect(row.rank).toBe(idx + 1);
    });
  });

  it(`caps rows at BODY_MAP_MAX_ROWS (${BODY_MAP_MAX_ROWS})`, () => {
    const bigVector: Record<string, number> = {};
    for (let i = 1; i <= 20; i++) bigVector[`muscle_${i}`] = i;
    const vm = buildBodyMapViewModel(bigVector, BASE_OPTIONS);
    expect(vm.rows.length).toBeLessThanOrEqual(BODY_MAP_MAX_ROWS);
  });

  it("a small vector (< MAX_ROWS) returns all scored muscles", () => {
    const vm = buildBodyMapViewModel({ quads: 50, chest: 30 }, BASE_OPTIONS);
    expect(vm.rows).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 5. Region grouping
// ---------------------------------------------------------------------------

describe("region grouping", () => {
  it("always returns exactly 4 regions", () => {
    const vm = buildBodyMapViewModel(makeVector(), BASE_OPTIONS);
    expect(vm.regions).toHaveLength(4);
  });

  it("region keys are push / pull / core / lower in that order", () => {
    const vm = buildBodyMapViewModel(makeVector(), BASE_OPTIONS);
    expect(vm.regions.map((r) => r.key)).toEqual(["push", "pull", "core", "lower"]);
  });

  it("chest and shoulders appear in the push region", () => {
    const vm = buildBodyMapViewModel({ chest: 80, shoulders: 60 }, BASE_OPTIONS);
    const push = vm.regions.find((r) => r.key === "push")!;
    const keys = push.muscles.map((m) => m.key);
    expect(keys).toContain("chest");
    expect(keys).toContain("shoulders");
  });

  it("upper_back_lats and biceps appear in the pull region", () => {
    const vm = buildBodyMapViewModel(
      { upper_back_lats: 90, biceps: 40 },
      BASE_OPTIONS
    );
    const pull = vm.regions.find((r) => r.key === "pull")!;
    const keys = pull.muscles.map((m) => m.key);
    expect(keys).toContain("upper_back_lats");
    expect(keys).toContain("biceps");
  });

  it("core and lower_back appear in the core region", () => {
    const vm = buildBodyMapViewModel(
      { core: 70, lower_back: 50 },
      BASE_OPTIONS
    );
    const coreRegion = vm.regions.find((r) => r.key === "core")!;
    const keys = coreRegion.muscles.map((m) => m.key);
    expect(keys).toContain("core");
    expect(keys).toContain("lower_back");
  });

  it("quads, hamstrings, glutes, calves appear in the lower region", () => {
    const vm = buildBodyMapViewModel(
      { quads: 80, hamstrings: 60, glutes: 50, calves: 20 },
      BASE_OPTIONS
    );
    const lower = vm.regions.find((r) => r.key === "lower")!;
    const keys = lower.muscles.map((m) => m.key);
    expect(keys).toContain("quads");
    expect(keys).toContain("hamstrings");
    expect(keys).toContain("glutes");
    expect(keys).toContain("calves");
  });

  it("regionTopScore reflects the highest-rawScore muscle in that region", () => {
    const vm = buildBodyMapViewModel(
      { chest: 100, shoulders: 60 },
      BASE_OPTIONS
    );
    const push = vm.regions.find((r) => r.key === "push")!;
    expect(push.regionTopScore).toBe(100);
  });

  it("regionTopScore is 0 when no active muscles in the region", () => {
    const vm = buildBodyMapViewModel({ quads: 80 }, BASE_OPTIONS);
    const push = vm.regions.find((r) => r.key === "push")!;
    expect(push.regionTopScore).toBe(0);
    expect(push.muscles).toHaveLength(0);
  });

  it("region muscles are ordered by rawScore descending", () => {
    const vm = buildBodyMapViewModel(
      { quads: 80, hamstrings: 60, glutes: 100, calves: 20 },
      BASE_OPTIONS
    );
    const lower = vm.regions.find((r) => r.key === "lower")!;
    for (let i = 0; i < lower.muscles.length - 1; i++) {
      expect(lower.muscles[i].rawScore).toBeGreaterThanOrEqual(
        lower.muscles[i + 1].rawScore
      );
    }
  });

  it("regions include muscles beyond BODY_MAP_MAX_ROWS (not capped)", () => {
    const bigVector: Record<string, number> = {
      quads:           100,
      hamstrings:      90,
      glutes:          80,
      calves:          70,
      hip_flexors:     60,
      adductors:       50,
      chest:           40,
      shoulders:       30,
      triceps:         20,
      upper_back_lats: 10,
    };
    const vm = buildBodyMapViewModel(bigVector, BASE_OPTIONS);
    // rows are capped at 8 but regions should have all lower muscles
    const lower = vm.regions.find((r) => r.key === "lower")!;
    expect(lower.muscles.length).toBeGreaterThan(4);
  });
});

// ---------------------------------------------------------------------------
// 6. Empty state
// ---------------------------------------------------------------------------

describe("EMPTY_BODY_MAP", () => {
  it("has hasData=false", () => {
    expect(EMPTY_BODY_MAP.hasData).toBe(false);
  });

  it("has 4 empty regions", () => {
    expect(EMPTY_BODY_MAP.regions).toHaveLength(4);
    EMPTY_BODY_MAP.regions.forEach((r) => {
      expect(r.muscles).toHaveLength(0);
      expect(r.regionTopScore).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// 7. Determinism
// ---------------------------------------------------------------------------

describe("determinism", () => {
  it("produces identical output for the same input", () => {
    const vec = makeVector();
    const vm1 = buildBodyMapViewModel(vec, BASE_OPTIONS);
    const vm2 = buildBodyMapViewModel(vec, BASE_OPTIONS);
    expect(vm1.rows.map((r) => r.key)).toEqual(vm2.rows.map((r) => r.key));
    expect(vm1.rows.map((r) => r.normalizedScore)).toEqual(
      vm2.rows.map((r) => r.normalizedScore)
    );
    expect(vm1.regions.map((r) => r.muscles.map((m) => m.key))).toEqual(
      vm2.regions.map((r) => r.muscles.map((m) => m.key))
    );
  });
});

// ---------------------------------------------------------------------------
// 8. Unknown muscle keys
// ---------------------------------------------------------------------------

describe("unknown muscle keys", () => {
  it("gracefully includes unknown keys without throwing", () => {
    const vm = buildBodyMapViewModel(
      { quads: 100, some_unknown_muscle: 50 },
      BASE_OPTIONS
    );
    expect(vm.hasData).toBe(true);
    const unknownRow = vm.rows.find((r) => r.key === "some_unknown_muscle");
    expect(unknownRow).toBeDefined();
    // Label falls back to humanized key
    expect(unknownRow!.label).toBe("some unknown muscle");
  });
});

// ---------------------------------------------------------------------------
// 9. Labels
// ---------------------------------------------------------------------------

describe("muscle labels", () => {
  it("known keys use the display name from trainingDisplay", () => {
    const vm = buildBodyMapViewModel({ upper_back_lats: 100 }, BASE_OPTIONS);
    expect(vm.rows[0].label).toBe("Upper back / lats");
  });

  it("quads → Quadriceps", () => {
    const vm = buildBodyMapViewModel({ quads: 100 }, BASE_OPTIONS);
    expect(vm.rows[0].label).toBe("Quadriceps");
  });
});

// ---------------------------------------------------------------------------
// 10. Mode variants (workout / cumulative / recent)
// ---------------------------------------------------------------------------

describe("mode variants", () => {
  it("workout mode sets mode='workout'", () => {
    const vm = buildBodyMapViewModel(makeVector(), {
      mode: "workout",
      sourceLabel: "This workout",
    });
    expect(vm.mode).toBe("workout");
  });

  it("cumulative mode sets mode='cumulative'", () => {
    const vm = buildBodyMapViewModel(makeVector(), {
      mode: "cumulative",
      sourceLabel: "Past 30 days",
    });
    expect(vm.mode).toBe("cumulative");
  });

  it("recent mode sets mode='recent'", () => {
    const vm = buildBodyMapViewModel(makeVector(), {
      mode: "recent",
      sourceLabel: "Recent workouts",
    });
    expect(vm.mode).toBe("recent");
  });

  it("empty vector with cumulative mode has correct mode on empty state", () => {
    const vm = buildBodyMapViewModel(null, {
      mode: "cumulative",
      sourceLabel: "Past 30 days",
    });
    expect(vm.mode).toBe("cumulative");
    expect(vm.sourceLabel).toBe("Past 30 days");
    expect(vm.hasData).toBe(false);
  });
});
