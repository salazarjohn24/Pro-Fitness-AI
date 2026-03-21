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
- `external_workouts`: Records of workouts logged from external sources. Includes parser columns: `parserConfidence` (real), `parserWarnings` (jsonb), `workoutFormat` (varchar), `wasUserEdited` (boolean), `editedFields` (jsonb, includes "sets" when set-level data was edited). The `movements` jsonb column stores enriched `RichMovement` objects with `movementType` + `setRows` (P3, backward-compatible).
- `workout_history`: Per-exercise history. P4 additions: `externalWorkoutId` (int, nullable FK → external_workouts ON DELETE SET NULL), `durationSeconds` (int nullable, for holds/cardio), `source` (varchar, 'internal'|'external').
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
- Current build number as of March 21 2026: **18** (always auto-increment before any EAS build)
- Bundle ID: `app.replit.profitnessai`
- EAS Project: `@salazarjohn24/mobile`
- ASC App ID: `6760667643`

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