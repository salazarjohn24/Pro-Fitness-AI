import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
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
import { EQUIPMENT_CATEGORIES } from "@/components/EquipmentChecklist";
import { CheckInModal } from "@/components/CheckInModal";
import { useEnvironments, useCreateEnvironment, type GymEnvironment } from "@/hooks/useEnvironments";
import { useTodayCheckIn, useProfile, useSubmitCheckIn, useUpdateProfile } from "@/hooks/useProfile";
import {
  useArchitectGenerate,
  fetchExerciseAlternatives,
  recordExerciseSubstitution,
  type AlternativeExercise,
  type GeneratedExercise,
  type GeneratedWorkout,
} from "@/hooks/useWorkout";

const MUSCLE_GROUPS = [
  { id: "chest", label: "Chest", icon: "💪" },
  { id: "back", label: "Back", icon: "🔙" },
  { id: "shoulders", label: "Shoulders", icon: "🏋️" },
  { id: "quads", label: "Quads", icon: "🦵" },
  { id: "hamstrings", label: "Hamstrings", icon: "🦿" },
  { id: "glutes", label: "Glutes", icon: "🍑" },
  { id: "biceps", label: "Biceps", icon: "💪" },
  { id: "triceps", label: "Triceps", icon: "🤛" },
  { id: "core", label: "Core", icon: "🎯" },
  { id: "calves", label: "Calves", icon: "🦶" },
];

const EQUIPMENT_ICONS: Record<string, string> = {
  "Barbell": "🏋️", "Dumbbells": "💪", "Kettlebells": "🔔", "EZ Curl Bar": "〰️",
  "Weight Plates": "⚖️", "Trap Bar": "🔩",
  "Cable Machine": "🔗", "Smith Machine": "🏗️", "Leg Press": "🦵", "Lat Pulldown": "📐",
  "Chest Press Machine": "🫁", "Leg Extension": "⚙️", "Leg Curl": "🔧", "Rowing Machine": "🚣",
  "Pull-Up Bar": "🔝", "Dip Station": "🪜", "Gymnastics Rings": "⭕", "TRX / Suspension": "🪢",
  "Resistance Bands": "🔄", "Ab Wheel": "🛞", "Plyo Box": "📦", "Battle Ropes": "🪢",
};

const EQUIPMENT_OPTIONS = Object.entries(EQUIPMENT_CATEGORIES).flatMap(([, items]) =>
  items.map(item => ({ id: item, label: item, icon: EQUIPMENT_ICONS[item] ?? "🔧" }))
);

type Step = "muscles" | "equipment" | "generating" | "review";

const CATEGORY_LABELS: Record<string, string> = {
  warmup: "DYNAMIC WARM-UP",
  compound: "PRIMARY COMPOUND",
  accessory: "SECONDARY ACCESSORIES",
  core: "CORE",
  cooldown: "COOL-DOWN",
};

function flattenEnvEquipment(env: GymEnvironment): string[] {
  if (!env.equipment) return [];
  const flat: string[] = [];
  for (const items of Object.values(env.equipment)) {
    items.forEach(item => flat.push(item));
  }
  return flat;
}

const LEGACY_EQUIPMENT_MAP: Record<string, string> = {
  barbell: "Barbell", dumbbell: "Dumbbells", dumbbells: "Dumbbells",
  kettlebells: "Kettlebells", "ez bar": "EZ Curl Bar", "ez curl bar": "EZ Curl Bar",
  "weight plates": "Weight Plates", "trap bar": "Trap Bar",
  "cable machine": "Cable Machine", "smith machine": "Smith Machine",
  "leg press": "Leg Press", "leg press machine": "Leg Press",
  "lat pulldown": "Lat Pulldown", "chest press machine": "Chest Press Machine",
  "leg extension": "Leg Extension", "leg extension machine": "Leg Extension",
  "leg curl": "Leg Curl", "leg curl machine": "Leg Curl",
  "rowing machine": "Rowing Machine",
  "pull-up bar": "Pull-Up Bar", "dip station": "Dip Station",
  "gymnastics rings": "Gymnastics Rings", "trx / suspension": "TRX / Suspension",
  "resistance band": "Resistance Bands", "resistance bands": "Resistance Bands",
  "ab wheel": "Ab Wheel", "plyo box": "Plyo Box", "battle ropes": "Battle Ropes",
  bench: "Barbell", "squat rack": "Barbell", "foam roller": "Resistance Bands",
};

