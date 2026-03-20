export const LOW_CONFIDENCE_THRESHOLD = 0.65;

export interface ParseResultInput {
  muscleGroups: string[];
  movements: Array<unknown>;
  workoutType: string;
}

export function computeParserConfidence(result: ParseResultInput): number {
  let score = 1.0;
  if (result.movements.length === 0) score -= 0.35;
  if (result.muscleGroups.length === 0) score -= 0.30;
  if (result.workoutType === "Other" || result.workoutType === "Imported") score -= 0.10;
  if (result.movements.length < 2 && result.muscleGroups.length < 2) score -= 0.10;
  return Math.max(0.05, Math.min(1.0, Math.round(score * 100) / 100));
}

export interface EditableFields {
  label: string;
  workoutType: string;
  duration: number;
  intensity: number;
  muscleGroups: string[];
}

export function detectEditedFields(
  initial: EditableFields,
  current: EditableFields,
): string[] {
  const edited: string[] = [];
  if (current.label.trim() !== initial.label.trim()) edited.push("label");
  if (current.workoutType !== initial.workoutType) edited.push("workoutType");
  if (current.duration !== initial.duration) edited.push("duration");
  if (current.intensity !== initial.intensity) edited.push("intensity");
  const sameGroups =
    current.muscleGroups.length === initial.muscleGroups.length &&
    current.muscleGroups.every((g) => initial.muscleGroups.includes(g));
  if (!sameGroups) edited.push("muscleGroups");
  return edited;
}
