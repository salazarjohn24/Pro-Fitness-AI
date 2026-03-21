/**
 * movementSets.ts — P3 pure utilities for movement set-level editing
 *
 * No React Native imports — safe to use in tests directly.
 */

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
  volume: string;
  muscleGroups: string[];
  fatiguePercent: number;
  movementType: MovementType;
  setRows: SetRow[];
}

export function defaultSetRow(type: MovementType): SetRow {
  switch (type) {
    case "strength":
      return { reps: 10, weight: "" };
    case "bodyweight":
      return { reps: 10 };
    case "hold":
      return { durationSeconds: 30 };
    case "cardio":
      return { durationSeconds: 300 };
    default:
      return { reps: 10 };
  }
}

export function inferMovementTypeFromName(name: string): MovementType {
  const lower = name.toLowerCase();
  if (/plank|wall sit|l.sit|dead hang|isometric|hang/.test(lower)) return "hold";
  if (
    /\brun\b|row|bike|ski erg|swim|sprint|\bm\b.*run|calorie|400|800|1600|5k|10k/.test(lower)
  )
    return "cardio";
  if (
    /push.?up|pull.?up|chin.?up|\bdip\b|burpee|sit.?up|crunch|jumping jack|mountain climber|air squat/.test(
      lower,
    )
  )
    return "bodyweight";
  return "strength";
}

export function inferMovementTypeFromWorkout(workoutType: string): MovementType {
  const lower = workoutType.toLowerCase();
  if (
    lower === "running" ||
    lower === "cycling" ||
    lower === "swimming" ||
    lower === "cardio"
  )
    return "cardio";
  if (lower === "yoga" || lower === "pilates") return "hold";
  return "strength";
}

export function parseVolumeToSets(volume: string, movementType: MovementType): SetRow[] {
  const v = (volume ?? "").trim();

  if (movementType === "strength") {
    const m = v.match(/(\d+)\s*[x×]\s*(\d+)\s*[@at]+\s*([\d.]+)/i);
    if (m) {
      const n = Math.min(20, Math.max(1, parseInt(m[1])));
      return Array.from({ length: n }, () => ({ reps: parseInt(m[2]), weight: m[3] }));
    }
    const m2 = v.match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (m2) {
      const n = Math.min(20, Math.max(1, parseInt(m2[1])));
      return Array.from({ length: n }, () => ({ reps: parseInt(m2[2]), weight: "" }));
    }
  }

  if (movementType === "bodyweight") {
    const m = v.match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (m) {
      const n = Math.min(20, Math.max(1, parseInt(m[1])));
      return Array.from({ length: n }, () => ({ reps: parseInt(m[2]) }));
    }
    const m2 = v.match(/(\d+)\s+reps?/i);
    if (m2) return [{ reps: parseInt(m2[1]) }];
  }

  if (movementType === "hold") {
    const m = v.match(/(\d+)\s*[x×]\s*(\d+)\s*s(?:ec)?/i);
    if (m) {
      const n = Math.min(20, Math.max(1, parseInt(m[1])));
      return Array.from({ length: n }, () => ({ durationSeconds: parseInt(m[2]) }));
    }
    const m2 = v.match(/(\d+)\s*s(?:ec)?/i);
    if (m2) return [{ durationSeconds: parseInt(m2[1]) }];
    const m3 = v.match(/(\d+)\s*min/i);
    if (m3) return [{ durationSeconds: parseInt(m3[1]) * 60 }];
  }

  if (movementType === "cardio") {
    const distM = v.match(/(\d+)\s*m\b/i);
    if (distM) return [{ distance: parseInt(distM[1]) }];
    const minM = v.match(/(\d+)\s*min/i);
    if (minM) return [{ durationSeconds: parseInt(minM[1]) * 60 }];
    const secM = v.match(/(\d+)\s*s(?:ec)?/i);
    if (secM) return [{ durationSeconds: parseInt(secM[1]) }];
  }

  return [defaultSetRow(movementType)];
}

export function generateVolumeString(
  setRows: SetRow[],
  movementType: MovementType,
): string {
  if (setRows.length === 0) return "";
  const n = setRows.length;
  const first = setRows[0];

  switch (movementType) {
    case "strength": {
      const reps = first.reps ?? 10;
      const w = (first.weight ?? "").trim();
      return w ? `${n}×${reps} @ ${w}lbs` : `${n}×${reps}`;
    }
    case "bodyweight": {
      const reps = first.reps ?? 10;
      return `${n}×${reps}`;
    }
    case "hold": {
      const dur = first.durationSeconds ?? 30;
      const durStr =
        dur >= 60
          ? `${Math.floor(dur / 60)}min${dur % 60 ? ` ${dur % 60}s` : ""}`
          : `${dur}s`;
      return `${n}×${durStr}`;
    }
    case "cardio": {
      const parts: string[] = [];
      setRows.forEach((s) => {
        if (s.durationSeconds) {
          const dur = s.durationSeconds;
          parts.push(dur >= 60 ? `${Math.floor(dur / 60)}min` : `${dur}s`);
        }
        if (s.distance) parts.push(`${s.distance}m`);
        if (s.calories) parts.push(`${s.calories}cal`);
      });
      return parts.join(" · ") || "Cardio";
    }
    default:
      return "";
  }
}
