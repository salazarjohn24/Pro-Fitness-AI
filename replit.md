# Workspace

## Overview

This project is a pnpm monorepo using TypeScript, designed for a native mobile fitness application (Pro Fitness AI) with an Express.js backend and a PostgreSQL database. The Pro Fitness AI app is a dark-themed fitness tracker that provides AI-powered workout recommendations, tracks user progress, and offers a comprehensive exercise vault. The project aims to deliver a highly personalized and intelligent fitness experience to users.

## User Preferences

I prefer concise and accurate responses. Please prioritize functionality and clean code. For any significant architectural changes or new feature implementations, please ask for my approval before proceeding. I prefer to work iteratively, with small, testable changes.

## System Architecture

The project is structured as a pnpm workspace monorepo.

### Core Technologies
- **Monorepo Tool**: pnpm workspaces
- **Backend**: Node.js 24, Express 5, PostgreSQL, Drizzle ORM
- **Mobile**: Expo (React Native), Expo Router
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Custom email/password (bcryptjs) with sessions; UI for social auth (Google, GitHub, X, Apple) is present.
- **Validation**: Zod (v4), drizzle-zod
- **API Codegen**: Orval (from OpenAPI spec)
- **Build Tool**: esbuild (CJS bundle)
- **AI Integration**: OpenAI via Replit AI Integrations proxy, specifically `gpt-5-mini` for all fitness AI features.

### Monorepo Structure
- `artifacts/`: Contains deployable applications (`api-server`, `mobile`).
- `lib/`: Houses shared libraries (`api-spec`, `api-client-react`, `api-zod`, `db`).
- `scripts/`: Utility scripts.

### Mobile App (Pro Fitness AI)
A dark-themed fitness tracker with AI recommendations.
- **Key Features**: Authentication flows (welcome, login, signup), 5-step onboarding (biometrics, experience, injuries, goals), daily protocol sync hub, exercise vault with detailed exercise views, performance audit (progress tracking), profile management, active workout sessions, and a custom workout architect.
- **Key Components**: OnboardingModal, CheckInModal (with BodyMap for soreness tracking), ActivityImportModal (for external workout logging with AI interpretation + explicit keyboard dismiss affordance), ParsedWorkoutForm (reusable confidence-aware edit form with movementType-based set editor, "Save Anyway" banner action, and set-level editedFields tracking), MovementSetEditor (per-exercise card with strength/bodyweight/hold/cardio type chips + per-set row editing with add/remove), AppTourOverlay, InsightInfoModal, AccordionCard.
- **State Management**: React Query hooks are extensively used for data fetching and mutation (e.g., `useProfile`, `useWorkout`, `useExercises`).
- **Notifications**: Full notification system with scheduling and preference management (`lib/notifications.ts`).
- **Design System**: Predominantly dark theme (`#1D1D1B` background) with accent colors like Strava orange (`#FC5200`), warm gold (`#F6EA98`), and steel blue (`#779CAF`). Glass-effect cards use `rgba(255,255,255,0.05)`.

### Database Schema
The PostgreSQL database schema includes tables for:
- `users`: User authentication details.
- `sessions`: User session management.
- `user_profiles`: Fitness-specific user data, onboarding information, and preferences.
- `daily_check_ins`: Daily user check-in data including energy, sleep, stress, and soreness.
- `external_workouts`: Records of workouts logged from external sources. Includes parser columns: `parserConfidence` (real), `parserWarnings` (jsonb), `workoutFormat` (varchar), `wasUserEdited` (boolean), `editedFields` (jsonb, includes "sets" when set-level data was edited). The `movements` jsonb column stores enriched `RichMovement` objects with `movementType` + `setRows` (P3, backward-compatible). Decision-lock additions: `lastEditedAt` (timestamp nullable), `editSource` (varchar, "manual"|"ai"|"user"), `rawImportText` (text nullable).
- `workout_history`: Per-exercise history. P4 additions: `externalWorkoutId` (int, nullable FK → external_workouts ON DELETE SET NULL), `durationSeconds` (int nullable, for holds/cardio), `distanceMeters` (int nullable, for cardio — P4.1), `source` (varchar, 'internal'|'external'). Decision-lock additions: `longestSetDuration` (int nullable, max single-set hold duration in seconds). Cardio rows: weight=0, reps=0, sets=1.
- `exercise_performance`: Aggregated performance records. P4 additions: `externalWorkoutId` (int, nullable FK → external_workouts ON DELETE SET NULL), `source` (varchar, 'internal'|'external').
- `gym_environments`: User-defined gym setups with equipment.
- `workout_sessions`: Details of completed workout sessions.
- `exercise_library`: Comprehensive exercise data.
- `user_feedback`: User-submitted feedback (message + userId + timestamp).

