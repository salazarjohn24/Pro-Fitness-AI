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

export default function ActivityHistoryScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: workouts = [], isLoading } = useWorkoutHistory(90);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

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

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.orange} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>No workouts found.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={w => `${w.type}-${w.id}`}
          renderItem={({ item }) => <WorkoutRow workout={item} />}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 24 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    paddingHorizontal: 20,
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
