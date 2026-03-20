# Pro Fitness AI — Import Parser QA Playbook

> Version: Phase 5 · Last updated: 2026-03-20  
> Run before every build that touches `ActivityImportModal`, `ParsedWorkoutForm`,
> `aiService.ts`, `formatParser.ts`, or `sessionLoad.ts`.

---

## Event Schema Reference

All events are fired via `artifacts/mobile/lib/telemetry.ts → track()`.  
In production, wire `track()` to PostHog / Amplitude. In development, events appear in the Metro console with a `[telemetry]` prefix.

| Event name | Fired from | When |
|---|---|---|
| `parser_confidence_recorded` | `ActivityImportModal` | After AI text parse **or** screenshot analysis returns confidence |
| `parser_warning_shown` | `ParsedWorkoutForm` (useEffect) | Once per form mount when confidence < 0.65 |
| `import_user_edited_fields` | `ParsedWorkoutForm` (handleSubmit) | On save when ≥ 1 field was changed from parsed value |
| `workout_format_detected` | `ActivityImportModal` | After AI text parse or screenshot returns a format tag |
| `workout_format_overridden` | `ParsedWorkoutForm` (format chip onPress) | When user taps a format chip different from the originally detected format |

### `parser_confidence_recorded`
```json
{
  "confidence": 0.72,
  "confidence_pct": 72,
  "source": "text | screenshot",
  "has_warning": false,
  "workout_type": "CrossFit"
}
```

### `parser_warning_shown`
```json
{
  "confidence": 0.55,
  "confidence_pct": 55,
  "source": "text | screenshot | manual",
  "warning_count": 1
}
```

### `import_user_edited_fields`
```json
{
  "edited_fields": ["label", "duration"],
  "edited_field_count": 2,
  "source": "text | screenshot | manual",
  "format": "AMRAP",
  "had_low_confidence": true
}
```

### `workout_format_detected`
```json
{
  "format": "AMRAP | EMOM | FOR_TIME | STANDARD | UNKNOWN",
  "source": "text | screenshot",
  "has_format_warning": false,
  "confidence": 0.72
}
```

### `workout_format_overridden`
```json
{
  "from": "STANDARD",
  "to": "AMRAP",
  "source": "text | screenshot | manual",
  "confidence": 0.80
}
```

---

## QA Checklist

### TC-01 — Happy Path: Text Import

**Precondition**: Logged in, on Home or Activity tab.

| Step | Action | Expected result | Telemetry expected |
|---|---|---|---|
| 1 | Tap "+ Import Workout" | Import modal opens on "Choose" step | — |
| 2 | Tap "AI Interpreter" | Text input screen appears | — |
| 3 | Paste a clear workout description (e.g. `"Back Squat 5×5 @ 80kg, then RDL 4×8"`) | — | — |
| 4 | Tap "Analyze Workout" | Spinner appears, then `ParsedWorkoutForm` opens | `parser_confidence_recorded` {source:"text", has_warning:false} |
| 5 | Verify label, type, duration, intensity and muscle groups are pre-filled | All fields populated | — |
| 6 | Verify FORMAT chip row shows correct format (STANDARD for strength work) | STANDARD chip highlighted in indigo | `workout_format_detected` {format:"STANDARD"} |
| 7 | Tap "LOG WORKOUT" without changing any field | Workout saved, modal closes | _(no `import_user_edited_fields` — nothing was changed)_ |

**Pass**: Workout appears in history. No amber warning banner. All 2 telemetry events fired.

---

### TC-02 — Low-Confidence Warning Flow

**Precondition**: Use a vague description such as `"did some stuff at the gym for about an hour"`.

| Step | Action | Expected result | Telemetry expected |
|---|---|---|---|
| 1 | Paste the vague description and tap "Analyze" | `ParsedWorkoutForm` opens | `parser_confidence_recorded` {has_warning:true} |
| 2 | Observe top of form | Amber "LOW CONFIDENCE PARSE" banner with percentage badge is visible | `parser_warning_shown` {source:"text"} |
| 3 | Verify the percentage badge matches `confidence_pct` in console | Badge reads the same integer | — |
| 4 | Check that all fields are still editable | Label, type, duration, intensity, muscle groups all respond to taps | — |
| 5 | Save without editing | Workout saved; `wasUserEdited: false` on the saved record | _(no `import_user_edited_fields`)_ |

**Pass**: Banner fires exactly once (not on re-renders). Confidence badge is accurate. Workout logs normally.

---

### TC-03 — Edit-Before-Save Flow

**Precondition**: Start from TC-01 step 4 (clear workout, form open, no warning banner).

| Step | Action | Expected result | Telemetry expected |
|---|---|---|---|
| 1 | Change the label to a custom name | Label field updates | — |
| 2 | Change duration chip (e.g. 30 → 45 min) | Duration updates | — |
| 3 | Tap "LOG WORKOUT" | Workout saved | `import_user_edited_fields` {edited_fields:["label","duration"], edited_field_count:2, had_low_confidence:false} |
| 4 | Open the saved workout in history | Label and duration reflect the edited values | — |

**Pass**: Event fires with the correct field list. `wasUserEdited: true` on the saved record.

---

### TC-04 — Screenshot Import Flow

**Precondition**: Have a CrossFit WOD screenshot ready in the photo library.