### AI Integration
- **Provider**: OpenAI via Replit AI Integrations.
- **Model**: `gpt-5-mini`.
- **Key AI Features**:
    - Generating personalized workouts (`/api/workout/generate`).
    - Architecting custom workouts (`/api/workout/architect-generate`).
    - Parsing natural language workout descriptions (`/api/workout/parse-description`).
    - Generating personalized coach's notes for exercises (`/api/exercises/:id/coach-note`).
    - Providing personalized performance analysis insights (`/api/audit/ai-insight`).
- **Fallback Mechanism**: All AI endpoints have rule-based fallbacks in case of API call failures.
- **External Fatigue Integration**: AI workout generation incorporates external workout data to adjust recommendations based on recent fatigue.

### Development Workflow
- **TypeScript**: `composite: true` for all packages, `tsconfig.base.json` for shared configurations.
- **Codegen**: `pnpm --filter @workspace/api-spec run codegen` for API client generation.
- **DB Schema Push**: `pnpm --filter @workspace/db run push` for Drizzle ORM schema synchronization.

## TestFlight Publishing — REQUIRED STEPS EVERY TIME

**ALWAYS remind the user to do these steps before every new TestFlight build.**

### Step 1: Bump the build number in `artifacts/mobile/app.json`
- Find `"buildNumber"` under `"ios"` and increment it by 1 (e.g. 9 → 10, 10 → 11)
- Apple rejects any build with a number it has already seen — this is the #1 cause of submission failures

### Step 2: Build
Run in the Replit shell from `artifacts/mobile`:
```
npx eas-cli@latest build --platform ios --profile production
```

### Step 3: Submit to TestFlight
Once the build finishes:
```
npx eas-cli@latest submit --platform ios --latest
```

### Notes
- HealthKit, push notification credentials, and provisioning profiles are permanently set up — never need to be touched again
- Current build number as of March 22 2026: **20** (always auto-increment before any EAS build; next build must use **21**)
- Bundle ID: `app.replit.profitnessai`
- EAS Project: `@salazarjohn24/mobile`
- ASC App ID: `6760667643`

## Exercise Library Seeding

The `exercise_library` table is populated by `lib/db/src/seed-exercises.ts`.

**Run the seeder:**
```bash
pnpm --filter @workspace/db run seed:exercises
```

**Automatic seeding on startup:** The API server (`artifacts/api-server/src/index.ts`) automatically calls `seedExercises()` on every startup. If the table is empty (e.g. fresh production deployment) it seeds all exercises; if rows already exist it exits in milliseconds. This means production will self-seed on the next deployment restart.

**When to run manually (standalone):**
- Fresh environment setup (cloned repo, new Replit workspace) before the server starts
- After a full database reset or `push-force` that drops all rows
- To force a re-seed: truncate first (`TRUNCATE exercise_library RESTART IDENTITY CASCADE;`) then run the script

**Idempotency:** The script checks for any existing row before inserting. It will never duplicate records.

**Current state (March 22 2026):** 49 exercises seeded via `seed-exercises.ts` — legs, chest, back, shoulders, arms, core; equipment types: barbell, dumbbell, cable, machine, bodyweight; difficulties: beginner, intermediate, advanced.

## Pre-Release Gate (P5 Complete)

Run before every TestFlight build:
```bash
bash scripts/pre-release-check.sh
```
Gates: auth config check (prod domain) + API tests + mobile tests. Exit 0 = all pass.

