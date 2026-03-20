import { type WorkoutFormat } from "./parserValidator";

export interface FormatDetectionResult {
  format: WorkoutFormat;
  confidence: number;
  warning?: string;
}

export const FORMAT_CONFIDENCE_THRESHOLD = 0.60;
export const FORMAT_AMBIGUITY_GAP = 0.15;

const norm = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[.,!?;:—–\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

interface Detector {
  format: Exclude<WorkoutFormat, "UNKNOWN">;
  detect: (normalizedText: string) => number;
}

const amrapDetector: Detector = {
  format: "AMRAP",
  detect(t) {
    if (/\bamrap\b/.test(t)) return 0.95;
    if (/as many rounds/.test(t)) return 0.90;
    if (/as many reps/.test(t)) return 0.85;
    if (/as many.*as possible/.test(t)) return 0.80;
    return 0;
  },
};

const emomDetector: Detector = {
  format: "EMOM",
  detect(t) {
    if (/\bemom\b/.test(t)) return 0.95;
    if (/every minute on the minute/.test(t)) return 0.95;
    if (/\be\s*m\s*o\s*m\b/.test(t)) return 0.80;
    if (/every minute/.test(t)) return 0.60;
    return 0;
  },
};

const forTimeDetector: Detector = {
  format: "FOR_TIME",
  detect(t) {
    if (/\d+\s+rounds?\s+for\s+time/.test(t)) return 0.95;
    if (/for time/.test(t)) return 0.95;
    if (/complete.*for.*time/.test(t)) return 0.90;
    if (/time\s+cap/.test(t)) return 0.75;
    if (/\b21\s+15\s+9\b/.test(t)) return 0.80;
    if (/\brft\b/.test(t)) return 0.90;
    return 0;
  },
};

const standardDetector: Detector = {
  format: "STANDARD",
  detect(t) {
    const hasSetsReps = /\d+\s*[×x]\s*\d+/.test(t);
    const hasLift = /\b(squat|deadlift|press|bench|row|curl|extension|snatch|clean|jerk)\b/.test(t);
    if (hasSetsReps && hasLift) return 0.85;
    if (/\bworking\s+sets?\b/.test(t)) return 0.82;
    if (/\bsets?\b.*\breps?\b|\breps?\b.*\bsets?\b/.test(t)) return 0.72;
    if (/\b(strength|power|skill)\s+(work|day|training|session)\b/.test(t)) return 0.75;
    if (hasSetsReps) return 0.65;
    return 0;
  },
};

const DETECTORS: Detector[] = [amrapDetector, emomDetector, forTimeDetector, standardDetector];

export function detectWorkoutFormat(rawText: string): FormatDetectionResult {
  if (!rawText || !rawText.trim()) {
    return {
      format: "UNKNOWN",
      confidence: 0,
      warning: "No workout text provided — format cannot be determined.",
    };
  }

  const t = norm(rawText);

  const scores = DETECTORS
    .map((d) => ({ format: d.format as WorkoutFormat, confidence: d.detect(t) }))
    .sort((a, b) => b.confidence - a.confidence);

  const best = scores[0];
  const second = scores[1];

  if (best.confidence < FORMAT_CONFIDENCE_THRESHOLD) {
    const hint = best.confidence > 0
      ? ` Closest match: ${best.format} at ${Math.round(best.confidence * 100)}%.`
      : "";
    return {
      format: "UNKNOWN",
      confidence: best.confidence,
      warning: `Format could not be determined.${hint} Please select the correct format.`,
    };
  }

  const isAmbiguous =
    second !== undefined &&
    second.confidence >= FORMAT_CONFIDENCE_THRESHOLD &&
    best.confidence - second.confidence < FORMAT_AMBIGUITY_GAP;

  if (isAmbiguous) {
    return {
      format: best.format,
      confidence: best.confidence,
      warning: `Format is ambiguous between ${best.format} and ${second.format}. Please verify.`,
    };
  }

  return { format: best.format, confidence: best.confidence };
}

export function normalizeMetconFormatString(metconStr: string | null | undefined): WorkoutFormat {
  if (!metconStr) return "UNKNOWN";
  const t = norm(metconStr);
  if (/\bamrap\b/.test(t) || /as many rounds/.test(t)) return "AMRAP";
  if (/\bemom\b/.test(t) || /\be\s*m\s*o\s*m\b/.test(t) || /every minute/.test(t)) return "EMOM";
  if (/for time/.test(t) || /\brft\b/.test(t) || /rounds?\s+for\s+time/.test(t)) return "FOR_TIME";
  if (/\b21\s+15\s+9\b/.test(t)) return "FOR_TIME";
  if (/\d+\s*[×x]\s*\d+/.test(t) || /\bstrength\b/.test(t)) return "STANDARD";
  return "UNKNOWN";
}
