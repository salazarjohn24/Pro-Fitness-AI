export const WORKOUT_FORMAT_VALUES = ["AMRAP", "EMOM", "FOR_TIME", "STANDARD", "UNKNOWN"] as const;
export type WorkoutFormat = typeof WORKOUT_FORMAT_VALUES[number];

export interface ParserMeta {
  parserConfidence: number | null;
  parserWarnings: string[];
  workoutFormat: WorkoutFormat | null;
  wasUserEdited: boolean;
  editedFields: string[];
}

export const PARSER_META_DEFAULTS: ParserMeta = {
  parserConfidence: null,
  parserWarnings: [],
  workoutFormat: null,
  wasUserEdited: false,
  editedFields: [],
};

export function validateParserConfidence(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || value < 0 || value > 1) {
    return "parserConfidence must be a number between 0 and 1";
  }
  return null;
}

export function validateParserWarnings(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.some((w: unknown) => typeof w !== "string")) {
    return "parserWarnings must be an array of strings";
  }
  return null;
}

export function validateWorkoutFormat(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (!(WORKOUT_FORMAT_VALUES as readonly string[]).includes(value as string)) {
    return `workoutFormat must be one of: ${WORKOUT_FORMAT_VALUES.join(", ")}`;
  }
  return null;
}

export function validateEditedFields(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.some((f: unknown) => typeof f !== "string")) {
    return "editedFields must be an array of strings";
  }
  return null;
}

export function resolveParserMeta(body: Record<string, unknown>): ParserMeta {
  return {
    parserConfidence: body.parserConfidence != null ? (body.parserConfidence as number) : null,
    parserWarnings: Array.isArray(body.parserWarnings) ? (body.parserWarnings as string[]) : [],
    workoutFormat: body.workoutFormat != null ? (body.workoutFormat as WorkoutFormat) : null,
    wasUserEdited: typeof body.wasUserEdited === "boolean" ? body.wasUserEdited : false,
    editedFields: Array.isArray(body.editedFields) ? (body.editedFields as string[]) : [],
  };
}
