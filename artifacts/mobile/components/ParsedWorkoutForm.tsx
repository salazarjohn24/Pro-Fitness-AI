import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";
import { MUSCLE_GROUPS, computeStimulusPoints, type SkillLevel } from "@/utils/stimulus";
import { DatePickerSheet, getLocalToday, formatDisplayDate } from "@/components/DatePickerSheet";
import {
  LOW_CONFIDENCE_THRESHOLD,
  detectEditedFields,
} from "@/utils/parserMeta";
import { track } from "@/lib/telemetry";
import { MovementSetEditor } from "@/components/MovementSetEditor";
import {
  defaultSetRow,
  inferMovementTypeFromName,
  inferMovementTypeFromWorkout,
  parseVolumeToSets,
  generateVolumeString,
  type RichMovement,
  type MovementType,
  type SetRow,
} from "@/utils/movementSets";

const WORKOUT_TYPES = [
  "Strength", "Cardio", "HIIT", "CrossFit", "Yoga",
  "Pilates", "Swimming", "Running", "Cycling", "Sports", "Other",
];
const DURATION_OPTIONS = [15, 20, 30, 45, 60, 75, 90, 120];

const FORMAT_CHIPS: Array<{ value: string; label: string }> = [
  { value: "AMRAP", label: "AMRAP" },
  { value: "EMOM", label: "EMOM" },
  { value: "FOR_TIME", label: "FOR TIME" },
  { value: "STANDARD", label: "STANDARD" },
  { value: "UNKNOWN", label: "?" },
];

function resolveSkillLevel(raw?: string | null): SkillLevel {
  if (raw === "Beginner" || raw === "Intermediate" || raw === "Advanced") return raw;
  return "Intermediate";
}

export interface ParsedWorkoutFormInitial {
  label: string;
  workoutType: string;
  duration: number;
  intensity: number;
  muscleGroups: string[];
  movements: Array<{
    name: string;
    volume: string;
    muscleGroups: string[];
    fatiguePercent: number;
    movementType?: MovementType;
    setRows?: SetRow[];
  }>;
  workoutDate: string;
  parserConfidence: number | null;
  parserWarnings: string[];
  workoutFormat: string | null;
}

export interface ParsedFormResult {
  label: string;
  workoutType: string;
  duration: number;
  intensity: number;
  muscleGroups: string[];
  movements: Array<{
    name: string;
    volume: string;
    muscleGroups: string[];
    fatiguePercent: number;
    movementType: MovementType;
    setRows: SetRow[];
  }>;
  workoutDate: string;
  parserConfidence: number | null;
  parserWarnings: string[];
  workoutFormat: string | null;
  stimulusPoints: number;
  wasUserEdited: boolean;
  editedFields: string[];
  lastEditedAt: string | null;
  editSource: "user" | "ai" | "manual" | null;
}

// A1: movement types that conflict with a declared rest day
const REST_DAY_CONFLICT_TYPES = new Set<string>(["strength", "bodyweight", "cardio"]);

interface Props {
  initial: ParsedWorkoutFormInitial;
  onSubmit: (data: ParsedFormResult) => void;
  skillLevel?: string | null;
  submitLabel?: string;
  submitDisabled?: boolean;
  importSource?: "text" | "screenshot" | "manual";
}

function buildRichMovements(
  rawMovements: ParsedWorkoutFormInitial["movements"],
  defaultMvType: MovementType,
): RichMovement[] {
  return (rawMovements ?? []).map((mv) => {
    const mtype: MovementType =
      mv.movementType ?? inferMovementTypeFromName(mv.name) ?? defaultMvType;
    return {
      name: mv.name,
      volume: mv.volume,
      muscleGroups: mv.muscleGroups,
      fatiguePercent: mv.fatiguePercent,
      movementType: mtype,
      setRows: mv.setRows?.length ? mv.setRows : parseVolumeToSets(mv.volume, mtype),
    };
  });
}

