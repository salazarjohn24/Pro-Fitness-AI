# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains a Pro Fitness AI native mobile app (Expo) with an Express backend and PostgreSQL database.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Mobile**: Expo (React Native) with Expo Router
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: Email/password (bcryptjs) with custom sessions; social auth UI ready (Google, GitHub, X, Apple)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── mobile/             # Expo React Native app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     # pnpm workspace config
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package
```

## Mobile App (artifacts/mobile)

Pro Fitness AI — dark-themed fitness tracker with AI recommendations.

### Screens
- `app/index.tsx` — Entry: redirects to welcome, onboarding, or tabs based on auth + onboarding state
- `app/welcome.tsx` — Landing screen with "Create Account" and "Sign In" options
- `app/login.tsx` — Sign-in form (username/email + password) with social auth buttons
- `app/signup.tsx` — Account creation form (username, email, password) with social auth buttons
- `app/(tabs)/index.tsx` — Status tab: Daily Protocol Sync hub with tasks, onboarding trigger, auto check-in, readiness score, AI workout generation
- `app/onboarding.tsx` — 5-step onboarding flow (Biometrics → Experience → Injury Vault → Goal → Review)
- `app/gym-setup.tsx` — Post-onboarding gym environment setup (name, type, equipment checklist)
- `app/(tabs)/vault.tsx` — Exercise Vault: searchable, filterable exercise card grid (muscle group, equipment, goal filters)
- `app/exercise/[id].tsx` — Exercise detail: YouTube link, instructions, common mistakes, stimulus map, Coach's Note, plateau alerts, similar exercises
- `app/(tabs)/progress.tsx` — Audit tab (Performance Audit): time-range filtered (1M/3M/6M) training volume bar chart + muscle focus breakdown from real API data, data sufficiency banner, audit alerts, recovery correlation
- `app/(tabs)/profile.tsx` — Profile: user info, fitness goals, gym environments, insight preferences, settings
- `app/workout-session.tsx` — Active workout session with exercise cards, swap, video, rest timer → Review screen (exercise summary, add-missed-exercise stepper, AI insights textarea) → Congratulations screen (rotating muscle-specific recovery/nutrition tips, saving spinner)
- `app/workout-architect.tsx` — Multi-step custom workout builder (muscle groups → equipment → AI generate → review → start); check-in gate shows motivational card + inline CheckInModal instead of dead-end lock screen
- `app/workout-detail.tsx` — Unified workout detail screen for both in-app sessions (sets table with inline weight/reps editing) and external workouts (movements list, fatigue meter)

### Key Components
- `components/OnboardingModal.tsx` — Multi-step onboarding: goal, skill level, equipment, injuries
- `components/CheckInModal.tsx` — Daily check-in with 4 questions + body map (sore muscles) + notes; supports editing via initialData
- `components/BodyMap.tsx` — Interactive front/back SVG body diagram for tapping sore muscle groups
- `components/ActivityImportModal.tsx` — External workout logger modal with screenshot import, manual entry (label, duration, type, RPE intensity, muscle groups), and AI interpreter (paste workout description → auto-parsed muscle groups & intensity)
- `app/external-workouts.tsx` — Dedicated screen for viewing, editing, and deleting external workouts with add button
- `components/AppTourOverlay.tsx` — First-launch guided tour overlay (4 steps: Home, Vault, Progress, Profile); persisted via AsyncStorage key `app_tour_v1_completed`; exported helpers `hasTourBeenSeen()` + `markTourSeen()`; replay via Profile → "Replay App Tour" button
- `components/InsightInfoModal.tsx` — Info popup for AI insights and readiness score explanation
- `components/AccordionCard.tsx` — Collapsible card for deep-dive metrics (alert details, recovery correlation breakdown)

### Key Files
- `lib/auth.tsx` — Auth context (Replit OIDC mobile flow)
- `hooks/useProfile.ts` — React Query hooks for profile, check-ins, external workouts (submit, recent, update, delete), readiness score computation, and fitness profile CRUD
- `hooks/useWorkout.ts` — Hooks for workout generation, architect generation, saving, alternatives; `useWorkoutHistory(days)` unified history feed, `useSessionDetail(id)`, `useUpdateSessionExercises(id)` for detail/editing
- `lib/notifications.ts` — Full notification system: `initNotifications()` (auto-schedules on app start), `loadNotifPrefs/saveNotifPrefs/applyNotifPrefs` (AsyncStorage `notif_prefs_v1`), `scheduleDaily` with CALENDAR repeating trigger, `sendTestNotification`, workout-ready notifications. Types: `NotifPrefs`, `DEFAULT_NOTIF_PREFS`
- `constants/recoveryTips.ts` — Rotating muscle-specific recovery tip cards and nutrition tip cards (used on Congratulations screen)
- `hooks/useExercises.ts` — React Query hooks for exercise library (list, detail, history, log set)
- `hooks/useAuditAlerts.ts` — React Query hook for fetching audit alerts (neglect + consistency)
- `hooks/useRecoveryCorrelation.ts` — React Query hook for recovery-to-load correlation data
- `hooks/useVolumeStats.ts` — React Query hook for time-range filtered volume stats (volume timeline + muscle focus)
- `hooks/useEnvironments.ts` — React Query hooks for gym environment CRUD (list, create, activate, delete)
- `components/EquipmentChecklist.tsx` — Reusable categorized equipment checklist component
- `utils/stimulus.ts` — Stimulus point calculation, workout description parser, muscle group inference
- `constants/colors.ts` — Design tokens (dark theme, orange #FC5200)

### Design System
- Background: `#1D1D1B` (near-black)
- Accent: `#FC5200` (Strava orange)
- Highlight: `#F6EA98` (warm gold/yellow)
- Recovery: `#779CAF` (steel blue)
- Glass cards: `rgba(255,255,255,0.05)` with `rgba(255,255,255,0.1)` border