function matchEquipmentIds(envItems: string[]): string[] {
  const validIds = new Set(EQUIPMENT_OPTIONS.map(o => o.id));
  return [...new Set(envItems
    .map(item => validIds.has(item) ? item : LEGACY_EQUIPMENT_MAP[item.toLowerCase()])
    .filter((v): v is string => !!v && validIds.has(v)))];
}

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120];

export default function WorkoutArchitectScreen() {
  const insets = useSafeAreaInsets();
  const { data: todayCheckIn, isLoading: checkInLoading, refetch: refetchCheckIn } = useTodayCheckIn();
  const { mutate: architectGenerate, isPending: isGenerating } = useArchitectGenerate();
  const { data: environments } = useEnvironments();
  const { mutate: createEnv, isPending: isCreatingEnv } = useCreateEnvironment();
  const { data: profile } = useProfile();
  const { mutate: updateProfile } = useUpdateProfile();
  const { mutate: submitCheckIn, isPending: isSubmittingCheckIn } = useSubmitCheckIn();
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  const [step, setStep] = useState<Step>("muscles");
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [equipmentLoaded, setEquipmentLoaded] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [workoutName, setWorkoutName] = useState("");
  const [availableMinutes, setAvailableMinutes] = useState<number>(60);

  const [addEnvOpen, setAddEnvOpen] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvEquipment, setNewEnvEquipment] = useState<string[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<number | null>(null);

  const activeEnv = environments?.find(e => e.isActive) ?? environments?.[0];

  useEffect(() => {
    if (!equipmentLoaded && activeEnv) {
      const ids = matchEquipmentIds(flattenEnvEquipment(activeEnv));
      if (ids.length > 0) setSelectedEquipment(ids);
      setSelectedEnvId(activeEnv.id);
      setEquipmentLoaded(true);
    }
  }, [activeEnv, equipmentLoaded]);

  const toggleNewEnvEquipment = (id: string) => {
    setNewEnvEquipment(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleSaveNewEnv = () => {
    if (!newEnvName.trim() || newEnvEquipment.length === 0) return;
    const eqMap: Record<string, string[]> = {};
    newEnvEquipment.forEach(id => {
      const cat = Object.entries(EQUIPMENT_CATEGORIES).find(([, items]) => items.includes(id))?.[0] ?? "Equipment";
      if (!eqMap[cat]) eqMap[cat] = [];
      eqMap[cat].push(id);
    });
    createEnv(
      { name: newEnvName.trim(), type: "Custom", equipment: eqMap, isActive: true },
      {
        onSuccess: () => {
          setSelectedEquipment(newEnvEquipment);
          setAddEnvOpen(false);
          setNewEnvName("");
          setNewEnvEquipment([]);
        },
      }
    );
  };

  const [reviewExercises, setReviewExercises] = useState<GeneratedExercise[]>([]);
  const [exerciseSets, setExerciseSets] = useState<Record<string, number>>({});
  const [exerciseReps, setExerciseReps] = useState<Record<string, number>>({});
  const [exerciseWeights, setExerciseWeights] = useState<Record<string, string>>({});

  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<AlternativeExercise[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const checkInDone = !!todayCheckIn;

  const toggleMuscle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMuscles(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const toggleEquipment = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedEquipment(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
    setSelectedEnvId(null);
  };

  useEffect(() => {
    if (profile?.preferredWorkoutDuration) {
      setAvailableMinutes(profile.preferredWorkoutDuration);
    }
  }, [profile?.preferredWorkoutDuration]);

  const moveExerciseUp = (idx: number) => {
    if (idx === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReviewExercises(prev => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  };

  const moveExerciseDown = (idx: number) => {
    setReviewExercises(prev => {
      if (idx >= prev.length - 1) return prev;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  };

  const handleGenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep("generating");

    architectGenerate(
      { muscleGroups: selectedMuscles, equipment: selectedEquipment, availableMinutes },
      {
        onSuccess: (workout) => {
          setGeneratedWorkout(workout);
          setWorkoutName(workout.workoutTitle);
          setReviewExercises(workout.exercises);
          const sets: Record<string, number> = {};
          const reps: Record<string, number> = {};
          const weights: Record<string, string> = {};
          workout.exercises.forEach(ex => {
            sets[ex.exerciseId] = ex.sets;
            reps[ex.exerciseId] = ex.reps;
            weights[ex.exerciseId] = ex.weight;
          });
          setExerciseSets(sets);
          setExerciseReps(reps);
          setExerciseWeights(weights);
          setStep("review");
        },
        onError: () => {
          setStep("equipment");
        },
      }
    );
  };

  const adjustSets = (id: string, delta: number) => {
    Haptics.selectionAsync();
    setExerciseSets(prev => ({
      ...prev,
      [id]: Math.max(1, Math.min(8, (prev[id] ?? 3) + delta)),
    }));
  };

  const adjustReps = (id: string, delta: number) => {
    Haptics.selectionAsync();
    setExerciseReps(prev => ({
      ...prev,
      [id]: Math.max(1, Math.min(30, (prev[id] ?? 10) + delta)),
    }));
  };

  const removeExercise = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReviewExercises(prev => prev.filter(e => e.exerciseId !== id));
  };

  const handleSwap = useCallback(async (exerciseId: string) => {
    setSwappingId(exerciseId);
    setSwapLoading(true);
    try {
      const alts = await fetchExerciseAlternatives(exerciseId);
      const currentIds = new Set(reviewExercises.map(e => e.exerciseId));
      setSwapAlternatives(alts.filter(a => !currentIds.has(a.id)));
    } catch {
      setSwapAlternatives([]);
    }
    setSwapLoading(false);
  }, [reviewExercises]);

  const confirmSwap = (alt: AlternativeExercise) => {
    if (!swappingId) return;
    const oldId = swappingId;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const originalEx = reviewExercises.find(ex => ex.exerciseId === oldId);
    if (originalEx && originalEx.name !== alt.name) {
      recordExerciseSubstitution(originalEx.name, alt.name);
    }

    setSwappingId(null);
    setSwapAlternatives([]);

    setReviewExercises(prev => prev.map(ex => {
      if (ex.exerciseId === oldId) {
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
    }));

    setExerciseSets(prev => {
      const n = { ...prev };
      const val = n[oldId];
      delete n[oldId];
      if (val !== undefined) n[alt.id] = val;
      return n;
    });
    setExerciseReps(prev => {
      const n = { ...prev };
      const val = n[oldId];
      delete n[oldId];
      if (val !== undefined) n[alt.id] = val;
      return n;
    });
    setExerciseWeights(prev => {
      const n = { ...prev };
      const val = n[oldId];
      delete n[oldId];
      if (val !== undefined) n[alt.id] = val;
      return n;
    });
  };

  const handleStartWorkout = () => {
    if (!generatedWorkout || reviewExercises.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const finalExercises = reviewExercises.map(ex => ({
      ...ex,
      sets: exerciseSets[ex.exerciseId] ?? ex.sets,
      reps: exerciseReps[ex.exerciseId] ?? ex.reps,
      weight: exerciseWeights[ex.exerciseId] ?? ex.weight,
    }));

    const finalWorkout: GeneratedWorkout = {
      ...generatedWorkout,
      workoutTitle: workoutName || generatedWorkout.workoutTitle,
      exercises: finalExercises,
      totalSets: finalExercises.reduce((a, e) => a + e.sets, 0),
      estimatedMinutes: Math.round(finalExercises.reduce((a, e) => a + e.sets * 2.5, 0)),
    };

    router.push({
      pathname: "/workout-session",
      params: { workout: JSON.stringify(finalWorkout) },
    });
  };

  if (checkInLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.centerBlock}>
          <ActivityIndicator color={Colors.orange} size="large" />
        </View>
      </View>
    );
  }

  if (!checkInDone) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="x" size={18} color={Colors.textMuted} />
          </Pressable>
          <Text style={styles.topBarTitle}>WORKOUT ARCHITECT</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centerBlock}>
          <View style={styles.lockedIcon}>
            <Feather name="cpu" size={40} color={Colors.highlight} />
          </View>
          <Text style={styles.lockedTitle}>QUICK{"\n"}CHECK-IN</Text>
          <Text style={styles.lockedDesc}>
            The AI needs to know how you feel today — your energy, sleep, soreness, and stress — before it can design the right workout for you right now.
          </Text>
          <View style={styles.lockedBenefitsRow}>
            <View style={styles.lockedBenefit}>
              <Feather name="battery-charging" size={14} color={Colors.highlight} />
              <Text style={styles.lockedBenefitText}>Energy-calibrated volume</Text>
            </View>
            <View style={styles.lockedBenefit}>
              <Feather name="alert-triangle" size={14} color={Colors.orange} />
              <Text style={styles.lockedBenefitText}>Soreness-aware exercise selection</Text>
            </View>
            <View style={styles.lockedBenefit}>
              <Feather name="trending-up" size={14} color={Colors.recovery} />
              <Text style={styles.lockedBenefitText}>Smarter progressive overload</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.lockedBtn, { opacity: pressed ? 0.9 : 1 }]}
            onPress={() => setShowCheckInModal(true)}
          >
            <Feather name="clipboard" size={14} color="#fff" />
            <Text style={styles.lockedBtnText}>DO MY CHECK-IN NOW</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSubtle }}>Maybe later</Text>
          </Pressable>
        </View>
        <CheckInModal
          visible={showCheckInModal}
          onClose={() => setShowCheckInModal(false)}
          isSubmitting={isSubmittingCheckIn}
          onComplete={(data) => {
            submitCheckIn(data, {
              onSuccess: () => {
                setShowCheckInModal(false);
                refetchCheckIn();
                updateProfile({ checkInCompleted: true, dailySyncProgress: Math.min(100, (profile?.dailySyncProgress ?? 0) + 50) });
              },
            });
          }}
        />
      </View>
    );
  }

  if (step === "generating") {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.topBar}>
          <View style={{ width: 36 }} />
          <Text style={styles.topBarTitle}>GENERATING</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centerBlock}>
          <ActivityIndicator color={Colors.orange} size="large" />
          <Text style={styles.generatingTitle}>BUILDING YOUR{"\n"}WORKOUT</Text>
          <Text style={styles.generatingDesc}>
            Analyzing your check-in data, soreness map, and selected muscle groups to create your optimal session...
          </Text>
        </View>
      </View>
    );
  }

  if (step === "review" && generatedWorkout) {
    const totalSets = reviewExercises.reduce((a, ex) => a + (exerciseSets[ex.exerciseId] ?? ex.sets), 0);
    const totalReps = reviewExercises.reduce((a, ex) => a + (exerciseSets[ex.exerciseId] ?? ex.sets) * (exerciseReps[ex.exerciseId] ?? ex.reps), 0);
    const estimatedTime = Math.round(reviewExercises.reduce((a, ex) => a + (exerciseSets[ex.exerciseId] ?? ex.sets) * 2.5, 0));

    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setStep("equipment")} style={styles.backBtn}>
            <Feather name="arrow-left" size={18} color={Colors.textMuted} />
          </Pressable>
          <Text style={styles.topBarTitle}>REVIEW WORKOUT</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.reviewHeader}>
            <TextInput
              style={styles.workoutNameInput}
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholderTextColor={Colors.textSubtle}
            />
            <Text style={styles.rationaleText}>{generatedWorkout.rationale}</Text>
            <View style={styles.reviewStats}>
              <View style={styles.reviewStat}>
                <Feather name="clock" size={14} color={Colors.recovery} />
                <Text style={styles.reviewStatVal}>~{estimatedTime} min</Text>
              </View>
              <View style={styles.reviewStat}>
                <Feather name="layers" size={14} color={Colors.orange} />
                <Text style={styles.reviewStatVal}>{totalSets} sets</Text>
              </View>
              <View style={styles.reviewStat}>
                <Feather name="trending-up" size={14} color={Colors.highlight} />
                <Text style={styles.reviewStatVal}>{totalReps} reps</Text>
              </View>
            </View>
          </View>

          {reviewExercises.map((ex, i) => (
            <View key={ex.exerciseId} style={styles.reviewExCard}>
              <View style={styles.reviewExHeader}>
                <View style={styles.reorderBtns}>
                  <Pressable
                    onPress={() => moveExerciseUp(i)}
                    style={[styles.reorderBtn, i === 0 && styles.reorderBtnDisabled]}
                    disabled={i === 0}
                  >
                    <Feather name="chevron-up" size={15} color={i === 0 ? Colors.textSubtle : Colors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => moveExerciseDown(i)}
                    style={[styles.reorderBtn, i === reviewExercises.length - 1 && styles.reorderBtnDisabled]}
                    disabled={i === reviewExercises.length - 1}
                  >
                    <Feather name="chevron-down" size={15} color={i === reviewExercises.length - 1 ? Colors.textSubtle : Colors.textMuted} />
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.reviewExName}>{ex.name}</Text>
                    <View style={styles.catBadge}>
                      <Text style={styles.catBadgeText}>{CATEGORY_LABELS[ex.category] ?? ex.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewExMuscles}>
                    {ex.primaryMuscle}{ex.secondaryMuscles.length > 0 ? ` · ${ex.secondaryMuscles.join(" · ")}` : ""}
                  </Text>
                </View>
                <View style={styles.reviewExActions}>
                  <Pressable onPress={() => handleSwap(ex.exerciseId)} style={styles.reviewActionBtn}>
                    <Feather name="refresh-cw" size={14} color={Colors.highlight} />
                  </Pressable>
                  <Pressable onPress={() => removeExercise(ex.exerciseId)} style={styles.reviewActionBtn}>
                    <Feather name="trash-2" size={14} color="#555" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.adjustRow}>
                <View style={styles.adjBlock}>
                  <Text style={styles.adjLabel}>SETS</Text>
                  <View style={styles.adjControls}>
                    <Pressable onPress={() => adjustSets(ex.exerciseId, -1)} style={styles.adjBtn}>
                      <Feather name="minus" size={14} color={Colors.textMuted} />
                    </Pressable>
                    <Text style={styles.adjVal}>{exerciseSets[ex.exerciseId] ?? ex.sets}</Text>
                    <Pressable onPress={() => adjustSets(ex.exerciseId, 1)} style={styles.adjBtn}>
                      <Feather name="plus" size={14} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.adjDivider} />
                <View style={styles.adjBlock}>
                  <Text style={styles.adjLabel}>REPS</Text>
                  <View style={styles.adjControls}>
                    <Pressable onPress={() => adjustReps(ex.exerciseId, -1)} style={styles.adjBtn}>
                      <Feather name="minus" size={14} color={Colors.textMuted} />
                    </Pressable>
                    <Text style={styles.adjVal}>{exerciseReps[ex.exerciseId] ?? ex.reps}</Text>
                    <Pressable onPress={() => adjustReps(ex.exerciseId, 1)} style={styles.adjBtn}>
                      <Feather name="plus" size={14} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.adjDivider} />
                <View style={styles.adjBlock}>
                  <Text style={styles.adjLabel}>WEIGHT</Text>
                  <TextInput
                    style={styles.weightInput}
                    value={exerciseWeights[ex.exerciseId] ?? ex.weight}
                    onChangeText={(t) => setExerciseWeights(prev => ({ ...prev, [ex.exerciseId]: t }))}
                    placeholderTextColor={Colors.textSubtle}
                  />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: botPad + 12 }]}>
          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              reviewExercises.length === 0 && styles.startBtnDisabled,
              { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
            onPress={handleStartWorkout}
            disabled={reviewExercises.length === 0}
          >
            <Feather name="play" size={18} color="#fff" />
            <Text style={styles.startBtnText}>START WORKOUT</Text>
          </Pressable>
        </View>

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

  if (step === "equipment") {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setStep("muscles")} style={styles.backBtn}>
            <Feather name="arrow-left" size={18} color={Colors.textMuted} />
          </Pressable>
          <Text style={styles.topBarTitle}>GYM ENVIRONMENT</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.stepIndicator}>
          <View style={styles.stepDotDone} />
          <View style={styles.stepLine} />
          <View style={styles.stepDotActive} />
        </View>

        <View style={styles.stepHeader}>
          <View style={[styles.stepIcon, { backgroundColor: Colors.recovery + "20" }]}>
            <Feather name="tool" size={24} color={Colors.recovery} />
          </View>
          <Text style={styles.stepTitle}>WHAT EQUIPMENT{"\n"}IS AVAILABLE?</Text>
          <Text style={styles.stepSubtitle}>
            {selectedEnvId
              ? `Loaded from "${environments?.find(e => e.id === selectedEnvId)?.name ?? "environment"}" — adjust as needed`
              : "Select all that apply — or skip for bodyweight only"}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 140 }]}
          showsVerticalScrollIndicator={false}
        >
          {environments && environments.length > 0 && (
            <View style={styles.envSwitcher}>
              <Text style={styles.envSwitcherLabel}>LOAD FROM ENVIRONMENT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.envSwitcherRow}>
                {environments.map(env => {
                  const isSelected = selectedEnvId === env.id;
                  return (
                    <Pressable
                      key={env.id}
                      style={[styles.envChip, isSelected && styles.envChipActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const ids = matchEquipmentIds(flattenEnvEquipment(env));
                        setSelectedEquipment(ids);
                        setSelectedEnvId(env.id);
                      }}
                    >
                      <Feather
                        name={env.type === "Home Gym" ? "home" : env.type === "CrossFit Box" ? "target" : "map-pin"}
                        size={12}
                        color={isSelected ? Colors.orange : Colors.textMuted}
                      />
                      <Text style={[styles.envChipText, isSelected && styles.envChipTextActive]}>{env.name}</Text>
                      {env.isActive && (
                        <View style={styles.envDefaultDot} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
          <View style={styles.selectionGrid}>
            {EQUIPMENT_OPTIONS.map(eq => {
              const sel = selectedEquipment.includes(eq.id);
              return (
                <Pressable
                  key={eq.id}
                  onPress={() => toggleEquipment(eq.id)}
                  style={({ pressed }) => [
                    styles.selectionTile,
                    sel && styles.selectionTileSelected,
                    pressed && { transform: [{ scale: 0.97 }] },
                  ]}
                >
                  <Text style={styles.selectionEmoji}>{eq.icon}</Text>
                  <Text style={[styles.selectionLabel, sel && styles.selectionLabelSelected]}>{eq.label}</Text>
                  {sel && (
                    <View style={styles.checkMark}>
                      <Feather name="check" size={10} color={Colors.bgPrimary} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [styles.saveEnvBtn, pressed && { opacity: 0.8 }]}
            onPress={() => { setNewEnvEquipment([]); setNewEnvName(""); setAddEnvOpen(true); }}
          >
            <Feather name="plus-circle" size={14} color={Colors.highlight} />
            <Text style={styles.saveEnvBtnText}>CREATE NEW GYM ENVIRONMENT</Text>
          </Pressable>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: botPad + 12 }]}>
          <Pressable
            style={({ pressed }) => [styles.startBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            onPress={handleGenerate}
          >
            <Feather name="cpu" size={18} color="#fff" />
            <Text style={styles.startBtnText}>
              {selectedEquipment.length === 0 ? "BODYWEIGHT ONLY" : `GENERATE (${selectedEquipment.length} EQUIPMENT)`}
            </Text>
          </Pressable>
        </View>

        <Modal visible={addEnvOpen} transparent animationType="slide">
          <View style={styles.newEnvOverlay}>
            <View style={styles.newEnvSheet}>
              <View style={styles.swapHandle} />
              <Text style={styles.swapTitle}>CREATE GYM ENVIRONMENT</Text>
              <Text style={[styles.stepSubtitle, { marginBottom: 12 }]}>
                Name this environment and select the equipment available there.
              </Text>
              <TextInput
                style={styles.envNameInput}
                value={newEnvName}
                onChangeText={setNewEnvName}
                placeholder="Environment name (e.g., Home Gym)"
                placeholderTextColor={Colors.textSubtle}
              />
              <ScrollView style={styles.newEnvScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.newEnvGrid}>
                  {EQUIPMENT_OPTIONS.map(eq => {
                    const sel = newEnvEquipment.includes(eq.id);
                    return (
                      <Pressable
                        key={eq.id}
                        onPress={() => toggleNewEnvEquipment(eq.id)}
                        style={({ pressed }) => [
                          styles.newEnvTile,
                          sel && styles.newEnvTileSelected,
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text style={{ fontSize: 18 }}>{eq.icon}</Text>
                        <Text style={[styles.newEnvTileLabel, sel && { color: Colors.highlight }]}>{eq.label}</Text>
                        {sel && (
                          <View style={styles.checkMark}>
                            <Feather name="check" size={8} color={Colors.bgPrimary} />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              <Text style={styles.envSelectedCount}>
                {newEnvEquipment.length} equipment selected
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <Pressable
                  style={({ pressed }) => [styles.swapCancel, { flex: 1, opacity: pressed ? 0.9 : 1 }]}
                  onPress={() => { setAddEnvOpen(false); setNewEnvName(""); setNewEnvEquipment([]); }}
                >
                  <Text style={styles.swapCancelText}>CANCEL</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.startBtn,
                    { flex: 1, opacity: pressed ? 0.9 : 1 },
                    (!newEnvName.trim() || newEnvEquipment.length === 0 || isCreatingEnv) && styles.startBtnDisabled,
                  ]}
                  onPress={handleSaveNewEnv}
                  disabled={!newEnvName.trim() || newEnvEquipment.length === 0 || isCreatingEnv}
                >
                  {isCreatingEnv ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.startBtnText}>CREATE & USE</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={18} color={Colors.textMuted} />
        </Pressable>
        <Text style={styles.topBarTitle}>WORKOUT ARCHITECT</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.stepIndicator}>
        <View style={styles.stepDotActive} />
        <View style={styles.stepLine} />
        <View style={styles.stepDot} />
      </View>

      <View style={styles.stepHeader}>
        <View style={[styles.stepIcon, { backgroundColor: Colors.orange + "20" }]}>
          <Feather name="target" size={24} color={Colors.orange} />
        </View>
        <Text style={styles.stepTitle}>WHAT DO YOU{"\n"}WANT TO TRAIN?</Text>
        <Text style={styles.stepSubtitle}>Select the muscle groups for today's session</Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.selectionGrid}>
          {MUSCLE_GROUPS.map(mg => {
            const sel = selectedMuscles.includes(mg.id);
            return (
              <Pressable
                key={mg.id}
                onPress={() => toggleMuscle(mg.id)}
                style={({ pressed }) => [
                  styles.selectionTile,
                  sel && styles.selectionTileSelected,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                <Text style={styles.selectionEmoji}>{mg.icon}</Text>
                <Text style={[styles.selectionLabel, sel && styles.selectionLabelSelected]}>{mg.label}</Text>
                {sel && (
                  <View style={styles.checkMark}>
                    <Feather name="check" size={10} color={Colors.bgPrimary} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.durationSection}>
          <Text style={styles.durationLabel}>AVAILABLE TIME</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map(mins => (
              <Pressable
                key={mins}
                onPress={() => { Haptics.selectionAsync(); setAvailableMinutes(mins); }}
                style={[styles.durationBtn, availableMinutes === mins && styles.durationBtnActive]}
              >
                <Text style={[styles.durationBtnText, availableMinutes === mins && styles.durationBtnTextActive]}>
                  {mins}m
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {selectedMuscles.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: botPad + 12 }]}>
          <Pressable
            style={({ pressed }) => [styles.startBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep("equipment"); }}
          >
            <Feather name="arrow-right" size={18} color="#fff" />
            <Text style={styles.startBtnText}>NEXT: GYM SETUP ({selectedMuscles.length} SELECTED)</Text>
          </Pressable>
        </View>
      )}
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
    paddingVertical: 14,
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
  topBarTitle: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    letterSpacing: 2,
    fontStyle: "italic",
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    paddingHorizontal: 80,
    marginBottom: 16,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.orange,
  },
  stepDotDone: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.highlight,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#333",
    marginHorizontal: 8,
  },
  stepHeader: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  stepIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitle: {
    fontSize: 22,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 26,
  },
  stepSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    textAlign: "center",
  },
  centerBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  lockedIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  lockedTitle: {
    fontSize: 28,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 32,
  },
  lockedDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  lockedBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  lockedBtnText: {
    fontSize: 12,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  lockedBenefitsRow: {
    width: "100%",
    gap: 10,
    marginTop: 20,
    marginBottom: 4,
  },
  lockedBenefit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lockedBenefitText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    flex: 1,
  },
  generatingTitle: {
    fontSize: 24,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 28,
    marginTop: 16,
  },
  generatingDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, gap: 10 },
  selectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  selectionTile: {
    width: "47%",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectionTileSelected: {
    borderColor: Colors.orange,
    backgroundColor: Colors.orange + "12",
  },
  selectionEmoji: { fontSize: 20 },
  selectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flex: 1,
  },
  selectionLabelSelected: { color: Colors.orange },
  durationSection: {
    marginTop: 20,
    paddingHorizontal: 4,
  },
  durationLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 1,
    marginBottom: 10,
  },
  durationRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  durationBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#1e1e1e",
  },
  durationBtnActive: {
    borderColor: Colors.orange,
    backgroundColor: Colors.orange + "18",
  },
  durationBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  durationBtnTextActive: { color: Colors.orange },
  checkMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
  },
  startBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startBtnDisabled: { backgroundColor: "#2C2C2A" },
  startBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  reviewHeader: { gap: 10, marginBottom: 4 },
  workoutNameInput: {
    fontSize: 22,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingBottom: 8,
  },
  rationaleText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    lineHeight: 18,
  },
  reviewStats: { flexDirection: "row", gap: 16 },
  reviewStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  reviewStatVal: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textMuted },
  categoryLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 8,
  },
  reviewExCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 14,
    marginBottom: 10,
  },
  reviewExHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reorderBtns: { flexDirection: "column", gap: 2, marginRight: 4 },
  reorderBtn: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#2a2a2a",
  },
  reorderBtnDisabled: { opacity: 0.3 },
  catBadge: {
    backgroundColor: Colors.highlight + "22",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  catBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.highlight,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  reviewExName: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text, textTransform: "uppercase", letterSpacing: 0.3 },
  reviewExMuscles: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSubtle, marginTop: 2 },
  reviewExActions: { flexDirection: "row", gap: 6 },
  reviewActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  adjustRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adjBlock: { flex: 1, alignItems: "center", padding: 10, gap: 6 },
  adjDivider: { width: 1, backgroundColor: Colors.border },
  adjLabel: {
    fontSize: 7,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  adjControls: { flexDirection: "row", alignItems: "center", gap: 12 },
  adjBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  adjVal: { fontSize: 18, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic", minWidth: 24, textAlign: "center" },
  weightInput: {
    fontSize: 14,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textAlign: "center",
    minWidth: 60,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 2,
  },
  swapOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  swapSheet: {
    backgroundColor: "#242422",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  swapHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#444",
    alignSelf: "center",
    marginBottom: 16,
  },
  swapTitle: {
    fontSize: 12,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    letterSpacing: 2,
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 16,
  },
  swapEmpty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  swapOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    marginBottom: 8,
  },
  swapOptionName: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textTransform: "uppercase",
  },
  swapOptionMuscle: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    marginTop: 2,
  },
  swapCancel: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
  },
  swapCancelText: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  envBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: Colors.recovery + "18",
    borderWidth: 1,
    borderColor: Colors.recovery + "30",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  envBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.recovery,
    letterSpacing: 0.5,
  },
  saveEnvBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.highlight + "30",
    borderStyle: "dashed",
    backgroundColor: Colors.highlight + "08",
  },
  saveEnvBtnText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.highlight,
    letterSpacing: 1,
  },
  envNameInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  envSelectedCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    marginTop: 8,
    textAlign: "center",
  },
  newEnvOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  newEnvSheet: {
    backgroundColor: Colors.bgPrimary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  newEnvScroll: {
    maxHeight: 280,
    marginTop: 12,
  },
  newEnvGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  newEnvTile: {
    width: "30%",
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    gap: 4,
  },
  newEnvTileSelected: {
    borderColor: Colors.highlight,
    backgroundColor: Colors.highlight + "15",
  },
  newEnvTileLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    textAlign: "center",
  },
  envSwitcher: {
    marginBottom: 14,
  },
  envSwitcherLabel: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  envSwitcherRow: {
    gap: 8,
    paddingRight: 20,
  },
  envChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  envChipActive: {
    borderColor: Colors.orange,
    backgroundColor: Colors.orange + "15",
  },
  envChipText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  envChipTextActive: {
    color: Colors.orange,
  },
  envDefaultDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.highlight,
    marginLeft: 2,
  },
});
