/**
 * historyInsights.ts — Step 5 main insight generation entry point.
 *
 * Main export: `generateInsights(rollup, options) → InsightGenerationResult`
 *
 * Detection pipeline (in order):
 *   1. Recently elevated muscles   (from rollup.summary.recentlyElevated)
 *   2. Recently reduced muscles    (from rollup.summary.recentlyReduced)
 *   3. Underrepresented muscles    (from rollup.summary.underrepresentedMuscles)
 *   4. Underrepresented patterns   (from rollup.summary.underrepresentedPatterns)
 *   5. Dominant pattern bias       (from rollup.summary.topPatternsCumulative[0])
 *   6. Dominant stimulus bias      (from rollup.summary.dominantStimulusCumulative)
 *   7. Balance observations        (push/pull and upper/lower comparisons)
 *   8. Data quality note           (when fallback rate is high)
 *
 * Insights are then sorted: severity (high→low) then type (alpha) for
 * deterministic output ordering.
 *
 * SCOPE: Step 5 only. No readiness. No recovery. No recommendations.
 * All text is relative and descriptive — never prescriptive.
 */

import {
  ELEVATED_MAX_MUSCLES,
  REDUCED_MAX_MUSCLES,
  UNDERREPRESENTED_MUSCLE_MAX,
  UNDERREPRESENTED_PATTERN_MAX,
  BALANCE_MIN_WORKOUTS,
  DOMINANT_MIN_WORKOUTS,
  BALANCE_RATIO_THRESHOLD,
  BALANCE_MIN_ABSOLUTE_SCORE,
  DATA_QUALITY_HIGH_RATE,
  DATA_QUALITY_MODERATE_RATE,
  DATA_QUALITY_MIN_MOVEMENTS,
  PUSH_PATTERNS,
  PULL_PATTERNS,
  LOWER_PATTERNS,
  CYCLICAL_PATTERNS,
  sumPatternGroup,
} from "./insightRules";
import {
  insightText,
  generateHeadline,
  muscleDisplay,
  patternDisplay,
  stimulusDisplay,
} from "./insightText";
import type { HistoricalRollupResult } from "./historyScoringTypes";
import type {
  HistoryInsight,
  InsightGenerationResult,
  InsightSummary,
  InsightType,
  InsightSeverity,
} from "./insightTypes";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GenerateInsightsOptions {
  /**
   * Human-readable label for the time range, shown in the headline and summary.
   * Defaults to "selected range".
   */
  rangeLabel?: string;
  /**
   * Maximum number of insights to include in the result.
   * If the pipeline generates more, the highest-severity ones are kept.
   * Defaults to 12.
   */
  maxInsights?: number;
}

// ---------------------------------------------------------------------------
// Severity ordering (for sorting)
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  high: 0, moderate: 1, low: 2, info: 3,
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate structured training insights from a Step 4 HistoricalRollupResult.
 *
 * @param rollup  - Output from scoreHistory() in historyAggregation.ts
 * @param options - rangeLabel and maxInsights
 */