## Database Schema

### `users` table (auth)
- `id` (PK), `email`, `first_name`, `last_name`, `profile_image_url`, `created_at`, `updated_at`

### `sessions` table (auth)
- `sid` (PK), `sess` (JSONB), `expire`

### `user_profiles` table (fitness data)
- `id` (PK serial), `user_id` (FK → users), `streak_days`, `fitness_goal`, `workout_frequency`, `daily_sync_progress`, `check_in_completed`, `activity_imported`
- **Onboarding fields**: `age`, `weight`, `height`, `gender`, `experience_level`, `injuries` (JSON array), `injury_notes`, `primary_goal`, `onboarding_completed` (boolean)
- **Preferences**: `insight_detail_level` (simple/granular), `sync_preferences` (JSON: appleHealth, strava, manualScreenshot booleans)
- **Environment link**: `active_environment_id` (references gym_environments)
- `updated_at`

### `daily_check_ins` table
- `id` (PK serial), `user_id` (FK → users), `date`, `energy_level`, `sleep_quality`, `stress_level`, `soreness_score`, `sore_muscle_groups` (JSONB {muscle, severity}[]), `sleep_score` (integer, auto-computed from sleep_quality), `notes`, `created_at`
- Unique constraint on (user_id, date) for upsert support

### `external_workouts` table
- `id` (PK serial), `user_id` (FK → users), `label`, `duration`, `workout_type`, `source`, `intensity` (1-10), `muscle_groups` (JSONB string[]), `stimulus_points` (integer), `created_at`

### `gym_environments` table
- `id` (PK serial), `user_id` (FK → users), `name`, `type`, `equipment` (JSON: categorized equipment lists), `is_active` (boolean), `created_at`

