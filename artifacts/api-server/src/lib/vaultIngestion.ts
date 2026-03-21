import { db as globalDb, exerciseLibraryTable, workoutHistoryTable, exercisePerformanceTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";

export type MovementType = "strength" | "bodyweight" | "hold" | "cardio";

export interface SetRow {
  reps?: number;
  weight?: string;
  durationSeconds?: number;
  distance?: number;
  calories?: number;
}

export interface RichMovement {
  name: string;
  volume?: string;
  muscleGroups?: string[];
  fatiguePercent?: number;
  movementType?: MovementType;
  setRows?: SetRow[];
}

export interface StrengthAggregate {
  weight: number;
  reps: number;
  sets: number;
  avgReps: number;
  maxWeight: number;
  avgWeight: number;
  totalVolume: number;
}

export interface HoldAggregate {
  sets: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
}

export interface BodyweightAggregate {
  reps: number;
  sets: number;
  avgReps: number;
  totalReps: number;
}

export interface CardioAggregate {
  totalDurationSeconds: number;
  totalDistance: number;
  totalCalories: number;
}

type DbClient = typeof globalDb;

export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^(barbell|dumbbell|cable|machine|ez[\s-]?bar|kettlebell|smith)\s+/i, "")
    .replace(/\s+/g, " ");
}

export function parseWeightLbs(raw: string | undefined): number {
  if (!raw) return 0;
  const isKg = /kg/i.test(raw);
  const cleaned = raw.replace(/lbs?|kg|bw|bodyweight|lb/gi, "").trim();
  const n = parseFloat(cleaned);
  if (isNaN(n) || n < 0) return 0;
  if (isKg) return Math.round(n * 2.205);
  return Math.round(n);
}

export function aggregateStrength(setRows: SetRow[]): StrengthAggregate {
  const valid = setRows.filter((r) => (r.reps ?? 0) > 0);
  if (valid.length === 0) {
    return { weight: 0, reps: 0, sets: 0, avgReps: 0, maxWeight: 0, avgWeight: 0, totalVolume: 0 };
  }
  const weights = valid.map((r) => parseWeightLbs(r.weight));
  const repsArr = valid.map((r) => r.reps ?? 0);
  const maxWeight = Math.max(...weights);
  const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
  const avgReps = repsArr.reduce((a, b) => a + b, 0) / repsArr.length;
  const totalVolume = valid.reduce((sum, r) => sum + parseWeightLbs(r.weight) * (r.reps ?? 0), 0);
  return {
    weight: maxWeight,
    reps: Math.max(1, Math.round(avgReps)),
    sets: valid.length,
    avgReps,
    maxWeight,
    avgWeight,
    totalVolume,
  };
}

export function aggregateBodyweight(setRows: SetRow[]): BodyweightAggregate {
  const valid = setRows.filter((r) => (r.reps ?? 0) > 0);
  if (valid.length === 0) return { reps: 0, sets: 0, avgReps: 0, totalReps: 0 };
  const repsArr = valid.map((r) => r.reps ?? 0);
  const avgReps = repsArr.reduce((a, b) => a + b, 0) / repsArr.length;
  const totalReps = repsArr.reduce((a, b) => a + b, 0);
  return {
    reps: Math.max(1, Math.round(avgReps)),
    sets: valid.length,
    avgReps,
    totalReps,
  };
}

export function aggregateHold(setRows: SetRow[]): HoldAggregate {
  const valid = setRows.filter((r) => (r.durationSeconds ?? 0) > 0);
  if (valid.length === 0) return { sets: 0, totalDurationSeconds: 0, avgDurationSeconds: 0 };
  const durations = valid.map((r) => r.durationSeconds ?? 0);
  const total = durations.reduce((a, b) => a + b, 0);
  return {
    sets: valid.length,
    totalDurationSeconds: total,
    avgDurationSeconds: total / valid.length,
  };
}

export function aggregateCardio(setRows: SetRow[]): CardioAggregate {
  const totalDurationSeconds = setRows.reduce((sum, r) => sum + (r.durationSeconds ?? 0), 0);
  const totalDistance = setRows.reduce((sum, r) => sum + (r.distance ?? 0), 0);
  const totalCalories = setRows.reduce((sum, r) => sum + (r.calories ?? 0), 0);
  return { totalDurationSeconds, totalDistance, totalCalories };
}

export function inferLibraryDefaults(
  movementType: MovementType,
  muscleGroups: string[]
): { muscleGroup: string; equipment: string; goal: string; difficulty: string } {
  const primaryMuscle = muscleGroups[0] ?? "";
  switch (movementType) {
    case "strength":
      return {
        muscleGroup: primaryMuscle || "Full Body",
        equipment: "Barbell",
        goal: "strength",
        difficulty: "intermediate",
      };
    case "bodyweight":
      return {
        muscleGroup: primaryMuscle || "Full Body",
        equipment: "Bodyweight",
        goal: "hypertrophy",
        difficulty: "beginner",
      };
    case "hold":
      return {
        muscleGroup: primaryMuscle || "Core",
        equipment: "Bodyweight",
        goal: "endurance",
        difficulty: "beginner",
      };
    case "cardio":
      return {
        muscleGroup: "Cardio",
        equipment: "None",
        goal: "cardio",
        difficulty: "beginner",
      };
  }
}

