import { openai } from "@workspace/integrations-openai-ai-server";
import type { ExerciseData } from "../data/exercises";
import { detectWorkoutFormat, normalizeMetconFormatString } from "../lib/formatParser";
import type { WorkoutFormat } from "../lib/parserValidator";

function sanitizeUserInput(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>]/g, "")
    .slice(0, 500);
}

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

export interface ExerciseHistoryEntry {
  lastSets: number;
  lastAvgReps: number;
  lastMaxWeight: number;
  lastAvgWeight: number;
  performedAt: Date | string;
}

export interface SubstitutionEntry {
  originalName: string;
  preferredName: string;
  count: number;
}

export interface ExternalFatigueEntry {
  label: string;
  muscleGroups: string[];
  intensity: number;
  hoursAgo: number;
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
  preferredWorkoutDuration?: number;
  workoutPreferences?: string | null;
  exerciseHistory?: Record<string, ExerciseHistoryEntry>;
  substitutions?: SubstitutionEntry[];
  externalWorkoutFatigue?: ExternalFatigueEntry[];
}

export interface ArchitectContext extends WorkoutContext {
  requestedMuscleGroups: string[];
  availableMinutes?: number;
  sessionNotes?: string | null;
}

export interface RecoveryTip {
  category: string;
  title: string;
  detail: string;
}

export interface RecoveryInsightsResult {
  headline: string;
  tips: RecoveryTip[];
}

