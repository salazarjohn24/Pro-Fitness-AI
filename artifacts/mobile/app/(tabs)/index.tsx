import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";

const TODAY = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).toUpperCase();

function BentoCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function RationaleChip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Feather name="sparkles" size={10} color={Colors.highlight} />
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { mutate: updateProfile } = useUpdateProfile();

  const streak = profile?.streakDays ?? 0;
  const syncProgress = profile?.dailySyncProgress ?? 0;
  const checkInDone = profile?.checkInCompleted ?? false;
  const activityDone = profile?.activityImported ?? false;

  const completedTasks = [checkInDone, activityDone, false].filter(Boolean).length;
  const pct = Math.round((completedTasks / 3) * 100);

  const handleCheckIn = () => {
    if (checkInDone) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newProgress = Math.min(100, syncProgress + 33);
    updateProfile({ checkInCompleted: true, dailySyncProgress: newProgress, streakDays: streak + 1 });
  };

  const handleActivity = () => {
    if (activityDone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newProgress = Math.min(100, syncProgress + 34);
    updateProfile({ activityImported: true, dailySyncProgress: newProgress });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: topPad }]}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { paddingTop: topPad + 8, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{TODAY}</Text>
          <Text style={styles.logoText}>
            PRO FITNESS <Text style={styles.logoAccent}>AI</Text>
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.streakBadge}>
            <Feather name="zap" size={14} color={Colors.orange} />
            <Text style={styles.streakText}>{streak}</Text>
          </View>
        </View>
      </View>

      {/* Daily Protocol Sync */}
      <BentoCard>
        <View style={styles.syncHeader}>
          <View style={styles.syncTitleRow}>
            <Text style={styles.sectionLabel}>Daily Protocol Sync</Text>
            <Text style={styles.syncPct}>{pct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>
        </View>

        <View style={styles.taskList}>
          {/* Check-in Task */}
          <Pressable
            onPress={handleCheckIn}
            style={({ pressed }) => [
              styles.taskItem,
              checkInDone ? styles.taskDone : styles.taskPending,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={[styles.taskIcon, checkInDone ? styles.taskIconDone : styles.taskIconHighlight]}>
              <Feather name={checkInDone ? "check" : "zap"} size={16} color={checkInDone ? Colors.bgPrimary : Colors.highlight} />
            </View>
            <View style={styles.taskInfo}>
              <Text style={[styles.taskTitle, checkInDone && styles.taskTitleDone]}>Intelligence Check-in</Text>
              <Text style={styles.taskSub}>{checkInDone ? "Calibration Complete" : "Calibration Required"}</Text>
            </View>
            <Feather name={checkInDone ? "check-circle" : "chevron-right"} size={16} color={checkInDone ? Colors.highlight : Colors.textMuted} />
          </Pressable>

          {/* Activity Task */}
          <Pressable
            onPress={handleActivity}
            style={({ pressed }) => [
              styles.taskItem,
              styles.taskInactive,
              activityDone && styles.taskDone,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={[styles.taskIcon, activityDone ? styles.taskIconDone : styles.taskIconNeutral]}>
              <Feather name="camera" size={16} color={activityDone ? Colors.bgPrimary : Colors.textMuted} />
            </View>
            <View style={styles.taskInfo}>
              <Text style={[styles.taskTitle, !activityDone && styles.taskTitleMuted, activityDone && styles.taskTitleDone]}>
                Activity Screenshot
              </Text>
              <Text style={styles.taskSub}>{activityDone ? "Synced" : "Sync via AI Vision Scan"}</Text>
            </View>
            <Feather name={activityDone ? "check-circle" : "plus"} size={16} color={activityDone ? Colors.highlight : "#3C3C3A"} />
          </Pressable>

          {/* Workout Task */}
          <View style={[styles.taskItem, styles.taskLocked]}>
            <View style={[styles.taskIcon, styles.taskIconLocked]}>
              <Feather name="dumbbell" size={16} color="#3C3C3A" />
            </View>
            <View style={styles.taskInfo}>
              <Text style={styles.taskTitleLocked}>Physique Protocol</Text>
              <Text style={styles.taskSub}>
                {checkInDone ? "Ready to Start" : "Locked: Pending Calibration"}
              </Text>
            </View>
            <Feather name={checkInDone ? "chevron-right" : "lock"} size={16} color="#3C3C3A" />
          </View>
        </View>
      </BentoCard>

      {/* AI Recommendation */}
      <BentoCard style={[styles.recommendCard, !checkInDone && styles.recommendLocked]}>
        <View style={styles.recommendHeader}>
          <RationaleChip text="AI Smart Load" />
          <Text style={styles.recommendLabel}>OPTIMIZED PLAN</Text>
        </View>
        <Text style={styles.recommendTitle}>Back & Arms{"\n"}Focus</Text>
        <Text style={styles.recommendDesc}>
          The AI suggests this to balance your recent volume and improve posture.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.startButton,
            { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}
          disabled={!checkInDone}
        >
          <Feather name="play" size={16} color="#fff" />
          <Text style={styles.startButtonText}>START WORKOUT</Text>
        </Pressable>
      </BentoCard>

      {/* Workout Architect */}
      <Pressable style={({ pressed }) => [styles.card, styles.architectCard, { opacity: pressed ? 0.85 : 1 }]}>
        <View style={styles.architectIcon}>
          <Feather name="cpu" size={20} color={Colors.highlight} />
        </View>
        <View style={styles.architectInfo}>
          <Text style={styles.architectTitle}>Workout Architect</Text>
          <Text style={styles.architectSub}>Build your own custom session</Text>
        </View>
        <Feather name="arrow-right" size={18} color={Colors.highlight} />
      </Pressable>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <BentoCard style={styles.statCard}>
          <Feather name="activity" size={18} color={Colors.recovery} />
          <Text style={styles.statValue}>78</Text>
          <Text style={styles.statLabel}>Recovery</Text>
        </BentoCard>
        <BentoCard style={styles.statCard}>
          <Feather name="zap" size={18} color={Colors.orange} />
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </BentoCard>
        <BentoCard style={styles.statCard}>
          <Feather name="target" size={18} color={Colors.highlight} />
          <Text style={styles.statValue}>{profile?.workoutFrequency ?? 3}x</Text>
          <Text style={styles.statLabel}>/ Week</Text>
        </BentoCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loadingContainer: { flex: 1, backgroundColor: Colors.bgPrimary, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 20, gap: 14 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
    marginBottom: 4,
  },
  logoText: {
    fontSize: 20,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    letterSpacing: 0.5,
    fontStyle: "italic",
  },
  logoAccent: { color: Colors.orange },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  streakBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  streakText: { fontSize: 14, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic" },
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    padding: 20,
  },
  syncHeader: { gap: 10, marginBottom: 16 },
  syncTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 2, textTransform: "uppercase" },
  syncPct: { fontSize: 10, fontFamily: "Inter_900Black", color: Colors.highlight },
  progressTrack: { height: 5, backgroundColor: "#292927", borderRadius: 10, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Colors.highlight, borderRadius: 10 },
  taskList: { gap: 8 },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  taskPending: { borderColor: "rgba(246,234,152,0.3)", backgroundColor: "rgba(246,234,152,0.04)" },
  taskDone: { borderColor: "rgba(246,234,152,0.2)", backgroundColor: "rgba(246,234,152,0.07)" },
  taskInactive: { borderColor: Colors.border, backgroundColor: "rgba(255,255,255,0.02)" },
  taskLocked: { borderColor: "#2C2C2A", backgroundColor: "transparent", opacity: 0.5 },
  taskIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  taskIconHighlight: { backgroundColor: "rgba(246,234,152,0.12)" },
  taskIconDone: { backgroundColor: Colors.highlight },
  taskIconNeutral: { backgroundColor: "#2C2C2A" },
  taskIconLocked: { backgroundColor: "#222220" },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.text, textTransform: "uppercase", letterSpacing: 0.5 },
  taskTitleDone: { color: Colors.highlight },
  taskTitleMuted: { color: "#A8A29E" },
  taskTitleLocked: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#78716C", textTransform: "uppercase", letterSpacing: 0.5 },
  taskSub: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textSubtle, marginTop: 2, letterSpacing: 0.5 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(246,234,152,0.12)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.25)",
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  chipText: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.highlight, textTransform: "uppercase", letterSpacing: 0.5 },
  recommendCard: { borderLeftWidth: 4, borderLeftColor: Colors.orange, gap: 12 },
  recommendLocked: { opacity: 0.4 },
  recommendHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recommendLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 1 },
  recommendTitle: {
    fontSize: 30,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    lineHeight: 34,
    fontStyle: "italic",
    textTransform: "uppercase",
  },
  recommendDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 20 },
  startButton: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  startButtonText: { fontSize: 13, fontFamily: "Inter_900Black", color: "#fff", letterSpacing: 1, fontStyle: "italic" },
  architectCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderColor: "rgba(246,234,152,0.3)",
  },
  architectIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(246,234,152,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  architectInfo: { flex: 1 },
  architectTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text, textTransform: "uppercase", letterSpacing: 0.5 },
  architectSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSubtle, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, alignItems: "center", gap: 8, paddingVertical: 16 },
  statValue: { fontSize: 22, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic" },
  statLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, textTransform: "uppercase", letterSpacing: 1 },
});
