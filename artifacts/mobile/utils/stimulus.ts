export const MUSCLE_GROUPS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps",
  "Core", "Quads", "Hamstrings", "Glutes", "Calves",
  "Full Body",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export type SkillLevel = "Beginner" | "Intermediate" | "Advanced";

const SKILL_VOLUME_MULTIPLIER: Record<SkillLevel, number> = {
  Beginner: 0.7,
  Intermediate: 1.0,
  Advanced: 1.3,
};

export function computeStimulusPoints(params: {
  duration: number;
  intensity: number;
  muscleGroups: string[];
  skillLevel?: SkillLevel;
}): number {
  const { duration, intensity, muscleGroups, skillLevel = "Intermediate" } = params;
  const clampedDuration = Math.max(1, Math.min(duration, 120));
  const clampedIntensity = Math.max(1, Math.min(intensity, 10));
  const uniqueGroups = [...new Set(muscleGroups)];
  const baseDurationScore = clampedDuration / 10;
  const intensityFactor = clampedIntensity / 10;
  const groupCount = Math.max(uniqueGroups.length, 1);
  const volumeMultiplier = SKILL_VOLUME_MULTIPLIER[skillLevel] ?? 1.0;
  const raw = baseDurationScore * intensityFactor * groupCount * volumeMultiplier;
  return Math.round(Math.min(raw, 100));
}

const WORKOUT_TYPE_MUSCLE_MAP: Record<string, string[]> = {
  Strength: ["Chest", "Back", "Shoulders"],
  Cardio: ["Quads", "Hamstrings", "Calves", "Core"],
  HIIT: ["Full Body"],
  CrossFit: ["Full Body"],
  Yoga: ["Core", "Hamstrings", "Shoulders"],
  Pilates: ["Core", "Glutes"],
  Swimming: ["Back", "Shoulders", "Core"],
  Running: ["Quads", "Hamstrings", "Calves"],
  Cycling: ["Quads", "Hamstrings", "Glutes"],
  Sports: ["Full Body"],
  Other: ["Full Body"],
};

export function inferMuscleGroupsFromType(workoutType: string): string[] {
  return WORKOUT_TYPE_MUSCLE_MAP[workoutType] ?? ["Full Body"];
}

const KEYWORD_MUSCLE_MAP: Record<string, string[]> = {
  squat: ["Quads", "Glutes", "Hamstrings"],
  deadlift: ["Back", "Hamstrings", "Glutes"],
  bench: ["Chest", "Triceps", "Shoulders"],
  press: ["Shoulders", "Triceps"],
  "overhead press": ["Shoulders", "Triceps"],
  "pull-up": ["Back", "Biceps"],
  pullup: ["Back", "Biceps"],
  "chin-up": ["Biceps", "Back"],
  row: ["Back", "Biceps"],
  curl: ["Biceps"],
  "tricep extension": ["Triceps"],
  dip: ["Chest", "Triceps"],
  lunge: ["Quads", "Glutes"],
  "box jump": ["Quads", "Calves", "Glutes"],
  burpee: ["Full Body"],
  thruster: ["Quads", "Shoulders", "Core"],
  snatch: ["Full Body"],
  clean: ["Full Body"],
  "wall ball": ["Quads", "Shoulders"],
  "kettle bell": ["Full Body"],
  kettlebell: ["Full Body"],
  plank: ["Core"],
  "sit-up": ["Core"],
  situp: ["Core"],
  crunch: ["Core"],
  run: ["Quads", "Hamstrings", "Calves"],
  running: ["Quads", "Hamstrings", "Calves"],
  sprint: ["Quads", "Hamstrings", "Calves"],
  swim: ["Back", "Shoulders", "Core"],
  bike: ["Quads", "Hamstrings"],
  cycle: ["Quads", "Hamstrings"],
  "push-up": ["Chest", "Triceps", "Shoulders"],
  pushup: ["Chest", "Triceps", "Shoulders"],
};

export function parseWorkoutDescription(text: string): {
  muscleGroups: string[];
  suggestedIntensity: number;
} {
  const lower = text.toLowerCase();
  const foundGroups = new Set<string>();

  for (const [keyword, groups] of Object.entries(KEYWORD_MUSCLE_MAP)) {
    if (lower.includes(keyword)) {
      groups.forEach((g) => foundGroups.add(g));
    }
  }

  if (foundGroups.size === 0) {
    foundGroups.add("Full Body");
  }

  let suggestedIntensity = 5;
  const roundsMatch = lower.match(/(\d+)\s*rounds?/);
  const forTimeMatch = lower.includes("for time") || lower.includes("amrap");
  const hasHeavy = lower.includes("heavy") || lower.includes("max");
  const hasLight = lower.includes("light") || lower.includes("easy") || lower.includes("recovery");

  if (roundsMatch) {
    const rounds = parseInt(roundsMatch[1], 10);
    suggestedIntensity = Math.min(Math.max(Math.round(rounds * 1.5), 4), 9);
  }
  if (forTimeMatch) suggestedIntensity = Math.max(suggestedIntensity, 7);
  if (hasHeavy) suggestedIntensity = Math.max(suggestedIntensity, 8);
  if (hasLight) suggestedIntensity = Math.min(suggestedIntensity, 4);

  return {
    muscleGroups: Array.from(foundGroups),
    suggestedIntensity: Math.min(suggestedIntensity, 10),
  };
}
