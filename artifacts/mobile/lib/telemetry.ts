/**
 * telemetry.ts — lightweight, type-safe event tracking for Pro Fitness AI.
 *
 * Design rules:
 *   - Every event has a discriminated-union type so call sites are checked at compile time.
 *   - All property keys are snake_case to match analytics platform conventions (PostHog / Amplitude).
 *   - No PII: events carry numeric scores, enum values, and field name arrays only.
 *   - In development: events are logged to the console with a [telemetry] prefix.
 *   - In production: replace the body of `dispatch()` with your analytics SDK call.
 *     PostHog example: posthog.capture(event.name, event.props)
 */

// ---------------------------------------------------------------------------
// Event schema — discriminated union
// ---------------------------------------------------------------------------

/**
 * Fired once per parse result, immediately after the server returns a
 * confidence score for a text description or screenshot analysis.
 *
 * Firing locations:
 *   - ActivityImportModal: after `handleAiParse` sets `aiParserConfidence` (text path)
 *   - ActivityImportModal: after `analyzeImage` returns and confidence is computed (screenshot path)
 */
export interface ParserConfidenceRecordedProps {
  confidence: number;         // raw 0.0 – 1.0 score
  confidence_pct: number;     // integer 0 – 100 for histogram bucketing
  source: "text" | "screenshot";
  has_warning: boolean;       // true when confidence < LOW_CONFIDENCE_THRESHOLD (0.65)
  workout_type: string;       // e.g. "CrossFit", "Strength"
}

/**
 * Fired once per form mount when the LOW CONFIDENCE PARSE banner is visible.
 * Uses a useEffect with [] deps so it fires exactly once per form display.
 *
 * Firing location:
 *   - ParsedWorkoutForm: useEffect triggered when showBanner is true
 */
export interface ParserWarningShownProps {
  confidence: number;         // raw 0.0 – 1.0
  confidence_pct: number;     // integer 0 – 100
  source: "text" | "screenshot" | "manual";
  warning_count: number;      // number of individual warning strings in the list
}

/**
 * Fired once per save action when the user changed one or more parsed fields
 * before tapping LOG WORKOUT. Tells the PM which fields users find unreliable.
 *
 * Firing location:
 *   - ParsedWorkoutForm: handleSubmit, only when editedFields.length > 0
 */
export interface ImportUserEditedFieldsProps {
  edited_fields: string[];    // subset of: label, workoutType, duration, intensity, muscleGroups, workoutFormat
  edited_field_count: number; // convenience integer for funnel analysis
  source: "text" | "screenshot" | "manual";
  format: string;             // resolved format at save time (may differ from detected format)
  had_low_confidence: boolean;// whether the confidence banner was shown
}

/**
 * Fired once per parse result when a non-UNKNOWN format is detected (or UNKNOWN
 * is the best the parser could do). Allows tracking detection rates per format.
 *
 * Firing locations:
 *   - ActivityImportModal: text path — after `setAiParserFormat(data.workoutFormat)`
 *   - ActivityImportModal: screenshot path — after `analyzeImage` returns a format
 */
export interface WorkoutFormatDetectedProps {
  format: string;             // AMRAP | EMOM | FOR_TIME | STANDARD | UNKNOWN
  source: "text" | "screenshot";
  has_format_warning: boolean;// true when formatWarning was present in the API response
  confidence: number;         // overall parser confidence at detection time
}

/**
 * Fired when the user taps a format chip that differs from the originally
 * detected format. Only fires on changes — not on first render.
 *
 * Firing location:
 *   - ParsedWorkoutForm: onPress handler for FORMAT chip row
 */
export interface WorkoutFormatOverriddenProps {
  from: string;               // originally detected format
  to: string;                 // format the user selected
  source: "text" | "screenshot" | "manual";
  confidence: number;         // parser confidence at the time of the override
}

/**
 * Fired once per card mount when the "Today's Training Adjustment" card is
 * actually shown (i.e. no persisted choice exists for today yet).
 *
 * Firing location:
 *   - TrainingAdjustmentCard: useEffect after AsyncStorage check, when outcome is null
 */
export interface RecommendationShownProps {
  avg_fatigue: number;             // avgFatigue from deload-check response
  session_count: number;           // total sessions counted in the 7-day window
  internal_session_count: number;  // in-app sessions
  external_session_count: number;  // externally logged sessions
  weekly_volume: number;           // stimulus-point-based weekly volume score
  volume_reduction_pct: number;    // DELOAD_VOLUME_REDUCTION_PCT constant value
  intensity_reduction_pct: number; // DELOAD_INTENSITY_REDUCTION_PCT constant value
}

/**
 * Fired when the user taps "Use Recommended Plan".
 *
 * Firing location:
 *   - TrainingAdjustmentCard: handleAccept
 */
export interface RecommendationAcceptedProps {
  avg_fatigue: number;
  session_count: number;
  volume_reduction_pct: number;
  intensity_reduction_pct: number;
}

/**
 * Fired when the user taps "Train as Planned (Override)".
 *
 * Firing location:
 *   - TrainingAdjustmentCard: handleOverride
 */
export interface RecommendationOverriddenProps {
  avg_fatigue: number;
  session_count: number;
  volume_reduction_pct: number;
  intensity_reduction_pct: number;
}

export type TelemetryEvent =
  | { name: "parser_confidence_recorded"; props: ParserConfidenceRecordedProps }
  | { name: "parser_warning_shown"; props: ParserWarningShownProps }
  | { name: "import_user_edited_fields"; props: ImportUserEditedFieldsProps }
  | { name: "workout_format_detected"; props: WorkoutFormatDetectedProps }
  | { name: "workout_format_overridden"; props: WorkoutFormatOverriddenProps }
  | { name: "recommendation_shown"; props: RecommendationShownProps }
  | { name: "recommendation_accepted"; props: RecommendationAcceptedProps }
  | { name: "recommendation_overridden"; props: RecommendationOverriddenProps };

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Fire a telemetry event. Fire-and-forget — never awaited, never throws.
 * Replace the body of this function when wiring to a real analytics SDK.
 */
export function track(event: TelemetryEvent): void {
  try {
    if (__DEV__) {
      console.log(`[telemetry] ${event.name}`, event.props);
    }
    // Production integration point — uncomment and configure your SDK:
    // posthog.capture(event.name, event.props);
    // amplitude.track(event.name, event.props);
  } catch {
    // Telemetry must never crash the app
  }
}
