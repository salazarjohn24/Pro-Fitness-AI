import { openai } from "@workspace/integrations-openai-ai-server";
import type { ExerciseData } from "../data/exercises";

export interface AIWorkoutResult {
  workoutTitle: string;
  rationale: string;
  exercises: AIGeneratedExercise[];
}

export interface AIGeneratedExercise {
  exerciseId: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  category: string;
  sets: number;
  reps: number;
  weight: string;
  youtubeKeyword: string;
}

export interface WorkoutContext {
  skillLevel: string;
  fitnessGoal: string;
  energyLevel: number;
  sleepQuality: number;
  stressLevel: number;
  highSorenessGroups: string[];
  moderateSorenessGroups: string[];
  injuries: string[];
  equipment: string[];
  checkInNotes?: string | null;
}

export interface ArchitectContext extends WorkoutContext {
  requestedMuscleGroups: string[];
}

function buildExerciseListForPrompt(exercises: ExerciseData[]): string {
  return exercises.map(ex =>
    `[${ex.id}] ${ex.name} | primary: ${ex.primaryMuscle} | secondary: ${ex.secondaryMuscles.join(", ")} | equipment: ${ex.equipment.join(", ")} | difficulty: ${ex.difficulty} | category: ${ex.category} | yt: ${ex.youtubeKeyword}`
  ).join("\n");
}

function parseAIExerciseResponse(
  content: string,
  exerciseMap: Map<string, ExerciseData>
): AIGeneratedExercise[] {
  const exercises: AIGeneratedExercise[] = [];
  const lines = content.split("\n").filter(l => l.trim());
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line.trim());
      if (parsed.exerciseId && parsed.name) {
        const orig = exerciseMap.get(parsed.exerciseId);
        exercises.push({
          exerciseId: parsed.exerciseId,
          name: parsed.name,
          primaryMuscle: orig?.primaryMuscle ?? parsed.primaryMuscle ?? "",
          secondaryMuscles: orig?.secondaryMuscles ?? parsed.secondaryMuscles ?? [],
          category: orig?.category ?? parsed.category ?? "accessory",
          sets: Math.max(1, Math.min(8, parseInt(parsed.sets) || 3)),
          reps: Math.max(1, Math.min(30, parseInt(parsed.reps) || 10)),
          weight: parsed.weight ?? "Moderate",
          youtubeKeyword: orig?.youtubeKeyword ?? parsed.youtubeKeyword ?? parsed.name,
        });
      }
    } catch {
      // skip malformed lines
    }
  }
  return exercises;
}

