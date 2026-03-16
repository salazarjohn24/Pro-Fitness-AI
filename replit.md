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
- **Authentication**: Replit Auth (OIDC/PKCE) with mobile token exchange
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
- `app/index.tsx` — Entry: redirects to welcome or tabs based on auth state
- `app/welcome.tsx` — Welcome/login screen with "Get Started" button
- `app/(tabs)/index.tsx` — Status tab: Daily Protocol Sync hub with tasks, onboarding trigger, auto check-in, readiness score
- `app/(tabs)/vault.tsx` — Workout Vault: exercise library with categories
- `app/(tabs)/progress.tsx` — Progress: analytics, bar charts, muscle focus
- `app/(tabs)/profile.tsx` — Profile: user info, fitness goals, settings

### Key Components
- `components/OnboardingModal.tsx` — Multi-step onboarding: goal, skill level, equipment, injuries
- `components/CheckInModal.tsx` — Daily check-in with 4 questions + body map (sore muscles) + notes
- `components/BodyMap.tsx` — Interactive front/back SVG body diagram for tapping sore muscle groups
- `components/ActivityImportModal.tsx` — External workout logger with screenshot import OR manual entry (label, duration, type)
- `components/InsightInfoModal.tsx` — Info popup for AI insights and readiness score explanation

### Key Files
- `lib/auth.tsx` — Auth context (Replit OIDC mobile flow)
- `hooks/useProfile.ts` — React Query hooks for profile, check-ins, external workouts, readiness score computation
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
- `id` (PK serial), `user_id` (FK → users), `streak_days`, `fitness_goal`, `workout_frequency`, `daily_sync_progress`, `check_in_completed`, `activity_imported`, `equipment` (JSONB string[]), `skill_level`, `injuries` (JSONB string[]), `onboarding_completed`, `updated_at`

### `daily_check_ins` table
- `id` (PK serial), `user_id` (FK → users), `date`, `energy_level`, `sleep_quality`, `stress_level`, `soreness_score`, `sore_muscle_groups` (JSONB string[]), `notes`, `created_at`

### `external_workouts` table
- `id` (PK serial), `user_id` (FK → users), `label`, `duration`, `workout_type`, `source`, `created_at`

## API Endpoints

- `GET /api/healthz` — Health check
- `GET /api/auth/user` — Get current auth state
- `GET /api/login` — Start OIDC login (browser)
- `GET /api/callback` — OIDC callback (browser)
- `POST /api/mobile-auth/token-exchange` — Mobile PKCE code exchange
- `POST /api/mobile-auth/logout` — Mobile logout
- `GET /api/profile` — Get user fitness profile (creates if not exists)
- `PUT /api/profile` — Update user fitness profile (includes equipment, skillLevel, injuries, onboardingCompleted)
- `POST /api/checkins` — Create/update today's daily check-in
- `GET /api/checkins/today` — Get today's check-in for current user
- `POST /api/workouts/external` — Log an external workout (manual or screenshot)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`
Push DB schema: `pnpm --filter @workspace/db run push`
