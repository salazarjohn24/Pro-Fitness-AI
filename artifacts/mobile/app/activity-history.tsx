import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useWorkoutHistory, type UnifiedWorkout } from "@/hooks/useWorkout";
import { useTrainingAnalysis, type TrainingRangePreset } from "@/hooks/useTrainingAnalysis";
import {
  buildHistoryAnalysisViewModel,
  type InsightCard,
} from "@/lib/viewModels/historyAnalysisViewModel";

// ---------------------------------------------------------------------------
// Severity → Color (for insight cards)
// ---------------------------------------------------------------------------

type InsightSeverity = "info" | "low" | "moderate" | "high";

function severityColor(s: InsightSeverity): string {
  if (s === "high")     return Colors.orange;
  if (s === "moderate") return Colors.highlight;
  if (s === "low")      return Colors.recovery;
  return Colors.textSubtle;
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type FilterKey = "all" | "internal" | "external" | "apple_health";

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All",
  internal: "In-App",
  external: "External",
  apple_health: "Apple Health",
};

function filterWorkouts(workouts: UnifiedWorkout[], key: FilterKey): UnifiedWorkout[] {
  if (key === "internal") return workouts.filter(w => w.type === "internal");
  if (key === "external") return workouts.filter(w => w.type === "external" && w.source !== "apple_health");
  if (key === "apple_health") return workouts.filter(w => w.source === "apple_health");
  return workouts;
}

// ---------------------------------------------------------------------------
// WorkoutRow (unchanged)
// ---------------------------------------------------------------------------

