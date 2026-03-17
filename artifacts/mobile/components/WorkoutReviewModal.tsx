import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import type { GeneratedExercise, GeneratedWorkout } from "@/hooks/useWorkout";

interface Props {
  visible: boolean;
  workout: GeneratedWorkout | null;
  onClose: () => void;
  onStart: (workout: GeneratedWorkout, exercises: GeneratedExercise[]) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  warmup: "WARM-UP",
  compound: "PRIMARY",
  accessory: "ACCESSORY",
  core: "CORE",
  cooldown: "COOL-DOWN",
};

export default function WorkoutReviewModal({ visible, workout, onClose, onStart }: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 24 : insets.top;
  const botPad = Platform.OS === "web" ? 24 : insets.bottom;

  const [exercises, setExercises] = useState<GeneratedExercise[]>([]);

  React.useEffect(() => {
    if (workout) setExercises(workout.exercises);
  }, [workout]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    Haptics.selectionAsync();
    setExercises(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index === exercises.length - 1) return;
    Haptics.selectionAsync();
    setExercises(prev => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const removeExercise = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExercises(prev => prev.filter((_, i) => i !== index));
  };

  const handleStart = () => {
    if (!workout || exercises.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onStart({ ...workout, exercises }, exercises);
  };

  if (!workout) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn} hitSlop={10}>
            <Feather name="x" size={20} color={Colors.textMuted} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Review Workout</Text>
            <Text style={styles.headerSub}>{exercises.length} exercises</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.workoutInfo}>
          <Text style={styles.workoutTitle}>{workout.workoutTitle}</Text>
          <Text style={styles.workoutRationale}>{workout.rationale}</Text>
        </View>

        <View style={styles.hint}>
          <Feather name="info" size={12} color={Colors.textSubtle} />
          <Text style={styles.hintText}>Drag to reorder • Tap minus to remove • Tap play when ready</Text>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: botPad + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {exercises.map((ex, idx) => (
            <View key={`${ex.exerciseId}-${idx}`} style={styles.exerciseRow}>
              <View style={styles.reorderCol}>
                <Pressable
                  onPress={() => moveUp(idx)}
                  style={[styles.reorderBtn, idx === 0 && styles.reorderBtnDisabled]}
                  disabled={idx === 0}
                  hitSlop={6}
                >
                  <Feather name="chevron-up" size={16} color={idx === 0 ? Colors.border : Colors.textMuted} />
                </Pressable>
                <Pressable
                  onPress={() => moveDown(idx)}
                  style={[styles.reorderBtn, idx === exercises.length - 1 && styles.reorderBtnDisabled]}
                  disabled={idx === exercises.length - 1}
                  hitSlop={6}
                >
                  <Feather name="chevron-down" size={16} color={idx === exercises.length - 1 ? Colors.border : Colors.textMuted} />
                </Pressable>
              </View>

              <View style={styles.exerciseInfo}>
                {ex.category && CATEGORY_LABELS[ex.category] && (
                  <Text style={styles.categoryLabel}>{CATEGORY_LABELS[ex.category]}</Text>
                )}
                <Text style={styles.exerciseName}>{ex.name}</Text>
                <Text style={styles.exerciseVolume}>
                  {ex.sets} sets × {ex.reps} reps
                  {ex.weight && ex.weight !== "BW" ? ` · ${ex.weight}` : ex.weight === "BW" ? " · Bodyweight" : ""}
                </Text>
                <Text style={styles.exerciseMuscle}>{ex.primaryMuscle}</Text>
              </View>

              <Pressable
                onPress={() => removeExercise(idx)}
                style={styles.removeBtn}
                hitSlop={8}
              >
                <Feather name="minus-circle" size={18} color={Colors.textSubtle} />
              </Pressable>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: botPad + 12 }]}>
          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              exercises.length === 0 && styles.startBtnDisabled,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={handleStart}
            disabled={exercises.length === 0}
          >
            <Feather name="play" size={18} color={Colors.bg} />
            <Text style={styles.startBtnText}>Start Workout</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    marginTop: 2,
  },
  workoutInfo: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  workoutTitle: {
    fontSize: 22,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    letterSpacing: -0.5,
  },
  workoutRationale: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hintText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 8,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  reorderCol: {
    gap: 2,
    alignItems: "center",
  },
  reorderBtn: {
    padding: 4,
    borderRadius: 6,
  },
  reorderBtnDisabled: {
    opacity: 0.3,
  },
  exerciseInfo: {
    flex: 1,
    gap: 2,
  },
  categoryLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.orange,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  exerciseName: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  exerciseVolume: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  exerciseMuscle: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    textTransform: "capitalize",
  },
  removeBtn: {
    padding: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
  },
  startBtnDisabled: {
    opacity: 0.4,
  },
  startBtnText: {
    fontSize: 16,
    fontFamily: "Inter_900Black",
    color: Colors.bg,
    letterSpacing: 0.5,
  },
});