export async function resolveOrCreateExerciseId(
  name: string,
  movementType: MovementType,
  muscleGroups: string[],
  client: DbClient = globalDb
): Promise<number> {
  const trimmed = name.trim();

  const [exact] = await client
    .select({ id: exerciseLibraryTable.id })
    .from(exerciseLibraryTable)
    .where(ilike(exerciseLibraryTable.name, trimmed))
    .limit(1);
  if (exact) return exact.id;

  const normalized = normalizeExerciseName(trimmed);
  if (normalized !== trimmed.toLowerCase()) {
    const [norm] = await client
      .select({ id: exerciseLibraryTable.id })
      .from(exerciseLibraryTable)
      .where(ilike(exerciseLibraryTable.name, normalized))
      .limit(1);
    if (norm) return norm.id;
  }

  const firstWord = trimmed.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 4) {
    const [partial] = await client
      .select({ id: exerciseLibraryTable.id })
      .from(exerciseLibraryTable)
      .where(ilike(exerciseLibraryTable.name, `%${firstWord}%`))
      .limit(1);
    if (partial) return partial.id;
  }

  const defaults = inferLibraryDefaults(movementType, muscleGroups);
  const [created] = await client
    .insert(exerciseLibraryTable)
    .values({
      name: trimmed,
      muscleGroup: defaults.muscleGroup,
      equipment: defaults.equipment,
      goal: defaults.goal,
      difficulty: defaults.difficulty,
    })
    .returning({ id: exerciseLibraryTable.id });

  return created.id;
}

// ---------------------------------------------------------------------------
// Exercise match check — read-only, no inserts (for pre-submit UX)
// ---------------------------------------------------------------------------

export type ExerciseMatchResult = {
  name: string;
  willCreate: boolean;
  matchedId: number | null;
  matchedName: string | null;
  suggestion: { id: number; name: string } | null;
};

/**
 * Checks each movement name against the exercise library without inserting.
 * Returns match status + best-fit suggestion for unmatched names.
 */
export async function checkExerciseMatches(
  movements: Array<{ name: string; movementType?: string }>,
  client: DbClient = globalDb
): Promise<ExerciseMatchResult[]> {
  const results: ExerciseMatchResult[] = [];

  for (const movement of movements) {
    const raw = movement.name?.trim();
    if (!raw) continue;

    // 1. Exact case-insensitive match
    const [exact] = await client
      .select({ id: exerciseLibraryTable.id, name: exerciseLibraryTable.name })
      .from(exerciseLibraryTable)
      .where(ilike(exerciseLibraryTable.name, raw))
      .limit(1);
    if (exact) {
      results.push({ name: raw, willCreate: false, matchedId: exact.id, matchedName: exact.name, suggestion: null });
      continue;
    }

    // 2. Normalized match (strip equipment prefix)
    const normalized = normalizeExerciseName(raw);
    if (normalized !== raw.toLowerCase()) {
      const [norm] = await client
        .select({ id: exerciseLibraryTable.id, name: exerciseLibraryTable.name })
        .from(exerciseLibraryTable)
        .where(ilike(exerciseLibraryTable.name, normalized))
        .limit(1);
      if (norm) {
        results.push({ name: raw, willCreate: false, matchedId: norm.id, matchedName: norm.name, suggestion: null });
        continue;
      }
    }

    // 3. First-word partial match → becomes best-fit suggestion, but won't auto-match
    const firstWord = raw.split(/\s+/)[0];
    let suggestion: { id: number; name: string } | null = null;
    if (firstWord && firstWord.length >= 4) {
      const [partial] = await client
        .select({ id: exerciseLibraryTable.id, name: exerciseLibraryTable.name })
        .from(exerciseLibraryTable)
        .where(ilike(exerciseLibraryTable.name, `%${firstWord}%`))
        .limit(1);
      if (partial) suggestion = { id: partial.id, name: partial.name };
    }

    results.push({ name: raw, willCreate: true, matchedId: null, matchedName: null, suggestion });
  }

  return results;
}

export async function deleteVaultEntriesForExternalWorkout(
  externalWorkoutId: number,
  userId: string,
  client: DbClient = globalDb
): Promise<void> {
  await Promise.all([
    client
      .delete(workoutHistoryTable)
      .where(
        and(
          eq(workoutHistoryTable.externalWorkoutId, externalWorkoutId),
          eq(workoutHistoryTable.userId, userId)
        )
      ),
    client
      .delete(exercisePerformanceTable)
      .where(
        and(
          eq(exercisePerformanceTable.externalWorkoutId, externalWorkoutId),
          eq(exercisePerformanceTable.userId, userId)
        )
      ),
  ]);
}