function WorkoutRow({ workout }: { workout: UnifiedWorkout }) {
  const isRest = workout.workoutType === "rest";
  const isInternal = workout.type === "internal";
  const isAppleHealth = workout.source === "apple_health";

  const iconName: any = isRest ? "moon"
    : isInternal ? "award"
    : isAppleHealth ? "heart"
    : workout.source === "ai_scan" ? "cpu"
    : "globe";

  const iconColor = isRest ? Colors.recovery
    : isInternal ? Colors.highlight
    : isAppleHealth ? "#E1306C"
    : Colors.orange;

  const iconBg = isRest ? styles.iconRest
    : isInternal ? styles.iconInApp
    : isAppleHealth ? styles.iconAppleHealth
    : styles.iconExternal;

  const srcLabel = isRest ? "Rest"
    : isInternal ? "In-App"
    : isAppleHealth ? "Apple Health"
    : workout.source === "ai_scan" ? "AI Scan"
    : "External";

  const subText = isRest
    ? "Recovery day"
    : isInternal
    ? `${workout.durationMinutes}m · ${workout.exerciseCount} exercises · ${workout.totalSetsCompleted ?? 0} sets`
    : `${workout.durationMinutes}m${workout.intensity ? ` · RPE ${workout.intensity}` : ""}${workout.stimulusPoints ? ` · ${workout.stimulusPoints} pts` : ""}${workout.exerciseCount > 0 ? ` · ${workout.exerciseCount} exercises` : ""}`;

  const dateStr = new Date(workout.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Pressable
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/workout-detail?type=${workout.type}&id=${workout.id}` as any);
      }}
    >
      <View style={[styles.iconWrap, iconBg]}>
        <Feather name={iconName} size={14} color={iconColor} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{workout.label}</Text>
        <Text style={styles.sub} numberOfLines={1}>{subText}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.date}>{dateStr}</Text>
        <Text style={styles.source}>{srcLabel}</Text>
      </View>
      <Feather name="chevron-right" size={13} color={Colors.textSubtle} style={{ marginLeft: 4 }} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// InsightCardRow — renders a single insight card
// ---------------------------------------------------------------------------

function InsightCardRow({ card }: { card: InsightCard }) {
  const color = severityColor(card.severity);
  return (
    <View style={[overviewStyles.insightCard, { borderLeftColor: color + "60" }]} testID={`insight-card-${card.type}`}>
      <View style={[overviewStyles.insightDot, { backgroundColor: color }]} />
      <Text style={overviewStyles.insightText}>{card.text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// TrainingOverviewPanel — the history analysis header
// ---------------------------------------------------------------------------

const RANGE_OPTIONS: Array<{ label: string; value: TrainingRangePreset }> = [
  { label: "7d",  value: 7  },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

function TrainingOverviewPanel({
  range,
  onRangeChange,
}: {
  range: TrainingRangePreset;
  onRangeChange: (r: TrainingRangePreset) => void;
}) {
  const { data: analysisData, isLoading } = useTrainingAnalysis(range);
  const vm = buildHistoryAnalysisViewModel(
    analysisData?.rollup ?? null,
    analysisData?.insights ?? null,
  );

  return (
    <View style={overviewStyles.wrapper} testID="training-overview-panel">
      {/* Section header + range pills */}
      <View style={overviewStyles.headerRow}>
        <Text style={overviewStyles.sectionLabel}>TRAINING OVERVIEW</Text>
        <View style={overviewStyles.rangePills}>
          {RANGE_OPTIONS.map(opt => (
            <Pressable
              key={opt.value}
              style={[overviewStyles.rangePill, range === opt.value && overviewStyles.rangePillActive]}
              onPress={() => {
                Haptics.selectionAsync();
                onRangeChange(opt.value);
              }}
              testID={`range-pill-${opt.value}`}
            >
              <Text style={[overviewStyles.rangePillText, range === opt.value && overviewStyles.rangePillTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Content card */}
      <View style={overviewStyles.card}>
        {isLoading ? (
          <View style={overviewStyles.loadingRow} testID="overview-loading">
            <ActivityIndicator size="small" color={Colors.textSubtle} />
            <Text style={overviewStyles.loadingText}>Loading overview…</Text>
          </View>
        ) : vm.workoutCount === 0 ? (
          <View testID="overview-empty">
            <Text style={overviewStyles.emptyHeadline}>No workout data for {vm.rangeLabel || "this range"}</Text>
            <Text style={overviewStyles.emptyHint}>Log or import workouts to see your training overview here.</Text>
          </View>
        ) : (
          <View testID="overview-content">
            {/* Headline */}
            <Text style={overviewStyles.headline} testID="overview-headline">{vm.headline}</Text>

            {/* Top muscles */}
            {vm.topMuscles.length > 0 && (
              <View style={overviewStyles.section}>
                <Text style={overviewStyles.subLabel}>TOP MUSCLES</Text>
                <View style={overviewStyles.muscleRow}>
                  {vm.topMuscles.slice(0, 5).map(m => (
                    <View key={m.key} style={overviewStyles.muscleChip} testID={`overview-muscle-${m.key}`}>
                      {m.isElevatedRecently && (
                        <Feather name="trending-up" size={9} color={Colors.recovery} style={{ marginRight: 3 }} />
                      )}
                      {m.isReducedRecently && (
                        <Feather name="trending-down" size={9} color={Colors.orange} style={{ marginRight: 3 }} />
                      )}
                      <Text style={overviewStyles.muscleChipText}>{m.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Insight cards (max 3, excluding data quality) */}
            {vm.insightCards.length > 0 && (
              <View style={overviewStyles.section} testID="overview-insights">
                <Text style={overviewStyles.subLabel}>OBSERVATIONS</Text>
                {vm.insightCards.slice(0, 3).map((card, idx) => (
                  <InsightCardRow key={`${card.type}-${card.subject}-${idx}`} card={card} />
                ))}
              </View>
            )}

            {/* Summary observations (when no insight cards or as supplement) */}
            {vm.insightCards.length === 0 && vm.summaryObservations.length > 0 && (
              <View style={overviewStyles.section}>
                <Text style={overviewStyles.subLabel}>SUMMARY</Text>
                {vm.summaryObservations.slice(0, 2).map((obs, i) => (
                  <Text key={i} style={overviewStyles.observationText}>{obs}</Text>
                ))}
              </View>
            )}

            {/* Data quality note */}
            {vm.dataQualityNote != null && (
              <View style={overviewStyles.qualityNote} testID="overview-quality-note">
                <Feather name="info" size={11} color={Colors.textSubtle} />
                <Text style={overviewStyles.qualityNoteText}>{vm.dataQualityNote}</Text>
              </View>
            )}

            {/* Low-data trust note */}
            {!vm.hasEnoughData && vm.workoutCount > 0 && (
              <View style={overviewStyles.qualityNote} testID="overview-low-data">
                <Feather name="info" size={11} color={Colors.textSubtle} />
                <Text style={overviewStyles.qualityNoteText}>
                  Based on {vm.workoutCount} {vm.workoutCount === 1 ? "workout" : "workouts"}. Add more sessions to see richer trends.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* List divider */}
      <Text style={overviewStyles.listSectionLabel}>WORKOUTS</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ActivityHistoryScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: workouts = [], isLoading: historyLoading } = useWorkoutHistory(90);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [overviewRange, setOverviewRange] = useState<TrainingRangePreset>(30);

  const countAll = workouts.length;
  const countInternal = workouts.filter(w => w.type === "internal").length;
  const countExternal = workouts.filter(w => w.type === "external" && w.source !== "apple_health").length;
  const countAppleHealth = workouts.filter(w => w.source === "apple_health").length;

  const filterDefs: Array<{ key: FilterKey; count: number }> = (
    [
      { key: "all" as FilterKey, count: countAll },
      { key: "internal" as FilterKey, count: countInternal },
      { key: "external" as FilterKey, count: countExternal },
      { key: "apple_health" as FilterKey, count: countAppleHealth },
    ] as Array<{ key: FilterKey; count: number }>
  ).filter(f => f.count > 0 || f.key === "all");

  const filtered = filterWorkouts(workouts, activeFilter);

  const listHeader = (
    <View>
      {/* Training overview panel */}
      <TrainingOverviewPanel range={overviewRange} onRangeChange={setOverviewRange} />

      {/* Filter pills (above the workout list) */}
      {filterDefs.length > 1 && (
        <View style={styles.filterRow}>
          {filterDefs.map(f => (
            <Pressable
              key={f.key}
              style={[styles.filterPill, activeFilter === f.key && styles.filterPillActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter(f.key);
              }}
            >
              <Text style={[styles.filterText, activeFilter === f.key && styles.filterTextActive]}>
                {FILTER_LABELS[f.key]}{f.count > 0 ? ` (${f.count})` : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  const listEmpty = historyLoading ? (
    <View style={styles.centered}>
      <ActivityIndicator color={Colors.orange} />
    </View>
  ) : (
    <View style={styles.centered}>
      <Text style={styles.empty}>No workouts found.</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>ACTIVITY HISTORY</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={w => `${w.type}-${w.id}`}
        renderItem={({ item }) => <WorkoutRow workout={item} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={[styles.list, { paddingBottom: botPad + 24 }]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Training overview styles
// ---------------------------------------------------------------------------

const overviewStyles = StyleSheet.create({
  wrapper: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 1.5,
  },
  rangePills: {
    flexDirection: "row",
    gap: 4,
  },
  rangePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  rangePillActive: {
    backgroundColor: Colors.highlight + "20",
    borderColor: Colors.highlight + "50",
  },
  rangePillText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
  },
  rangePillTextActive: {
    color: Colors.highlight,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 16,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  emptyHeadline: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    lineHeight: 16,
  },
  headline: {
    fontSize: 15,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    marginBottom: 12,
    lineHeight: 20,
  },
  section: {
    marginBottom: 12,
    gap: 6,
  },
  subLabel: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  muscleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  muscleChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.highlight + "30",
    backgroundColor: Colors.highlight + "08",
  },
  muscleChipText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.highlight,
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  insightDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 5,
    flexShrink: 0,
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 17,
  },
  observationText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 17,
    marginBottom: 4,
  },
  qualityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    paddingTop: 10,
    marginTop: 4,
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
  listSectionLabel: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 8,
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    color: Colors.textMuted,
    letterSpacing: 2,
    fontStyle: "italic",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  filterPillActive: {
    backgroundColor: Colors.highlight,
    borderColor: Colors.highlight,
  },
  filterText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
  },
  filterTextActive: {
    color: Colors.bgPrimary,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  empty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  iconInApp: {
    backgroundColor: "rgba(99,102,241,0.15)",
  },
  iconExternal: {
    backgroundColor: "rgba(249,115,22,0.15)",
  },
  iconAppleHealth: {
    backgroundColor: "rgba(225,48,108,0.15)",
  },
  iconRest: {
    backgroundColor: "rgba(74,222,128,0.12)",
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  sub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    marginTop: 2,
  },
  right: {
    alignItems: "flex-end",
    flexShrink: 0,
  },
  date: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  source: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    marginTop: 2,
  },
});