| Step | Action | Expected result | Telemetry expected |
|---|---|---|---|
| 1 | Tap "+ Import Workout" → "Photo Library" | Image picker opens | — |
| 2 | Select a CrossFit WOD screenshot | Scanning spinner appears | — |
| 3 | Wait for analysis | `ParsedWorkoutForm` opens | `parser_confidence_recorded` {source:"screenshot"}, `workout_format_detected` {source:"screenshot"} |
| 4 | Verify muscle groups are populated from the image | At least one muscle group chip highlighted | — |
| 5 | Save without editing | Workout saved | — |

**Pass**: Two telemetry events fire. Workout saved with correct source = "screenshot".

---

### TC-05 — CrossFit Format Detection and Override

**Precondition**: Paste a clear AMRAP description: `"AMRAP 12: 10 Thrusters 95lb, 10 Pull-ups, 10 Box Jumps 24"`.

| Step | Action | Expected result | Telemetry expected |
|---|---|---|---|
| 1 | Analyze the text | Form opens | `workout_format_detected` {format:"AMRAP"} |
| 2 | Verify FORMAT chip row | "AMRAP" chip is highlighted in indigo | — |
| 3 | Tap "EMOM" chip | EMOM chip becomes highlighted | `workout_format_overridden` {from:"AMRAP", to:"EMOM"} |
| 4 | Tap "AMRAP" chip again (reverting) | AMRAP highlighted, no override event | _(event NOT re-fired — only fires on change away from detected)_ |
| 5 | Save | Workout saved with `workoutFormat: "EMOM"` | — |

**Pass**: Override event fires exactly once (on the first change). Reverting to the original does not fire again. Saved format matches the chip the user last selected.

---

### TC-06 — Deload Check: External Workout Parity (Phase 4 regression)

**Precondition**: Account with 3 consecutive high-fatigue check-ins (energy ≤ 2, soreness ≥ 4, stress ≥ 4).  
Import 4 external workouts across the last 7 days (instead of 4 internal sessions).

| Step | Action | Expected result |
|---|---|---|
| 1 | Import 4 external workouts over 7 days | All 4 log successfully |
| 2 | Hit `GET /api/workout/deload-check` | Response: `recommended: true`, `sessionCount: 4`, `externalSessionCount: 4`, `internalSessionCount: 0` |
| 3 | Repeat with 4 internal sessions instead (no external) | Same `recommended: true`, `sessionCount: 4` |
| 4 | Repeat with 2 internal + 2 external | `sessionCount: 4`, `recommended: true` |

**Pass**: Deload fires equally for external-only, internal-only, and mixed weeks.

---

### TC-07 — Readiness Impact: Combined Day (Phase 4 regression)

**Precondition**: Log both an internal session AND an external workout on the same date.

| Step | Action | Expected result |
|---|---|---|
| 1 | Log internal session (any workout) | Appears in session history |
| 2 | Import external workout for today | Appears in external history |
| 3 | Hit `POST /api/workout/recovery-insights` | `todayWorkout.label` contains BOTH workout names concatenated with " + " |
| 4 | Verify `todayWorkout.intensity` | Equals the higher of the two intensities |
| 5 | Verify `todayWorkout.muscleGroups` | Contains groups from the external workout |

**Pass**: Neither workout is silently dropped. Combined context sent to AI recovery insight generation.

---

## Release Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| `track()` throws → crashes app | **None** | Wrapped in try/catch; telemetry never surfaces errors |
| `parser_warning_shown` fires on re-renders | Low | Guarded by `useEffect([], [])` — fires once per mount |
| `workout_format_overridden` fires on initial chip render | None | Guard: `value !== workoutFormat && value !== originalFormat` prevents render-time fires |
| External workouts counted in deload push false positives | Low-Medium | Threshold is 4 sessions — same as before. Monitor deload rate in analytics for 2 weeks post-release |
| `weeklyVolume` unit mismatch (kg-reps vs load-equiv) | Low | Field is display-only. `recommended` uses only `sessionCount` + `avgFatigue` |
| Screenshot telemetry missing when `analyzeImage` fails | Low | Fallback path (default 47-min session) deliberately omits events — no data to report |

---

## Rollback Notes

All Phase 5 changes are **purely additive** — no schema changes, no API contract changes, no behavior changes to existing flows.

**To roll back telemetry only** (leave Phase 3 + 4 intact):
1. Delete `artifacts/mobile/lib/telemetry.ts`
2. Remove `import { track } from "@/lib/telemetry"` from both components
3. Remove the `importSource` prop from `ParsedWorkoutForm` (revert to previous `Props` interface)
4. Remove the `useEffect` for `parser_warning_shown` from `ParsedWorkoutForm`
5. Remove the `track(...)` calls in `handleSubmit` and the format chip `onPress`

The app will behave identically to pre-Phase-5 with no data loss.

**Checkpoint**: `d9c3463cef4d7cedb066e7a489baf18c801951a7` (post-Phase-4 merge)  
Roll back to this commit if Phase 5 introduces any unexpected side effects.

---

## Monitoring Dashboard Setup (Post-Launch)

Recommended PostHog funnels once the `track()` stub is wired to a real SDK:

```
Funnel: Import quality
  parser_confidence_recorded (any)
  → parser_warning_shown (where confidence_pct < 65)
  → import_user_edited_fields (where had_low_confidence = true)

Insight: Format detection rate by source
  COUNT UNIQUE(parser_confidence_recorded) GROUP BY source
  WHERE workout_format_detected.format != "UNKNOWN"

Insight: Fields most commonly corrected
  import_user_edited_fields → BREAKDOWN BY edited_fields (array unpack)

Insight: Override frequency by format
  workout_format_overridden → BREAKDOWN BY from, to
```