export async function ingestMovementsToVault(
  externalWorkoutId: number,
  userId: string,
  movements: RichMovement[],
  workoutDate?: string | null,
  client: DbClient = globalDb
): Promise<void> {
  if (!Array.isArray(movements) || movements.length === 0) return;

  const performedAt = workoutDate ? new Date(workoutDate) : new Date();

  for (const movement of movements) {
    const name = movement.name?.trim();
    if (!name) continue;

    const movementType: MovementType = movement.movementType ?? "strength";
    const muscleGroups: string[] = movement.muscleGroups ?? [];
    const setRows: SetRow[] = movement.setRows ?? [];

    if (movementType === "cardio") {
      const agg = aggregateCardio(setRows);
      const exerciseId = await resolveOrCreateExerciseId(name, movementType, muscleGroups, client);
      const primaryVolume = agg.totalDistance > 0 ? agg.totalDistance : agg.totalDurationSeconds;

      await Promise.all([
        client.insert(workoutHistoryTable).values({
          userId,
          exerciseId,
          weight: 0,
          reps: 0,
          sets: 1,
          durationSeconds: agg.totalDurationSeconds > 0 ? agg.totalDurationSeconds : null,
          distanceMeters: agg.totalDistance > 0 ? Math.round(agg.totalDistance) : null,
          performedAt,
          externalWorkoutId,
          source: "external",
        }),
        client.insert(exercisePerformanceTable).values({
          userId,
          exerciseName: name,
          sets: 1,
          avgReps: null,
          maxWeight: null,
          avgWeight: null,
          totalVolume: primaryVolume > 0 ? primaryVolume : null,
          performedAt,
          externalWorkoutId,
          source: "external",
        }),
      ]);
      continue;
    }

    const exerciseId = await resolveOrCreateExerciseId(name, movementType, muscleGroups, client);

    if (movementType === "hold") {
      const agg = aggregateHold(setRows);
      if (agg.sets === 0 && setRows.length === 0) continue;
      const setsCount = agg.sets > 0 ? agg.sets : Math.max(1, setRows.length);
      const totalDuration = agg.totalDurationSeconds;

      // A3: longest single set duration for progressive overload tracking
      const validDurations = setRows
        .map((r) => r.durationSeconds ?? 0)
        .filter((d) => d > 0);
      const longestSetDuration = validDurations.length > 0
        ? Math.max(...validDurations)
        : null;

      await Promise.all([
        client.insert(workoutHistoryTable).values({
          userId,
          exerciseId,
          weight: 0,
          reps: Math.max(0, Math.round(agg.avgDurationSeconds)),
          sets: setsCount,
          durationSeconds: totalDuration > 0 ? totalDuration : null,
          longestSetDuration,
          performedAt,
          externalWorkoutId,
          source: "external",
        }),
        client.insert(exercisePerformanceTable).values({
          userId,
          exerciseName: name,
          sets: setsCount,
          avgReps: null,
          maxWeight: 0,
          avgWeight: 0,
          totalVolume: totalDuration > 0 ? totalDuration : null,
          performedAt,
          externalWorkoutId,
          source: "external",
        }),
      ]);
      continue;
    }

    if (movementType === "bodyweight") {
      const agg = aggregateBodyweight(setRows);
      if (agg.sets === 0 && setRows.length === 0) continue;
      const setsCount = agg.sets > 0 ? agg.sets : Math.max(1, setRows.length);

      await Promise.all([
        client.insert(workoutHistoryTable).values({
          userId,
          exerciseId,
          weight: 0,
          reps: agg.reps,
          sets: setsCount,
          performedAt,
          externalWorkoutId,
          source: "external",
        }),
        client.insert(exercisePerformanceTable).values({
          userId,
          exerciseName: name,
          sets: setsCount,
          avgReps: agg.avgReps,
          maxWeight: 0,
          avgWeight: 0,
          totalVolume: agg.totalReps > 0 ? agg.totalReps : null,
          performedAt,
          externalWorkoutId,
          source: "external",
        }),
      ]);
      continue;
    }

    const agg = aggregateStrength(setRows);
    if (agg.sets === 0 && setRows.length === 0) continue;
    const setsCount = agg.sets > 0 ? agg.sets : Math.max(1, setRows.length);

    await Promise.all([
      client.insert(workoutHistoryTable).values({
        userId,
        exerciseId,
        weight: agg.weight,
        reps: Math.max(1, agg.reps),
        sets: setsCount,
        performedAt,
        externalWorkoutId,
        source: "external",
      }),
      client.insert(exercisePerformanceTable).values({
        userId,
        exerciseName: name,
        sets: setsCount,
        avgReps: agg.avgReps,
        maxWeight: agg.maxWeight,
        avgWeight: agg.avgWeight,
        totalVolume: agg.totalVolume > 0 ? agg.totalVolume : null,
        performedAt,
        externalWorkoutId,
        source: "external",
      }),
    ]);
  }
}