export function generateInsights(
  rollup: HistoricalRollupResult,
  options: GenerateInsightsOptions = {}
): InsightGenerationResult {
  const rangeLabel  = options.rangeLabel ?? "selected range";
  const maxInsights = options.maxInsights ?? 12;
  const { summary, metadata, cumulativePatternVector, cumulativeStimulusVector } = rollup;

  const insights: HistoryInsight[] = [];

  // ── 1. Recently elevated muscles ──────────────────────────────────────────
  const elevated = summary.recentlyElevated.slice(0, ELEVATED_MAX_MUSCLES);
  for (const muscle of elevated) {
    insights.push({
      type: "recently_elevated_muscle",
      severity: "low",
      subject: muscle,
      text: insightText("recently_elevated_muscle", muscle),
      evidence: "recency rank higher than cumulative rank in the selected range",
    });
  }

  // ── 2. Recently reduced muscles ───────────────────────────────────────────
  const reduced = summary.recentlyReduced.slice(0, REDUCED_MAX_MUSCLES);
  for (const muscle of reduced) {
    insights.push({
      type: "recently_reduced_muscle",
      severity: "low",
      subject: muscle,
      text: insightText("recently_reduced_muscle", muscle),
      evidence: "recency rank lower than cumulative rank in the selected range",
    });
  }

  // ── 3. Underrepresented muscles ───────────────────────────────────────────
  for (const entry of summary.underrepresentedMuscles.slice(0, UNDERREPRESENTED_MUSCLE_MAX)) {
    insights.push({
      type: "underrepresented_muscle",
      severity: "info",
      subject: entry.key,
      text: insightText("underrepresented_muscle", entry.key),
      evidence: `lowest cumulative score (${entry.score.toFixed(2)}) in the selected range`,
    });
  }

  // ── 4. Underrepresented patterns ──────────────────────────────────────────
  for (const entry of summary.underrepresentedPatterns.slice(0, UNDERREPRESENTED_PATTERN_MAX)) {
    insights.push({
      type: "underrepresented_pattern",
      severity: "info",
      subject: entry.key,
      text: insightText("underrepresented_pattern", entry.key),
      evidence: `lowest cumulative pattern exposure (${entry.score.toFixed(2)}) in the selected range`,
    });
  }

  // ── 5. Dominant pattern bias ──────────────────────────────────────────────
  if (
    metadata.filteredWorkouts >= DOMINANT_MIN_WORKOUTS &&
    summary.topPatternsCumulative.length > 0
  ) {
    const top = summary.topPatternsCumulative[0];
    insights.push({
      type: "dominant_pattern_bias",
      severity: "info",
      subject: top.key,
      text: insightText("dominant_pattern_bias", top.key),
      evidence: `highest cumulative pattern exposure: ${top.score.toFixed(2)}`,
    });
  }

  // ── 6. Dominant stimulus bias ─────────────────────────────────────────────
  if (metadata.filteredWorkouts >= DOMINANT_MIN_WORKOUTS) {
    const ds = summary.dominantStimulusCumulative;
    const dsValue = cumulativeStimulusVector[ds];
    insights.push({
      type: "dominant_stimulus_bias",
      severity: "info",
      subject: ds,
      text: insightText("dominant_stimulus_bias", ds),
      evidence: `${stimulusDisplay(ds)} stimulus averaged ${dsValue.toFixed(2)} across filtered workouts`,
    });
  }

  // ── 7. Balance observations ───────────────────────────────────────────────
  if (metadata.filteredWorkouts >= BALANCE_MIN_WORKOUTS) {
    const balanceInsights = detectBalanceObservations(cumulativePatternVector);
    insights.push(...balanceInsights);
  }

  // ── 8. Data quality note ──────────────────────────────────────────────────
  const totalMovements = summary.topMusclesCumulative.length > 0
    ? metadata.totalFallbackMovements + metadata.filteredWorkouts // approximate
    : 0;
  const totalTrackedMovements =
    metadata.totalFallbackMovements +
    (metadata.filteredWorkouts > 0 ? metadata.filteredWorkouts * 3 : 0); // rough proxy

  // More reliable: use raw fallback count if above absolute threshold
  if (metadata.totalFallbackMovements >= DATA_QUALITY_MIN_MOVEMENTS) {
    // Estimate fallback rate: fallbackMovements vs total movements in range
    // We don't have exact total, so use workoutsWithFallback as the signal
    const fallbackWorkoutRate = metadata.filteredWorkouts > 0
      ? metadata.workoutsWithFallback / metadata.filteredWorkouts
      : 0;

    if (fallbackWorkoutRate >= DATA_QUALITY_HIGH_RATE) {
      insights.push({
        type: "data_quality_note",
        severity: "moderate",
        subject: "data_quality",
        text: insightText("data_quality_note", "data_quality", "high"),
        evidence: `${metadata.workoutsWithFallback}/${metadata.filteredWorkouts} workouts contained unrecognised movements`,
      });
    } else if (fallbackWorkoutRate >= DATA_QUALITY_MODERATE_RATE) {
      insights.push({
        type: "data_quality_note",
        severity: "low",
        subject: "data_quality",
        text: insightText("data_quality_note", "data_quality"),
        evidence: `${metadata.workoutsWithFallback}/${metadata.filteredWorkouts} workouts contained unrecognised movements`,
      });
    }
  }

  // ── Sort: severity (high→low) then type (alpha) for determinism ───────────
  const sorted = insights.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.type.localeCompare(b.type);
  });

  // ── Cap at maxInsights ────────────────────────────────────────────────────
  const capped = sorted.slice(0, maxInsights);

  // ── Generate summary ──────────────────────────────────────────────────────
  const insightSummary = buildInsightSummary(capped, rollup, rangeLabel);

  return {
    insights: capped,
    summary: insightSummary,
    rangeLabel,
    workoutCount: metadata.filteredWorkouts,
  };
}

// ---------------------------------------------------------------------------
// Balance observation detection
// ---------------------------------------------------------------------------