export async function generateAIWorkout(
  ctx: WorkoutContext,
  availableExercises: ExerciseData[],
  exerciseMap: Map<string, ExerciseData>
): Promise<AIWorkoutResult> {
  const exerciseList = buildExerciseListForPrompt(availableExercises);

  const systemPrompt = `You are an expert personal trainer AI. Generate a complete, personalized workout session.

AVAILABLE EXERCISES (only use these, referenced by ID):
${exerciseList}

OUTPUT FORMAT: First output a JSON object on its own line with "workoutTitle" and "rationale" keys. Then output one exercise per line as a JSON object with these exact keys: exerciseId, name, sets, reps, weight (use "BW" for bodyweight, "Light", "Moderate", "Heavy", or "Max Effort").

RULES:
- Always include 2-3 warmup exercises, 2-4 compound lifts, 2-4 accessory exercises, 1-2 core exercises, and 1-2 cooldowns
- weight field: "BW" for warmup/cooldown/bodyweight, otherwise "Light"/"Moderate"/"Heavy"/"Max Effort" based on goal and skill
- NEVER include exercises that target high-soreness or injured muscle groups
- Reduce sets by 20% for moderately sore muscles
- Adjust volume down for low energy (energy <= 2)
- Match difficulty to skill level (beginners avoid advanced exercises)
- Output ONLY valid JSON lines, no markdown, no explanation text`;

  const userPrompt = `User context:
- Fitness goal: ${ctx.fitnessGoal}
- Skill level: ${ctx.skillLevel}
- Today's energy level: ${ctx.energyLevel}/5
- Sleep quality: ${ctx.sleepQuality}/5
- Stress level: ${ctx.stressLevel}/5
- High soreness (AVOID): ${ctx.highSorenessGroups.join(", ") || "none"}
- Moderate soreness (reduce volume): ${ctx.moderateSorenessGroups.join(", ") || "none"}
- Injuries (AVOID): ${ctx.injuries.join(", ") || "none"}
- Available equipment: ${ctx.equipment.join(", ") || "bodyweight only"}
${ctx.checkInNotes ? `- User notes: ${ctx.checkInNotes}` : ""}

Generate the ideal workout for this person today.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  const lines = content.split("\n").filter(l => l.trim());

  let workoutTitle = "AI Optimized Session";
  let rationale = "Personalized for your current readiness and goals.";
  const exerciseLines: string[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line.trim());
      if (parsed.workoutTitle) {
        workoutTitle = parsed.workoutTitle;
        rationale = parsed.rationale ?? rationale;
      } else if (parsed.exerciseId) {
        exerciseLines.push(line);
      }
    } catch {
      // skip
    }
  }

  const exercises = parseAIExerciseResponse(exerciseLines.join("\n"), exerciseMap);

  return { workoutTitle, rationale, exercises };
}

export async function generateAIArchitectWorkout(
  ctx: ArchitectContext,
  availableExercises: ExerciseData[],
  exerciseMap: Map<string, ExerciseData>
): Promise<AIWorkoutResult> {
  const exerciseList = buildExerciseListForPrompt(availableExercises);

  const systemPrompt = `You are an expert personal trainer AI. Generate a custom workout session targeting specific muscle groups.

AVAILABLE EXERCISES (only use these, referenced by ID):
${exerciseList}

OUTPUT FORMAT: First output a JSON object on its own line with "workoutTitle" and "rationale" keys. Then output one exercise per line as a JSON object with these exact keys: exerciseId, name, sets, reps, weight.

RULES:
- Prioritize the requested muscle groups for compound and accessory exercises
- Always include 2 warmup exercises relevant to the target muscles, and 2 cooldown exercises
- Include 1-2 core exercises
- weight field: "BW" for warmup/cooldown/bodyweight, otherwise "Light"/"Moderate"/"Heavy"/"Max Effort"
- NEVER include exercises targeting high-soreness or injured muscle groups
- Output ONLY valid JSON lines, no markdown, no explanation`;

  const userPrompt = `User context:
- Target muscle groups: ${ctx.requestedMuscleGroups.join(", ")}
- Fitness goal: ${ctx.fitnessGoal}
- Skill level: ${ctx.skillLevel}
- Today's energy level: ${ctx.energyLevel}/5
- Sleep quality: ${ctx.sleepQuality}/5
- High soreness (AVOID): ${ctx.highSorenessGroups.join(", ") || "none"}
- Moderate soreness (reduce volume): ${ctx.moderateSorenessGroups.join(", ") || "none"}
- Injuries (AVOID): ${ctx.injuries.join(", ") || "none"}
- Available equipment: ${ctx.equipment.join(", ") || "bodyweight only"}

Generate the custom workout targeting the requested muscle groups.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  const lines = content.split("\n").filter(l => l.trim());

  let workoutTitle = ctx.requestedMuscleGroups.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(" & ") + " Session";
  let rationale = `Custom session targeting ${ctx.requestedMuscleGroups.join(", ")}.`;
  const exerciseLines: string[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line.trim());
      if (parsed.workoutTitle) {
        workoutTitle = parsed.workoutTitle;
        rationale = parsed.rationale ?? rationale;
      } else if (parsed.exerciseId) {
        exerciseLines.push(line);
      }
    } catch {
      // skip
    }
  }

  const exercises = parseAIExerciseResponse(exerciseLines.join("\n"), exerciseMap);

  return { workoutTitle, rationale, exercises };
}

