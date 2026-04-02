import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import { Colors } from "@/constants/colors";
import { useRecentExternalWorkouts, useUpdateExternalWorkout, type ExternalWorkout } from "@/hooks/useProfile";
import { useSessionDetail, useUpdateSessionExercises, useDeleteSession } from "@/hooks/useWorkout";
import { useWorkoutAnalysis } from "@/hooks/useWorkoutAnalysis";
import { useExternalWorkoutAnalysis, type ExternalWorkoutAnalysisResult } from "@/hooks/useExternalWorkoutAnalysis";
import { buildWorkoutAnalysisViewModel, type WorkoutAnalysisDisplayModel } from "@/lib/viewModels/workoutAnalysisViewModel";
import { buildAppleHealthActivityViewModel, isActivityBasedAnalysis } from "@/lib/viewModels/appleHealthActivityViewModel";
import { buildBodyMapViewModel } from "@/lib/viewModels/bodyMapViewModel";
import { MuscleEmphasisMap } from "@/components/MuscleEmphasisMap";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function sourceLabel(source: string): string {
  if (source === "in-app") return "In-App";
  if (source === "ai_scan") return "AI Scan";
  if (source === "apple_health") return "Apple Health";
  return "External";
}

function sourceIcon(source: string): "award" | "cpu" | "heart" | "globe" {
  if (source === "in-app") return "award";
  if (source === "ai_scan") return "cpu";
  if (source === "apple_health") return "heart";
  return "globe";
}