function detectBalanceObservations(
  patternVector: Record<string, number>
): HistoryInsight[] {
  const observations: HistoryInsight[] = [];

  const pushScore  = sumPatternGroup(patternVector, PUSH_PATTERNS);
  const pullScore  = sumPatternGroup(patternVector, PULL_PATTERNS);
  const lowerScore = sumPatternGroup(patternVector, LOWER_PATTERNS);
  const upperScore = pushScore + pullScore;
  const cyclical   = sumPatternGroup(patternVector, CYCLICAL_PATTERNS);

  // Push vs pull
  if (
    pushScore >= BALANCE_MIN_ABSOLUTE_SCORE &&
    pullScore >= BALANCE_MIN_ABSOLUTE_SCORE
  ) {
    if (pullScore > pushScore * BALANCE_RATIO_THRESHOLD) {
      observations.push(makeBalance(
        "pull-dominant upper body",
        `Upper body pulling has been more represented than pushing in this range.`,
        `pull score ${pullScore.toFixed(1)} vs push score ${pushScore.toFixed(1)}`
      ));
    } else if (pushScore > pullScore * BALANCE_RATIO_THRESHOLD) {
      observations.push(makeBalance(
        "push-dominant upper body",
        `Upper body pushing has been more represented than pulling in this range.`,
        `push score ${pushScore.toFixed(1)} vs pull score ${pullScore.toFixed(1)}`
      ));
    }
  } else if (
    pushScore >= BALANCE_MIN_ABSOLUTE_SCORE &&
    pullScore < BALANCE_MIN_ABSOLUTE_SCORE
  ) {
    observations.push(makeBalance(
      "minimal upper body pull",
      `Upper body pulling has received minimal exposure in this range.`,
      `pull score ${pullScore.toFixed(1)} below minimum threshold`
    ));
  } else if (
    pullScore >= BALANCE_MIN_ABSOLUTE_SCORE &&
    pushScore < BALANCE_MIN_ABSOLUTE_SCORE
  ) {
    observations.push(makeBalance(
      "minimal upper body push",
      `Upper body pushing has received minimal exposure in this range.`,
      `push score ${pushScore.toFixed(1)} below minimum threshold`
    ));
  }

  // Lower vs upper
  if (
    lowerScore >= BALANCE_MIN_ABSOLUTE_SCORE &&
    upperScore >= BALANCE_MIN_ABSOLUTE_SCORE
  ) {
    if (lowerScore > upperScore * BALANCE_RATIO_THRESHOLD) {
      observations.push(makeBalance(
        "lower body dominant",
        `Lower-body loading has been more represented than upper-body work in this period.`,
        `lower score ${lowerScore.toFixed(1)} vs upper score ${upperScore.toFixed(1)}`
      ));
    } else if (upperScore > lowerScore * BALANCE_RATIO_THRESHOLD) {
      observations.push(makeBalance(
        "upper body dominant",
        `Upper-body work has been more represented than lower-body loading in this period.`,
        `upper score ${upperScore.toFixed(1)} vs lower score ${lowerScore.toFixed(1)}`
      ));
    }
  }

  // Cyclical dominance (when cyclical is as large as all non-cyclical combined)
  const nonCyclical = pushScore + pullScore + lowerScore;
  if (
    cyclical >= BALANCE_MIN_ABSOLUTE_SCORE &&
    nonCyclical >= BALANCE_MIN_ABSOLUTE_SCORE &&
    cyclical > nonCyclical * BALANCE_RATIO_THRESHOLD
  ) {
    observations.push(makeBalance(
      "cyclical dominant",
      `Cyclical / conditioning work has dominated this range relative to structural lifting.`,
      `cyclical score ${cyclical.toFixed(1)} vs structural score ${nonCyclical.toFixed(1)}`
    ));
  }

  return observations;
}

function makeBalance(
  subject: string,
  text: string,
  evidence: string
): HistoryInsight {
  return {
    type: "balance_observation",
    severity: "info",
    subject,
    text,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Insight summary builder
// ---------------------------------------------------------------------------

function buildInsightSummary(
  insights: HistoryInsight[],
  rollup: HistoricalRollupResult,
  rangeLabel: string
): InsightSummary {
  const { summary, metadata } = rollup;

  const dominantPattern =
    summary.topPatternsCumulative.length > 0
      ? summary.topPatternsCumulative[0].key
      : null;
  const dominantStimulus =
    metadata.filteredWorkouts >= DOMINANT_MIN_WORKOUTS
      ? (summary.dominantStimulusCumulative as string)
      : null;

  const headline = generateHeadline(
    dominantPattern,
    dominantStimulus,
    metadata.filteredWorkouts,
    rangeLabel
  );

  // Take up to 4 observations: pick the most informative insight types first
  const preferredTypes: InsightType[] = [
    "dominant_stimulus_bias",
    "dominant_pattern_bias",
    "balance_observation",
    "recently_elevated_muscle",
    "recently_reduced_muscle",
    "underrepresented_muscle",
    "underrepresented_pattern",
    "data_quality_note",
  ];

  const observations: string[] = [];
  const seen = new Set<InsightType>();

  for (const preferredType of preferredTypes) {
    if (observations.length >= 4) break;
    const match = insights.find(
      (i) => i.type === preferredType && !seen.has(i.type as InsightType)
    );
    if (match) {
      observations.push(match.text);
      seen.add(match.type as InsightType);
    }
  }

  // If still empty (very sparse rollup), add a safe default
  if (observations.length === 0 && metadata.filteredWorkouts > 0) {
    observations.push(`${metadata.filteredWorkouts} workout${metadata.filteredWorkouts !== 1 ? "s" : ""} analysed in the ${rangeLabel}.`);
  }

  return { headline, observations };
}