export function ParsedWorkoutForm({
  initial,
  onSubmit,
  skillLevel,
  submitLabel = "LOG WORKOUT",
  submitDisabled,
  importSource = "manual",
}: Props) {
  const userSkillLevel = resolveSkillLevel(skillLevel);
  const defaultMvType = inferMovementTypeFromWorkout(initial.workoutType);

  const [label, setLabel] = useState(initial.label);
  const [workoutType, setWorkoutType] = useState(initial.workoutType);
  const [duration, setDuration] = useState(
    DURATION_OPTIONS.includes(initial.duration) ? initial.duration : 30,
  );
  const [intensity, setIntensity] = useState(initial.intensity);
  const [muscleGroups, setMuscleGroups] = useState<string[]>(initial.muscleGroups);
  const [workoutDate, setWorkoutDate] = useState(initial.workoutDate || getLocalToday());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [workoutFormat, setWorkoutFormat] = useState<string | null>(
    initial.workoutFormat ?? "UNKNOWN",
  );

  const [movements, setMovements] = useState<RichMovement[]>(() =>
    buildRichMovements(initial.movements, defaultMvType),
  );
  const [newMovementName, setNewMovementName] = useState("");
  const addInputRef = useRef<TextInput>(null);

  const initialSetsJsonRef = useRef<string>(
    JSON.stringify(
      buildRichMovements(initial.movements, defaultMvType).map((m) => ({
        name: m.name,
        movementType: m.movementType,
        setRows: m.setRows,
      })),
    ),
  );

  const showBanner =
    initial.parserConfidence !== null &&
    initial.parserConfidence < LOW_CONFIDENCE_THRESHOLD;

  // A1: rest-day conflict detection
  const restDayConflictCount =
    workoutType === "rest"
      ? movements.filter((m) => REST_DAY_CONFLICT_TYPES.has(m.movementType)).length
      : 0;

  const stripConflictingMovements = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setMovements((prev) => prev.filter((m) => !REST_DAY_CONFLICT_TYPES.has(m.movementType)));
  };

  const convertToWorkoutDay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setWorkoutType("Strength");
  };

  useEffect(() => {
    if (showBanner && initial.parserConfidence !== null) {
      track({
        name: "parser_warning_shown",
        props: {
          confidence: initial.parserConfidence,
          confidence_pct: Math.round(initial.parserConfidence * 100),
          source: importSource,
          warning_count: initial.parserWarnings.length,
        },
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMuscleGroup = (group: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMuscleGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    );
  };

  const addMovement = () => {
    const name = newMovementName.trim();
    if (!name) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const mtype = inferMovementTypeFromName(name);
    const newMov: RichMovement = {
      name,
      volume: "",
      muscleGroups: [],
      fatiguePercent: 20,
      movementType: mtype,
      setRows: [defaultSetRow(mtype)],
    };
    setMovements((prev) => [...prev, newMov]);
    setNewMovementName("");
    track({
      name: "import_movement_added",
      props: {
        movement_name: name,
        source: importSource,
        confidence: initial.parserConfidence,
      },
    });
  };

  const updateMovement = (idx: number, updated: RichMovement) => {
    setMovements((prev) => prev.map((m, i) => (i === idx ? updated : m)));
  };

  const deleteMovement = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const deleted = movements[index];
    setMovements((prev) => prev.filter((_, i) => i !== index));
    track({
      name: "import_movement_deleted",
      props: {
        movement_name: deleted?.name ?? "",
        source: importSource,
        confidence: initial.parserConfidence,
      },
    });
  };

  const doSubmit = () => {
    if (!label.trim() || submitDisabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const resolvedGroups = muscleGroups.length > 0 ? muscleGroups : [workoutType];
    const stimulusPoints = computeStimulusPoints({
      duration,
      intensity,
      muscleGroups: resolvedGroups,
      skillLevel: userSkillLevel,
    });

    const editedFields = detectEditedFields(
      {
        label: initial.label,
        workoutType: initial.workoutType,
        duration: initial.duration,
        intensity: initial.intensity,
        muscleGroups: initial.muscleGroups,
        workoutFormat: initial.workoutFormat,
      },
      { label, workoutType, duration, intensity, muscleGroups, workoutFormat },
    );

    const currentSetsJson = JSON.stringify(
      movements.map((m) => ({
        name: m.name,
        movementType: m.movementType,
        setRows: m.setRows,
      })),
    );
    if (currentSetsJson !== initialSetsJsonRef.current && !editedFields.includes("sets")) {
      editedFields.push("sets");
    }

    if (editedFields.length > 0) {
      track({
        name: "import_user_edited_fields",
        props: {
          edited_fields: editedFields,
          edited_field_count: editedFields.length,
          source: importSource,
          format: workoutFormat ?? "UNKNOWN",
          had_low_confidence: showBanner,
        },
      });
    }

    const outputMovements = movements.map((m) => ({
      name: m.name,
      volume: generateVolumeString(m.setRows, m.movementType),
      muscleGroups: m.muscleGroups,
      fatiguePercent: m.fatiguePercent,
      movementType: m.movementType,
      setRows: m.setRows,
    }));

    onSubmit({
      label: label.trim(),
      workoutType,
      duration,
      intensity,
      muscleGroups: resolvedGroups,
      movements: outputMovements,
      workoutDate,
      parserConfidence: initial.parserConfidence,
      parserWarnings: initial.parserWarnings,
      workoutFormat,
      stimulusPoints,
      wasUserEdited: editedFields.length > 0,
      editedFields,
      lastEditedAt: editedFields.length > 0 ? new Date().toISOString() : null,
      editSource: editedFields.length > 0 ? "user" : importSource === "manual" ? "manual" : "ai",
    });
  };

  return (
    <>
      {showBanner && (
        <View
          style={styles.confidenceBanner}
          accessibilityRole="alert"
          accessibilityLabel={`Low confidence parse. Parser confidence: ${Math.round((initial.parserConfidence ?? 0) * 100)}%. Review details below before saving.`}
        >
          <View style={styles.bannerTopRow}>
            <Feather name="alert-triangle" size={14} color="#F59E0B" />
            <Text style={styles.bannerTitle}>LOW CONFIDENCE PARSE</Text>
            <View style={styles.bannerBadge}>
              <Text style={styles.bannerBadgeText}>
                {Math.round((initial.parserConfidence ?? 0) * 100)}%
              </Text>
            </View>
          </View>
          <Text style={styles.bannerDesc}>
            Review set details below before saving, or skip right to saving now.
          </Text>
          <View style={styles.bannerActions}>
            <Text style={styles.editDetailsHint}>↓ Edit details below</Text>
            <Pressable
              onPress={doSubmit}
              style={[
                styles.saveAnywayBtn,
                (!label.trim() || submitDisabled) && styles.saveAnywayBtnDisabled,
              ]}
              disabled={!label.trim() || submitDisabled}
              accessibilityRole="button"
              accessibilityLabel="Save without reviewing details"
            >
              <Text style={styles.saveAnywayText}>SAVE ANYWAY</Text>
            </Pressable>
          </View>
        </View>
      )}

      {restDayConflictCount > 0 && (
        <View
          style={styles.restDayConflictBanner}
          accessibilityRole="alert"
          accessibilityLabel={`Rest day conflict: ${restDayConflictCount} movement${restDayConflictCount > 1 ? "s" : ""} will not be tracked on a rest day.`}
        >
          <View style={styles.bannerTopRow}>
            <Feather name="moon" size={14} color="#60A5FA" />
            <Text style={styles.restDayConflictTitle}>REST DAY CONFLICT</Text>
          </View>
          <Text style={styles.restDayConflictDesc}>
            {restDayConflictCount} movement{restDayConflictCount > 1 ? "s" : ""} won't be tracked on a rest day.
          </Text>
          <View style={styles.restDayConflictActions}>
            <Pressable
              onPress={stripConflictingMovements}
              style={styles.restDayKeepBtn}
              accessibilityRole="button"
              accessibilityLabel="Keep rest day and remove conflicting movements"
            >
              <Text style={styles.restDayKeepText}>KEEP REST DAY</Text>
            </Pressable>
            <Pressable
              onPress={convertToWorkoutDay}
              style={styles.restDayConvertBtn}
              accessibilityRole="button"
              accessibilityLabel="Convert to a workout day"
            >
              <Text style={styles.restDayConvertText}>CONVERT TO WORKOUT</Text>
            </Pressable>
          </View>
        </View>
      )}

      {initial.parserWarnings.length > 0 && (
        <View style={styles.warningsBox}>
          {initial.parserWarnings.map((w, i) => (
            <View key={i} style={styles.warningRow}>
              <Feather name="info" size={11} color={Colors.textSubtle} />
              <Text style={styles.warningText}>{w}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>WORKOUT NAME</Text>
        <TextInput
          style={styles.textInput}
          placeholder='e.g. "CrossFit WOD"'
          placeholderTextColor={Colors.textSubtle}
          value={label}
          onChangeText={setLabel}
          accessibilityLabel="Workout name"
          accessibilityHint="Enter a name for this workout"
          returnKeyType="done"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>WORKOUT TYPE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="menu"
          accessibilityLabel="Workout type selector"
        >
          <View style={styles.chipRow}>
            {WORKOUT_TYPES.map((type) => {
              const selected = workoutType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setWorkoutType(type);
                  }}
                  style={[styles.typeChip, selected && styles.typeChipSelected]}
                  accessibilityRole="menuitem"
                  accessibilityLabel={type}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                    {type}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>FORMAT</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="menu"
          accessibilityLabel="Workout format selector"
        >
          <View style={styles.chipRow}>
            {FORMAT_CHIPS.map(({ value, label: chipLabel }) => {
              const selected = (workoutFormat ?? "UNKNOWN") === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const originalFormat = initial.workoutFormat ?? "UNKNOWN";
                    if (value !== workoutFormat && value !== originalFormat) {
                      track({
                        name: "workout_format_overridden",
                        props: {
                          from: originalFormat,
                          to: value,
                          source: importSource,
                          confidence: initial.parserConfidence ?? 0,
                        },
                      });
                    }
                    setWorkoutFormat(value);
                  }}
                  style={[
                    styles.formatChip,
                    selected &&
                      (value === "UNKNOWN"
                        ? styles.formatChipUnknownSelected
                        : styles.formatChipSelected),
                  ]}
                  accessibilityRole="menuitem"
                  accessibilityLabel={`Format: ${chipLabel}`}
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.formatChipText,
                      selected &&
                        (value === "UNKNOWN"
                          ? styles.formatChipTextUnknown
                          : styles.formatChipTextSelected),
                    ]}
                  >
                    {chipLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        {workoutFormat === "UNKNOWN" && (
          <Text style={styles.formatUnknownHint} accessibilityRole="alert">
            Format unknown — tap a format above to classify this workout.
          </Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>DURATION (MINUTES)</Text>
        <View style={styles.chipRow}>
          {DURATION_OPTIONS.map((d) => {
            const selected = duration === d;
            return (
              <Pressable
                key={d}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDuration(d);
                }}
                style={[styles.durationChip, selected && styles.durationChipSelected]}
                accessibilityRole="button"
                accessibilityLabel={`${d} minutes`}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.durationChipText, selected && styles.durationChipTextSelected]}>
                  {d}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>INTENSITY (RPE {intensity}/10)</Text>
        <View style={styles.rpeRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
            const selected = intensity === v;
            return (
              <Pressable
                key={v}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIntensity(v);
                }}
                style={[styles.rpeChip, selected && styles.rpeChipSelected]}
                accessibilityRole="button"
                accessibilityLabel={`RPE ${v}`}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.rpeChipText, selected && styles.rpeChipTextSelected]}>
                  {v}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.rpeHint} accessibilityElementsHidden>
          {intensity <= 3
            ? "Light effort"
            : intensity <= 5
              ? "Moderate effort"
              : intensity <= 7
                ? "Hard effort"
                : intensity <= 9
                  ? "Very hard"
                  : "Max effort"}
        </Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>MUSCLE GROUPS</Text>
        <View
          style={styles.muscleGrid}
          accessibilityRole="menu"
          accessibilityLabel="Muscle group selector"
        >
          {MUSCLE_GROUPS.map((group) => {
            const selected = muscleGroups.includes(group);
            return (
              <Pressable
                key={group}
                onPress={() => toggleMuscleGroup(group)}
                style={[styles.muscleChip, selected && styles.muscleChipSelected]}
                accessibilityRole="menuitem"
                accessibilityLabel={group}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.muscleChipText, selected && styles.muscleChipTextSelected]}>
                  {group}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>EXERCISES & SETS</Text>

        {movements.length === 0 && (
          <View style={styles.emptyMovements}>
            <Feather name="layers" size={14} color={Colors.textSubtle} />
            <Text style={styles.emptyMovementsText}>
              No exercises yet — add one below.
            </Text>
          </View>
        )}

        {movements.map((mv, idx) => (
          <MovementSetEditor
            key={`${mv.name}-${idx}`}
            movement={mv}
            index={idx}
            onChange={(updated) => updateMovement(idx, updated)}
            onDelete={() => deleteMovement(idx)}
          />
        ))}

        <View style={styles.addMovementRow}>
          <TextInput
            ref={addInputRef}
            style={styles.addMovementInput}
            placeholder="Add exercise (e.g. Back Squat)…"
            placeholderTextColor={Colors.textSubtle}
            value={newMovementName}
            onChangeText={setNewMovementName}
            onSubmitEditing={addMovement}
            returnKeyType="done"
            accessibilityLabel="New exercise name"
          />
          <Pressable
            onPress={addMovement}
            style={[
              styles.addMovementBtn,
              !newMovementName.trim() && styles.addMovementBtnDisabled,
            ]}
            disabled={!newMovementName.trim()}
            accessibilityRole="button"
            accessibilityLabel="Add exercise"
          >
            <Feather
              name="plus"
              size={14}
              color={newMovementName.trim() ? Colors.orange : Colors.textSubtle}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>LOG FOR DATE</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setDatePickerOpen(true);
          }}
          style={styles.dateTrigger}
          accessibilityRole="button"
          accessibilityLabel={`Date: ${formatDisplayDate(workoutDate)}. Tap to change.`}
        >
          <Feather name="calendar" size={16} color={Colors.highlight} />
          <Text style={styles.dateTriggerText}>{formatDisplayDate(workoutDate)}</Text>
          <Feather name="chevron-down" size={14} color={Colors.textSubtle} />
        </Pressable>
      </View>

      {movements.length > 0 && workoutType !== "rest" && (
        <View style={styles.vaultInfoBanner}>
          <Feather name="database" size={12} color="#6366F1" />
          <Text style={styles.vaultInfoText}>
            {movements.length} movement{movements.length > 1 ? "s" : ""} will be logged to your exercise vault
          </Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.saveBtn,
          (!label.trim() || submitDisabled) && styles.saveBtnDisabled,
          { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
        onPress={doSubmit}
        disabled={!label.trim() || submitDisabled}
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        accessibilityState={{ disabled: !label.trim() || submitDisabled }}
      >
        <Feather name="check-circle" size={16} color="#fff" />
        <Text style={styles.saveBtnText}>{submitLabel}</Text>
      </Pressable>

      <DatePickerSheet
        visible={datePickerOpen}
        value={workoutDate}
        onClose={() => setDatePickerOpen(false)}
        onSelect={(date) => setWorkoutDate(date)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  confidenceBanner: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  bannerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerTitle: {
    flex: 1,
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#F59E0B",
    letterSpacing: 1.5,
  },
  bannerDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#D97706",
    lineHeight: 16,
  },
  bannerBadge: {
    backgroundColor: "rgba(245,158,11,0.15)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bannerBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#F59E0B",
  },
  bannerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  editDetailsHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    fontStyle: "italic",
  },
  saveAnywayBtn: {
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveAnywayBtnDisabled: {
    opacity: 0.4,
  },
  saveAnywayText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#F59E0B",
    letterSpacing: 1,
  },
  warningsBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 6,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    lineHeight: 15,
  },
  formGroup: { marginBottom: 18 },
  fieldLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: "#1A1A18",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  typeChipSelected: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.12)",
  },
  typeChipText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
  },
  typeChipTextSelected: { color: Colors.orange },
  formatChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  formatChipSelected: {
    borderColor: "#6366F1",
    backgroundColor: "rgba(99,102,241,0.12)",
  },
  formatChipUnknownSelected: {
    borderColor: Colors.textSubtle,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  formatChipText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
  },
  formatChipTextSelected: { color: "#818CF8" },
  formatChipTextUnknown: { color: Colors.textSubtle },
  formatUnknownHint: {
    marginTop: 8,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#F59E0B",
    lineHeight: 15,
  },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  durationChipSelected: {
    borderColor: Colors.highlight,
    backgroundColor: "rgba(246,234,152,0.12)",
  },
  durationChipText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
  },
  durationChipTextSelected: { color: Colors.highlight },
  rpeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rpeChip: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  rpeChipSelected: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.12)",
  },
  rpeChipText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
  },
  rpeChipTextSelected: { color: Colors.orange },
  rpeHint: {
    marginTop: 8,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    letterSpacing: 0.5,
  },
  muscleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  muscleChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  muscleChipSelected: {
    borderColor: Colors.highlight,
    backgroundColor: "rgba(246,234,152,0.12)",
  },
  muscleChipText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
  },
  muscleChipTextSelected: { color: Colors.highlight },
  emptyMovements: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  emptyMovementsText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    fontStyle: "italic",
  },
  addMovementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  addMovementInput: {
    flex: 1,
    backgroundColor: "#1A1A18",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  addMovementBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  addMovementBtnDisabled: {
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  dateTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.3)",
    backgroundColor: "rgba(246,234,152,0.06)",
  },
  dateTriggerText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.highlight,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
  },
  // A1: rest-day conflict banner
  restDayConflictBanner: {
    backgroundColor: "rgba(96,165,250,0.08)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.35)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  restDayConflictTitle: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#60A5FA",
    letterSpacing: 0.8,
    marginLeft: 6,
  },
  restDayConflictDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    lineHeight: 17,
  },
  restDayConflictActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  restDayKeepBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.4)",
    alignItems: "center",
  },
  restDayKeepText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#60A5FA",
    letterSpacing: 0.6,
  },
  restDayConvertBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(96,165,250,0.15)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.4)",
    alignItems: "center",
  },
  restDayConvertText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#93C5FD",
    letterSpacing: 0.6,
  },
  // A6: vault movement count info banner
  vaultInfoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(99,102,241,0.07)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.25)",
    borderRadius: 10,
    marginBottom: 10,
  },
  vaultInfoText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#818CF8",
    flex: 1,
  },
});