function sourceColor(source: string): string {
  if (source === "in-app") return Colors.highlight;
  if (source === "ai_scan") return Colors.recovery;
  return Colors.orange;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCORE_LABELS: Record<number, string> = { 1: "Very Low", 2: "Low", 3: "Moderate", 4: "High", 5: "Very High" };

// Kept for external workouts (coarse muscleGroups field)
const MUSCLE_COLOR: Record<string, string> = {
  Chest: Colors.orange,
  Back: Colors.recovery,
  Shoulders: Colors.highlight,
  Quads: "#b06aff",
  Hamstrings: "#6ac7ff",
  Glutes: "#ff6ab2",
  Biceps: Colors.highlight,
  Triceps: Colors.orange,
  Core: Colors.recovery,
  Calves: "#aaa",
};

// ---------------------------------------------------------------------------
// WorkoutAnalysisPanel — renders the Step 3–8 analysis for sessions and
// external workouts. importNote is an optional extra note for external
// workouts scored without set-level data.
// ---------------------------------------------------------------------------

function WorkoutAnalysisPanel({
  vm,
  importNote,
}: {
  vm: WorkoutAnalysisDisplayModel;
  importNote?: string | null;
}) {
  return (
    <View style={analysisStyles.card} testID="workout-analysis-panel">
      {/* Headline */}
      <Text style={analysisStyles.headline} testID="analysis-headline">{vm.headline}</Text>

      {/* Top muscles */}
      {vm.topMuscles.length > 0 && (
        <View style={analysisStyles.row}>
          <Text style={analysisStyles.subLabel}>MUSCLES</Text>
          <View style={analysisStyles.chipRow}>
            {vm.topMuscles.slice(0, 5).map((m) => (
              <View key={m.key} style={analysisStyles.chip} testID={`muscle-chip-${m.key}`}>
                <Text style={analysisStyles.chipText}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Top patterns */}
      {vm.topPatterns.length > 0 && (
        <View style={analysisStyles.row}>
          <Text style={analysisStyles.subLabel}>PATTERNS</Text>
          <View style={analysisStyles.chipRow}>
            {vm.topPatterns.slice(0, 3).map((p) => (
              <View key={p.key} style={[analysisStyles.chip, analysisStyles.chipPattern]} testID={`pattern-chip-${p.key}`}>
                <Text style={[analysisStyles.chipText, { color: Colors.recovery }]}>{p.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Dominant stimulus */}
      {vm.dominantStimulus.key && (
        <View style={analysisStyles.row}>
          <Text style={analysisStyles.subLabel}>STIMULUS</Text>
          <View style={[analysisStyles.chip, analysisStyles.chipStimulus]} testID="stimulus-chip">
            <Text style={[analysisStyles.chipText, { color: Colors.orange }]}>{vm.dominantStimulus.label}</Text>
          </View>
        </View>
      )}

      {/* Data quality note — fallback-movement ratio */}
      {vm.dataQualityNote != null && (
        <View style={analysisStyles.qualityNote} testID="analysis-quality-note">
          <Feather name="info" size={11} color={Colors.textSubtle} />
          <Text style={analysisStyles.qualityNoteText}>{vm.dataQualityNote}</Text>
        </View>
      )}

      {/* Import data note — name-only scoring caveat for external workouts */}
      {importNote != null && vm.dataQualityNote == null && (
        <View style={analysisStyles.qualityNote} testID="analysis-import-note">
          <Feather name="info" size={11} color={Colors.textSubtle} />
          <Text style={analysisStyles.qualityNoteText}>{importNote}</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// AnalysisSkeleton — shown while analysis is loading
// ---------------------------------------------------------------------------

function AnalysisSkeleton() {
  return (
    <View style={[analysisStyles.card, analysisStyles.skeleton]} testID="analysis-skeleton">
      <ActivityIndicator size="small" color={Colors.textSubtle} />
      <Text style={analysisStyles.skeletonText}>Analysing workout…</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function WorkoutDetailScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const params = useLocalSearchParams<{ type: string; id: string }>();
  const type = params.type as "internal" | "external";
  const id = parseInt(params.id ?? "0", 10);

  const { data: session, isLoading: sessionLoading } = useSessionDetail(type === "internal" ? id : null);
  const { data: externalWorkouts, isLoading: externalLoading } = useRecentExternalWorkouts();
  const { mutate: updateSession, isPending: isSaving } = useUpdateSessionExercises();
  const { mutate: updateExternal, isPending: isSavingExternal } = useUpdateExternalWorkout();
  const { mutate: deleteSession, isPending: isDeleting } = useDeleteSession();

  // Step 6 analysis — in-app sessions
  const { data: analysisData, isLoading: analysisLoading } = useWorkoutAnalysis(
    type === "internal" ? id : null
  );
  const analysisVm = buildWorkoutAnalysisViewModel(analysisData ?? null);

  // Step 8 analysis — external workouts (premium when eligible, coarse fallback when not)
  const { data: extAnalysisData } = useExternalWorkoutAnalysis(
    type === "external" ? id : null
  );
  // Build the correct view model depending on whether the server returned
  // a movement-based score or an activity-based estimate (Apple Health).
  const isActivityAnalysis = isActivityBasedAnalysis(extAnalysisData);
  const extMovementData = isActivityAnalysis ? null : (extAnalysisData as ExternalWorkoutAnalysisResult | null);
  const extAnalysisVm = isActivityAnalysis
    ? buildAppleHealthActivityViewModel(extAnalysisData as Parameters<typeof buildAppleHealthActivityViewModel>[0])
    : buildWorkoutAnalysisViewModel(extMovementData);
  // Additional note surfaced when scoring was from movement names only (no set data)
  const extImportNote = extMovementData?.importedDataNote ?? null;

  const [isEditMode, setIsEditMode] = useState(false);
  const [editExercises, setEditExercises] = useState<typeof session extends undefined ? never : NonNullable<typeof session>["exercises"] | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const external = type === "external" ? externalWorkouts?.find((w: ExternalWorkout) => w.id === id) : null;

  const safeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  if ((type === "internal" && sessionLoading) || (type === "external" && externalLoading)) {
    return (
      <View style={[styles.container, { paddingTop: topPad, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  if ((type === "internal" && !session) || (type === "external" && !external && !externalLoading)) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.topBar}>
          <Pressable onPress={safeBack} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={Colors.textMuted} />
          </Pressable>
          <Text style={styles.topBarTitle}>WORKOUT DETAIL</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 40 }}>
          <Feather name="alert-circle" size={32} color={Colors.textSubtle} />
          <Text style={{ color: Colors.textMuted, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "center" }}>
            {type === "internal" ? "Session not found" : "Workout not found"}
          </Text>
          <Text style={{ color: Colors.textSubtle, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", lineHeight: 18 }}>
            This workout may have been deleted, or it's older than your current history window.
          </Text>
          <Pressable onPress={safeBack} style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ color: Colors.textMuted, fontFamily: "Inter_700Bold", fontSize: 12 }}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const exercises = editExercises ?? session?.exercises ?? [];
  const completedSets = exercises.reduce((acc: number, ex: any) => acc + ex.sets.filter((s: any) => s.completed).length, 0);
  const totalSets = exercises.reduce((acc: number, ex: any) => acc + ex.sets.length, 0);
  const pct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  // Used as fallback when analysis is unavailable/empty for internal sessions
  const muscleGroupsInternal = Array.from(new Set(
    exercises.flatMap((ex: any) => [ex.primaryMuscle, ...(ex.secondaryMuscles ?? [])].filter(Boolean))
  )) as string[];

  const handleEnterEditMode = () => {
    if (!editExercises && session?.exercises) {
      setEditExercises(session.exercises as any);
    }
    setIsEditMode(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBulkSetChange = (exIdx: number, sIdx: number, field: "weight" | "reps", value: string) => {
    setEditExercises((prev: any) => {
      const base = prev ?? session?.exercises ?? [];
      return base.map((ex: any, eIdx: number) => {
        if (eIdx !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s: any, setI: number) => {
            if (setI !== sIdx) return s;
            if (field === "reps") {
              const n = parseInt(value, 10);
              return { ...s, reps: isNaN(n) || n < 1 ? s.reps : n };
            }
            return { ...s, weight: value };
          }),
        };
      });
    });
    setIsDirty(true);
  };

  const handleSaveSession = () => {
    if (!session) return;
    if (!isDirty) {
      setIsEditMode(false);
      safeBack();
      return;
    }
    updateSession({ id: session.id, exercises: editExercises as any }, {
      onSuccess: () => {
        setIsDirty(false);
        setEditExercises(null);
        setIsEditMode(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        safeBack();
      },
      onError: () => {
        Alert.alert("Save Failed", "Could not save your edits. Please check your connection and try again.");
      },
    });
  };

  const handleDiscardEdits = () => {
    if (!isDirty) {
      setEditExercises(null);
      setIsEditMode(false);
      return;
    }
    if (Platform.OS === "web") {
      if (!confirm("Discard your changes?")) return;
      setEditExercises(null);
      setIsDirty(false);
      setIsEditMode(false);
    } else {
      Alert.alert("Discard Changes", "Your edits won't be saved.", [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            setEditExercises(null);
            setIsDirty(false);
            setIsEditMode(false);
          },
        },
      ]);
    }
  };

  const handleBackPress = () => {
    if (isEditMode) {
      if (isDirty) {
        if (Platform.OS === "web") {
          if (!confirm("Leave without saving?")) return;
          setEditExercises(null);
          setIsDirty(false);
          setIsEditMode(false);
          safeBack();
        } else {
          Alert.alert("Unsaved Changes", "Leave without saving your edits?", [
            { text: "Keep Editing", style: "cancel" },
            {
              text: "Leave",
              style: "destructive",
              onPress: () => {
                setEditExercises(null);
                setIsDirty(false);
                setIsEditMode(false);
                safeBack();
              },
            },
          ]);
        }
      } else {
        setIsEditMode(false);
        safeBack();
      }
    } else {
      safeBack();
    }
  };

  const handleDeleteSession = () => {
    if (!session) return;
    Alert.alert(
      "Delete Session?",
      "This will permanently remove this workout from your history. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteSession(session.id, {
              onSuccess: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                safeBack();
              },
              onError: () => {
                Alert.alert("Delete Failed", "Could not delete this session. Please try again.");
              },
            });
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBackPress}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color={Colors.textMuted} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {type === "internal" ? session?.workoutTitle?.toUpperCase() : external?.label?.toUpperCase() ?? "WORKOUT"}
        </Text>
        {isEditMode ? (
          <Pressable onPress={handleSaveSession} style={styles.saveTopBtn} disabled={isSaving}>
            {isSaving ? <ActivityIndicator size={14} color={Colors.highlight} /> : <Text style={styles.saveTopBtnText}>DONE</Text>}
          </Pressable>
        ) : type === "internal" ? (
          <Pressable onPress={handleEnterEditMode} style={styles.editTopBtn}>
            <Feather name="edit-2" size={14} color={Colors.textMuted} />
            <Text style={styles.editTopBtnText}>EDIT</Text>
          </Pressable>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 32 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

        {/* Source + Date badge row */}
        <View style={styles.metaRow}>
          <View style={[styles.sourceBadge, { borderColor: sourceColor(type === "internal" ? "in-app" : (external?.source ?? "manual")) + "40" }]}>
            <Feather
              name={sourceIcon(type === "internal" ? "in-app" : (external?.source ?? "manual"))}
              size={11}
              color={sourceColor(type === "internal" ? "in-app" : (external?.source ?? "manual"))}
            />
            <Text style={[styles.sourceBadgeText, { color: sourceColor(type === "internal" ? "in-app" : (external?.source ?? "manual")) }]}>
              {type === "internal" ? "IN-APP SESSION" : sourceLabel(external?.source ?? "manual").toUpperCase()}
            </Text>
          </View>
          <Text style={styles.metaDate}>
            {new Date(type === "internal" ? (session?.createdAt ?? "") : (external?.workoutDate ?? external?.createdAt ?? "")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </Text>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>
              {type === "internal"
                ? formatSeconds(session?.durationSeconds ?? 0)
                : formatDuration(external?.duration ?? 0)}
            </Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statVal}>
              {type === "internal" ? exercises.length : (external?.movements?.length ?? 0)}
            </Text>
            <Text style={styles.statLabel}>Exercises</Text>
          </View>
          <View style={styles.statDivider} />
          {type === "internal" ? (
            <>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: pct === 100 ? Colors.highlight : pct >= 80 ? Colors.recovery : Colors.textMuted }]}>
                  {pct}%
                </Text>
                <Text style={styles.statLabel}>Complete</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{completedSets}</Text>
                <Text style={styles.statLabel}>Sets Done</Text>
              </View>
            </>
          ) : (
            <>
              {external?.intensity != null && (
                <>
                  <View style={styles.statBox}>
                    <Text style={[styles.statVal, { color: Colors.orange }]}>RPE {external.intensity}</Text>
                    <Text style={styles.statLabel}>Intensity</Text>
                  </View>
                  <View style={styles.statDivider} />
                </>
              )}
              {/* Suppress stimulusPoints when premium analysis is present:
                  the analysis panel shows a scored stimulus chip that is
                  more accurate, and showing both would send contradictory
                  signals. Retain only when premium analysis is unavailable. */}
              {external?.stimulusPoints != null && !extAnalysisVm.hasAnalysis && (
                <View style={styles.statBox}>
                  <Text style={[styles.statVal, { color: Colors.highlight }]}>{external.stimulusPoints}</Text>
                  <Text style={styles.statLabel}>Stim Pts</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ===== ANALYSIS SECTION ===== */}
        {type === "internal" && (
          <>
            {analysisLoading ? (
              <AnalysisSkeleton />
            ) : analysisVm.hasAnalysis ? (
              <WorkoutAnalysisPanel vm={analysisVm} />
            ) : muscleGroupsInternal.length > 0 ? (
              /* Fallback: coarse exercise.primaryMuscle chips when analysis unavailable */
              <View style={styles.muscleRow}>
                {muscleGroupsInternal.map((m: string) => (
                  <View key={m} style={[styles.muscleChip, { borderColor: (MUSCLE_COLOR[m] ?? Colors.textSubtle) + "50" }]}>
                    <View style={[styles.muscleDot, { backgroundColor: MUSCLE_COLOR[m] ?? Colors.textSubtle }]} />
                    <Text style={styles.muscleChipText}>{m}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Step 10: Muscle emphasis map — additive, shown only with premium analysis */}
            {analysisVm.hasAnalysis && !analysisLoading && (
              <MuscleEmphasisMap
                vm={buildBodyMapViewModel(analysisData?.muscleVector, {
                  mode:        "workout",
                  sourceLabel: "This workout · relative emphasis",
                  hasLowData:  analysisVm.analysisConfidence === "low",
                })}
                testID="workout-muscle-emphasis-map"
              />
            )}
          </>
        )}

        {/*
         * ===== COEXISTENCE RULES (Step 9) =====
         * When extAnalysisVm.hasAnalysis === true (premium panel shown):
         *   - WorkoutAnalysisPanel shown → engine-scored muscle/pattern/stimulus chips
         *   - stimulusPoints stat suppressed (see stat block above)
         *   - coarse muscleGroups chips NOT rendered (superseded by panel)
         *   - per-movement mv.muscleGroups + mv.fatiguePercent retained in movement
         *     cards below (per-movement detail, different granularity level — OK)
         *
         * When extAnalysisVm.hasAnalysis === false (premium panel unavailable):
         *   - coarse muscleGroups chips shown (data is still useful context)
         *   - stimulusPoints stat shown (no contradiction)
         *
         * importNote display rule:
         *   - Shown when importedDataNote is non-null AND vm.dataQualityNote is null.
         *   - Suppressed when dataQualityNote is present (both notes address data quality;
         *     the fallback-movement note is more specific and supersedes the import note).
         */}
        {type === "external" && (
          extAnalysisVm.hasAnalysis ? (
            <>
              <WorkoutAnalysisPanel vm={extAnalysisVm} importNote={isActivityAnalysis ? null : extImportNote} />
              {/* Muscle emphasis map: only shown for movement-based analysis.
                  Activity-based estimates lack a precise per-muscle vector. */}
              {!isActivityAnalysis && (
                <MuscleEmphasisMap
                  vm={buildBodyMapViewModel(extMovementData?.muscleVector, {
                    mode:        "workout",
                    sourceLabel: "This workout · relative emphasis",
                    hasLowData:  extAnalysisVm.analysisConfidence === "low",
                  })}
                  testID="ext-workout-muscle-emphasis-map"
                />
              )}
            </>
          ) : (external?.muscleGroups ?? []).length > 0 ? (
            <View style={styles.muscleRow}>
              {(external!.muscleGroups ?? []).map((m: string) => (
                <View key={m} style={[styles.muscleChip, { borderColor: (MUSCLE_COLOR[m] ?? Colors.textSubtle) + "50" }]}>
                  <View style={[styles.muscleDot, { backgroundColor: MUSCLE_COLOR[m] ?? Colors.textSubtle }]} />
                  <Text style={styles.muscleChipText}>{m}</Text>
                </View>
              ))}
            </View>
          ) : null
        )}

        {isEditMode && (
          <View style={styles.editBanner}>
            <Feather name="edit-2" size={12} color={Colors.highlight} />
            <Text style={styles.editBannerText}>Edit mode — tap DONE to save</Text>
            <Pressable onPress={handleDiscardEdits} style={{ marginLeft: "auto" }}>
              <Text style={styles.editBannerDiscard}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {/* ===== INTERNAL SESSION: Exercise detail ===== */}
        {type === "internal" && (
          <>
            <Text style={styles.sectionLabel}>EXERCISES</Text>
            {exercises.map((ex: any, eIdx: number) => {
              const completedInEx = ex.sets.filter((s: any) => s.completed).length;
              const allDone = completedInEx === ex.sets.length;
              return (
                <View key={ex.exerciseId ?? eIdx} style={styles.exerciseCard}>
                  <View style={styles.exerciseCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exerciseName}>{ex.name}</Text>
                      {ex.primaryMuscle && (
                        <Text style={styles.exerciseMuscle}>{ex.primaryMuscle}</Text>
                      )}
                    </View>
                    <View style={[styles.completionBadge, { backgroundColor: allDone ? "rgba(119,156,175,0.15)" : "rgba(252,82,0,0.1)" }]}>
                      <Text style={[styles.completionBadgeText, { color: allDone ? Colors.recovery : Colors.orange }]}>
                        {completedInEx}/{ex.sets.length}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.setsTable}>
                    <View style={styles.setsTableHeader}>
                      <Text style={[styles.setsTableHeaderCell, { flex: 0.5 }]}>SET</Text>
                      <Text style={[styles.setsTableHeaderCell, { flex: 1 }]}>WEIGHT</Text>
                      <Text style={[styles.setsTableHeaderCell, { flex: 1 }]}>REPS</Text>
                      <Text style={[styles.setsTableHeaderCell, { flex: 0.6, textAlign: "center" }]}>STATUS</Text>
                    </View>
                    {ex.sets.map((set: any, sIdx: number) => (
                      <View key={sIdx} style={[styles.setsTableRow, isEditMode && styles.setsTableRowEditing]}>
                        <Text style={[styles.setsTableCell, { flex: 0.5, color: isEditMode ? Colors.highlight : Colors.textMuted }]}>
                          {sIdx + 1}
                        </Text>
                        {isEditMode ? (
                          <TextInput
                            style={[styles.setEditInput, { flex: 1 }]}
                            value={set.weight && set.weight !== "0" ? String(set.weight) : ""}
                            onChangeText={v => handleBulkSetChange(eIdx, sIdx, "weight", v)}
                            placeholder="weight"
                            placeholderTextColor={Colors.textSubtle}
                            keyboardType="default"
                            returnKeyType="done"
                          />
                        ) : (
                          <Text style={[styles.setsTableCell, { flex: 1, color: Colors.text }]}>
                            {set.weight && set.weight !== "0" && set.weight !== "" ? set.weight : "—"}
                          </Text>
                        )}
                        {isEditMode ? (
                          <TextInput
                            style={[styles.setEditInput, { flex: 1 }]}
                            value={set.reps != null ? String(set.reps) : ""}
                            onChangeText={v => handleBulkSetChange(eIdx, sIdx, "reps", v)}
                            placeholder="reps"
                            placeholderTextColor={Colors.textSubtle}
                            keyboardType="number-pad"
                            returnKeyType="done"
                          />
                        ) : (
                          <Text style={[styles.setsTableCell, { flex: 1, color: Colors.text }]}>{set.reps}</Text>
                        )}
                        <View style={{ flex: 0.6, alignItems: "center" }}>
                          <Feather
                            name={set.completed ? "check-circle" : "x-circle"}
                            size={14}
                            color={set.completed ? Colors.recovery : Colors.textSubtle}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}

            {/* Feedback section */}
            {session?.postWorkoutFeedback && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 24 }]}>POST-WORKOUT FEEDBACK</Text>
                <View style={styles.feedbackCard}>
                  <View style={styles.feedbackRow}>
                    <View style={styles.feedbackItem}>
                      <Text style={styles.feedbackItemLabel}>DIFFICULTY</Text>
                      <Text style={[styles.feedbackItemVal, { color: Colors.orange }]}>
                        {SCORE_LABELS[session.postWorkoutFeedback.perceivedDifficulty] ?? session.postWorkoutFeedback.perceivedDifficulty}
                      </Text>
                    </View>
                    <View style={styles.feedbackItem}>
                      <Text style={styles.feedbackItemLabel}>ENERGY AFTER</Text>
                      <Text style={[styles.feedbackItemVal, { color: Colors.recovery }]}>
                        {SCORE_LABELS[session.postWorkoutFeedback.energyAfter] ?? session.postWorkoutFeedback.energyAfter}
                      </Text>
                    </View>
                    <View style={styles.feedbackItem}>
                      <Text style={styles.feedbackItemLabel}>ENJOYMENT</Text>
                      <Text style={[styles.feedbackItemVal, { color: Colors.highlight }]}>
                        {SCORE_LABELS[session.postWorkoutFeedback.enjoyment] ?? session.postWorkoutFeedback.enjoyment}
                      </Text>
                    </View>
                  </View>
                  {session.postWorkoutFeedback.notes?.trim() !== "" && (
                    <View style={styles.feedbackNotes}>
                      <Feather name="message-square" size={12} color={Colors.textSubtle} />
                      <Text style={styles.feedbackNotesText}>{session.postWorkoutFeedback.notes}</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        )}

        {/* ===== EXTERNAL WORKOUT: Movements ===== */}
        {type === "external" && external && (
          <>
            {external.workoutType && (
              <View style={styles.workoutTypeBadge}>
                <Text style={styles.workoutTypeBadgeText}>{external.workoutType.toUpperCase()}</Text>
                {external.isMetcon && <Text style={[styles.workoutTypeBadgeText, { color: Colors.orange, marginLeft: 8 }]}>METCON</Text>}
                {external.metconFormat && <Text style={[styles.workoutTypeBadgeText, { color: Colors.textSubtle }]}> · {external.metconFormat}</Text>}
              </View>
            )}

            {(external.movements?.length ?? 0) > 0 ? (
              <>
                <Text style={styles.sectionLabel}>MOVEMENTS</Text>
                {external.movements!.map((mv, idx) => (
                  <View key={idx} style={styles.movementCard}>
                    <View style={styles.movementLeft}>
                      <Text style={styles.movementName}>{mv.name}</Text>
                      {(mv.muscleGroups ?? []).length > 0 && (
                        <Text style={styles.movementMuscles}>{(mv.muscleGroups ?? []).join(", ")}</Text>
                      )}
                      {mv.volume && <Text style={styles.movementVolume}>{mv.volume}</Text>}
                    </View>
                    {mv.fatiguePercent > 0 && (
                      <View style={styles.fatigueMeter}>
                        <View style={[styles.fatigueFill, { height: `${Math.min(mv.fatiguePercent, 100)}%` as any }]} />
                        <Text style={styles.fatigueLabel}>{mv.fatiguePercent}%</Text>
                      </View>
                    )}
                  </View>
                ))}
              </>
            ) : (
              <View style={styles.noMovementsCard}>
                <Feather name="info" size={16} color={Colors.textSubtle} />
                <Text style={styles.noMovementsText}>
                  No exercise breakdown was captured for this workout.
                </Text>
                <Text style={styles.noMovementsHint}>
                  When you import or log your next workout, use the AI interpreter or add exercises manually to get per-exercise insights.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ===== DELETE (internal sessions only) ===== */}
        {type === "internal" && (
          <Pressable
            onPress={handleDeleteSession}
            disabled={isDeleting}
            style={({ pressed }) => [styles.deleteBtn, { opacity: pressed || isDeleting ? 0.7 : 1 }]}
          >
            {isDeleting ? (
              <ActivityIndicator size={14} color={Colors.orange} />
            ) : (
              <Feather name="trash-2" size={14} color={Colors.orange} />
            )}
            <Text style={styles.deleteBtnText}>{isDeleting ? "Deleting…" : "Delete Session"}</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Analysis panel styles (kept separate for clarity)
// ---------------------------------------------------------------------------

const analysisStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  skeleton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    justifyContent: "center",
  },
  skeletonText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  headline: {
    fontSize: 15,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    letterSpacing: 0.3,
  },
  row: {
    gap: 6,
  },
  subLabel: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 1.5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.highlight + "30",
    backgroundColor: Colors.highlight + "0A",
  },
  chipPattern: {
    borderColor: Colors.recovery + "30",
    backgroundColor: Colors.recovery + "0A",
  },
  chipStimulus: {
    alignSelf: "flex-start",
    borderColor: Colors.orange + "30",
    backgroundColor: Colors.orange + "0A",
  },
  chipText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.highlight,
  },
  qualityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  qualityNoteText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    lineHeight: 16,
  },
});

// ---------------------------------------------------------------------------
// Screen styles (unchanged from original)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
  },
  topBarTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    letterSpacing: 1,
    fontStyle: "italic",
  },
  saveTopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.highlight + "20",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.highlight + "40",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
  },
  saveTopBtnText: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: Colors.highlight,
    letterSpacing: 1,
  },
  editTopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editTopBtnText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  content: {
    padding: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  sourceBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    letterSpacing: 1.2,
  },
  metaDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  statsStrip: {
    flexDirection: "row",
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    marginBottom: 16,
    alignItems: "center",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  statVal: {
    fontSize: 17,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
  },
  statLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    letterSpacing: 0.5,
  },
  muscleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 20,
  },
  muscleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  muscleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  muscleChipText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.highlight + "15",
    borderWidth: 1,
    borderColor: Colors.highlight + "30",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  editBannerText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.highlight,
    flex: 1,
  },
  editBannerDiscard: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  exerciseCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    overflow: "hidden",
  },
  exerciseCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  exerciseName: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 2,
  },
  exerciseMuscle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  completionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  completionBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    letterSpacing: 0.5,
  },
  setsTable: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  setsTableHeader: {
    flexDirection: "row",
    marginBottom: 6,
  },
  setsTableHeaderCell: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 1,
  },
  setsTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  setsTableRowEditing: {
    backgroundColor: Colors.highlight + "08",
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  setsTableCell: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  setEditInput: {
    backgroundColor: Colors.bgMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.highlight + "50",
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginRight: 6,
  },
  feedbackCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  feedbackRow: {
    flexDirection: "row",
    gap: 8,
  },
  feedbackItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  feedbackItemLabel: {
    fontSize: 8,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 1,
    textAlign: "center",
  },
  feedbackItemVal: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  feedbackNotes: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  feedbackNotesText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 18,
  },
  workoutTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  workoutTypeBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 1,
  },
  movementCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 8,
  },
  movementLeft: {
    flex: 1,
    gap: 4,
  },
  movementName: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  movementMuscles: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  movementVolume: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.highlight,
    marginTop: 2,
  },
  fatigueMeter: {
    width: 28,
    height: 50,
    backgroundColor: Colors.bgMuted,
    borderRadius: 6,
    overflow: "hidden",
    justifyContent: "flex-end",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
    marginLeft: 12,
  },
  fatigueFill: {
    width: "100%",
    backgroundColor: Colors.orange + "80",
    borderRadius: 4,
  },
  fatigueLabel: {
    position: "absolute",
    top: 4,
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  noMovementsCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  noMovementsText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    textAlign: "center",
  },
  noMovementsHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    textAlign: "center",
    lineHeight: 18,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(252,82,0,0.25)",
    backgroundColor: "rgba(252,82,0,0.06)",
  },
  deleteBtnText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.orange,
    letterSpacing: 0.5,
  },
});