### `workout_sessions` table
- `id` (PK serial), `user_id` (FK → users), `session_date`, `workout_title`, `duration_seconds`, `exercises` (JSONB [{exerciseId, name, sets: [{reps, weight, completed}]}]), `total_sets_completed`, `total_volume` (real, computed server-side), `consistency_index` (real 0.0–1.0, computed from set completion + post-workout feedback), `post_workout_feedback` (JSONB), `created_at`

### `exercise_library` table
- `id` (PK serial), `name`, `muscle_group`, `equipment`, `goal`, `difficulty`, `youtube_url`, `instructions` (JSONB string[]), `common_mistakes` (JSONB string[]), `primary_muscles` (JSONB string[]), `secondary_muscles` (JSONB string[]), `tertiary_muscles` (JSONB string[]), `alternative_ids` (JSONB int[]), `created_at`

### `workout_history` table
- `id` (PK serial), `user_id` (FK → users), `exercise_id` (FK → exercise_library), `weight`, `reps`, `sets`, `consistency_index` (real, nullable), `performed_at`

## Exercise Library
- 54 exercises stored as JSON constant in `artifacts/api-server/src/data/exercises.ts`
- Categories: warmup (7), compound (15), accessory (20), core (6), cooldown (6)
- Each exercise has: id, name, primaryMuscle, secondaryMuscles, equipment, category, difficulty, alternatives, youtubeKeyword

## API Endpoints

- `GET /api/healthz` — Health check
- `GET /api/auth/user` — Get current auth state
- `GET /api/login` — Start OIDC login (browser)
- `GET /api/callback` — OIDC callback (browser)
- `POST /api/mobile-auth/token-exchange` — Mobile PKCE code exchange
- `POST /api/mobile-auth/logout` — Mobile logout
- `GET /api/profile` — Get user fitness profile (creates if not exists)
- `PUT /api/profile` — Update user fitness profile (supports all onboarding + preference fields)
- `POST /api/checkins` — Create/update today's daily check-in (upsert)
- `GET /api/checkins/today` — Get today's check-in for current user
- `POST /api/checkin` — Save daily check-in data (alternate endpoint, also upserts)
- `GET /api/checkin/latest` — Get today's check-in (alternate endpoint)
- `POST /api/workouts/external` — Log an external workout (manual, screenshot, or AI-parsed) with intensity, muscle groups, stimulus points
- `GET /api/workouts/external` — Get recent external workouts (last 10, newest first)
- `PUT /api/workouts/external/:id` — Update an external workout
- `DELETE /api/workouts/external/:id` — Delete an external workout
- `GET /api/environments` — List user's gym environments
- `POST /api/environments` — Create new gym environment
- `PUT /api/environments/:id` — Update gym environment
- `DELETE /api/environments/:id` — Delete gym environment
- `PATCH /api/environments/:id/activate` — Set environment as active (validates ownership first)
- `POST /api/workout/generate` — Generate personalized workout from profile + check-in data
- `POST /api/workout/architect-generate` — Generate custom workout from selected muscle groups + equipment
- `POST /api/workout/sessions` — Save completed workout session
- `GET /api/workout/sessions` — Get user's workout history (last 20)
- `GET /api/exercises` — List exercises with optional filters (muscle_group, equipment, goal, search)
- `GET /api/exercises/:id` — Get exercise detail with resolved alternatives
- `GET /api/exercises/:id/history` — Get last 3 sessions with 1RM estimate, plateau detection, rest recommendation
- `POST /api/exercises/:id/history` — Log a set (weight, reps, sets)
- `GET /api/exercises/:id/alternatives` — Get alternative exercises for swapping
- `GET /api/audit/alerts` — Get audit alerts (neglected muscles 10+ days, consistency checks <80%)
- `GET /api/audit/recovery-correlation` — Get recovery-to-load correlation (high vs low sleep score volume comparison)
- `GET /api/audit/volume-stats?range=1M|3M|6M` — Get time-range filtered training volume timeline + muscle focus breakdown

## AI Integration (OpenAI via Replit AI Integrations)