export interface RecoveryContext {
  energyLevel: number;
  sleepQuality: number;
  stressLevel: number;
  soreMuscles: { muscle: string; severity: number }[];
  todayWorkout: {
    label: string;
    intensity: number;
    durationMinutes: number;
    muscleGroups: string[];
    isMetcon: boolean;
  } | null;
  fitnessGoal: string;
  skillLevel: string;
  notes?: string | null;
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

The "rationale" field must be 1-2 sentences that specifically explain what shaped this session. If the user provided custom workout preferences, explicitly call out how they influenced the workout design (e.g. "Based on your preference for compound movements and Hyrox training, this session prioritizes..."). If energy or sleep is low, mention it. Make the rationale feel personalized, not generic.

RULES:
- Always include 2-3 warmup exercises, 2-4 compound lifts, 2-4 accessory exercises, 1-2 core exercises, and 1-2 cooldowns
- weight field: "BW" for warmup/cooldown/bodyweight, otherwise "Light"/"Moderate"/"Heavy"/"Max Effort" based on goal and skill
- NEVER include exercises that target high-soreness or injured muscle groups
- Reduce sets by 20% for moderately sore muscles
- Adjust volume down for low energy (energy <= 2)
- Match difficulty to skill level (beginners avoid advanced exercises)
- Output ONLY valid JSON lines, no markdown, no explanation text`;

  const historyLines = ctx.exerciseHistory && Object.keys(ctx.exerciseHistory).length > 0
    ? Object.entries(ctx.exerciseHistory)
        .map(([name, h]) => `  - ${name}: last ${h.lastSets} sets × ~${Math.round(h.lastAvgReps)} reps @ ${Math.round(h.lastMaxWeight)}lbs max`)
        .join("\n")
    : "  None recorded yet";

  const substitutionLines = ctx.substitutions && ctx.substitutions.length > 0
    ? ctx.substitutions.map(s => `  - Always swap "${s.originalName}" → "${s.preferredName}" (${s.count}x)`).join("\n")
    : "  None";

  const externalFatigueLines = ctx.externalWorkoutFatigue && ctx.externalWorkoutFatigue.length > 0
    ? ctx.externalWorkoutFatigue
        .map(e => `  - "${e.label}" (${Math.round(e.hoursAgo)}h ago, RPE ${e.intensity}/10): ${e.muscleGroups.join(", ")}`)
        .join("\n")
    : "  None";

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
- Target workout duration: ${ctx.preferredWorkoutDuration ?? 60} minutes (adjust exercise count/sets/reps accordingly)
${ctx.checkInNotes ? `- User notes: ${sanitizeUserInput(ctx.checkInNotes)}` : ""}

Recent external training logged outside this app (account for cumulative muscle fatigue):
${externalFatigueLines}
⚠ Muscles hit at RPE ≥ 7 in an external session within 48h: reduce volume significantly or avoid entirely. RPE 5-6 within 24h: note the overlap and reduce sets by 20%.

Recent exercise performance (for progressive overload — suggest slightly more weight/reps than last time if appropriate):
${historyLines}

User exercise preferences (honor these substitutions):
${substitutionLines}

User's custom workout preferences (IMPORTANT — always honor these when designing the session):
${ctx.workoutPreferences?.trim() ? sanitizeUserInput(ctx.workoutPreferences) : "None provided"}

Generate the ideal workout. Apply progressive overload where previous performance data exists. Honor substitution preferences. CRITICALLY: respect the external training fatigue above to avoid muscle overload. In the rationale, explicitly mention how the user's custom preferences (if any) shaped this session — do not write a generic rationale.`;

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

The "rationale" field must be 1-2 sentences that specifically explain what shaped this session. Explicitly call out: (1) how session notes influenced this specific workout if provided, (2) how custom workout preferences affected exercise selection or structure if provided, (3) any external fatigue adjustments made. Make it feel personal and specific — not generic.

RULES:
- Prioritize the requested muscle groups for compound and accessory exercises
- Always include 2 warmup exercises relevant to the target muscles, and 2 cooldown exercises
- Include 1-2 core exercises
- weight field: "BW" for warmup/cooldown/bodyweight, otherwise "Light"/"Moderate"/"Heavy"/"Max Effort"
- NEVER include exercises targeting high-soreness or injured muscle groups
- Output ONLY valid JSON lines, no markdown, no explanation`;

  const targetMinutes = ctx.availableMinutes ?? ctx.preferredWorkoutDuration ?? 60;

  const historyLinesA = ctx.exerciseHistory && Object.keys(ctx.exerciseHistory).length > 0
    ? Object.entries(ctx.exerciseHistory)
        .map(([name, h]) => `  - ${name}: last ${h.lastSets} sets × ~${Math.round(h.lastAvgReps)} reps @ ${Math.round(h.lastMaxWeight)}lbs max`)
        .join("\n")
    : "  None recorded yet";

  const substitutionLinesA = ctx.substitutions && ctx.substitutions.length > 0
    ? ctx.substitutions.map(s => `  - Always swap "${s.originalName}" → "${s.preferredName}" (${s.count}x)`).join("\n")
    : "  None";

  const externalFatigueLinesA = ctx.externalWorkoutFatigue && ctx.externalWorkoutFatigue.length > 0
    ? ctx.externalWorkoutFatigue
        .map(e => `  - "${e.label}" (${Math.round(e.hoursAgo)}h ago, RPE ${e.intensity}/10): ${e.muscleGroups.join(", ")}`)
        .join("\n")
    : "  None";

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
- Available time: ${targetMinutes} minutes (fit all exercises within this duration)

Recent external training logged outside this app (account for cumulative muscle fatigue):
${externalFatigueLinesA}
⚠ Even if a requested muscle group was hit externally at RPE ≥ 7 within 48h, reduce volume significantly and flag it in the rationale so the user knows.

Recent exercise performance (apply progressive overload where possible):
${historyLinesA}

User exercise preferences (honor these substitutions):
${substitutionLinesA}

User's custom workout preferences (IMPORTANT — always honor these):
${ctx.workoutPreferences?.trim() ? sanitizeUserInput(ctx.workoutPreferences) : "None provided"}

Additional notes for today's session (IMPORTANT — honor these for this specific workout):
${ctx.sessionNotes?.trim() ? sanitizeUserInput(ctx.sessionNotes) : "None"}

Generate the custom workout targeting the requested muscle groups. Adjust exercise count and sets to fit the time available. Apply progressive overload and honor substitution preferences. In the rationale, specifically reference how session notes (if any) and workout preferences (if any) shaped this session — never write a generic rationale.`;

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

export interface RebalancePlanDay {
  day: string;
  name: string;
  exercises: string[];
  tag: "Push" | "Pull" | "Compound" | "Recovery";
  reason: string;
}

export interface RebalancePlanResult {
  insightBanner: string;
  titleSubtext: string;
  days: RebalancePlanDay[];
}

export async function generateRebalancePlan(
  muscleFocus: { muscle: string; sets: number; percentage: number }[],
  alerts: { type: string; muscle: string; message: string }[]
): Promise<RebalancePlanResult> {
  const muscleData = muscleFocus.length > 0
    ? muscleFocus.map(m => `${m.muscle}: ${m.percentage}% of volume`).join(", ")
    : "No data yet";
  const alertData = alerts.length > 0
    ? alerts.map(a => a.message).join("; ")
    : "No critical alerts";

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 900,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an elite strength coach creating a personalized weekly rebalance plan based on real training data.
Return ONLY valid JSON with this exact structure:
{
  "insightBanner": "1-2 sentences explaining the specific imbalance detected and why it matters for this athlete",
  "titleSubtext": "2-4 word focus description (e.g. 'Push/Pull Correction', 'Lower Body Focus')",
  "days": [
    {
      "day": "MON",
      "name": "Workout name",
      "exercises": ["Exercise 1 4×8", "Exercise 2 3×12"],
      "tag": "Push",
      "reason": "1 sentence referencing specific imbalance data"
    }
  ]
}
Rules:
- Generate 4-5 days including exactly 1 Recovery day
- tag must be one of: "Push", "Pull", "Compound", "Recovery"
- Prioritize underworked muscles based on the provided data
- 3-4 exercises per day with sets×reps notation
- Reasons must reference the specific muscle percentages provided
- Be direct and specific, not generic`,
      },
      {
        role: "user",
        content: `Current muscle volume distribution (last month):
${muscleData}

Active training alerts:
${alertData}

Create a 4-5 day rebalance plan that specifically addresses these imbalances.`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    return {
      insightBanner: typeof parsed.insightBanner === "string"
        ? parsed.insightBanner
        : "Your muscle volume distribution shows imbalances this plan will correct.",
      titleSubtext: typeof parsed.titleSubtext === "string" ? parsed.titleSubtext : "Muscle Rebalance",
      days: Array.isArray(parsed.days) ? parsed.days.map((d: any) => ({
        day: String(d.day ?? ""),
        name: String(d.name ?? ""),
        exercises: Array.isArray(d.exercises) ? d.exercises.map(String) : [],
        tag: (["Push", "Pull", "Compound", "Recovery"] as const).includes(d.tag) ? d.tag : "Compound",
        reason: String(d.reason ?? ""),
      })) : [],
    };
  } catch {
    return {
      insightBanner: "Your muscle volume distribution shows imbalances this plan will correct.",
      titleSubtext: "Muscle Rebalance",
      days: [],
    };
  }
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

export interface AnalyzedMovement {
  name: string;
  volume: string;
  muscleGroups: string[];
  fatiguePercent: number;
}

export interface WorkoutImageAnalysis {
  label: string;
  workoutType: string;
  duration: number;
  intensity: number;
  muscleGroups: string[];
  movements: AnalyzedMovement[];
  isMetcon: boolean;
  metconFormat: string | null;
  workoutFormat: WorkoutFormat;
  formatWarning?: string;
}

export async function analyzeWorkoutImageAI(base64Image: string, mimeType = "image/jpeg"): Promise<WorkoutImageAnalysis> {
  const systemPrompt = `You are an elite strength and conditioning coach analyzing a workout screenshot. 
Extract every movement/exercise you see, then compute weighted muscle fatigue percentages that sum to 100.

For EMOMs, AMRAPs, running clocks, Fran, "21-15-9", and other metcons:
- Identify the format (e.g. "EMOM 20", "AMRAP 12 min", "21-15-9", "5 Rounds For Time")
- Assign fatiguePercent to each movement based on volume × intensity × muscle-group size
- Bigger, compound movements (thrusters, deadlifts, squats) get more fatigue weight than isolated ones

Return ONLY valid JSON with this structure (no markdown, no explanation):
{
  "label": "string (concise workout name)",
  "workoutType": "strength|cardio|hiit|crossfit|yoga|pilates|swimming|running|cycling|sports|other",
  "duration": number (estimated minutes),
  "intensity": number (1-10 RPE),
  "muscleGroups": ["primary muscles worked"],
  "isMetcon": boolean,
  "metconFormat": "string or null (e.g. EMOM 20, AMRAP 12, 5 RFT, 21-15-9)",
  "movements": [
    {
      "name": "movement name",
      "volume": "volume descriptor (e.g. 3x10, 21-15-9 reps, 5 rounds x 8)",
      "muscleGroups": ["muscles"],
      "fatiguePercent": number (0-100, all must sum to 100)
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1000,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this workout and return the JSON breakdown:" },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ] as any,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content.trim());

    const movements: AnalyzedMovement[] = Array.isArray(parsed.movements)
      ? parsed.movements.map((m: any) => ({
          name: String(m.name ?? ""),
          volume: String(m.volume ?? ""),
          muscleGroups: Array.isArray(m.muscleGroups) ? m.muscleGroups : [],
          fatiguePercent: Math.max(0, Math.min(100, Number(m.fatiguePercent) || 0)),
        }))
      : [];

    const rawMetconFormat = parsed.metconFormat ?? null;
    const formatResult = detectWorkoutFormat(parsed.label ? `${parsed.label} ${rawMetconFormat ?? ""}` : rawMetconFormat ?? "");
    const workoutFormat = rawMetconFormat
      ? normalizeMetconFormatString(rawMetconFormat)
      : formatResult.format;

    return {
      label: parsed.label ?? "Workout",
      workoutType: parsed.workoutType ?? "other",
      duration: Math.max(5, Math.min(300, parseInt(parsed.duration) || 30)),
      intensity: Math.max(1, Math.min(10, parseInt(parsed.intensity) || 6)),
      muscleGroups: Array.isArray(parsed.muscleGroups) ? parsed.muscleGroups : [],
      movements,
      isMetcon: Boolean(parsed.isMetcon),
      metconFormat: rawMetconFormat,
      workoutFormat,
      formatWarning: workoutFormat === "UNKNOWN" ? formatResult.warning : undefined,
    };
  } catch {
    return {
      label: "Workout",
      workoutType: "other",
      duration: 30,
      intensity: 6,
      muscleGroups: ["Full Body"],
      movements: [],
      isMetcon: false,
      metconFormat: null,
      workoutFormat: "UNKNOWN",
      formatWarning: "Could not determine workout format from image.",
    };
  }
}

export async function parseWorkoutDescriptionAI(description: string): Promise<{
  muscleGroups: string[];
  intensity: number;
  estimatedDuration: number;
  workoutType: string;
  label: string;
  movements: Array<{ name: string; volume: string; muscleGroups: string[]; fatiguePercent: number }>;
  workoutFormat: WorkoutFormat;
  formatWarning?: string;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 800,
    messages: [
      {
        role: "system",
        content: `You are a fitness AI that parses workout descriptions into structured data for fatigue and muscle tracking.

Return ONLY a valid JSON object with these exact keys:
- label: string — concise workout name (e.g. "CrossFit WOD", "Deadlift + Conditioning")
- workoutType: string — one of: Strength, Cardio, HIIT, CrossFit, Yoga, Pilates, Swimming, Running, Cycling, Sports, Other
- intensity: number — overall RPE 1-10
- estimatedDuration: number — total minutes
- muscleGroups: string[] — all muscle groups worked, from: chest, back, shoulders, quads, hamstrings, glutes, biceps, triceps, core, calves, traps, lats
- movements: array of individual exercises, each with:
    - name: string — exercise name (e.g. "Deadlift", "Running", "Wall Walk")
    - volume: string — concise volume descriptor (e.g. "5RM @ 295lbs", "17:03 for 2050m", "10-8-6 reps")
    - muscleGroups: string[] — muscle groups specific to this movement
    - fatiguePercent: number — estimated fatigue contribution 0-100 for that movement

Rules:
- Include every distinct movement in the description as a separate entry in movements
- For timed workouts (e.g. "17:03 on a 30min clock"), use that as the volume
- For strength PRs or rep maxes, note the weight and rep scheme in volume
- fatiguePercent reflects how taxing that movement is (heavy barbell compounds = 70-90, running = 40-60, accessory = 20-50)
- No markdown, no explanation, just raw JSON`,
      },
      {
        role: "user",
        content: `Parse this workout: ${sanitizeUserInput(description)}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(content.trim());
    const movements = Array.isArray(parsed.movements)
      ? parsed.movements.map((m: any) => ({
          name: String(m.name ?? "Exercise"),
          volume: String(m.volume ?? ""),
          muscleGroups: Array.isArray(m.muscleGroups) ? m.muscleGroups : [],
          fatiguePercent: Math.max(0, Math.min(100, parseInt(m.fatiguePercent) || 50)),
        }))
      : [];
    const formatResult = detectWorkoutFormat(description);
    return {
      muscleGroups: Array.isArray(parsed.muscleGroups) ? parsed.muscleGroups : [],
      intensity: Math.max(1, Math.min(10, parseInt(parsed.intensity) || 5)),
      estimatedDuration: Math.max(5, Math.min(300, parseInt(parsed.estimatedDuration) || 30)),
      workoutType: parsed.workoutType ?? "Other",
      label: parsed.label ?? "Workout",
      movements,
      workoutFormat: formatResult.format,
      formatWarning: formatResult.warning,
    };
  } catch {
    const formatResult = detectWorkoutFormat(description);
    return {
      muscleGroups: [],
      intensity: 5,
      estimatedDuration: 30,
      workoutType: "Other",
      label: "Workout",
      movements: [],
      workoutFormat: formatResult.format,
      formatWarning: formatResult.warning,
    };
  }
}

export async function generateRecoveryInsights(ctx: RecoveryContext): Promise<RecoveryInsightsResult> {
  const sorenesList = ctx.soreMuscles.length > 0
    ? ctx.soreMuscles.map(s => `${s.muscle} (severity ${s.severity}/10)`).join(", ")
    : "none reported";

  const workoutSummary = ctx.todayWorkout
    ? `${ctx.todayWorkout.label} — ${ctx.todayWorkout.durationMinutes} min, intensity ${ctx.todayWorkout.intensity}/10, muscles: ${ctx.todayWorkout.muscleGroups.join(", ") || "general"}${ctx.todayWorkout.isMetcon ? ", high-intensity metabolic conditioning" : ""}`
    : "no workout data";

  const system = `You are an elite personal trainer and sports recovery coach. Generate concise, science-backed, and highly personalized recovery insights based on the user's check-in data and today's workout. Always reference their specific muscle groups, numbers, and situation. Keep tone warm, direct, and motivating — like a knowledgeable training partner. Return valid JSON only.`;

  const user = `User completed a workout today. Generate recovery insights.

CHECK-IN DATA:
- Energy level: ${ctx.energyLevel}/5
- Sleep quality: ${ctx.sleepQuality}/5
- Stress level: ${ctx.stressLevel}/5
- Sore muscles: ${sorenesList}
- Notes: ${ctx.notes || "none"}

TODAY'S WORKOUT:
${workoutSummary}

PROFILE:
- Goal: ${ctx.fitnessGoal}
- Level: ${ctx.skillLevel}

Return JSON:
{
  "headline": "1-2 sentence congratulation + main focus for rest of today (max 120 chars)",
  "tips": [
    { "category": "SLEEP|NUTRITION|MOBILITY|HYDRATION|STRESS|MINDSET", "title": "action headline (max 6 words)", "detail": "2 sentences specific to this user's data" }
  ]
}

Rules:
- Generate exactly 4 tips
- If energy ≤ 2, include NUTRITION tip focused on glycogen and energy restoration
- If stress ≥ 4, include STRESS tip with concrete de-stress technique
- If sleep ≤ 2, make SLEEP the first tip
- If soreness reported, include MOBILITY tip naming those exact muscles
- Reference the actual workout muscles, duration, intensity in tip details
- Never give generic advice — always tie to their specific numbers`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
    max_tokens: 800,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(content.trim());
    const tips: RecoveryTip[] = Array.isArray(parsed.tips)
      ? parsed.tips.slice(0, 5).map((t: any) => ({
          category: String(t.category ?? "MINDSET").toUpperCase(),
          title: String(t.title ?? "Recovery tip"),
          detail: String(t.detail ?? ""),
        }))
      : [];
    return {
      headline: String(parsed.headline ?? "Great session — prioritize recovery now."),
      tips,
    };
  } catch {
    return {
      headline: "Great session — here's how to recover well.",
      tips: [
        { category: "NUTRITION", title: "Refuel within 90 minutes", detail: "Have a meal with 30–40g protein and quality carbs to kick off muscle repair and restore glycogen." },
        { category: "HYDRATION", title: "Drink water consistently", detail: "Aim for 500ml in the next hour to replace fluids lost during training and support recovery processes." },
        { category: "SLEEP", title: "Protect tonight's sleep", detail: "Sleep is when muscle protein synthesis peaks. Wind down early and avoid screens 60 min before bed." },
        { category: "MOBILITY", title: "Light stretch before bed", detail: "5–10 minutes of static stretching on your worked muscles reduces next-day soreness and improves flexibility." },
      ],
    };
  }
}
