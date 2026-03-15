import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";

const REBALANCE_PLAN = [
  {
    day: "MON",
    name: "Chest Power Day",
    exercises: ["Bench Press 5×5", "Incline DB Press 4×8", "Cable Fly 3×12"],
    tag: "Push",
    tagColor: Colors.orange,
    reason: "Closes the 2-session gap vs. back volume",
  },
  {
    day: "TUE",
    name: "Back & Rear Delt",
    exercises: ["Weighted Pull-Up 4×6", "Barbell Row 4×8", "Face Pull 3×15"],
    tag: "Pull",
    tagColor: Colors.recovery,
    reason: "Maintain current back strength",
  },
  {
    day: "THU",
    name: "Chest & Shoulder Volume",
    exercises: ["DB Shoulder Press 4×10", "Lateral Raise 4×15", "Push-Up Burnout 3×F"],
    tag: "Push",
    tagColor: Colors.orange,
    reason: "Additional push session to rebalance",
  },
  {
    day: "FRI",
    name: "Legs & Core",
    exercises: ["Squat 4×6", "Romanian Deadlift 3×10", "Plank 3×60s"],
    tag: "Compound",
    tagColor: Colors.highlight,
    reason: "Maintain lower body stimulus",
  },
  {
    day: "SAT",
    name: "Active Recovery",
    exercises: ["Hip Flexor Stretch 3×60s", "Thoracic Rotation 3×10", "Foam Roll 10 min"],
    tag: "Recovery",
    tagColor: "#779CAF",
    reason: "Reduce soreness, improve mobility",
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function RebalancePlanModal({ visible, onClose }: Props) {
  const [adopted, setAdopted] = useState(false);

  const handleAdopt = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAdopted(true);
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => setAdopted(false), 400);
  };

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
              <Text style={styles.title}>Push/Pull{"\n"}<Text style={styles.titleAccent}>Correction</Text></Text>
            </View>
          </View>

          <View style={styles.insightBanner}>
            <Feather name="alert-circle" size={13} color={Colors.highlight} />
            <Text style={styles.insightBannerText}>
              Your back volume leads chest by 2 sessions this month, risking postural imbalances.
            </Text>
          </View>

          {!adopted ? (
            <>
              <ScrollView style={styles.planScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.planList}>
                  {REBALANCE_PLAN.map((day, i) => (
                    <View key={i} style={styles.dayCard}>
                      <View style={styles.dayLabel}>
                        <Text style={styles.dayText}>{day.day}</Text>
                      </View>
                      <View style={styles.dayContent}>
                        <View style={styles.dayTop}>
                          <Text style={styles.dayName}>{day.name}</Text>
                          <View style={[styles.tag, { borderColor: day.tagColor + "40", backgroundColor: day.tagColor + "15" }]}>
                            <Text style={[styles.tagText, { color: day.tagColor }]}>{day.tag}</Text>
                          </View>
                        </View>
                        <View style={styles.exerciseList}>
                          {day.exercises.map((ex, j) => (
                            <Text key={j} style={styles.exercise}>· {ex}</Text>
                          ))}
                        </View>
                        <View style={styles.reasonRow}>
                          <Feather name="star" size={10} color={Colors.highlight} />
                          <Text style={styles.reasonText}>{day.reason}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>

              <Pressable
                style={({ pressed }) => [styles.adoptBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                onPress={handleAdopt}
              >
                <Feather name="check-circle" size={16} color="#fff" />
                <Text style={styles.adoptBtnText}>ADOPT REBALANCE PLAN</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.adoptedBlock}>
              <View style={styles.adoptedIcon}>
                <Feather name="check" size={32} color={Colors.highlight} />
              </View>
              <Text style={styles.adoptedTitle}>PLAN ADOPTED</Text>
              <Text style={styles.adoptedDesc}>
                Your weekly schedule has been updated. The AI will monitor your volume balance going forward.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.adoptBtn, { opacity: pressed ? 0.9 : 1 }]}
                onPress={handleClose}
              >
                <Text style={styles.adoptBtnText}>DONE</Text>
              </Pressable>
            </View>
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
  adoptBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  adoptBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  adoptedBlock: { alignItems: "center", gap: 16, paddingVertical: 20 },
  adoptedIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "rgba(246,234,152,0.1)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  adoptedTitle: {
    fontSize: 28,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
  },
  adoptedDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});