- **Provider**: OpenAI via Replit AI Integrations proxy (no API key required, billed to credits)
- **Package**: `@workspace/integrations-openai-ai-server` (lib/integrations-openai-ai-server)
- **Model**: `gpt-5-mini` for all fitness AI features
- **AI Features**:
  - `POST /api/workout/generate` — AI selects exercises from library, sets sets/reps, writes rationale (falls back to rule-based)
  - `POST /api/workout/architect-generate` — AI generates custom workout for requested muscle groups (falls back to rule-based)
  - `POST /api/workout/parse-description` — AI parses natural language workout descriptions into structured data (muscleGroups, intensity, duration, type, label)
  - `GET /api/exercises/:id/coach-note` — AI generates personalized coach's note based on user's history, injuries, and goals
  - `GET /api/audit/ai-insight` — AI generates a personalized performance analysis paragraph from training data, alerts, and recovery patterns
- **Service**: `artifacts/api-server/src/services/aiService.ts` — all OpenAI calls with rule-based fallbacks
- **Mobile hooks**:
  - `useExerciseCoachNote(id)` — fetches AI coach note for exercise detail screen
  - `useAIAuditInsight()` — fetches AI performance analysis for the progress/audit screen
- **Fallbacks**: All AI endpoints fall back to rule-based logic if the API call fails

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`
Push DB schema: `pnpm --filter @workspace/db run push`

---

## Backlog — Low Priority

Known low-severity issues confirmed during QA passes across all screens. None are blocking — all tabled for a future cleanup pass.

### Tabled — future release

| # | Screen | File | Issue |
|---|--------|------|-------|
| L2 | Audit | `app/(tabs)/progress.tsx` | `AlertChip` key uses `alert.muscle` which can be undefined for consistency alerts. Safer key: `${alert.type}-${i}`. |
| L3 | Audit | `app/(tabs)/progress.tsx` | Recovery correlation accordion renders even when `hasEnoughData` is false — should be gated. |
| L4 | Audit | `app/(tabs)/progress.tsx` | Tied-peak volume bars both highlighted orange — should highlight only the most-recent peak. |
| L5 | Audit | `api-server/src/routes/audit.ts` | External workouts contribute 1 set/muscle regardless of actual volume — muscle focus % not apples-to-apples with in-app sessions. |
| L9 | Vault | `api-server/src/routes/exercises.ts` | `consistencyIndex` always written as `null` when logging a set — fix when a feature consumes this field. |
| L10 | Vault | `api-server/src/routes/exercises.ts` | Internal docs comment references `/alternatives` — actual endpoint is `/api/exercises/:id/alternatives`. |
| L11 | Profile | `app/(tabs)/profile.tsx` | "PRO MEMBER" badge hardcoded for all users — gate on a real membership field once subscriptions are added. |
| L14 | Profile | `app/(tabs)/profile.tsx` | Quick-tap `updateProfile` calls (insight level, etc.) have no `onError` handler — silent failures. |
| L15 | Profile | `app/(tabs)/profile.tsx` | `markTourSeen()` fires on tour open rather than on completion — should move to `onDone` callback. |
| L16 | Builder | `app/workout-architect.tsx` | Env switcher icon (line 683) still uses hard-coded ternary — same as L13 fixed in profile.tsx. Use `GYM_TYPES.find(...)` lookup. |
| L17 | Builder | `app/workout-architect.tsx` | Chest and Biceps both use the "💪" emoji in `MUSCLE_GROUPS` — duplicate icon, no functional impact. |
| L18 | Builder | `app/workout-architect.tsx` | Swap fetch failure shows "No alternatives available" — indistinguishable from a genuinely empty result. |
| L19 | Builder | `app/workout-architect.tsx` | Workout name `TextInput` has no `placeholder` prop — blank if AI returns an empty title. |
| L20 | Builder | `app/workout-architect.tsx` | Deleting all exercises disables START with no explanation text — user may not know why the button is greyed out. |
