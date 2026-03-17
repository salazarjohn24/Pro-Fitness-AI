import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState, useEffect } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";
import { MUSCLE_GROUPS, computeStimulusPoints, type SkillLevel } from "@/utils/stimulus";

const WORKOUT_TYPES = [
  "Strength", "Cardio", "HIIT", "CrossFit", "Yoga",
  "Pilates", "Swimming", "Running", "Cycling", "Sports", "Other",
];

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 75, 90, 120];

function resolveSkillLevel(raw?: string | null): SkillLevel {
  if (raw === "Beginner" || raw === "Intermediate" || raw === "Advanced") return raw;
  return "Intermediate";
}

export interface WorkoutItem {
  id: number;
  label: string;
  duration: number;
  workoutType: string;
  intensity: number | null;
  muscleGroups: string[] | null;
  stimulusPoints: number | null;
  source: string;
  createdAt: string;
}

interface Props {
  visible: boolean;
  workout: WorkoutItem | null;
  skillLevel?: string | null;
  onClose: () => void;
  onSave: (id: number, data: {
    label: string;
    duration: number;
    workoutType: string;
    intensity: number;
    muscleGroups: string[];
    stimulusPoints: number;
  }) => void;
  onDelete: (id: number) => void;
  isSaving?: boolean;
}

export function EditWorkoutModal({ visible, workout, skillLevel, onClose, onSave, onDelete, isSaving }: Props) {
  const userSkillLevel = resolveSkillLevel(skillLevel);

  const [label, setLabel] = useState("");
  const [duration, setDuration] = useState(30);
  const [workoutType, setWorkoutType] = useState("Strength");
  const [intensity, setIntensity] = useState(5);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);

  useEffect(() => {
    if (workout) {
      setLabel(workout.label);
      setDuration(workout.duration || 30);
      setWorkoutType(workout.workoutType || "Strength");
      setIntensity(workout.intensity ?? 5);
      setMuscleGroups(workout.muscleGroups ?? []);
    }
  }, [workout]);

  const toggleMuscleGroup = (group: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMuscleGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const handleSave = () => {
    if (!label.trim() || !workout) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const groups = muscleGroups.length > 0 ? muscleGroups : [workoutType];
    const stimulusPoints = computeStimulusPoints({
      duration,
      intensity,
      muscleGroups: groups,
      skillLevel: userSkillLevel,
    });
    onSave(workout.id, {
      label: label.trim(),
      duration,
      workoutType,
      intensity,
      muscleGroups: groups,
      stimulusPoints,
    });
  };

  const handleDelete = () => {
    if (!workout) return;
    Alert.alert(
      "Delete Workout",
      "Are you sure you want to remove this activity from your log?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onDelete(workout.id);
          },
        },
      ]
    );
  };

  if (!workout) return null;

  const isRest = workout.workoutType === "rest";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 560 }}>
            <View style={styles.titleRow}>
              <View>
                <Text style={styles.overline}>EDIT ACTIVITY</Text>
                <Text style={styles.title}>
                  Adjust <Text style={styles.titleAccent}>details</Text>
                </Text>
              </View>
              <Pressable onPress={handleDelete} style={styles.deleteBtn} hitSlop={8}>
                <Feather name="trash-2" size={18} color="#F87171" />
              </Pressable>
            </View>

            {isRest ? (
              <View style={styles.restNote}>
                <Feather name="moon" size={14} color={Colors.recovery} />
                <Text style={styles.restNoteText}>Rest &amp; Recovery Day — no adjustments needed</Text>
              </View>
            ) : (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>WORKOUT NAME</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder='e.g. "Upper Body Push"'
                    placeholderTextColor={Colors.textSubtle}
                    value={label}
                    onChangeText={setLabel}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>WORKOUT TYPE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.typeRow}>
                      {WORKOUT_TYPES.map((type) => {
                        const selected = workoutType === type;
                        return (
                          <Pressable
                            key={type}
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWorkoutType(type); }}
                            style={[styles.typeChip, selected && styles.typeChipSelected]}
                          >
                            <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>{type}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>DURATION (MINUTES)</Text>
                  <View style={styles.durationRow}>
                    {DURATION_OPTIONS.map((d) => {
                      const selected = duration === d;
                      return (
                        <Pressable
                          key={d}
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDuration(d); }}
                          style={[styles.durationChip, selected && styles.durationChipSelected]}
                        >
                          <Text style={[styles.durationChipText, selected && styles.durationChipTextSelected]}>{d}</Text>
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
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIntensity(v); }}
                          style={[styles.rpeChip, selected && styles.rpeChipSelected]}
                        >
                          <Text style={[styles.rpeChipText, selected && styles.rpeChipTextSelected]}>{v}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>MUSCLE GROUPS</Text>
                  <View style={styles.muscleGrid}>
                    {MUSCLE_GROUPS.map((group) => {
                      const selected = muscleGroups.includes(group);
                      return (
                        <Pressable
                          key={group}
                          onPress={() => toggleMuscleGroup(group)}
                          style={[styles.muscleChip, selected && styles.muscleChipSelected]}
                        >
                          <Text style={[styles.muscleChipText, selected && styles.muscleChipTextSelected]}>{group}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            <View style={styles.actions}>
              {!isRest && (
                <Pressable
                  style={({ pressed }) => [
                    styles.saveBtn,
                    (!label.trim() || isSaving) && styles.saveBtnDisabled,
                    { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                  ]}
                  onPress={handleSave}
                  disabled={!label.trim() || isSaving}
                >
                  <Feather name="check-circle" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>{isSaving ? "SAVING..." : "SAVE CHANGES"}</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  overline: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
  },
  titleAccent: { color: Colors.orange },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(248,113,113,0.1)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  restNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(119,156,175,0.08)",
    borderWidth: 1,
    borderColor: "rgba(119,156,175,0.2)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  restNoteText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.recovery,
    flex: 1,
  },
  formGroup: { marginBottom: 20 },
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
  typeRow: { flexDirection: "row", gap: 8 },
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
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  actions: { gap: 10, marginTop: 8 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 16,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
});
