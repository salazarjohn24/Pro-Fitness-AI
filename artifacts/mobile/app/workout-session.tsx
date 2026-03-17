import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { getRecoveryTip, getNutritionTip } from "@/constants/recoveryTips";
import { useSubmitExternalWorkout, useProfile } from "@/hooks/useProfile";
import { computeStimulusPoints, type SkillLevel } from "@/utils/stimulus";
import { useSaveWorkout, fetchExerciseAlternatives, recordExerciseSubstitution, type AlternativeExercise, type GeneratedExercise, type GeneratedWorkout } from "@/hooks/useWorkout";

type SetStatus = "pending" | "done" | "failed";

interface SetLog {
  completed: boolean;
  status: SetStatus;
  weight: string;
  reps: number;
  completedAt?: number;
}

const DEFAULT_REST_SECONDS = 75;

const CATEGORY_LABELS: Record<string, string> = {
  warmup: "DYNAMIC WARM-UP",
  compound: "PRIMARY COMPOUND",
  accessory: "SECONDARY ACCESSORIES",
  core: "CORE",
  cooldown: "COOL-DOWN",
};

export default function WorkoutSessionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ workout?: string }>();
  const { mutate: saveWorkout } = useSaveWorkout();
  const { mutate: submitExternalWorkout } = useSubmitExternalWorkout();
  const { data: profile } = useProfile();
  const userSkillLevel: SkillLevel = (profile?.skillLevel === "Beginner" || profile?.skillLevel === "Intermediate" || profile?.skillLevel === "Advanced") ? profile.skillLevel : "Intermediate";

  const [workoutData, setWorkoutData] = useState<GeneratedWorkout | null>(() => {
    if (params.workout) {
      try { return JSON.parse(params.workout); } catch { return null; }
    }
    return null;
  });

  const exercises = workoutData?.exercises ?? [];

  const [setLogs, setSetLogs] = useState<Record<string, SetLog[]>>(() => {
    const logs: Record<string, SetLog[]> = {};
    exercises.forEach((ex) => {
      logs[ex.exerciseId] = Array.from({ length: ex.sets }, () => ({
        completed: false,
        status: "pending" as SetStatus,
        weight: ex.weight,
        reps: ex.reps,
      }));
    });
    return logs;
  });

  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [restTimerVisible, setRestTimerVisible] = useState(false);
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);
  const [restRemaining, setRestRemaining] = useState(DEFAULT_REST_SECONDS);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<AlternativeExercise[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);

  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [feedbackDifficulty, setFeedbackDifficulty] = useState(3);
  const [feedbackEnergy, setFeedbackEnergy] = useState(3);
  const [feedbackEnjoyment, setFeedbackEnjoyment] = useState(3);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [workoutComments, setWorkoutComments] = useState("");
  const [extraExercises, setExtraExercises] = useState<{ name: string; sets: number; reps: number; weight: string }[]>([]);
  const [addExOpen, setAddExOpen] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExSets, setNewExSets] = useState(3);
  const [newExReps, setNewExReps] = useState(10);
  const [newExWeight, setNewExWeight] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (restTimerVisible && restRemaining > 0) {
      restTimerRef.current = setInterval(() => {
        setRestRemaining((r) => {
          if (r <= 1) {
            clearInterval(restTimerRef.current!);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
      return () => { if (restTimerRef.current) clearInterval(restTimerRef.current); };
    }
  }, [restTimerVisible, restRemaining]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const totalSets = exercises.reduce((a, ex) => a + ex.sets, 0);
  const completedSets = Object.values(setLogs).reduce(
    (a, logs) => a + logs.filter((l) => l.status === "done").length,
    0
  );
  const failedSets = Object.values(setLogs).reduce(
    (a, logs) => a + logs.filter((l) => l.status === "failed").length,
    0
  );
  const pct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  const toggleSet = (exId: string, setIdx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSetLogs((prev) => {
      const logs = [...(prev[exId] ?? [])];
      const current = logs[setIdx]?.status ?? "pending";
      const next: SetStatus = current === "pending" ? "done" : current === "done" ? "failed" : "pending";
      logs[setIdx] = { ...logs[setIdx], status: next, completed: next === "done", completedAt: next === "done" ? Date.now() : undefined };
      if (next === "done") {
        setRestRemaining(restSeconds);
        setRestTimerVisible(true);
      }
      return { ...prev, [exId]: logs };
    });
  };

  const updateSetWeight = (exId: string, setIdx: number, weight: string) => {
    setSetLogs((prev) => {
      const logs = [...(prev[exId] ?? [])];
      logs[setIdx] = { ...logs[setIdx], weight };
      return { ...prev, [exId]: logs };
    });
  };

  const updateSetReps = (exId: string, setIdx: number, reps: number) => {
    setSetLogs((prev) => {
      const logs = [...(prev[exId] ?? [])];
      logs[setIdx] = { ...logs[setIdx], reps };
      return { ...prev, [exId]: logs };
    });
  };

  const handleSwap = useCallback(async (exerciseId: string) => {
    setSwappingId(exerciseId);
    setSwapLoading(true);
    try {
      const alts = await fetchExerciseAlternatives(exerciseId);
      setSwapAlternatives(alts);
    } catch {
      setSwapAlternatives([]);
    }
    setSwapLoading(false);
  }, []);

  const confirmSwap = (alt: AlternativeExercise) => {
    if (!swappingId || !workoutData) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const originalEx = workoutData.exercises.find(ex => ex.exerciseId === swappingId);
    if (originalEx && originalEx.name !== alt.name) {
      recordExerciseSubstitution(originalEx.name, alt.name);
    }

    const newExercises = workoutData.exercises.map(ex => {
      if (ex.exerciseId === swappingId) {
        return {
          ...ex,
          exerciseId: alt.id,
          name: alt.name,
          primaryMuscle: alt.primaryMuscle,
          secondaryMuscles: alt.secondaryMuscles,
          youtubeKeyword: alt.youtubeKeyword,
        };
      }
      return ex;
    });

    const newWorkout = { ...workoutData, exercises: newExercises };
    setWorkoutData(newWorkout);

    const oldLogs = setLogs[swappingId];
    if (oldLogs) {
      const newLogs = { ...setLogs };
      delete newLogs[swappingId];
      newLogs[alt.id] = oldLogs.map(l => ({ ...l, completed: false, status: "pending" as SetStatus }));
      setSetLogs(newLogs);
    }

    setSwappingId(null);
    setSwapAlternatives([]);
  };

  const openVideo = (youtubeKeyword: string) => {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(youtubeKeyword)}`;
    Linking.openURL(url);
  };

  const handleAddExercise = () => {
    if (!newExName.trim()) return;
    setExtraExercises(prev => [...prev, { name: newExName.trim(), sets: newExSets, reps: newExReps, weight: newExWeight.trim() }]);
    setNewExName("");
    setNewExSets(3);
    setNewExReps(10);
    setNewExWeight("");
    setAddExOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (timerRef.current) clearInterval(timerRef.current);
    setShowReview(true);
  };

  const handleSubmitFeedback = () => {
    const exerciseData = exercises.map(ex => {
      const logs = setLogs[ex.exerciseId] ?? [];
      const completedTimestamps = logs
        .filter(s => s.status === "done" && s.completedAt)
        .map(s => s.completedAt!)
        .sort((a, b) => a - b);
      const restIntervals: number[] = [];
      for (let i = 1; i < completedTimestamps.length; i++) {
        restIntervals.push(Math.round((completedTimestamps[i] - completedTimestamps[i - 1]) / 1000));
      }
      return {
        exerciseId: ex.exerciseId,
        name: ex.name,
        targetWeight: ex.weight,
        targetReps: ex.reps,
        targetRestSeconds: restSeconds,
        actualRestSeconds: restIntervals,
        sets: logs.map(s => ({
          reps: s.reps,
          weight: s.weight,
          completed: s.status === "done",
        })),
      };
    });

    const extraData = extraExercises.map((ex, i) => ({
      exerciseId: `extra-${i}-${Date.now()}`,
      name: ex.name,
      targetWeight: ex.weight || "bodyweight",
      targetReps: ex.reps,
      targetRestSeconds: restSeconds,
      actualRestSeconds: [],
      sets: Array.from({ length: ex.sets }, () => ({ reps: ex.reps, weight: ex.weight || "0", completed: true })),
    }));

    const combinedNotes = [workoutComments.trim(), feedbackNotes.trim()].filter(Boolean).join("\n\n");

    saveWorkout({
      workoutTitle: workoutData?.workoutTitle ?? "Workout",
      durationSeconds: elapsed,
      exercises: [...exerciseData, ...extraData],
      totalSetsCompleted: completedSets + extraExercises.reduce((a, ex) => a + ex.sets, 0),
      postWorkoutFeedback: {
        perceivedDifficulty: feedbackDifficulty,
        energyAfter: feedbackEnergy,
        enjoyment: feedbackEnjoyment,
        notes: combinedNotes,
      },
    }, {
      onSuccess: () => setSaved(true),
      onError: () => setSaved(false),
    });

    setShowQuestionnaire(false);
    setFinished(true);

    const durationMin = Math.max(1, Math.round(elapsed / 60));
    const muscleGroups = [...new Set(
      exercises.flatMap((ex) => [
        ex.primaryMuscle,
        ...ex.secondaryMuscles
      ]).filter(Boolean)
    )];
    const intensity = Math.min(10, Math.max(1, Math.round((pct / 100) * 8) + 2));
    const stimulusPoints = computeStimulusPoints({ duration: durationMin, intensity, muscleGroups, skillLevel: userSkillLevel });
    submitExternalWorkout({
      label: workoutData?.workoutTitle ?? "Workout",
      duration: durationMin,
      workoutType: "Strength",
      source: "in-app",
      intensity,
      muscleGroups,
      stimulusPoints,
    });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!workoutData || exercises.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="x" size={20} color={Colors.textMuted} />
          </Pressable>
          <Text style={styles.topBarTitle}>NO WORKOUT</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.emptyBlock}>
          <Feather name="alert-circle" size={48} color={Colors.textSubtle} />
          <Text style={styles.emptyText}>No workout generated yet.{"\n"}Complete your check-in first.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.back()}>
            <Text style={styles.emptyBtnText}>GO BACK</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (showReview) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.topBar}>
          <View style={{ width: 36 }} />
          <Text style={styles.topBarTitle}>REVIEW SESSION</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={[styles.questionnaireContainer, { paddingBottom: botPad + 20 }]}>
          <View style={styles.finishedIcon}>
            <Feather name="check-square" size={32} color={Colors.highlight} />
          </View>
          <Text style={styles.finishedTitle}>REVIEW &{"\n"}CONFIRM</Text>
          <Text style={styles.finishedSub}>Add anything you missed and share insights to make your future workouts smarter.</Text>

          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionLabel}>EXERCISES LOGGED</Text>
            {exercises.map((ex) => {
              const logs = setLogs[ex.exerciseId] ?? [];
              const done = logs.filter(l => l.status === "done").length;
              const lastLog = logs.find(l => l.status === "done");
              return (
                <View key={ex.exerciseId} style={styles.reviewExRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewExName}>{ex.name}</Text>
                    <Text style={styles.reviewExMeta}>
                      {done}/{ex.sets} sets{lastLog?.weight ? ` · ${lastLog.weight}` : ""}{lastLog ? ` × ${lastLog.reps} reps` : ""}
                    </Text>
                  </View>
                  <View style={[styles.reviewExBadge, { backgroundColor: done === ex.sets ? "rgba(119,156,175,0.15)" : "rgba(252,82,0,0.12)" }]}>
                    <Text style={[styles.reviewExBadgeText, { color: done === ex.sets ? Colors.recovery : Colors.orange }]}>
                      {done === ex.sets ? "COMPLETE" : `${done}/${ex.sets}`}
                    </Text>
                  </View>
                </View>
              );
            })}
            {extraExercises.map((ex, i) => (
              <View key={`extra-${i}`} style={[styles.reviewExRow, { borderColor: "rgba(246,234,152,0.2)" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewExName}>{ex.name}</Text>
                  <Text style={styles.reviewExMeta}>{ex.sets} sets{ex.weight ? ` · ${ex.weight}` : ""} × {ex.reps} reps · Added</Text>
                </View>
                <Pressable onPress={() => setExtraExercises(prev => prev.filter((_, idx) => idx !== i))} style={styles.reviewExRemove}>
                  <Feather name="x" size={14} color={Colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.addExBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => setAddExOpen(o => !o)}
          >
            <Feather name={addExOpen ? "minus" : "plus"} size={14} color={Colors.highlight} />
            <Text style={styles.addExBtnText}>{addExOpen ? "CANCEL" : "ADD MISSED EXERCISE"}</Text>
          </Pressable>

          {addExOpen && (
            <View style={styles.addExForm}>
              <TextInput
                style={styles.addExInput}
                placeholder="Exercise name (e.g. Romanian Deadlift)"
                placeholderTextColor={Colors.textSubtle}
                value={newExName}
                onChangeText={setNewExName}
              />
              <View style={styles.addExRow}>
                <View style={styles.addExField}>
                  <Text style={styles.addExFieldLabel}>SETS</Text>
                  <View style={styles.addExStepper}>
                    <Pressable onPress={() => setNewExSets(s => Math.max(1, s - 1))} style={styles.addExStep}>
                      <Text style={styles.addExStepText}>−</Text>
                    </Pressable>
                    <Text style={styles.addExStepVal}>{newExSets}</Text>
                    <Pressable onPress={() => setNewExSets(s => Math.min(10, s + 1))} style={styles.addExStep}>
                      <Text style={styles.addExStepText}>+</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.addExField}>
                  <Text style={styles.addExFieldLabel}>REPS</Text>
                  <View style={styles.addExStepper}>
                    <Pressable onPress={() => setNewExReps(r => Math.max(1, r - 1))} style={styles.addExStep}>
                      <Text style={styles.addExStepText}>−</Text>
                    </Pressable>
                    <Text style={styles.addExStepVal}>{newExReps}</Text>
                    <Pressable onPress={() => setNewExReps(r => Math.min(50, r + 1))} style={styles.addExStep}>
                      <Text style={styles.addExStepText}>+</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={[styles.addExField, { flex: 1.5 }]}>
                  <Text style={styles.addExFieldLabel}>WEIGHT</Text>
                  <TextInput
                    style={styles.addExWeightInput}
                    placeholder="e.g. 135 lbs"
                    placeholderTextColor={Colors.textSubtle}
                    value={newExWeight}
                    onChangeText={setNewExWeight}
                    keyboardType="default"
                  />
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.addExConfirmBtn, { opacity: pressed ? 0.9 : 1 }]}
                onPress={handleAddExercise}
              >
                <Feather name="plus-circle" size={14} color={Colors.bgPrimary} />
                <Text style={styles.addExConfirmBtnText}>ADD EXERCISE</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionLabel}>AI INSIGHTS</Text>
            <View style={styles.aiBadge}>
              <Feather name="cpu" size={12} color={Colors.highlight} />
              <Text style={styles.aiBadgeText}>THIS TRAINS YOUR FUTURE WORKOUTS</Text>
            </View>
            <TextInput
              style={[styles.feedbackNotesInput, { marginTop: 10 }]}
              value={workoutComments}
              onChangeText={setWorkoutComments}
              placeholder="e.g. Left shoulder felt tight on bench, PR on deadlift, need shorter rest periods next time, elbow clicking on tricep work..."
              placeholderTextColor={Colors.textSubtle}
              multiline
              numberOfLines={4}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.doneBtn, { marginTop: 8, opacity: pressed ? 0.9 : 1 }]}
            onPress={() => { setShowReview(false); setShowQuestionnaire(true); }}
          >
            <Feather name="arrow-right" size={16} color={Colors.bgPrimary} />
            <Text style={styles.doneBtnText}>LOOKS GOOD — CONTINUE</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (showQuestionnaire) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <ScrollView contentContainerStyle={[styles.questionnaireContainer, { paddingBottom: botPad + 20 }]}>
          <View style={styles.finishedIcon}>
            <Feather name="clipboard" size={32} color={Colors.highlight} />
          </View>
          <Text style={styles.finishedTitle}>HOW DID{"\n"}IT GO?</Text>
          <Text style={styles.finishedSub}>Your feedback directly powers our AI engine. The more detail you provide, the smarter your future workout recommendations become.</Text>
          <View style={styles.aiBadge}>
            <Feather name="cpu" size={12} color={Colors.highlight} />
            <Text style={styles.aiBadgeText}>AI INSIGHT ENGINE — YOUR INPUT MATTERS</Text>
          </View>

          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackLabel}>PERCEIVED DIFFICULTY</Text>
            <Text style={styles.feedbackDesc}>How hard was this workout?</Text>
            <View style={styles.feedbackScale}>
              {[1, 2, 3, 4, 5].map(v => (
                <Pressable
                  key={v}
                  onPress={() => setFeedbackDifficulty(v)}
                  style={[styles.feedbackDot, feedbackDifficulty === v && styles.feedbackDotActive]}
                >
                  <Text style={[styles.feedbackDotText, feedbackDifficulty === v && styles.feedbackDotTextActive]}>{v}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.feedbackLabelsRow}>
              <Text style={styles.feedbackMinMax}>Easy</Text>
              <Text style={styles.feedbackMinMax}>Brutal</Text>
            </View>
          </View>

          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackLabel}>ENERGY AFTER</Text>
            <Text style={styles.feedbackDesc}>How do you feel energy-wise now?</Text>
            <View style={styles.feedbackScale}>
              {[1, 2, 3, 4, 5].map(v => (
                <Pressable
                  key={v}
                  onPress={() => setFeedbackEnergy(v)}
                  style={[styles.feedbackDot, feedbackEnergy === v && styles.feedbackDotActive]}
                >
                  <Text style={[styles.feedbackDotText, feedbackEnergy === v && styles.feedbackDotTextActive]}>{v}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.feedbackLabelsRow}>
              <Text style={styles.feedbackMinMax}>Drained</Text>
              <Text style={styles.feedbackMinMax}>Energized</Text>
            </View>
          </View>

          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackLabel}>ENJOYMENT</Text>
            <Text style={styles.feedbackDesc}>Did you enjoy this workout?</Text>
            <View style={styles.feedbackScale}>
              {[1, 2, 3, 4, 5].map(v => (
                <Pressable
                  key={v}
                  onPress={() => setFeedbackEnjoyment(v)}
                  style={[styles.feedbackDot, feedbackEnjoyment === v && styles.feedbackDotActive]}
                >
                  <Text style={[styles.feedbackDotText, feedbackEnjoyment === v && styles.feedbackDotTextActive]}>{v}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.feedbackLabelsRow}>
              <Text style={styles.feedbackMinMax}>Not at all</Text>
              <Text style={styles.feedbackMinMax}>Loved it</Text>
            </View>
          </View>

          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackLabel}>NOTES</Text>
            <Text style={styles.feedbackDesc}>Joint pain, great pump, exercise swaps, anything the AI should know for next time</Text>
            <TextInput
              style={styles.feedbackNotesInput}
              value={feedbackNotes}
              onChangeText={setFeedbackNotes}
              placeholder="e.g., Left shoulder felt tight on bench press, loved the superset..."
              placeholderTextColor={Colors.textSubtle}
              multiline
              numberOfLines={3}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.doneBtn, { marginTop: 20, opacity: pressed ? 0.9 : 1 }]}
            onPress={handleSubmitFeedback}
          >
            <Feather name="cpu" size={16} color="#fff" />
            <Text style={styles.doneBtnText}>SUBMIT FEEDBACK & FINISH</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (finished) {
    const allMuscles = exercises.flatMap(ex => [ex.primaryMuscle, ...ex.secondaryMuscles]).filter(Boolean);
    const recoveryTip = getRecoveryTip(allMuscles);
    const nutritionTip = getNutritionTip(exercises.length);
    const congrats = pct === 100 ? "OUTSTANDING\nPERFORMANCE!" : pct >= 80 ? "GREAT\nSESSION!" : pct >= 60 ? "SOLID\nWORK TODAY!" : "WELL\nDONE!";
    const subMsg = pct === 100
      ? "Every set. Every rep. That's the standard."
      : pct >= 80
      ? "Almost perfect — that consistency compounds."
      : "Progress is progress. You showed up and that matters.";

    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <ScrollView contentContainerStyle={[styles.questionnaireContainer, { paddingBottom: botPad + 30 }]}>
          <View style={[styles.finishedIcon, { backgroundColor: "rgba(246,234,152,0.12)" }]}>
            <Feather name="zap" size={40} color={Colors.highlight} />
          </View>
          <Text style={styles.finishedTitle}>{congrats}</Text>
          <Text style={styles.finishedSub}>{subMsg}</Text>

          <View style={styles.finishedStats}>
            <View style={styles.finishedStat}>
              <Text style={[styles.finishedStatVal, { color: Colors.highlight }]}>{completedSets + extraExercises.reduce((a, ex) => a + ex.sets, 0)}</Text>
              <Text style={styles.finishedStatLabel}>Sets Done</Text>
            </View>
            <View style={styles.finishedStat}>
              <Text style={[styles.finishedStatVal, { color: Colors.recovery }]}>{formatTime(elapsed)}</Text>
              <Text style={styles.finishedStatLabel}>Duration</Text>
            </View>
            <View style={styles.finishedStat}>
              <Text style={[styles.finishedStatVal, { color: Colors.highlight }]}>{pct}%</Text>
              <Text style={styles.finishedStatLabel}>Complete</Text>
            </View>
          </View>

          {saved ? (
            <View style={styles.savedBadge}>
              <Feather name="check-circle" size={14} color={Colors.highlight} />
              <Text style={styles.savedText}>Saved to history</Text>
            </View>
          ) : saved === false ? (
            <View style={[styles.savedBadge, { borderColor: "rgba(252,82,0,0.3)", backgroundColor: "rgba(252,82,0,0.1)" }]}>
              <Feather name="alert-circle" size={14} color={Colors.orange} />
              <Text style={[styles.savedText, { color: Colors.orange }]}>Save failed — check connection</Text>
            </View>
          ) : (
            <View style={[styles.savedBadge, { borderColor: Colors.border }]}>
              <ActivityIndicator size={12} color={Colors.textMuted} />
              <Text style={styles.savedText}>Saving…</Text>
            </View>
          )}

          <View style={styles.tipCard}>
            <View style={styles.tipCardHeader}>
              <Feather name={recoveryTip.icon as any} size={14} color={Colors.recovery} />
              <Text style={[styles.tipCardTag, { color: Colors.recovery }]}>RECOVERY TIP</Text>
            </View>
            <Text style={styles.tipCardTitle}>{recoveryTip.title}</Text>
            <Text style={styles.tipCardBody}>{recoveryTip.body}</Text>
          </View>

          <View style={[styles.tipCard, { borderColor: "rgba(252,82,0,0.2)", backgroundColor: "rgba(252,82,0,0.05)" }]}>
            <View style={styles.tipCardHeader}>
              <Feather name={nutritionTip.icon as any} size={14} color={Colors.orange} />
              <Text style={[styles.tipCardTag, { color: Colors.orange }]}>NUTRITION TIP</Text>
            </View>
            <Text style={styles.tipCardTitle}>{nutritionTip.title}</Text>
            <Text style={styles.tipCardBody}>{nutritionTip.body}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.doneBtn, { opacity: pressed ? 0.9 : 1, marginTop: 8 }]}
            onPress={() => router.replace("/(tabs)" as any)}
          >
            <Feather name="home" size={16} color={Colors.bgPrimary} />
            <Text style={styles.doneBtnText}>BACK TO DASHBOARD</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const groupedExercises = exercises.reduce((acc, ex) => {
    const cat = ex.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ex);
    return acc;
  }, {} as Record<string, GeneratedExercise[]>);

  const categoryOrder = ["warmup", "compound", "accessory", "core", "cooldown"];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={20} color={Colors.textMuted} />
        </Pressable>
        <View style={styles.timerBlock}>
          <Feather name="clock" size={13} color={Colors.orange} />
          <Text style={styles.timer}>{formatTime(elapsed)}</Text>
        </View>
        <Pressable onPress={handleFinish} style={styles.finishBtn}>
          <Text style={styles.finishBtnText}>FINISH</Text>
        </Pressable>
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressRow}>
          <Text style={styles.workoutTitle}>{workoutData.workoutTitle}</Text>
          <Text style={styles.progressPct}>{pct}%</Text>
        </View>
        <Text style={styles.workoutSub}>{workoutData.subtitle}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
      </View>

      <View style={styles.instructionBar}>
        <Feather name="info" size={12} color={Colors.recovery} />
        <Text style={styles.instructionText}>
          Tap <Text style={styles.instructionBold}>TAP</Text> to mark a set done and start rest.  Tap <Text style={styles.instructionBold}>DONE</Text> again to mark as <Text style={[styles.instructionBold, { color: Colors.orange }]}>FAIL</Text>.
        </Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {categoryOrder.map(cat => {
          const catExercises = groupedExercises[cat];
          if (!catExercises || catExercises.length === 0) return null;
          return (
            <View key={cat}>
              <Text style={styles.categoryLabel}>{CATEGORY_LABELS[cat] ?? cat.toUpperCase()}</Text>
              {catExercises.map((ex) => (
                <View key={ex.exerciseId} style={styles.exCard}>
                  <View style={styles.exHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exName}>{ex.name}</Text>
                      <Text style={styles.exMuscles}>{ex.primaryMuscle}{ex.secondaryMuscles.length > 0 ? ` · ${ex.secondaryMuscles.join(" · ")}` : ""}</Text>
                    </View>
                    <View style={styles.exActions}>
                      <Pressable
                        onPress={() => openVideo(ex.youtubeKeyword)}
                        style={styles.exActionBtn}
                      >
                        <Feather name="play-circle" size={18} color={Colors.recovery} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleSwap(ex.exerciseId)}
                        style={styles.exActionBtn}
                      >
                        <Feather name="refresh-cw" size={16} color={Colors.highlight} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.setList}>
                    <View style={styles.setHeaderRow}>
                      <Text style={[styles.setHeaderText, { width: 28 }]}>SET</Text>
                      <Text style={[styles.setHeaderText, { width: 72, textAlign: "center" }]}>WEIGHT</Text>
                      <Text style={[styles.setHeaderText, { flex: 1, textAlign: "center" }]}>REPS</Text>
                      <Text style={[styles.setHeaderText, { width: 60, textAlign: "center" }]}>STATUS</Text>
                    </View>
                    {(setLogs[ex.exerciseId] ?? []).map((log, i) => (
                      <View
                        key={i}
                        style={[
                          styles.setRow,
                          log.status === "done" && styles.setRowDone,
                          log.status === "failed" && styles.setRowFailed,
                        ]}
                      >
                        <View style={[
                          styles.setCircle,
                          log.status === "done" && styles.setCircleDone,
                          log.status === "failed" && styles.setCircleFailed,
                        ]}>
                          {log.status === "done"
                            ? <Feather name="check" size={12} color={Colors.bgPrimary} />
                            : log.status === "failed"
                              ? <Feather name="x" size={12} color="#fff" />
                              : <Text style={styles.setNum}>{i + 1}</Text>
                          }
                        </View>
                        <TextInput
                          style={[styles.setInput, log.status !== "pending" && styles.setInputDone]}
                          value={log.weight}
                          onChangeText={(t) => updateSetWeight(ex.exerciseId, i, t)}
                          placeholderTextColor={Colors.textSubtle}
                        />
                        <View style={styles.repsControl}>
                          <Pressable
                            onPress={() => updateSetReps(ex.exerciseId, i, Math.max(1, log.reps - 1))}
                            style={styles.repsBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                          >
                            <Feather name="minus" size={14} color={Colors.textMuted} />
                          </Pressable>
                          <TextInput
                            style={styles.repsInput}
                            value={String(log.reps)}
                            onChangeText={(t) => {
                              const n = parseInt(t, 10);
                              if (!isNaN(n) && n > 0) updateSetReps(ex.exerciseId, i, n);
                            }}
                            keyboardType="numeric"
                            placeholderTextColor={Colors.textSubtle}
                          />
                          <Pressable
                            onPress={() => updateSetReps(ex.exerciseId, i, log.reps + 1)}
                            style={styles.repsBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                          >
                            <Feather name="plus" size={14} color={Colors.textMuted} />
                          </Pressable>
                        </View>
                        <Pressable
                          onPress={() => toggleSet(ex.exerciseId, i)}
                          style={[
                            styles.statusBtn,
                            log.status === "done" && styles.statusBtnDone,
                            log.status === "failed" && styles.statusBtnFailed,
                          ]}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Feather
                            name={log.status === "done" ? "check" : log.status === "failed" ? "x" : "circle"}
                            size={14}
                            color={log.status === "done" ? Colors.bgPrimary : log.status === "failed" ? "#fff" : Colors.textMuted}
                          />
                          <Text style={[
                            styles.statusBtnText,
                            log.status === "done" && { color: Colors.bgPrimary },
                            log.status === "failed" && { color: "#fff" },
                          ]}>
                            {log.status === "done" ? "DONE" : log.status === "failed" ? "FAIL" : "TAP"}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={restTimerVisible} transparent animationType="fade">
        <View style={styles.restOverlay}>
          <View style={styles.restCard}>
            <Text style={styles.restLabel}>REST TIMER</Text>
            <Text style={styles.restTime}>{formatTime(restRemaining)}</Text>
            <View style={styles.restTrack}>
              <View style={[styles.restFill, { width: `${(restRemaining / restSeconds) * 100}%` }]} />
            </View>
            <View style={styles.restActions}>
              <Pressable
                style={styles.restAdjBtn}
                onPress={() => setRestRemaining(r => Math.max(0, r - 15))}
              >
                <Text style={styles.restAdjText}>-15s</Text>
              </Pressable>
              <Pressable
                style={styles.restAdjBtn}
                onPress={() => setRestRemaining(r => r + 15)}
              >
                <Text style={styles.restAdjText}>+15s</Text>
              </Pressable>
            </View>
            <Pressable
              style={({ pressed }) => [styles.restDismiss, { opacity: pressed ? 0.9 : 1 }]}
              onPress={() => {
                setRestTimerVisible(false);
                if (restTimerRef.current) clearInterval(restTimerRef.current);
              }}
            >
              <Text style={styles.restDismissText}>SKIP REST</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={swappingId !== null} transparent animationType="slide">
        <View style={styles.swapOverlay}>
          <View style={styles.swapSheet}>
            <View style={styles.swapHandle} />
            <Text style={styles.swapTitle}>SWAP EXERCISE</Text>
            {swapLoading ? (
              <ActivityIndicator color={Colors.orange} style={{ paddingVertical: 30 }} />
            ) : swapAlternatives.length === 0 ? (
              <View style={{ paddingVertical: 30, alignItems: "center" }}>
                <Text style={styles.swapEmpty}>No alternatives available</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {swapAlternatives.map((alt) => (
                  <Pressable
                    key={alt.id}
                    style={({ pressed }) => [styles.swapOption, pressed && { opacity: 0.8 }]}
                    onPress={() => confirmSwap(alt)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.swapOptionName}>{alt.name}</Text>
                      <Text style={styles.swapOptionMuscle}>{alt.primaryMuscle} · {alt.difficulty}</Text>
                    </View>
                    <Feather name="arrow-right" size={16} color={Colors.highlight} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable
              style={({ pressed }) => [styles.swapCancel, { opacity: pressed ? 0.9 : 1 }]}
              onPress={() => { setSwappingId(null); setSwapAlternatives([]); }}
            >
              <Text style={styles.swapCancelText}>CANCEL</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  topBarTitle: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  timerBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  timer: {
    fontSize: 15,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    letterSpacing: 1,
  },
  finishBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  finishBtnText: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  progressBlock: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workoutTitle: {
    fontSize: 20,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
  },
  workoutSub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    letterSpacing: 0.5,
  },
  progressPct: {
    fontSize: 16,
    fontFamily: "Inter_900Black",
    color: Colors.highlight,
    fontStyle: "italic",
  },
  progressTrack: { height: 4, backgroundColor: "#292927", borderRadius: 4, overflow: "hidden", marginTop: 2 },
  progressFill: { height: "100%", backgroundColor: Colors.orange, borderRadius: 4 },
  instructionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 2,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.recovery + "12",
    borderWidth: 1,
    borderColor: Colors.recovery + "25",
  },
  instructionText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 16,
  },
  instructionBold: {
    fontFamily: "Inter_900Black",
    color: Colors.text,
  },
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },
  categoryLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 8,
  },
  exCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    marginBottom: 10,
  },
  exHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  exName: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text, textTransform: "uppercase", letterSpacing: 0.4 },
  exMuscles: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSubtle, marginTop: 2 },
  exActions: { flexDirection: "row", gap: 8 },
  exActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  setList: { gap: 6 },
  setHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 8,
  },
  setHeaderText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 1,
    width: 30,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  setRowDone: {
    borderColor: "rgba(246,234,152,0.2)",
    backgroundColor: "rgba(246,234,152,0.05)",
  },
  setCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2A2A28",
    borderWidth: 1,
    borderColor: "#3C3C3A",
    alignItems: "center",
    justifyContent: "center",
  },
  setCircleDone: {
    backgroundColor: Colors.highlight,
    borderColor: Colors.highlight,
  },
  setNum: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textSubtle },
  setRowFailed: {
    backgroundColor: Colors.orange + "10",
    borderColor: Colors.orange + "30",
  },
  setCircleFailed: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  setInput: {
    width: 72,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  repsControl: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  repsBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  repsInput: {
    width: 36,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
    paddingVertical: 2,
  },
  statusBtn: {
    width: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  statusBtnDone: {
    backgroundColor: Colors.highlight,
    borderColor: Colors.highlight,
  },
  statusBtnFailed: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  statusBtnText: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  setInputDone: {
    color: Colors.textMuted,
    textDecorationLine: "line-through",
  },
  emptyBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  emptyBtnText: {
    fontSize: 12,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
  },
  finishedBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 18,
  },
  finishedIcon: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: "rgba(246,234,152,0.1)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  finishedTitle: {
    fontSize: 40,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 44,
  },
  finishedSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    letterSpacing: 1,
  },
  finishedStats: { flexDirection: "row", gap: 16 },
  finishedStat: { alignItems: "center", gap: 4 },
  finishedStatVal: { fontSize: 24, fontFamily: "Inter_900Black", fontStyle: "italic" },
  finishedStatLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 1 },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(246,234,152,0.1)",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.2)",
  },
  savedText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.highlight,
    letterSpacing: 0.5,
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  doneBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  restOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  restCard: {
    backgroundColor: "#242422",
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    gap: 16,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  restLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  restTime: {
    fontSize: 56,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
  },
  restTrack: {
    height: 6,
    backgroundColor: "#333",
    borderRadius: 6,
    overflow: "hidden",
    width: "100%",
  },
  restFill: {
    height: "100%",
    backgroundColor: Colors.orange,
    borderRadius: 6,
  },
  restActions: {
    flexDirection: "row",
    gap: 12,
  },
  restAdjBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  restAdjText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  restDismiss: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
  },
  restDismissText: {
    fontSize: 12,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
  },
  swapOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  swapSheet: {
    backgroundColor: "#242422",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  swapHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#444",
    alignSelf: "center",
    marginBottom: 20,
  },
  swapTitle: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    letterSpacing: 2,
    fontStyle: "italic",
    marginBottom: 16,
    textAlign: "center",
  },
  swapEmpty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  swapOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    marginBottom: 8,
  },
  swapOptionName: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  swapOptionMuscle: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    marginTop: 2,
  },
  swapCancel: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  swapCancelText: {
    fontSize: 12,
    fontFamily: "Inter_900Black",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  questionnaireContainer: {
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: "center",
  },
  feedbackSection: {
    width: "100%",
    marginTop: 24,
  },
  feedbackLabel: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  feedbackDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    marginBottom: 12,
  },
  feedbackScale: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  feedbackDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackDotActive: {
    backgroundColor: Colors.orange + "20",
    borderColor: Colors.orange,
  },
  feedbackDotText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
  },
  feedbackDotTextActive: {
    color: Colors.orange,
  },
  feedbackLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 10,
  },
  feedbackMinMax: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  feedbackNotesInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: "top",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.highlight + "15",
    borderWidth: 1,
    borderColor: Colors.highlight + "30",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  aiBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.highlight,
    letterSpacing: 1,
  },
  reviewSection: {
    marginTop: 24,
    width: "100%",
  },
  reviewSectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  reviewExRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reviewExName: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 2,
  },
  reviewExMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  reviewExBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reviewExBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    letterSpacing: 0.5,
  },
  reviewExRemove: {
    padding: 6,
  },
  addExBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.highlight + "40",
    borderRadius: 12,
    borderStyle: "dashed",
    justifyContent: "center",
  },
  addExBtnText: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: Colors.highlight,
    letterSpacing: 1,
  },
  addExForm: {
    marginTop: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  addExInput: {
    backgroundColor: Colors.bgMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  addExRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  addExField: {
    flex: 1,
    gap: 6,
  },
  addExFieldLabel: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 1,
  },
  addExStepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  addExStep: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addExStepText: {
    fontSize: 16,
    color: Colors.textMuted,
    fontFamily: "Inter_700Bold",
  },
  addExStepVal: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontFamily: "Inter_900Black",
    color: Colors.text,
  },
  addExWeightInput: {
    backgroundColor: Colors.bgMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  addExConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.highlight,
    borderRadius: 12,
    paddingVertical: 12,
  },
  addExConfirmBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: Colors.bgPrimary,
    letterSpacing: 0.5,
  },
  tipCard: {
    width: "100%",
    marginTop: 16,
    backgroundColor: "rgba(119,156,175,0.07)",
    borderWidth: 1,
    borderColor: "rgba(119,156,175,0.2)",
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  tipCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  tipCardTag: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    letterSpacing: 1.5,
  },
  tipCardTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  tipCardBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 19,
  },
});
