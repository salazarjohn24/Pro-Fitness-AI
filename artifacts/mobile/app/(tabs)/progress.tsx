import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useProfile, useRecentExternalWorkouts, useTodayCheckIn, computeReadinessScore } from "@/hooks/useProfile";
import { InsightInfoModal } from "@/components/InsightInfoModal";
import { RebalancePlanModal } from "@/components/RebalancePlanModal";
import { AccordionCard } from "@/components/AccordionCard";
import { useAuditAlerts, useAIAuditInsight } from "@/hooks/useAuditAlerts";
import { useRecoveryCorrelation } from "@/hooks/useRecoveryCorrelation";
import { useVolumeStats, type VolumeTimelinePoint, type MuscleFocusItem } from "@/hooks/useVolumeStats";
import { useWorkoutHistory } from "@/hooks/useWorkout";

type FeatherIcon = ComponentProps<typeof Feather>["name"];

const RANGES = ["1M", "3M", "6M"];

const MUSCLE_COLORS: Record<string, string> = {
  Chest: Colors.orange,
  Back: Colors.recovery,
  Quads: Colors.highlight,
  Shoulders: "#A78BFA",
  Biceps: "#34D399",
  Triceps: "#F472B6",
  Core: "#60A5FA",
  Glutes: "#FBBF24",
  Hamstrings: "#FB923C",
  Calves: "#818CF8",
  Legs: Colors.highlight,
  Arms: "#34D399",
};

function getMuscleColor(muscle: string, index: number): string {
  if (MUSCLE_COLORS[muscle]) return MUSCLE_COLORS[muscle];
  const fallbacks = [Colors.orange, Colors.recovery, Colors.highlight, "#A78BFA", "#34D399", "#F472B6", "#60A5FA"];
  return fallbacks[index % fallbacks.length];
}

const KPI_ITEMS: { label: string; value: string; unit: string; icon: FeatherIcon; color: string }[] = [
  { label: "Avg RPE", value: "—", unit: "intensity", icon: "zap", color: Colors.orange },
  { label: "Recovery", value: "78", unit: "score", icon: "activity", color: Colors.recovery },
  { label: "Volume", value: "0", unit: "kg", icon: "trending-up", color: Colors.highlight },
];

function AlertChip({ alert }: { alert: { type: string; message: string } }) {
  const isNeglect = alert.type === "neglect";
  return (
    <View style={[chipStyles.chip, isNeglect ? chipStyles.neglectChip : chipStyles.consistencyChip]}>
      <Feather
        name={isNeglect ? "alert-triangle" : "sliders"}
        size={10}
        color={isNeglect ? Colors.orange : "#A78BFA"}
      />
      <Text style={[chipStyles.chipText, { color: isNeglect ? Colors.orange : "#A78BFA" }]} numberOfLines={1}>
        {alert.message}
      </Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  neglectChip: {
    backgroundColor: "rgba(252,82,0,0.08)",
    borderColor: "rgba(252,82,0,0.25)",
  },
  consistencyChip: {
    backgroundColor: "rgba(167,139,250,0.08)",
    borderColor: "rgba(167,139,250,0.25)",
  },
  chipText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
    flex: 1,
  },
});

