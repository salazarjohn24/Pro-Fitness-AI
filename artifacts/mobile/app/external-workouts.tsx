import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActivityImportModal, type ImportedWorkoutData } from "@/components/ActivityImportModal";
import { Colors } from "@/constants/colors";
import {
  useProfile,
  useUpdateProfile,
  useRecentExternalWorkouts,
  useSubmitExternalWorkout,
  useUpdateExternalWorkout,
  useDeleteExternalWorkout,
  type ExternalWorkout,
} from "@/hooks/useProfile";
import {
  MUSCLE_GROUPS,
  computeStimulusPoints,
  type SkillLevel,
} from "@/utils/stimulus";

const WORKOUT_TYPES = [
  "Strength", "Cardio", "HIIT", "CrossFit", "Yoga",
  "Pilates", "Swimming", "Running", "Cycling", "Sports", "Other",
];

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 75, 90, 120];

function resolveSkillLevel(raw?: string | null): SkillLevel {
  if (raw === "Beginner" || raw === "Intermediate" || raw === "Advanced") return raw;
  return "Intermediate";
}

export default function ExternalWorkoutsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: profile } = useProfile();
  const { mutate: updateProfile } = useUpdateProfile();
  const { data: workouts, isLoading } = useRecentExternalWorkouts();
  const { mutate: submitWorkout } = useSubmitExternalWorkout();
  const { mutate: updateWorkout } = useUpdateExternalWorkout();
  const { mutate: deleteWorkout } = useDeleteExternalWorkout();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<ExternalWorkout | null>(null);

  const [editLabel, setEditLabel] = useState("");
  const [editDuration, setEditDuration] = useState(30);
  const [editType, setEditType] = useState("Strength");
  const [editIntensity, setEditIntensity] = useState(5);
  const [editMuscleGroups, setEditMuscleGroups] = useState<string[]>([]);

  const userSkillLevel = resolveSkillLevel(profile?.skillLevel);
  const syncProgress = profile?.dailySyncProgress ?? 0;

  const openEdit = (w: ExternalWorkout) => {
    setEditingWorkout(w);
    setEditLabel(w.label);
    setEditDuration(w.duration);
    setEditType(w.workoutType);
    setEditIntensity(w.intensity ?? 5);
    setEditMuscleGroups(w.muscleGroups ?? []);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSaveEdit = () => {
    if (!editingWorkout || !editLabel.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const groups = editMuscleGroups.length > 0 ? editMuscleGroups : ["Full Body"];
    const stimulusPoints = computeStimulusPoints({
      duration: editDuration,
      intensity: editIntensity,
      muscleGroups: groups,
      skillLevel: userSkillLevel,
    });
    updateWorkout({
      id: editingWorkout.id,
      label: editLabel.trim(),
      duration: editDuration,
      workoutType: editType,
      intensity: editIntensity,
      muscleGroups: groups,
      stimulusPoints,
    });
    setEditingWorkout(null);
  };

  const handleDelete = (w: ExternalWorkout) => {
    if (Platform.OS === "web") {
      if (confirm("Delete this workout?")) {
        deleteWorkout(w.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } else {
      Alert.alert("Delete Workout", `Remove "${w.label}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteWorkout(w.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]);
    }
  };

  const markActivityDone = () => {
    const newProgress = Math.min(100, syncProgress + 50);
    updateProfile({ activityImported: true, dailySyncProgress: newProgress });
  };

  const handleSaveError = (err: unknown, onRetry: () => void) => {
    const e = err as { message?: string; retryable?: boolean };
    const retryable = e?.retryable !== false;
    Alert.alert(
      "Workout Not Saved",
      e?.message ?? "Something went wrong. Please try again.",
      retryable
        ? [
            { text: "Cancel", style: "cancel" },
            { text: "Retry", onPress: onRetry },
          ]
        : [{ text: "OK", style: "cancel" }]
    );
  };

  const handleAddComplete = (data: ImportedWorkoutData) => {
    setAddModalOpen(false);
    submitWorkout(data, {
      onSuccess: () => {
        markActivityDone();
      },
      onError: (err) => {
        handleSaveError(err, () => handleAddComplete(data));
      },
    });
  };

  const handleManualSubmit = (data: Omit<ImportedWorkoutData, "source">) => {
    setAddModalOpen(false);
    submitWorkout({ ...data, source: "manual" }, {
      onSuccess: () => {
        markActivityDone();
      },
      onError: (err) => {
        handleSaveError(err, () => handleManualSubmit(data));
      },
    });
  };

  const toggleMuscleGroup = (group: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditMuscleGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const renderWorkoutCard = ({ item }: { item: ExternalWorkout }) => {
    const isRest = item.workoutType === "rest";
    const isExternal = item.source !== "in-app";
    const dateStr = new Date(item.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const iconName = isRest ? "moon" : isExternal ? "globe" : "award";
    const iconColor = isRest ? Colors.recovery : isExternal ? Colors.orange : Colors.highlight;
    const iconBg = isRest ? styles.sourceIconRest : isExternal ? styles.sourceIconExternal : styles.sourceIconInApp;

    return (
      <Pressable
        style={({ pressed }) => [styles.workoutCard, { opacity: pressed ? 0.9 : 1 }]}
        onPress={() => !isRest && openEdit(item)}
        disabled={isRest}
      >
        <View style={styles.workoutCardHeader}>
          <View style={[styles.sourceIcon, iconBg]}>
            <Feather name={iconName} size={16} color={iconColor} />
          </View>
          <View style={styles.workoutCardInfo}>
            <Text style={styles.workoutLabel}>{item.label}</Text>
            <Text style={styles.workoutMeta}>{dateStr}</Text>
          </View>
          <Pressable
            onPress={() => handleDelete(item)}
            style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={10}
          >
            <Feather name="trash-2" size={14} color={Colors.textSubtle} />
          </Pressable>
        </View>

        {!isRest && (
          <View style={styles.workoutStats}>
            {item.duration > 0 && (
              <View style={styles.workoutStat}>
                <Feather name="clock" size={12} color={Colors.recovery} />
                <Text style={styles.workoutStatText}>{item.duration} min</Text>
              </View>
            )}
            {item.intensity ? (
              <View style={styles.workoutStat}>
                <Feather name="zap" size={12} color={Colors.orange} />
                <Text style={styles.workoutStatText}>RPE {item.intensity}</Text>
              </View>
            ) : null}
            {item.stimulusPoints ? (
              <View style={styles.workoutStat}>
                <Feather name="trending-up" size={12} color={Colors.highlight} />
                <Text style={styles.workoutStatText}>{item.stimulusPoints} pts</Text>
              </View>
            ) : null}
            <View style={styles.workoutStat}>
              <Feather name="tag" size={12} color={Colors.textMuted} />
              <Text style={styles.workoutStatText}>{item.workoutType}</Text>
            </View>
          </View>
        )}

        {!isRest && item.muscleGroups && item.muscleGroups.length > 0 && (
          <View style={styles.muscleRow}>
            {item.muscleGroups.map((g) => (
              <View key={g} style={styles.muscleTag}>
                <Text style={styles.muscleTagText}>{g}</Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>
    );
  };

  if (editingWorkout) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: topPad }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => setEditingWorkout(null)} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={Colors.text} />
          </Pressable>
          <Text style={styles.topTitle}>Edit Workout</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.editScroll} contentContainerStyle={{ paddingBottom: botPad + 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>WORKOUT NAME</Text>
            <TextInput
              style={styles.textInput}
              value={editLabel}
              onChangeText={setEditLabel}
              placeholderTextColor={Colors.textSubtle}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>WORKOUT TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {WORKOUT_TYPES.map((type) => {
                  const selected = editType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditType(type); }}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{type}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>DURATION (MINUTES)</Text>
            <View style={styles.chipRow}>
              {DURATION_OPTIONS.map((d) => {
                const selected = editDuration === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditDuration(d); }}
                    style={[styles.durationChip, selected && styles.durationChipSelected]}
                  >
                    <Text style={[styles.durationChipText, selected && styles.durationChipTextSelected]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>RPE / INTENSITY (1-10)</Text>
            <View style={styles.chipRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
                const selected = editIntensity === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditIntensity(v); }}
                    style={[styles.rpeChip, selected && styles.rpeChipSelected]}
                  >
                    <Text style={[styles.rpeChipText, selected && styles.rpeChipTextSelected]}>{v}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.rpeHint}>
              {editIntensity <= 3 ? "Light effort" : editIntensity <= 5 ? "Moderate effort" : editIntensity <= 7 ? "Hard effort" : editIntensity <= 9 ? "Very hard" : "Max effort"}
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>MUSCLE GROUPS</Text>
            <View style={styles.musclePickerRow}>
              {MUSCLE_GROUPS.map((group) => {
                const selected = editMuscleGroups.includes(group);
                return (
                  <Pressable
                    key={group}
                    onPress={() => toggleMuscleGroup(group)}
                    style={[styles.chip, selected && styles.muscleChipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.muscleChipTextSelected]}>{group}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              !editLabel.trim() && styles.saveBtnDisabled,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={handleSaveEdit}
            disabled={!editLabel.trim()}
          >
            <Feather name="check" size={16} color="#fff" />
            <Text style={styles.saveBtnText}>SAVE CHANGES</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>External Workouts</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={workouts ?? []}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderWorkoutCard}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 100, gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="globe" size={32} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Workouts Yet</Text>
            <Text style={styles.emptyDesc}>
              Log your CrossFit, Strava, Apple Fitness, or any other external workout to keep your training log complete.
            </Text>
          </View>
        }
      />

      <View style={[styles.fabContainer, { bottom: botPad + 20 }]}>
        <Pressable
          style={({ pressed }) => [styles.fab, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setAddModalOpen(true);
          }}
        >
          <Feather name="plus" size={22} color="#fff" />
          <Text style={styles.fabText}>LOG WORKOUT</Text>
        </Pressable>
      </View>

      <ActivityImportModal
        visible={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onComplete={handleAddComplete}
        onManualSubmit={handleManualSubmit}
        skillLevel={profile?.skillLevel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 16,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  workoutCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  workoutCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sourceIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceIconExternal: {
    backgroundColor: "rgba(252,82,0,0.1)",
  },
  sourceIconInApp: {
    backgroundColor: "rgba(246,234,152,0.1)",
  },
  sourceIconRest: {
    backgroundColor: "rgba(119,156,175,0.1)",
  },
  workoutCardInfo: { flex: 1 },
  workoutLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  workoutMeta: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    marginTop: 2,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  workoutStats: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },
  workoutStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  workoutStatText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  muscleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  muscleTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: "rgba(246,234,152,0.08)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.2)",
  },
  muscleTagText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.highlight,
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  fabContainer: {
    position: "absolute",
    left: 20,
    right: 20,
  },
  fab: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: Colors.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 14,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  editScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formGroup: { gap: 8, marginTop: 16 },
  fieldLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  textInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  chipSelected: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.12)",
  },
  chipText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  chipTextSelected: {
    color: Colors.orange,
  },
  muscleChipSelected: {
    borderColor: Colors.highlight,
    backgroundColor: "rgba(246,234,152,0.12)",
  },
  muscleChipTextSelected: {
    color: Colors.highlight,
  },
  musclePickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  durationChip: {
    width: 52,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  durationChipSelected: {
    borderColor: Colors.highlight,
    backgroundColor: "rgba(246,234,152,0.1)",
  },
  durationChipText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  durationChipTextSelected: {
    color: Colors.highlight,
  },
  rpeChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  rpeChipSelected: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.15)",
  },
  rpeChipText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  rpeChipTextSelected: {
    color: Colors.orange,
  },
  rpeHint: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    letterSpacing: 0.5,
  },
  saveBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
  },
  saveBtnDisabled: {
    backgroundColor: "#3A3A38",
  },
  saveBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
});
