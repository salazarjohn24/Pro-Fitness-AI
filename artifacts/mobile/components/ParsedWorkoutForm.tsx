import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
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
  movements: Array<{ name: string; volume: string; muscleGroups: string[]; fatiguePercent: number }>;
  workoutDate: string;
  parserConfidence: number | null;
  parserWarnings: string[];
  workoutFormat: string | null;
}

export interface ParsedFormResult extends ParsedWorkoutFormInitial {
  stimulusPoints: number;
  wasUserEdited: boolean;
  editedFields: string[];
}

interface Props {
  initial: ParsedWorkoutFormInitial;
  onSubmit: (data: ParsedFormResult) => void;
  skillLevel?: string | null;
  submitLabel?: string;
  submitDisabled?: boolean;
}

export function ParsedWorkoutForm({
  initial,
  onSubmit,
  skillLevel,
  submitLabel = "LOG WORKOUT",
  submitDisabled,
}: Props) {
  const userSkillLevel = resolveSkillLevel(skillLevel);

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

  const showBanner =
    initial.parserConfidence !== null &&
    initial.parserConfidence < LOW_CONFIDENCE_THRESHOLD;

  const toggleMuscleGroup = (group: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMuscleGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    );
  };

  const handleSubmit = () => {
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

    onSubmit({
      label: label.trim(),
      workoutType,
      duration,
      intensity,
      muscleGroups: resolvedGroups,
      movements: initial.movements,
      workoutDate,
      parserConfidence: initial.parserConfidence,
      parserWarnings: initial.parserWarnings,
      workoutFormat,
      stimulusPoints,
      wasUserEdited: editedFields.length > 0,
      editedFields,
    });
  };

  return (
    <>
      {showBanner && (
        <View
          style={styles.confidenceBanner}
          accessibilityRole="alert"
          accessibilityLabel={`Low confidence parse. Parser confidence: ${Math.round((initial.parserConfidence ?? 0) * 100)}%. Please review the details below before saving.`}
        >
          <Feather name="alert-triangle" size={14} color="#F59E0B" />
          <View style={styles.bannerTextWrap}>
            <Text style={styles.bannerTitle}>LOW CONFIDENCE PARSE</Text>
            <Text style={styles.bannerDesc}>
              Please review the details below before saving.
            </Text>
          </View>
          <View style={styles.bannerBadge}>
            <Text style={styles.bannerBadgeText}>
              {Math.round((initial.parserConfidence ?? 0) * 100)}%
            </Text>
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
                    setWorkoutFormat(value);
                  }}
                  style={[
                    styles.formatChip,
                    selected && (value === "UNKNOWN" ? styles.formatChipUnknownSelected : styles.formatChipSelected),
                  ]}
                  accessibilityRole="menuitem"
                  accessibilityLabel={`Format: ${chipLabel}`}
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.formatChipText,
                      selected && (value === "UNKNOWN" ? styles.formatChipTextUnknown : styles.formatChipTextSelected),
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

      <Pressable
        style={({ pressed }) => [
          styles.saveBtn,
          (!label.trim() || submitDisabled) && styles.saveBtnDisabled,
          { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
        onPress={handleSubmit}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  bannerTextWrap: { flex: 1 },
  bannerTitle: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#F59E0B",
    letterSpacing: 1.5,
    marginBottom: 2,
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
});