**Test baseline (March 22 2026) — buildNumber 20:**
- API: 419 tests across 15 files (`artifacts/api-server`)
- Mobile: 175 tests across 4 files (`artifacts/mobile`)
- Regression suites: `artifacts/api-server/tests/regression.test.ts` (REG-1→REG-5), `artifacts/mobile/lib/__tests__/regression.test.ts` (REG-M1→REG-M7)
- Phase A additions: 13 HealthKit diagnostic tests (HS-11→HS-14); DiagnosticState + DIAG_STORAGE_KEY in healthSyncUtils; useHealthDiagnostics hook + HealthDiagnosticsPanel (__DEV__ only)
- Phase B additions: MatchedBy type + matched_by field on ExerciseMatchResult; resolveOrCreateExerciseIdWithMeta; VI-36→VI-42 pure tests; MI-1→MI-7 integration tests; Recent Activity filter pills (All/Internal/External/Apple Health); apple_health icon (heart/pink) + label fix; profile production status row (dot + last sync + error code) + Open Settings button (Linking.openSettings when NOT_AVAILABLE)
- PM release checklist: `docs/RELEASE_CHECKLIST.md`

## Movement Profile Engine (Step 1 — April 2026)

A canonical muscle weighting engine that augments (never replaces) the broad keyword stimulus logic.

### Taxonomy
12-group V1 taxonomy: `chest | shoulders | triceps | biceps | upper_back_lats | lower_back | core | glutes | hamstrings | quads | calves | forearms_grip`

### Key files
- `artifacts/api-server/src/lib/movementProfiles.ts` — types, 41 profiles, alias map, `normalizeMovementName()`, `getMovementProfile()`, `getBaseMuscleVector()`
- `artifacts/api-server/src/lib/muscleNormalization.ts` — extended with `toAuditMuscle(mg)` that maps V1 → existing 10-group audit canonical (`upper_back_lats` → `back`, `lower_back` → `back`, `forearms_grip` → null/dropped)
- `artifacts/api-server/src/routes/audit.ts` — `getMuscleGroupsFromName()` now tries profile vector first (weight ≥ 0.25), falls through to keyword logic on null
- `artifacts/api-server/src/lib/__tests__/movementProfiles.test.ts` — 704 unit tests; alias resolution, normalization, vector correctness, weight-role invariants, audit mapping, coverage sanity

### Integration behavior
- Profile recognized → returns primary + secondary muscles (weight ≥ 0.25) mapped to audit canonical
- `forearms_grip` is silently dropped (not in current `CANONICAL_MUSCLES`)
- Profile not recognized (e.g. "zottman curl") → returns null → keyword fallback runs exactly as before
- All existing tests continue to pass

### Deferred to Step 2+
Prescribed vs. performed architecture, historical rollups/aggregations, readiness/recovery/fatigue scoring, broad UI redesigns.

## Training Intelligence Engine — Steps 1–6 (April 2026)

A pure-TypeScript scoring stack in `artifacts/api-server/src/lib/`. All steps are additive layers — each imports only from the one below, never upward.

### Step 1 — Muscle profiles (`movementProfiles.ts`)
50 canonical movement profiles. `getMovementProfile(name)` → muscle weight vector.

### Step 2 — Movement-level scoring (`muscleVector.ts`)
`scoreMovement(input)` → `MovementScoreResult` with `muscleVector`, `stimulusVector`, `rawScore`, pattern, method.

### Step 3 — Workout-level aggregation (`workoutVector.ts`)
`scoreWorkout(input)` → `WorkoutScoreResult` with additive `muscleVector`, `patternVector`, rawScore-weighted `stimulusVector`, ranked `summary`.

### Step 4 — Historical rollup (`historyAggregation.ts`)
`scoreHistory(inputs, options)` → `HistoricalRollupResult` with cumulative + recency-decay vectors (0–2d=1.0, 3–7d=0.80, 8–14d=0.55, 15–30d=0.30, 31–90d=0.15, >90d=0.08), rank-shift detection, fully injectable `referenceDate`.

### Step 5 — Insight layer (`historyInsights.ts`)
`generateInsights(rollup, options)` → `InsightGenerationResult`. 8 insight types (recently elevated/reduced, underrepresented muscle/pattern, dominant pattern/stimulus bias, balance observations, data quality note). All text is relative/descriptive — never prescriptive.

### Step 6 — Presentation integration (April 2026)