export async function generateCoachNote(
  exerciseName: string,
  muscleGroup: string,
  difficulty: string,
  userProfile: {
    skillLevel?: string;
    fitnessGoal?: string;
    injuries?: string[];
  },
  history: {
    weight: number;
    reps: number;
    sets: number;
    performedAt: string;
  }[]
): Promise<string> {
  const hasHistory = history.length > 0;
  const historyText = hasHistory
    ? history.map((h, i) => `Session ${i + 1}: ${h.sets}x${h.reps} @ ${h.weight}lbs (${new Date(h.performedAt).toLocaleDateString()})`).join(", ")
    : "No previous sessions logged";

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 300,
    messages: [
      {
        role: "system",
        content: "You are a concise, expert personal trainer. Write a short, personalized coach's note (2-3 sentences max) for this athlete about the specific exercise. Be direct, actionable, and specific to their situation. No fluff.",
      },
      {
        role: "user",
        content: `Exercise: ${exerciseName} (targets: ${muscleGroup}, difficulty: ${difficulty})
Athlete profile: skill=${userProfile.skillLevel ?? "intermediate"}, goal=${userProfile.fitnessGoal ?? "general fitness"}, injuries=${(userProfile.injuries ?? []).join(", ") || "none"}
Recent history: ${historyText}

Write a personalized coach's note for this athlete.`,
      },
    ],
  });

  return response.choices[0]?.message?.content ?? "Focus on form and controlled movement throughout each rep.";
}

export async function generateAuditInsight(
  alerts: { type: string; muscle: string; message: string; daysSince?: number; consistencyIndex?: number }[],
  volumeStats: {
    totalSessions: number;
    totalVolume: number;
    muscleFocus: { muscle: string; percentage: number }[];
  },
  recoveryData: {
    avgHighVolume: number;
    avgLowVolume: number;
    percentageDifference: number;
    hasEnoughData: boolean;
  }
): Promise<string> {
  if (alerts.length === 0 && volumeStats.totalSessions < 3) {
    return "Log more workouts to unlock your personalized performance analysis.";
  }

  const alertsSummary = alerts.length > 0
    ? alerts.map(a => a.message).join("; ")
    : "No critical alerts";

  const topMuscles = volumeStats.muscleFocus.slice(0, 5).map(m => `${m.muscle} (${m.percentage}%)`).join(", ");

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 400,
    messages: [
      {
        role: "system",
        content: "You are an elite strength coach analyzing an athlete's training data. Provide a concise, insightful performance summary in 2-4 sentences. Be specific, motivating, and actionable. No generic advice.",
      },
      {
        role: "user",
        content: `Training data:
- Total sessions: ${volumeStats.totalSessions}
- Alerts: ${alertsSummary}
- Top trained muscles: ${topMuscles || "none yet"}
- Recovery impact: ${recoveryData.hasEnoughData ? `${recoveryData.percentageDifference}% more volume on high-recovery days` : "insufficient data"}

Provide a focused performance insight for this athlete.`,
      },
    ],
  });

  return response.choices[0]?.message?.content ?? "Keep training consistently to unlock deeper performance insights.";
}

export async function parseWorkoutDescriptionAI(description: string): Promise<{
  muscleGroups: string[];
  intensity: number;
  estimatedDuration: number;
  workoutType: string;
  label: string;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 500,
    messages: [
      {
        role: "system",
        content: `You are a fitness AI that parses workout descriptions into structured data. 
Return ONLY a valid JSON object with these keys:
- muscleGroups: string[] (from: chest, back, shoulders, quads, hamstrings, glutes, biceps, triceps, core, calves, full body)
- intensity: number (1-10 RPE scale)
- estimatedDuration: number (minutes)
- workoutType: string (strength, cardio, hiit, yoga, sports, rest, other)
- label: string (concise workout name)

No markdown, no explanation, just the JSON.`,
      },
      {
        role: "user",
        content: `Parse this workout description: "${description}"`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(content.trim());
    return {
      muscleGroups: Array.isArray(parsed.muscleGroups) ? parsed.muscleGroups : [],
      intensity: Math.max(1, Math.min(10, parseInt(parsed.intensity) || 5)),
      estimatedDuration: Math.max(5, Math.min(300, parseInt(parsed.estimatedDuration) || 30)),
      workoutType: parsed.workoutType ?? "other",
      label: parsed.label ?? "Workout",
    };
  } catch {
    return {
      muscleGroups: [],
      intensity: 5,
      estimatedDuration: 30,
      workoutType: "other",
      label: "Workout",
    };
  }
}
