import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import {
  useExerciseDetail,
  useExerciseHistory,
  type Exercise,
} from "@/hooks/useExercises";

const MUSCLE_COLORS = {
  primary: Colors.orange,
  secondary: "#F6EA98",
  tertiary: Colors.recovery,
};

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const exerciseId = parseInt(id || "0", 10);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: exercise, isLoading, isError, refetch } = useExerciseDetail(exerciseId);
  const { data: history } = useExerciseHistory(exerciseId);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: topPad + 20 }]}>
        <ActivityIndicator size="large" color={Colors.orange} />
        <Text style={styles.loadingText}>Loading exercise...</Text>
      </View>
    );
  }

  if (isError || !exercise) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: topPad + 20 }]}>
        <Feather name="alert-circle" size={40} color={Colors.textMuted} />
        <Text style={styles.errorTitle}>Exercise Not Found</Text>
        <Text style={styles.loadingText}>This exercise could not be loaded.</Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>RETRY</Text>
          </Pressable>
          <Pressable style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryText}>GO BACK</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: botPad + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        style={styles.backBtn}
        onPress={() => {
          Haptics.selectionAsync();
          router.back();
        }}
      >
        <Feather name="arrow-left" size={20} color={Colors.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.heroSection}>
        <View style={styles.heroIcon}>
          <Feather name="activity" size={32} color={Colors.orange} />
        </View>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <View style={styles.heroBadges}>
          <View style={[styles.badge, { backgroundColor: "rgba(252,82,0,0.15)", borderColor: Colors.orange + "40" }]}>
            <Text style={[styles.badgeText, { color: Colors.orange }]}>{exercise.muscleGroup.toUpperCase()}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.05)", borderColor: Colors.border }]}>
            <Text style={[styles.badgeText, { color: Colors.textMuted }]}>{exercise.equipment.toUpperCase()}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.05)", borderColor: Colors.border }]}>
            <Text style={[styles.badgeText, { color: Colors.textMuted }]}>{exercise.difficulty.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {exercise.youtubeUrl && (
        <Pressable
          style={({ pressed }) => [styles.videoCard, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Linking.openURL(exercise.youtubeUrl!);
          }}
        >
          <View style={styles.videoPlayIcon}>
            <Feather name="play-circle" size={36} color="#fff" />
          </View>
          <View style={styles.videoInfo}>
            <Text style={styles.videoTitle}>Watch Tutorial</Text>
            <Text style={styles.videoSub}>Open video on YouTube</Text>
          </View>
          <Feather name="external-link" size={16} color={Colors.textMuted} />
        </Pressable>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>STEP-BY-STEP INSTRUCTIONS</Text>
        <View style={styles.instructionsList}>
          {exercise.instructions?.map((step, i) => (
            <View key={i} style={styles.instructionRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>

      {exercise.commonMistakes && exercise.commonMistakes.length > 0 && (
        <View style={styles.mistakesCard}>
          <View style={styles.mistakesHeader}>
            <Feather name="alert-triangle" size={16} color="#EF4444" />
            <Text style={styles.mistakesTitle}>COMMON MISTAKES</Text>
          </View>
          {exercise.commonMistakes.map((mistake, i) => (
            <View key={i} style={styles.mistakeRow}>
              <Feather name="x" size={12} color="#EF4444" />
              <Text style={styles.mistakeText}>{mistake}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>STIMULUS MAP</Text>
        <View style={styles.stimulusCard}>
          {exercise.primaryMuscles?.length > 0 && (
            <View style={styles.stimulusGroup}>
              <View style={styles.stimulusHeader}>
                <View style={[styles.stimulusDot, { backgroundColor: MUSCLE_COLORS.primary }]} />
                <Text style={styles.stimulusLabel}>PRIMARY</Text>
              </View>
              <View style={styles.muscleChips}>
                {exercise.primaryMuscles.map((m, i) => (
                  <View key={i} style={[styles.muscleChip, { backgroundColor: MUSCLE_COLORS.primary + "20", borderColor: MUSCLE_COLORS.primary + "40" }]}>
                    <Text style={[styles.muscleChipText, { color: MUSCLE_COLORS.primary }]}>{m.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {exercise.secondaryMuscles?.length > 0 && (
            <View style={styles.stimulusGroup}>
              <View style={styles.stimulusHeader}>
                <View style={[styles.stimulusDot, { backgroundColor: MUSCLE_COLORS.secondary }]} />
                <Text style={styles.stimulusLabel}>SECONDARY</Text>
              </View>
              <View style={styles.muscleChips}>
                {exercise.secondaryMuscles.map((m, i) => (
                  <View key={i} style={[styles.muscleChip, { backgroundColor: MUSCLE_COLORS.secondary + "20", borderColor: MUSCLE_COLORS.secondary + "40" }]}>
                    <Text style={[styles.muscleChipText, { color: MUSCLE_COLORS.secondary }]}>{m.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {exercise.tertiaryMuscles?.length > 0 && (
            <View style={styles.stimulusGroup}>
              <View style={styles.stimulusHeader}>
                <View style={[styles.stimulusDot, { backgroundColor: MUSCLE_COLORS.tertiary }]} />
                <Text style={styles.stimulusLabel}>TERTIARY</Text>
              </View>
              <View style={styles.muscleChips}>
                {exercise.tertiaryMuscles.map((m, i) => (
                  <View key={i} style={[styles.muscleChip, { backgroundColor: MUSCLE_COLORS.tertiary + "20", borderColor: MUSCLE_COLORS.tertiary + "40" }]}>
                    <Text style={[styles.muscleChipText, { color: MUSCLE_COLORS.tertiary }]}>{m.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>

      {history && (
        <>
          {history.estimated1RM !== null && (
            <View style={styles.coachCard}>
              <View style={styles.coachHeader}>
                <Feather name="cpu" size={18} color={Colors.highlight} />
                <Text style={styles.coachTitle}>COACH'S NOTE</Text>
              </View>
              <View style={styles.coachStats}>
                <View style={styles.coachStat}>
                  <Text style={styles.coachStatValue}>{Math.round(history.estimated1RM)} lbs</Text>
                  <Text style={styles.coachStatLabel}>Est. 1RM</Text>
                </View>
                {history.sessions.length > 0 && (
                  <View style={styles.coachStat}>
                    <Text style={styles.coachStatValue}>{history.sessions[0].totalVolume.toLocaleString()}</Text>
                    <Text style={styles.coachStatLabel}>Last Volume</Text>
                  </View>
                )}
                <View style={styles.coachStat}>
                  <Text style={styles.coachStatValue}>{history.sessions.length}</Text>
                  <Text style={styles.coachStatLabel}>Sessions</Text>
                </View>
              </View>
              {history.restRecommendation && (
                <View style={styles.restRec}>
                  <Feather name="clock" size={12} color={Colors.highlight} />
                  <Text style={styles.restRecText}>{history.restRecommendation}</Text>
                </View>
              )}
            </View>
          )}

          {history.isPlateaued && (
            <View style={styles.plateauAlert}>
              <View style={styles.plateauHeader}>
                <Feather name="alert-circle" size={18} color="#F59E0B" />
                <Text style={styles.plateauTitle}>PLATEAU DETECTED</Text>
              </View>
              <Text style={styles.plateauText}>
                Your progress has stalled across the last 3 sessions. Consider trying an alternative exercise to break through.
              </Text>
              {exercise.alternatives && exercise.alternatives.length > 0 && (
                <View style={styles.plateauSuggestion}>
                  <Text style={styles.plateauSugText}>Try: <Text style={styles.plateauSugName}>{exercise.alternatives[0].name}</Text></Text>
                  <Pressable
                    style={styles.plateauSwapBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.replace({ pathname: "/exercise/[id]" as any, params: { id: String(exercise.alternatives[0].id) } });
                    }}
                  >
                    <Text style={styles.plateauSwapText}>SWAP</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </>
      )}

      {exercise.alternatives && exercise.alternatives.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SIMILAR EXERCISES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.altScroll}>
            <View style={styles.altList}>
              {exercise.alternatives.map((alt) => (
                <AlternativeCard key={alt.id} exercise={alt} />
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

function AlternativeCard({ exercise }: { exercise: Exercise }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.altCard, { opacity: pressed ? 0.85 : 1 }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/exercise/[id]" as any, params: { id: String(exercise.id) } });
      }}
    >
      <View style={styles.altIconContainer}>
        <Feather name="activity" size={20} color={Colors.orange} />
      </View>
      <Text style={styles.altName} numberOfLines={2}>{exercise.name}</Text>
      <Text style={styles.altMeta}>{exercise.equipment} · {exercise.difficulty}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { paddingHorizontal: 20, gap: 20 },
  loadingContainer: { alignItems: "center", justifyContent: "center", flex: 1 },
  loadingText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 12 },
  errorTitle: { fontSize: 18, fontFamily: "Inter_900Black", color: Colors.text, marginTop: 12 },
  retryBtn: { backgroundColor: Colors.orange, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 11, fontFamily: "Inter_900Black", color: "#fff", letterSpacing: 1 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8 },
  backText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  heroSection: { alignItems: "center", gap: 12 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "rgba(252,82,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseName: {
    fontSize: 24,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 28,
  },
  heroBadges: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  badgeText: { fontSize: 9, fontFamily: "Inter_900Black", letterSpacing: 1 },
  videoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: "rgba(252,82,0,0.3)",
    borderRadius: 20,
    padding: 16,
  },
  videoPlayIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  videoInfo: { flex: 1 },
  videoTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  videoSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  instructionsList: { gap: 12 },
  instructionRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(252,82,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { fontSize: 12, fontFamily: "Inter_900Black", color: Colors.orange },
  instructionText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text, lineHeight: 20 },
  mistakesCard: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  mistakesHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  mistakesTitle: { fontSize: 10, fontFamily: "Inter_900Black", color: "#EF4444", letterSpacing: 2 },
  mistakeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingLeft: 4 },
  mistakeText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(239,68,68,0.8)", lineHeight: 18 },
  stimulusCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 18,
    gap: 16,
  },
  stimulusGroup: { gap: 8 },
  stimulusHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  stimulusDot: { width: 10, height: 10, borderRadius: 5 },
  stimulusLabel: { fontSize: 9, fontFamily: "Inter_900Black", color: Colors.textMuted, letterSpacing: 1.5 },
  muscleChips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  muscleChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  muscleChipText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  coachCard: {
    backgroundColor: "rgba(246,234,152,0.08)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.25)",
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  coachHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  coachTitle: { fontSize: 10, fontFamily: "Inter_900Black", color: Colors.highlight, letterSpacing: 2 },
  coachStats: { flexDirection: "row", justifyContent: "space-around" },
  coachStat: { alignItems: "center", gap: 4 },
  coachStatValue: { fontSize: 20, fontFamily: "Inter_900Black", color: Colors.text },
  coachStatLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textMuted, letterSpacing: 0.5 },
  restRec: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(246,234,152,0.08)",
    borderRadius: 10,
    padding: 12,
  },
  restRecText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.highlight, lineHeight: 16 },
  plateauAlert: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  plateauHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  plateauTitle: { fontSize: 10, fontFamily: "Inter_900Black", color: "#F59E0B", letterSpacing: 2 },
  plateauText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(245,158,11,0.8)", lineHeight: 18 },
  plateauSuggestion: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  plateauSugText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.text },
  plateauSugName: { fontFamily: "Inter_700Bold", color: "#F59E0B" },
  plateauSwapBtn: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  plateauSwapText: { fontSize: 10, fontFamily: "Inter_900Black", color: "#fff", letterSpacing: 1 },
  altScroll: { marginHorizontal: -20 },
  altList: { flexDirection: "row", gap: 12, paddingHorizontal: 20 },
  altCard: {
    width: 160,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  altIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(252,82,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  altName: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text, textTransform: "uppercase" },
  altMeta: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted, textTransform: "capitalize" },
});