**Backend routes** (`artifacts/api-server/src/routes/analysis.ts`):
- `GET /api/workouts/sessions/:id/analysis` — runs `scoreWorkout` on a stored session's exercises; returns `WorkoutScoreResult`
- `GET /api/workouts/external/:id/analysis` — Step 8: adapts external workout via `externalWorkoutAdapter`, scores when eligible; returns `WorkoutScoreResult + importedDataNote`; 422 when ineligible
- `GET /api/training/history-analysis?days=N&rangeLabel=...` — runs `scoreHistory` + `generateInsights`; returns `{ rollup, insights }`
- Weight parser: `artifacts/api-server/src/lib/weightParser.ts` — converts "135 lbs" / "60 kg" / bare number / "bodyweight" to kg

**Mobile presentation layer**:
- `artifacts/mobile/lib/formatters/trainingDisplay.ts` — label maps (muscleLabel, patternLabel, stimulusLabel), roundScore, formatScorePct, severityTier, displayOrFallback
- `artifacts/mobile/lib/viewModels/workoutAnalysisViewModel.ts` — `buildWorkoutAnalysisViewModel(WorkoutScoreResultJSON)` → `WorkoutAnalysisDisplayModel` with headline, topMuscles, topPatterns, dominantStimulus, presentStimuli, dataQualityNote, sections
- `artifacts/mobile/lib/viewModels/historyAnalysisViewModel.ts` — `buildHistoryAnalysisViewModel(rollup, insights)` → `HistoryAnalysisDisplayModel` with headline, topMuscles, recentShifts, insightCards, dataQualityNote, summaryObservations
- `artifacts/mobile/hooks/useWorkoutAnalysis.ts` — React Query hook for session analysis endpoint
- `artifacts/mobile/hooks/useTrainingAnalysis.ts` — React Query hook for history analysis endpoint (`TrainingRangePreset`: 7 | 14 | 30 | 60 | 90)
- `artifacts/mobile/hooks/useExternalWorkoutAnalysis.ts` — Step 8: React Query hook for external workout analysis; returns null on 422/404 (graceful fallback)

**Test baseline (April 2026):**
- api-server: **1,376 tests / 21 files** (Steps 1–6 including weightParser)
- mobile: **255 tests / 7 files** (trainingDisplay, workoutAnalysisViewModel, historyAnalysisViewModel)

### Step 7 — UI wiring (April 2026)

**`artifacts/mobile/app/workout-detail.tsx`** — internal sessions now show a `WorkoutAnalysisPanel` (headline, engine-scored muscle chips, pattern chips, stimulus badge, data quality note) in place of the coarse `primaryMuscle` chips. Fallback to coarse chips if analysis is empty. Loading skeleton shown while analysis fetches.

**`artifacts/mobile/app/activity-history.tsx`** — `TrainingOverviewPanel` added as `FlatList ListHeaderComponent`. Range picker (7d/30d/90d), muscle chips with ↑/↓ shift indicators, insight cards, data quality notes. History analysis hook calls the backend. Shows skeleton while loading, empty state for no data.

**`lib/__tests__/step7Integration.test.ts`** — 43 new tests covering: workout analysis panel render/fallback/loading/error, history overview states, insight card structure and text-safety contract, recent shift flags, severity values, coexistence decisions, and determinism.

**Test baseline (April 2026, after Step 7):**
- api-server: **1,376 tests / 21 files** (unchanged)
- mobile: **298 tests / 8 files** (+43 step7Integration)

### Step 8 — External workout analysis unification (April 2026)

**`artifacts/api-server/src/lib/externalWorkoutAdapter.ts`** — Pure adapter converting external workout DB rows → `PerformedWorkoutInput`. Computes `ExtractionQuality` (`totalMovements`, `hasSetData`, `isEligible`, `ineligibleReason`). `importedDataNote()` helper for name-only imports.

**`GET /api/workouts/external/:id/analysis`** — New endpoint in `analysis.ts`. Auth-guarded. Uses adapter → eligibility check → `scoreWorkout()`. Returns `WorkoutScoreResult + importedDataNote` (200) or `{ eligible: false, reason }` (422) or 404.