function VolumeBarChart({ data, range }: { data: VolumeTimelinePoint[]; range: string }) {
  if (data.length === 0) {
    return (
      <View style={barStyles.emptyContainer}>
        <Feather name="bar-chart-2" size={28} color={Colors.textSubtle} />
        <Text style={barStyles.emptyText}>No volume data for this period</Text>
      </View>
    );
  }

  const grouped = groupDataForRange(data, range);
  const maxVal = Math.max(...grouped.map(d => d.volume), 1);

  return (
    <View style={barStyles.container}>
      {grouped.map((d, i) => {
        const heightPct = (d.volume / maxVal) * 100;
        const isBest = d.volume === maxVal && d.volume > 0;
        return (
          <View key={i} style={barStyles.barGroup}>
            <View style={barStyles.barTrack}>
              <View
                style={[
                  barStyles.barFill,
                  {
                    height: `${heightPct}%`,
                    backgroundColor: isBest ? Colors.orange : Colors.recovery + "80",
                  },
                ]}
              />
            </View>
            <Text style={barStyles.dayLabel}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function groupDataForRange(data: VolumeTimelinePoint[], range: string): { label: string; volume: number }[] {
  if (data.length === 0) return [];

  const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

  if (range === "1M") {
    const weekMap: Record<string, number> = {};
    for (const d of data) {
      const date = parseLocalDate(d.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const key = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      weekMap[key] = (weekMap[key] ?? 0) + d.volume;
    }
    return Object.entries(weekMap).map(([label, volume]) => ({ label, volume }));
  }

  if (range === "3M" || range === "6M") {
    const monthMap: Record<string, { volume: number; yearMonth: string }> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (const d of data) {
      const date = parseLocalDate(d.date);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${monthNames[date.getMonth()]} ${date.getFullYear().toString().slice(2)}`;
      if (!monthMap[yearMonth]) monthMap[yearMonth] = { volume: 0, yearMonth };
      monthMap[yearMonth].volume += d.volume;
    }
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([yearMonth, { volume }]) => {
        const [year, month] = yearMonth.split("-");
        const label = `${monthNames[parseInt(month, 10) - 1]} ${year.slice(2)}`;
        return { label, volume };
      });
  }

  return data.map(d => {
    const date = parseLocalDate(d.date);
    return { label: `${date.getMonth() + 1}/${date.getDate()}`, volume: d.volume };
  });
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
  emptyContainer: { height: 140, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSubtle },
});

function MuscleFocusChart({ data }: { data: MuscleFocusItem[] }) {
  if (data.length === 0) {
    return (
      <View style={barStyles.emptyContainer}>
        <Feather name="target" size={28} color={Colors.textSubtle} />
        <Text style={barStyles.emptyText}>No muscle data for this period</Text>
      </View>
    );
  }

  const maxSets = Math.max(...data.map(m => m.sets), 1);

  return (
    <View style={styles.muscleList}>
      {data.map((m, i) => {
        const widthPct = `${(m.sets / maxSets) * 100}%`;
        const color = getMuscleColor(m.muscle, i);
        return (
          <View key={m.muscle} style={styles.muscleRow}>
            <Text style={styles.muscleName}>{m.muscle}</Text>
            <View style={styles.muscleBarTrack}>
              <View
                style={[
                  styles.muscleBarFill,
                  { width: widthPct as any, backgroundColor: color },
                ]}
              />
            </View>
            <Text style={[styles.muscleSessions, { color }]}>{m.percentage}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function DataSufficiencyBanner({ totalSessions, hasEnoughData }: { totalSessions: number; hasEnoughData: boolean }) {
  if (hasEnoughData) return null;

  const workoutsNeeded = Math.max(0, 3 - totalSessions);
  const progressPct = Math.min(100, Math.round((totalSessions / 3) * 100));

  return (
    <View style={bannerStyles.container}>
      <View style={bannerStyles.iconRow}>
        <View style={bannerStyles.iconWrap}>
          <Feather name="unlock" size={16} color={Colors.highlight} />
        </View>
        <View style={bannerStyles.textCol}>
          <Text style={bannerStyles.title}>UNLOCK YOUR INSIGHTS</Text>
          <Text style={bannerStyles.desc}>
            {totalSessions === 0
              ? "Log your first workout to start building your performance profile. The more you train and log, the smarter your audit becomes."
              : `${workoutsNeeded} more workout${workoutsNeeded !== 1 ? "s" : ""} to unlock full analytics. Keep going \u2014 your data is building a powerful picture of your fitness.`}
          </Text>
        </View>
      </View>
      <View style={bannerStyles.progressTrack}>
        <View style={[bannerStyles.progressFill, { width: `${progressPct}%` }]} />
      </View>
      <Text style={bannerStyles.progressLabel}>
        {totalSessions} / 3 workouts logged
      </Text>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(246,234,152,0.06)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.2)",
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  iconRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(246,234,152,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.highlight,
    letterSpacing: 2,
  },
  desc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 18,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.highlight,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    textAlign: "center",
    letterSpacing: 1,
  },
});

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const [activeRange, setActiveRange] = useState("1M");
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [freqInfoOpen, setFreqInfoOpen] = useState(false);
  const { data: profile } = useProfile();
  const { data: alerts } = useAuditAlerts();
  const { data: aiInsight, isLoading: aiInsightLoading } = useAIAuditInsight();
  const { data: recoveryCorrelation } = useRecoveryCorrelation();
  const { data: volumeStats, isLoading: volumeLoading } = useVolumeStats(activeRange);
  const { data: recentExternalWorkouts } = useRecentExternalWorkouts();
  const { data: workoutHistory } = useWorkoutHistory(60);
  const { data: todayCheckIn } = useTodayCheckIn();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const totalVolume = volumeStats?.totalVolume ?? 0;
  const volumeLabel = totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : `${totalVolume}`;
  const totalSessions = volumeStats?.totalSessions ?? 0;
  const hasEnoughData = volumeStats?.hasEnoughData ?? false;

  const readinessScore = computeReadinessScore(todayCheckIn);

  const weeklyGoal = profile?.workoutFrequency ?? 3;
  const weekMonday = (() => {
    const d = new Date();
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return d.toLocaleDateString("en-CA");
  })();
  const thisWeekExternal = (recentExternalWorkouts ?? []).filter((w: any) => {
    const d = (w.workoutDate ?? w.createdAt?.slice(0, 10) ?? "");
    return d >= weekMonday;
  });
  const thisWeekInternal = (workoutHistory ?? []).filter(
    (w) => w.type === "internal" && (w.date ?? "").slice(0, 10) >= weekMonday
  );
  const weeklySessionCount = thisWeekExternal.length + thisWeekInternal.length;
  const weeklyAlignmentPct = Math.min(100, Math.round((weeklySessionCount / weeklyGoal) * 100));

  const rpeWorkoutsAll = (recentExternalWorkouts ?? []).filter((w: any) => w.intensity);
  const avgRpeAll = rpeWorkoutsAll.length > 0
    ? (Math.round(rpeWorkoutsAll.reduce((s: number, w: any) => s + (w.intensity ?? 0), 0) / rpeWorkoutsAll.length * 10) / 10).toString()
    : "—";

  const freqRecommendation = (() => {
    if (readinessScore >= 70) return { text: "Your recovery is strong. You have capacity for another session this week if you're under your goal.", color: Colors.highlight, icon: "trending-up" as FeatherIcon };
    if (readinessScore >= 50) return { text: "Moderate recovery. Maintain your current training load and prioritize sleep.", color: Colors.recovery, icon: "minus-circle" as FeatherIcon };
    return { text: "Recovery is low. Consider reducing volume or taking an active rest day for better adaptation.", color: Colors.orange, icon: "trending-down" as FeatherIcon };
  })();

  const kpiItems = KPI_ITEMS.map((item) => {
    if (item.label === "Avg RPE") return { ...item, value: avgRpeAll };
    if (item.label === "Volume") return { ...item, value: volumeLabel };
    if (item.label === "Recovery") return { ...item, value: readinessScore > 0 ? readinessScore.toString() : "—" };
    return item;
  });

  const neglectAlerts = (alerts ?? []).filter(a => a.type === "neglect");
  const consistencyAlerts = (alerts ?? []).filter(a => a.type === "consistency");
  const topAlerts = [...neglectAlerts.slice(0, 3), ...consistencyAlerts.slice(0, 2)];

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.dateText}>AUDIT</Text>
          <Text style={styles.title}>Performance <Text style={styles.titleAccent}>Audit</Text></Text>
        </View>

        <DataSufficiencyBanner totalSessions={totalSessions} hasEnoughData={hasEnoughData} />

        {topAlerts.length > 0 && (
          <View style={styles.alertsContainer}>
            {topAlerts.map((alert, i) => (
              <AlertChip key={`${alert.type}-${alert.muscle}-${i}`} alert={alert} />
            ))}
          </View>
        )}

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
            <Text style={styles.cardTitle}>WEEKLY FREQUENCY</Text>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFreqInfoOpen(true); }} style={styles.infoBtn}>
              <Feather name="info" size={14} color={Colors.textSubtle} />
            </Pressable>
          </View>

          <View style={freqStyles.alignRow}>
            <View style={freqStyles.alignNumbers}>
              <Text style={freqStyles.sessionCount}>{weeklySessionCount}</Text>
              <Text style={freqStyles.sessionGoal}>/ {weeklyGoal} this week</Text>
            </View>
            <View style={[freqStyles.alignBadge, weeklyAlignmentPct >= 100 ? freqStyles.badgeGreen : weeklyAlignmentPct >= 60 ? freqStyles.badgeYellow : freqStyles.badgeOrange]}>
              <Text style={[freqStyles.alignBadgeText, weeklyAlignmentPct >= 100 ? freqStyles.badgeGreenText : weeklyAlignmentPct >= 60 ? freqStyles.badgeYellowText : freqStyles.badgeOrangeText]}>
                {weeklyAlignmentPct >= 100 ? "ON TRACK" : weeklyAlignmentPct >= 60 ? "IN PROGRESS" : "BEHIND"}
              </Text>
            </View>
          </View>

          <View style={freqStyles.progressTrack}>
            <View style={[freqStyles.progressFill, {
              width: `${weeklyAlignmentPct}%` as any,
              backgroundColor: weeklyAlignmentPct >= 100 ? Colors.highlight : weeklyAlignmentPct >= 60 ? Colors.recovery : Colors.orange,
            }]} />
          </View>

          {todayCheckIn && (
            <View style={freqStyles.recommendRow}>
              <Feather name={freqRecommendation.icon} size={13} color={freqRecommendation.color} />
              <Text style={[freqStyles.recommendText, { color: freqRecommendation.color }]}>
                {freqRecommendation.text}
              </Text>
            </View>
          )}
          {!todayCheckIn && (
            <Text style={freqStyles.noCheckInHint}>
              Complete today's check-in to get a personalized frequency recommendation.
            </Text>
          )}
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
          {volumeLoading ? (
            <View style={barStyles.emptyContainer}>
              <ActivityIndicator color={Colors.orange} />
            </View>
          ) : (
            <VolumeBarChart data={volumeStats?.volumeTimeline ?? []} range={activeRange} />
          )}
          <View style={styles.chartFooter}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.orange }]} />
              <Text style={styles.legendText}>Peak</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.recovery + "80" }]} />
              <Text style={styles.legendText}>Other</Text>
            </View>
            <Text style={styles.legendText}>{totalSessions} session{totalSessions !== 1 ? "s" : ""}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>MUSCLE FOCUS</Text>
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
          {volumeLoading ? (
            <View style={barStyles.emptyContainer}>
              <ActivityIndicator color={Colors.orange} />
            </View>
          ) : (
            <MuscleFocusChart data={volumeStats?.muscleFocus ?? []} />
          )}
        </View>

        {(neglectAlerts.length > 0 || consistencyAlerts.length > 0) && (
          <AccordionCard title="Alert Details" icon="alert-circle" iconColor={Colors.orange}>
            {neglectAlerts.length > 0 && (
              <View style={styles.alertSection}>
                <Text style={styles.alertSectionTitle}>NEGLECTED MUSCLES</Text>
                <Text style={styles.alertSectionDesc}>
                  Muscle groups not trained in 10+ days. Consistent stimulus prevents atrophy and maintains strength balance.
                </Text>
                {neglectAlerts.map((a, i) => (
                  <View key={i} style={styles.alertDetailRow}>
                    <View style={[styles.alertDot, { backgroundColor: Colors.orange }]} />
                    <Text style={styles.alertDetailText}>{a.message}</Text>
                  </View>
                ))}
              </View>
            )}
            {consistencyAlerts.length > 0 && (
              <View style={styles.alertSection}>
                <Text style={[styles.alertSectionTitle, { color: "#A78BFA" }]}>CONSISTENCY CHECKS</Text>
                <Text style={styles.alertSectionDesc}>
                  Sessions with a consistency score below 80% suggest form or intensity adjustments may be needed.
                </Text>
                {consistencyAlerts.map((a, i) => (
                  <View key={i} style={styles.alertDetailRow}>
                    <View style={[styles.alertDot, { backgroundColor: "#A78BFA" }]} />
                    <Text style={styles.alertDetailText}>{a.message}</Text>
                  </View>
                ))}
              </View>
            )}
          </AccordionCard>
        )}

        {recoveryCorrelation && (
          <AccordionCard title="Recovery-to-Load Correlation" icon="bar-chart-2" iconColor={Colors.recovery}>
            <Text style={styles.alertSectionDesc}>
              How your sleep/recovery quality affects training volume output.
            </Text>
            <View style={styles.correlationGrid}>
              <View style={styles.correlationItem}>
                <Text style={[styles.correlationValue, { color: Colors.highlight }]}>
                  {recoveryCorrelation.avgHighVolume}
                </Text>
                <Text style={styles.correlationLabel}>AVG VOLUME (HIGH RECOVERY)</Text>
                <Text style={styles.correlationSub}>{recoveryCorrelation.highRecoveryCount} sessions</Text>
              </View>
              <View style={styles.correlationItem}>
                <Text style={[styles.correlationValue, { color: Colors.orange }]}>
                  {recoveryCorrelation.avgLowVolume}
                </Text>
                <Text style={styles.correlationLabel}>AVG VOLUME (LOW RECOVERY)</Text>
                <Text style={styles.correlationSub}>{recoveryCorrelation.lowRecoveryCount} sessions</Text>
              </View>
            </View>
            {recoveryCorrelation.hasEnoughData && (
              <View style={styles.correlationDelta}>
                <Feather
                  name={recoveryCorrelation.percentageDifference >= 0 ? "trending-up" : "trending-down"}
                  size={14}
                  color={recoveryCorrelation.percentageDifference >= 0 ? Colors.highlight : Colors.orange}
                />
                <Text style={[
                  styles.correlationDeltaText,
                  { color: recoveryCorrelation.percentageDifference >= 0 ? Colors.highlight : Colors.orange }
                ]}>
                  {recoveryCorrelation.percentageDifference >= 0 ? "+" : ""}{recoveryCorrelation.percentageDifference}% volume on high-recovery days
                </Text>
              </View>
            )}
            {!recoveryCorrelation.hasEnoughData && (
              <Text style={styles.alertSectionDesc}>
                Need at least 5 sessions in each recovery group for accurate correlation. Keep logging!
              </Text>
            )}
          </AccordionCard>
        )}

        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <View style={styles.insightIconWrap}>
              <Feather name="zap" size={16} color={Colors.highlight} />
            </View>
            <Text style={styles.insightTitle}>AI PERFORMANCE ANALYSIS</Text>
          </View>
          {aiInsightLoading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <ActivityIndicator size="small" color={Colors.highlight} />
              <Text style={[styles.insightText, { color: Colors.textMuted }]}>Generating your personalized insight...</Text>
            </View>
          ) : aiInsight?.insight ? (
            <Text style={styles.insightText}>{aiInsight.insight}</Text>
          ) : (
            <Text style={styles.insightText}>Log more workouts to unlock your personalized AI performance analysis.</Text>
          )}
          {hasEnoughData && (
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
      </ScrollView>

      <InsightInfoModal
        visible={freqInfoOpen}
        onClose={() => setFreqInfoOpen(false)}
        insight={{
          title: "Weekly Frequency Alignment",
          what: "This shows how many workouts you've logged this week compared to your target weekly frequency. The recommendation adapts based on today's readiness score from your check-in.",
          why: "Consistently hitting your frequency goal is the primary driver of long-term progress. Too few sessions means lost stimulus; too many without recovery means overtraining and elevated injury risk.",
          how: "Set your target frequency in Profile and do your daily check-in every morning. The app will tell you when your recovery supports adding a session or when it's smarter to rest.",
        }}
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
  alertsContainer: { gap: 8 },
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
  chartFooter: { flexDirection: "row", gap: 16, alignItems: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSubtle },
  muscleList: { gap: 12 },
  muscleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  muscleName: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textMuted, width: 72 },
  muscleBarTrack: { flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden" },
  muscleBarFill: { height: "100%", borderRadius: 6 },
  muscleSessions: { fontSize: 11, fontFamily: "Inter_900Black", width: 30, textAlign: "right" },
  alertSection: { gap: 6 },
  alertSectionTitle: {
    fontSize: 8,
    fontFamily: "Inter_900Black",
    color: Colors.orange,
    letterSpacing: 2,
  },
  alertSectionDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    lineHeight: 18,
  },
  alertDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  alertDetailText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    flex: 1,
  },
  correlationGrid: {
    flexDirection: "row",
    gap: 10,
  },
  correlationItem: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  correlationValue: {
    fontSize: 20,
    fontFamily: "Inter_900Black",
    fontStyle: "italic",
  },
  correlationLabel: {
    fontSize: 7,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 1,
    textAlign: "center",
  },
  correlationSub: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  correlationDelta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(246,234,152,0.06)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.15)",
  },
  correlationDeltaText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
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

const freqStyles = StyleSheet.create({
  alignRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  alignNumbers: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  sessionCount: { fontSize: 36, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic" },
  sessionGoal: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  alignBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
  badgeGreen: { backgroundColor: "rgba(246,234,152,0.12)", borderColor: "rgba(246,234,152,0.35)" },
  badgeGreenText: { color: Colors.highlight },
  badgeYellow: { backgroundColor: "rgba(74,222,128,0.1)", borderColor: "rgba(74,222,128,0.3)" },
  badgeYellowText: { color: Colors.recovery },
  badgeOrange: { backgroundColor: "rgba(252,82,0,0.1)", borderColor: "rgba(252,82,0,0.3)" },
  badgeOrangeText: { color: Colors.orange },
  alignBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1.5 },
  progressTrack: { height: 5, backgroundColor: Colors.border, borderRadius: 10, overflow: "hidden", marginTop: 12 },
  progressFill: { height: "100%", borderRadius: 10 },
  recommendRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14 },
  recommendText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  noCheckInHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSubtle, marginTop: 12, lineHeight: 18 },
});
