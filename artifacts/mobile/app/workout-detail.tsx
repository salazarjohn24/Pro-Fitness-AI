import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const SCORE_LABELS: Record<number, string> = { 1: "Very Low", 2: "Low", 3: "Moderate", 4: "High", 5: "Very High" };
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

interface EditingSet {
  exerciseIdx: number;
  setIdx: number;
  weight: string;
  reps: string;
}

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

  const [editingSet, setEditingSet] = useState<EditingSet | null>(null);
  const [editExercises, setEditExercises] = useState<typeof session extends undefined ? never : NonNullable<typeof session>["exercises"] | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const external = type === "external" ? externalWorkouts?.find((w: ExternalWorkout) => w.id === id) : null;

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
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
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
          <Pressable onPress={() => router.back()} style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border }}>
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

  const muscleGroupsInternal = Array.from(new Set(
    exercises.flatMap((ex: any) => [ex.primaryMuscle, ...(ex.secondaryMuscles ?? [])].filter(Boolean))
  )) as string[];

  const handleEditSet = (exerciseIdx: number, setIdx: number) => {
    const ex = exercises[exerciseIdx];
    const set = ex.sets[setIdx];
    setEditingSet({ exerciseIdx, setIdx, weight: String(set.weight ?? ""), reps: String(set.reps ?? "") });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveSet = () => {
    if (!editingSet) return;
    const newExercises = exercises.map((ex: any, eIdx: number) => {
      if (eIdx !== editingSet.exerciseIdx) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s: any, sIdx: number) => {
          if (sIdx !== editingSet.setIdx) return s;
          return {
            ...s,
            weight: editingSet.weight.trim() || s.weight,
            reps: parseInt(editingSet.reps) || s.reps,
          };
        }),
      };
    });
    setEditExercises(newExercises as any);
    setIsDirty(true);
    setEditingSet(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSaveSession = () => {
    if (!isDirty || !session) return;
    updateSession({ id: session.id, exercises: editExercises as any }, {
      onSuccess: () => {
        setIsDirty(false);
        setEditExercises(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onError: () => {
        Alert.alert("Save Failed", "Could not save your edits. Please check your connection and try again.");
      },
    });
  };

  const handleDiscardEdits = (navigateBack = false) => {
    if (Platform.OS === "web") {
      if (!confirm("Discard your changes?")) return;
      setEditExercises(null);
      setIsDirty(false);
      if (navigateBack) router.back();
    } else {
      Alert.alert("Discard Changes", "Your weight/rep edits won't be saved.", [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            setEditExercises(null);
            setIsDirty(false);
            if (navigateBack) router.back();
          },
        },
      ]);
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
                router.back();
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
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => { if (isDirty) { handleDiscardEdits(true); } else { router.back(); } }} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={Colors.textMuted} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {type === "internal" ? session?.workoutTitle?.toUpperCase() : external?.label?.toUpperCase() ?? "WORKOUT"}
        </Text>
        {isDirty ? (
          <Pressable onPress={handleSaveSession} style={styles.saveTopBtn} disabled={isSaving}>
            {isSaving ? <ActivityIndicator size={14} color={Colors.highlight} /> : <Text style={styles.saveTopBtnText}>SAVE</Text>}
          </Pressable>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 32 }]} showsVerticalScrollIndicator={false}>

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
              {external?.stimulusPoints != null && (
                <View style={styles.statBox}>
                  <Text style={[styles.statVal, { color: Colors.highlight }]}>{external.stimulusPoints}</Text>
                  <Text style={styles.statLabel}>Stim Pts</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Muscle group chips */}
        {(type === "internal" ? muscleGroupsInternal : (external?.muscleGroups ?? [])).length > 0 && (
          <View style={styles.muscleRow}>
            {(type === "internal" ? muscleGroupsInternal : (external?.muscleGroups ?? [])).map((m: string) => (
              <View key={m} style={[styles.muscleChip, { borderColor: (MUSCLE_COLOR[m] ?? Colors.textSubtle) + "50" }]}>
                <View style={[styles.muscleDot, { backgroundColor: MUSCLE_COLOR[m] ?? Colors.textSubtle }]} />
                <Text style={styles.muscleChipText}>{m}</Text>
              </View>
            ))}
          </View>
        )}

        {isDirty && (
          <View style={styles.editBanner}>
            <Feather name="edit-2" size={12} color={Colors.highlight} />
            <Text style={styles.editBannerText}>Editing session — tap SAVE above when done</Text>
            <Pressable onPress={handleDiscardEdits} style={{ marginLeft: "auto" }}>
              <Text style={styles.editBannerDiscard}>Discard</Text>
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
                      <Text style={[styles.setsTableHeaderCell, { flex: 0.5, textAlign: "right" }]}>EDIT</Text>
                    </View>
                    {ex.sets.map((set: any, sIdx: number) => {
                      const isEditingThis = editingSet?.exerciseIdx === eIdx && editingSet?.setIdx === sIdx;
                      return (
                        <View key={sIdx} style={[styles.setsTableRow, isEditingThis && styles.setsTableRowEditing]}>
                          {isEditingThis ? (
                            <>
                              <Text style={[styles.setsTableCell, { flex: 0.5, color: Colors.highlight }]}>{sIdx + 1}</Text>
                              <TextInput
                                style={[styles.setEditInput, { flex: 1 }]}
                                value={editingSet.weight}
                                onChangeText={v => setEditingSet(e => e ? { ...e, weight: v } : null)}
                                placeholder="weight"
                                placeholderTextColor={Colors.textSubtle}
                                keyboardType="default"
                                autoFocus
                              />
                              <TextInput
                                style={[styles.setEditInput, { flex: 1 }]}
                                value={editingSet.reps}
                                onChangeText={v => setEditingSet(e => e ? { ...e, reps: v } : null)}
                                placeholder="reps"
                                placeholderTextColor={Colors.textSubtle}
                                keyboardType="number-pad"
                              />
                              <View style={{ flex: 0.6 }} />
                              <Pressable onPress={handleSaveSet} style={[styles.setEditSave, { flex: 0.5 }]}>
                                <Feather name="check" size={14} color={Colors.highlight} />
                              </Pressable>
                            </>
                          ) : (
                            <>
                              <Text style={[styles.setsTableCell, { flex: 0.5 }]}>{sIdx + 1}</Text>
                              <Text style={[styles.setsTableCell, { flex: 1, color: Colors.text }]}>
                                {set.weight && set.weight !== "0" && set.weight !== "" ? set.weight : "—"}
                              </Text>
                              <Text style={[styles.setsTableCell, { flex: 1, color: Colors.text }]}>{set.reps}</Text>
                              <View style={{ flex: 0.6, alignItems: "center" }}>
                                <Feather
                                  name={set.completed ? "check-circle" : "x-circle"}
                                  size={14}
                                  color={set.completed ? Colors.recovery : Colors.textSubtle}
                                />
                              </View>
                              <Pressable onPress={() => handleEditSet(eIdx, sIdx)} style={{ flex: 0.5, alignItems: "flex-end" }}>
                                <Feather name="edit-2" size={12} color={Colors.textSubtle} />
                              </Pressable>
                            </>
                          )}
                        </View>
                      );
                    })}
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
                      {mv.muscleGroups?.length > 0 && (
                        <Text style={styles.movementMuscles}>{mv.muscleGroups.join(", ")}</Text>
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
    </View>
  );
}

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
  setEditSave: {
    alignItems: "flex-end",
    justifyContent: "center",
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