**`artifacts/mobile/hooks/useExternalWorkoutAnalysis.ts`** — Hook. Returns null on 422/404 (triggers coarse-chip fallback). Throws on 5xx.

**`workout-detail.tsx` external branch** — Now calls `useExternalWorkoutAnalysis`. Shows `WorkoutAnalysisPanel` when eligible (analysis available), falls back to coarse `muscleGroups` chips when not. `importedDataNote` shown as a second info row when present and `dataQualityNote` is null.

**`WorkoutAnalysisPanel`** — Updated to accept optional `importNote` prop (extra info line for external name-only imports).

**History endpoint** — `buildExternalWorkoutInput` inline helper replaced by `adaptExternalWorkout` from the adapter. Eligibility now uses `quality.isEligible` guard (same logic, cleaner code).

**Test baseline (April 2026, after Step 8):**
- api-server: **1,409 tests / 22 files** (+33 externalWorkoutAdapter)
- mobile: **314 tests / 9 files** (+16 step8Integration)

### Step 9 — MVP hardening pass (April 2026)

**Coexistence cleanup:**
- `stimulusPoints` stat suppressed when `extAnalysisVm.hasAnalysis=true` — eliminates coarse/premium stimulus contradiction for external workouts
- Coexistence rules documented in a `COEXISTENCE RULES` comment block in `workout-detail.tsx`
- `mv.muscleGroups` null guard tightened in movement card JSX

**Trust/data-quality wording improvements:**
- `workoutAnalysisViewModel.ts` `dataQualityNote`: wording changed from "weren't in the library" → "used generic patterns — muscle targets are estimated." (avoids implying user action, accurately describes what happened)
- `historyAnalysisViewModel.ts` `dataQualityNote`: wording changed from "weren't recognised" → "used generic patterns — muscle detail may be approximate."
- `activity-history.tsx` low-data note: fixed pluralization bug ("1 workout" vs "X workouts")

**New exported fields:**
- `WorkoutAnalysisDisplayModel.analysisConfidence: "high" | "medium" | "low"` — derived from fallback ratio; gives the screen a single testable signal for trust-level decisions
- `HistoryAnalysisDisplayModel.dataConfidence: "high" | "medium" | "low"` — parallel field for history overview
- `QUALITY_NOTE_HIGH_THRESHOLD`, `QUALITY_NOTE_LOW_THRESHOLD` exported from workout VM
- `HISTORY_MIN_WORKOUTS_FOR_DATA`, `HISTORY_QUALITY_NOTE_HIGH_THRESHOLD`, `HISTORY_QUALITY_NOTE_LOW_THRESHOLD` exported from history VM

**Telemetry (structured `console.info` logging in `analysis.ts`):**
- `[analysis] session=N movements=N fallback=N`
- `[analysis] external=N eligible=true|false movements=N fallback=N hasSetData=bool`
- `[analysis] history days=N sessions=N external=N total=N fallback_workouts=N fallback_rate=X.XX`

**Tests (`step9Integration.test.ts`, +42 mobile tests):**
- analysisConfidence computation and boundaries
- dataQualityNote wording assertions (new language)
- stimulusPoints coexistence rule
- importNote deduplication rule
- dataConfidence computation
- hasEnoughData threshold
- Contract stability (all pre-Step-9 fields still present)
- Determinism

**Test baseline (April 2026, after Step 9):**
- api-server: **1,409 tests / 22 files** (unchanged)
- mobile: **356 tests / 10 files** (+42 step9Integration)

### Deferred to Step 10+
Readiness/recovery/fatigue scoring, personalized recommendations, prescribed vs. performed delta, body-map rendering.

## External Dependencies

- **OpenAI**: Integrated via Replit AI Integrations for all AI-powered features (workout generation, parsing, insights, coach notes).
- **PostgreSQL**: Primary database for all application data.
- **Expo**: Framework for building the native mobile application.
- **Express.js**: Web application framework for the backend API.
- **React Native**: UI framework for mobile development.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL interaction.
- **Zod**: Schema declaration and validation library.
- **Orval**: OpenAPI spec code generator.
- **bcryptjs**: For password hashing.
- **AsyncStorage**: For persistent local storage in the mobile app (e.g., notification preferences, app tour state).