import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Colors } from "@/constants/colors";
import { useProfile } from "@/hooks/useProfile";
import { InsightInfoModal } from "@/components/InsightInfoModal";
import { RebalancePlanModal } from "@/components/RebalancePlanModal";

type FeatherIcon = ComponentProps<typeof Feather>["name"];

const RANGES = ["1W", "1M", "3M", "6M"];

const WEEK_DATA = [
  { day: "M", value: 65 },
  { day: "T", value: 80 },
  { day: "W", value: 45 },
  { day: "T", value: 90 },
  { day: "F", value: 72 },
  { day: "S", value: 30 },
  { day: "S", value: 58 },
];

const MUSCLES = [
  { name: "Chest", sessions: 8, color: Colors.orange },
  { name: "Back", sessions: 10, color: Colors.recovery },
  { name: "Legs", sessions: 6, color: Colors.highlight },
  { name: "Shoulders", sessions: 7, color: "#A78BFA" },
  { name: "Arms", sessions: 5, color: "#34D399" },
];

const MAX_SESSIONS = Math.max(...MUSCLES.map((m) => m.sessions));

const KPI_ITEMS: { label: string; value: string; unit: string; icon: FeatherIcon; color: string }[] = [
  { label: "Streak", value: "0", unit: "days", icon: "zap", color: Colors.orange },
  { label: "Recovery", value: "78", unit: "score", icon: "activity", color: Colors.recovery },
  { label: "Volume", value: "24k", unit: "kg", icon: "trending-up", color: Colors.highlight },
];

const DNA_ITEMS: { label: string; value: string; icon: FeatherIcon }[] = [
  { label: "Recovery Rate", value: "High", icon: "shield" },
  { label: "Power Profile", value: "Moderate", icon: "zap" },
  { label: "Endurance", value: "Building", icon: "trending-up" },
  { label: "Mobility", value: "Average", icon: "refresh-cw" },
];

const AI_INSIGHTS = [
  {
    id: "balance",
    title: "Volume Imbalance Detected",
    text: "Your back volume is outpacing chest by 2 sessions this month. Consider adding a push day to maintain balance and prevent postural imbalances.",
    hasRebalance: true,
    info: {
      title: "Volume Imbalance Detection",
      what: "The AI tracks how many sessions you dedicate to each muscle group each month and flags when push/pull or upper/lower ratios fall out of balance.",
      why: "Muscle imbalances increase injury risk, reduce performance, and can cause postural issues like forward shoulder rounding over time.",
      how: "Tap 'Rebalance plan' to get an AI-generated schedule that corrects the imbalance while maintaining your training frequency.",
    },
  },
  {
    id: "recovery",
    title: "Recovery Score Insight",
    text: "Your recovery score of 78 indicates moderate readiness. Your best training days this week were Thursday and Tuesday.",
    hasRebalance: false,
    info: {
      title: "Recovery Score",
      what: "Your recovery score (0-100) is calculated from your check-in biometrics: energy level, sleep quality, muscle soreness, and stress.",
      why: "Training when recovery is low increases injury risk and reduces the training stimulus. Training when recovery is high maximizes adaptation.",
      how: "Complete your daily check-in every morning for the most accurate recovery tracking. The AI will schedule high-intensity sessions on your highest-recovery days.",
    },
  },
];

