import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";
import { useRebalancePlan } from "@/hooks/useAuditAlerts";

const TAG_COLORS: Record<string, string> = {
  Push: Colors.orange,
  Pull: Colors.recovery,
  Compound: Colors.highlight,
  Recovery: "#779CAF",
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function RebalancePlanModal({ visible, onClose }: Props) {
  const { data: plan, isLoading, isError } = useRebalancePlan(visible);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const titleParts = (plan?.titleSubtext ?? "").split("/");
  const titleMain = titleParts[0]?.trim() ?? "Rebalance";
  const titleAccent = titleParts.slice(1).join("/").trim();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <Feather name="refresh-cw" size={18} color={Colors.highlight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.overline}>AI REBALANCE PLAN</Text>
              <Text style={styles.title}>
                {titleMain}
                {titleAccent ? (
                  <Text style={styles.titleAccent}>{"\n"}{titleAccent}</Text>
                ) : null}
              </Text>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="large" color={Colors.highlight} />
              <Text style={styles.loadingText}>Analyzing your muscle data...</Text>
              <Text style={styles.loadingSubtext}>Generating a personalized plan</Text>
            </View>
          ) : isError ? (
            <View style={styles.loadingBlock}>
              <Feather name="alert-circle" size={32} color={Colors.orange} />
              <Text style={styles.loadingText}>Couldn't generate plan</Text>
              <Text style={styles.loadingSubtext}>Check your connection and try again.</Text>
            </View>
          ) : (
            <>
              {plan?.insightBanner ? (
                <View style={styles.insightBanner}>
                  <Feather name="alert-circle" size={13} color={Colors.highlight} />
                  <Text style={styles.insightBannerText}>{plan.insightBanner}</Text>
                </View>
              ) : null}

              <ScrollView style={styles.planScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.planList}>
                  {(plan?.days ?? []).map((day, i) => {
                    const tagColor = TAG_COLORS[day.tag] ?? Colors.highlight;
                    return (
                      <View key={i} style={styles.dayCard}>
                        <View style={styles.dayLabel}>
                          <Text style={styles.dayText}>{day.day}</Text>
                        </View>
                        <View style={styles.dayContent}>
                          <View style={styles.dayTop}>
                            <Text style={styles.dayName}>{day.name}</Text>
                            <View style={[styles.tag, { borderColor: tagColor + "40", backgroundColor: tagColor + "15" }]}>
                              <Text style={[styles.tagText, { color: tagColor }]}>{day.tag}</Text>
                            </View>
                          </View>
                          <View style={styles.exerciseList}>
                            {day.exercises.map((ex, j) => (
                              <Text key={j} style={styles.exercise}>· {ex}</Text>
                            ))}
                          </View>
                          {day.reason ? (
                            <View style={styles.reasonRow}>
                              <Feather name="star" size={10} color={Colors.highlight} />
                              <Text style={styles.reasonText}>{day.reason}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              <Pressable
                style={({ pressed }) => [styles.doneBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                onPress={handleClose}
              >
                <Feather name="check" size={16} color="#fff" />
                <Text style={styles.doneBtnText}>GOT IT</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: "#242422",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderColor: Colors.border,
    gap: 16,
    maxHeight: "85%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#444",
    alignSelf: "center",
  },
  headerRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(246,234,152,0.1)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  overline: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 2, marginBottom: 3 },
  title: { fontSize: 24, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic", textTransform: "uppercase", lineHeight: 28 },
  titleAccent: { color: Colors.orange },
  insightBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(246,234,152,0.07)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.2)",
    borderRadius: 12,
    padding: 12,
  },
  insightBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 18,
  },
  loadingBlock: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  loadingSubtext: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  planScroll: { maxHeight: 340 },
  planList: { gap: 10 },
  dayCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  dayLabel: {
    width: 36,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 2,
  },
  dayText: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 1,
  },
  dayContent: { flex: 1, gap: 6 },
  dayTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayName: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text, flex: 1 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
  },
  tagText: { fontSize: 8, fontFamily: "Inter_900Black", letterSpacing: 1 },
  exerciseList: { gap: 2 },
  exercise: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  reasonText: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textSubtle, fontStyle: "italic" },
  doneBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  doneBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
});
