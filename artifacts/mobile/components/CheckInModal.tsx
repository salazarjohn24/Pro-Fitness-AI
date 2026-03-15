import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
} from "react-native";
import { Colors } from "@/constants/colors";

const QUESTIONS = [
  {
    id: "energy",
    label: "Energy Level",
    question: "How is your energy today?",
    icon: "zap",
    color: Colors.highlight,
    options: [
      { value: 1, label: "Drained", emoji: "😴" },
      { value: 2, label: "Low", emoji: "😑" },
      { value: 3, label: "Moderate", emoji: "😐" },
      { value: 4, label: "Good", emoji: "😊" },
      { value: 5, label: "Energized", emoji: "⚡" },
    ],
  },
  {
    id: "sleep",
    label: "Sleep Quality",
    question: "How did you sleep?",
    icon: "moon",
    color: Colors.recovery,
    options: [
      { value: 1, label: "Terrible", emoji: "😫" },
      { value: 2, label: "Poor", emoji: "😪" },
      { value: 3, label: "Fair", emoji: "😐" },
      { value: 4, label: "Good", emoji: "😴" },
      { value: 5, label: "Great", emoji: "🌟" },
    ],
  },
  {
    id: "soreness",
    label: "Muscle Soreness",
    question: "Any muscle soreness?",
    icon: "activity",
    color: Colors.orange,
    options: [
      { value: 1, label: "Severe", emoji: "🔥" },
      { value: 2, label: "High", emoji: "😣" },
      { value: 3, label: "Moderate", emoji: "😤" },
      { value: 4, label: "Mild", emoji: "🙂" },
      { value: 5, label: "None", emoji: "✅" },
    ],
  },
  {
    id: "stress",
    label: "Stress Level",
    question: "How is your stress today?",
    icon: "cpu",
    color: "#A78BFA",
    options: [
      { value: 1, label: "Maxed", emoji: "😰" },
      { value: 2, label: "High", emoji: "😟" },
      { value: 3, label: "Moderate", emoji: "😐" },
      { value: 4, label: "Low", emoji: "😌" },
      { value: 5, label: "Zen", emoji: "🧘" },
    ],
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function CheckInModal({ visible, onClose, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);

  const q = QUESTIONS[step];
  const total = QUESTIONS.length;
  const pct = ((step) / total) * 100;

  const handleAnswer = (val: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newAnswers = { ...answers, [q.id]: val };
    setAnswers(newAnswers);

    if (step < total - 1) {
      setTimeout(() => setStep(step + 1), 180);
    } else {
      setTimeout(() => {
        setDone(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 180);
    }
  };

  const handleFinish = () => {
    onComplete();
    setTimeout(() => {
      setStep(0);
      setAnswers({});
      setDone(false);
    }, 300);
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep(0);
      setAnswers({});
      setDone(false);
    }, 300);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={handleClose} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {!done ? (
            <>
              {/* Progress */}
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>INTELLIGENCE CHECK-IN</Text>
                <Text style={styles.progressCount}>{step + 1} / {total}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${((step + 1) / total) * 100}%` as any }]} />
              </View>

              {/* Question */}
              <View style={styles.questionBlock}>
                <View style={[styles.questionIcon, { backgroundColor: q.color + "20" }]}>
                  <Feather name={q.icon as any} size={24} color={q.color} />
                </View>
                <Text style={styles.questionLabel}>{q.label.toUpperCase()}</Text>
                <Text style={styles.questionText}>{q.question}</Text>
              </View>

              {/* Options */}
              <View style={styles.optionGrid}>
                {q.options.map((opt) => {
                  const selected = answers[q.id] === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => handleAnswer(opt.value)}
                      style={({ pressed }) => [
                        styles.option,
                        selected && { borderColor: q.color, backgroundColor: q.color + "15" },
                        pressed && { transform: [{ scale: 0.96 }] },
                      ]}
                    >
                      <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                      <Text style={[styles.optionLabel, selected && { color: q.color }]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Back button */}
              {step > 0 && (
                <Pressable onPress={() => { Haptics.selectionAsync(); setStep(step - 1); }} style={styles.backBtn}>
                  <Feather name="arrow-left" size={14} color={Colors.textSubtle} />
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
              )}
            </>
          ) : (
            <View style={styles.doneBlock}>
              <View style={styles.doneIcon}>
                <Feather name="check" size={32} color={Colors.highlight} />
              </View>
              <Text style={styles.doneTitle}>CALIBRATION{"\n"}COMPLETE</Text>
              <Text style={styles.doneDesc}>
                Your AI protocol has been updated based on today's biometrics. Optimal training load calculated.
              </Text>

              <View style={styles.summaryRow}>
                {QUESTIONS.map((q) => {
                  const val = answers[q.id] ?? 0;
                  return (
                    <View key={q.id} style={styles.summaryCard}>
                      <Feather name={q.icon as any} size={14} color={q.color} />
                      <Text style={[styles.summaryVal, { color: q.color }]}>{val}/5</Text>
                      <Text style={styles.summaryKey}>{q.label.split(" ")[0].toUpperCase()}</Text>
                    </View>
                  );
                })}
              </View>

              <Pressable
                style={({ pressed }) => [styles.finishBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                onPress={handleFinish}
              >
                <Feather name="zap" size={16} color="#fff" />
                <Text style={styles.finishBtnText}>UNLOCK TODAY'S PROTOCOL</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: "#242422",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#444",
    alignSelf: "center",
    marginBottom: 24,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  progressCount: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.highlight,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#333",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 28,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.highlight,
    borderRadius: 4,
  },
  questionBlock: { alignItems: "center", gap: 10, marginBottom: 28 },
  questionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  questionLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  questionText: {
    fontSize: 22,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textAlign: "center",
    textTransform: "uppercase",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  option: {
    width: "18%",
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  optionEmoji: { fontSize: 20 },
  optionLabel: {
    fontSize: 7,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    marginTop: 20,
  },
  backBtnText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  doneBlock: { alignItems: "center", gap: 16 },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "rgba(246,234,152,0.12)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  doneTitle: {
    fontSize: 30,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 34,
  },
  doneDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 4,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 12,
    gap: 4,
  },
  summaryVal: {
    fontSize: 16,
    fontFamily: "Inter_900Black",
    fontStyle: "italic",
  },
  summaryKey: {
    fontSize: 7,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 1,
  },
  finishBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    marginTop: 4,
  },
  finishBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
});