function BarChart() {
  const maxVal = Math.max(...WEEK_DATA.map((d) => d.value));
  return (
    <View style={barStyles.container}>
      {WEEK_DATA.map((d, i) => {
        const heightPct = (d.value / maxVal) * 100;
        return (
          <View key={i} style={barStyles.barGroup}>
            <View style={barStyles.barTrack}>
              <View
                style={[
                  barStyles.barFill,
                  {
                    height: `${heightPct}%`,
                    backgroundColor: i === 3 ? Colors.orange : Colors.recovery + "80",
                  },
                ]}
              />
            </View>
            <Text style={barStyles.dayLabel}>{d.day}</Text>
          </View>
        );
      })}
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 140 },
  barGroup: { flex: 1, alignItems: "center", gap: 6, height: "100%" },
  barTrack: {
    flex: 1,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: 6 },
  dayLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 1 },
});

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const [activeRange, setActiveRange] = useState("1W");
  const [infoInsight, setInfoInsight] = useState<(typeof AI_INSIGHTS)[0]["info"] | null>(null);
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const { data: profile } = useProfile();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const kpiItems = KPI_ITEMS.map((item) =>
    item.label === "Streak" ? { ...item, value: `${profile?.streakDays ?? 0}` } : item
  );

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.dateText}>ANALYTICS</Text>
          <Text style={styles.title}>Your <Text style={styles.titleAccent}>Progress</Text></Text>
        </View>

        <View style={styles.kpiRow}>
          {kpiItems.map(({ label, value, unit, icon, color }) => (
            <View key={label} style={[styles.kpiCard, { borderColor: color + "30" }]}>
              <Feather name={icon} size={16} color={color} />
              <Text style={[styles.kpiValue, { color }]}>{value}</Text>
              <Text style={styles.kpiUnit}>{unit}</Text>
              <Text style={styles.kpiLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>TRAINING VOLUME</Text>
            <View style={styles.rangeRow}>
              {RANGES.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => { Haptics.selectionAsync(); setActiveRange(r); }}
                  style={[styles.rangeBtn, activeRange === r && styles.rangeBtnActive]}
                >
                  <Text style={[styles.rangeBtnText, activeRange === r && styles.rangeBtnTextActive]}>{r}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <BarChart />
          <View style={styles.chartFooter}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.orange }]} />
              <Text style={styles.legendText}>Best day</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.recovery + "80" }]} />
              <Text style={styles.legendText}>Other</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>MUSCLE FOCUS</Text>
          <View style={styles.muscleList}>
            {MUSCLES.map((m) => {
              const widthPct = `${(m.sessions / MAX_SESSIONS) * 100}%`;
              return (
                <View key={m.name} style={styles.muscleRow}>
                  <Text style={styles.muscleName}>{m.name}</Text>
                  <View style={styles.muscleBarTrack}>
                    <View
                      style={[
                        styles.muscleBarFill,
                        { width: widthPct, backgroundColor: m.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.muscleSessions, { color: m.color }]}>{m.sessions}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.auditHeader}>
            <Text style={styles.cardTitle}>PERFORMANCE AUDIT</Text>
          </View>
          <View style={styles.dnaGrid}>
            {DNA_ITEMS.map(({ label, value, icon }) => (
              <View key={label} style={styles.dnaCard}>
                <Feather name={icon} size={14} color={Colors.recovery} />
                <Text style={styles.dnaValue}>{value}</Text>
                <Text style={styles.dnaLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {AI_INSIGHTS.map((insight) => (
          <View key={insight.id} style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <View style={styles.insightIconWrap}>
                <Feather name="star" size={16} color={Colors.highlight} />
              </View>
              <Text style={styles.insightTitle}>{insight.title.toUpperCase()}</Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setInfoInsight(insight.info);
                }}
                style={styles.infoBtn}
              >
                <Feather name="info" size={14} color={Colors.textSubtle} />
              </Pressable>
            </View>
            <Text style={styles.insightText}>{insight.text}</Text>
            {insight.hasRebalance && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setRebalanceOpen(true);
                }}
                style={({ pressed }) => [styles.insightAction, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="refresh-cw" size={12} color={Colors.highlight} />
                <Text style={styles.insightActionText}>Rebalance plan</Text>
                <Feather name="arrow-right" size={12} color={Colors.highlight} />
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>

      <InsightInfoModal
        visible={!!infoInsight}
        onClose={() => setInfoInsight(null)}
        insight={infoInsight}
      />

      <RebalancePlanModal
        visible={rebalanceOpen}
        onClose={() => setRebalanceOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { gap: 6 },
  dateText: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 2 },
  title: { fontSize: 32, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic" },
  titleAccent: { color: Colors.orange },
  kpiRow: { flexDirection: "row", gap: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  kpiValue: { fontSize: 22, fontFamily: "Inter_900Black", fontStyle: "italic" },
  kpiUnit: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textSubtle },
  kpiLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 9, fontFamily: "Inter_900Black", color: Colors.textSubtle, letterSpacing: 2 },
  rangeRow: { flexDirection: "row", gap: 4 },
  rangeBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.05)" },
  rangeBtnActive: { backgroundColor: Colors.orange },
  rangeBtnText: { fontSize: 9, fontFamily: "Inter_900Black", color: Colors.textMuted },
  rangeBtnTextActive: { color: "#fff" },
  chartFooter: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSubtle },
  muscleList: { gap: 12 },
  muscleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  muscleName: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textMuted, width: 72 },
  muscleBarTrack: { flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden" },
  muscleBarFill: { height: "100%", borderRadius: 6 },
  muscleSessions: { fontSize: 11, fontFamily: "Inter_900Black", width: 20, textAlign: "right" },
  auditHeader: { borderLeftWidth: 2, borderLeftColor: Colors.orange, paddingLeft: 8 },
  dnaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dnaCard: {
    width: "47%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    padding: 14,
    gap: 4,
    alignItems: "center",
  },
  dnaValue: { fontSize: 14, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic" },
  dnaLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 1 },
  insightCard: {
    backgroundColor: "rgba(246,234,152,0.06)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.2)",
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  insightHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  insightIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(246,234,152,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: { flex: 1, fontSize: 9, fontFamily: "Inter_900Black", color: Colors.highlight, letterSpacing: 2 },
  infoBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  insightText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 20 },
  insightAction: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  insightActionText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.highlight },
});
