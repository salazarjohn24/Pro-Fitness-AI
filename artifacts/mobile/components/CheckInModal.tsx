import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";
import { BodyMap } from "@/components/BodyMap";

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

type Step = "questions" | "bodymap" | "notes" | "done";

export interface CheckInData {
  energyLevel: number;
  sleepQuality: number;
  stressLevel: number;
  sorenessScore: number;
  soreMuscleGroups: { muscle: string; severity: number }[];
  notes: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onComplete: (data: CheckInData) => void;
  initialData?: CheckInData | null;
  isSubmitting?: boolean;
}

export function CheckInModal({ visible, onClose, onComplete, initialData, isSubmitting }: Props) {
  const [questionStep, setQuestionStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<Step>("questions");
  const [soreMuscles, setSoreMuscles] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [initialized, setInitialized] = useState(false);

  React.useEffect(() => {
    if (visible && initialData && !initialized) {
      setAnswers({
        energy: initialData.energyLevel,
        sleep: initialData.sleepQuality,
        soreness: initialData.sorenessScore,
        stress: initialData.stressLevel,
      });
      setSoreMuscles((initialData.soreMuscleGroups ?? []).map(s => s.muscle));
      setNotes(initialData.notes ?? "");
      setInitialized(true);
    }
    if (!visible) {
      setInitialized(false);
    }
  }, [visible, initialData, initialized]);

  const q = QUESTIONS[questionStep];
  const totalQuestions = QUESTIONS.length;
  const totalSteps = totalQuestions + 2;
  const currentOverallStep = phase === "questions" ? questionStep + 1 : phase === "bodymap" ? totalQuestions + 1 : phase === "notes" ? totalQuestions + 2 : totalSteps;

  const handleAnswer = (val: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newAnswers = { ...answers, [q.id]: val };
    setAnswers(newAnswers);

    if (questionStep < totalQuestions - 1) {
      setTimeout(() => setQuestionStep(questionStep + 1), 180);
    } else {
      setTimeout(() => setPhase("bodymap"), 180);
    }
  };

  const toggleMuscle = (id: string) => {
    setSoreMuscles((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const resetWizard = () => {
    setQuestionStep(0);
    setAnswers({});
    setPhase("questions");
    setSoreMuscles([]);
    setNotes("");
  };

  React.useEffect(() => {
    if (!visible) {
      const timer = setTimeout(resetWizard, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const sorenessVal = answers["soreness"] ?? 3;
    const severity = sorenessVal === 1 ? 9 : sorenessVal === 2 ? 7 : sorenessVal === 3 ? 5 : sorenessVal === 4 ? 3 : 1;
    const soreMuscleGroups = soreMuscles.map(muscle => ({ muscle, severity }));

    onComplete({
      energyLevel: answers["energy"] ?? 3,
      sleepQuality: answers["sleep"] ?? 3,
      stressLevel: answers["stress"] ?? 3,
      sorenessScore: answers["soreness"] ?? 3,
      soreMuscleGroups,
      notes,
    });
  };

  const handleClose = () => {
    if (isSubmitting) return;
    const hasProgress =
      Object.keys(answers).length > 0 ||
      soreMuscles.length > 0 ||
      notes.length > 0 ||
      phase !== "questions" ||
      questionStep > 0;
    if (hasProgress) {
      Alert.alert(
        "Discard Check-In?",
        "You'll lose your progress and need to start over.",
        [
          { text: "Keep Going", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: onClose },
        ]
      );
      return;
    }
    onClose();
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    if (phase === "notes") {
      setPhase("bodymap");
    } else if (phase === "bodymap") {
      setPhase("questions");
      setQuestionStep(totalQuestions - 1);
    } else if (questionStep > 0) {
      setQuestionStep(questionStep - 1);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={styles.backdropTouch} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {phase === "done" ? null : (
            <>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>INTELLIGENCE CHECK-IN</Text>
                <Text style={styles.progressCount}>{currentOverallStep} / {totalSteps}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${(currentOverallStep / totalSteps) * 100}%` as any }]} />
              </View>
            </>
          )}

          {phase === "questions" && (
            <>
              <View style={styles.questionBlock}>
                <View style={[styles.questionIcon, { backgroundColor: q.color + "20" }]}>
                  <Feather name={q.icon as any} size={24} color={q.color} />
                </View>
                <Text style={styles.questionLabel}>{q.label.toUpperCase()}</Text>
                <Text style={styles.questionText}>{q.question}</Text>
              </View>

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

              {questionStep > 0 && (
                <Pressable onPress={handleBack} style={styles.backBtn}>
                  <Feather name="arrow-left" size={14} color={Colors.textSubtle} />
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
              )}
            </>
          )}

          {phase === "bodymap" && (
            <>
              <View style={styles.questionBlock}>
                <View style={[styles.questionIcon, { backgroundColor: Colors.orange + "20" }]}>
                  <Feather name="user" size={24} color={Colors.orange} />
                </View>
                <Text style={styles.questionLabel}>SORE AREAS</Text>
                <Text style={styles.questionText}>Tap sore muscles</Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                <BodyMap selected={soreMuscles} onToggle={toggleMuscle} />
              </ScrollView>

              <View style={styles.bodyMapFooter}>
                <Pressable onPress={handleBack} style={styles.backBtn}>
                  <Feather name="arrow-left" size={14} color={Colors.textSubtle} />
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPhase("notes"); }}
                  style={styles.continueBtn}
                >
                  <Text style={styles.continueBtnText}>{soreMuscles.length === 0 ? "SKIP" : "CONTINUE"}</Text>
                  <Feather name="arrow-right" size={14} color="#fff" />
                </Pressable>
              </View>
            </>
          )}

          {phase === "notes" && (
            <>
              <View style={styles.questionBlock}>
                <View style={[styles.questionIcon, { backgroundColor: "#A78BFA20" }]}>
                  <Feather name="edit-3" size={24} color="#A78BFA" />
                </View>
                <Text style={styles.questionLabel}>NOTES</Text>
                <Text style={styles.questionText}>Anything else?</Text>
              </View>

              <TextInput
                style={styles.notesInput}
                placeholder="Optional: How are you feeling? Any context for today..."
                placeholderTextColor={Colors.textSubtle}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.bodyMapFooter}>
                <Pressable onPress={handleBack} style={styles.backBtn}>
                  <Feather name="arrow-left" size={14} color={Colors.textSubtle} />
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
                <Pressable onPress={handleFinish} style={[styles.continueBtn, isSubmitting && { opacity: 0.6 }]} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Feather name="check" size={14} color="#fff" />
                  )}
                  <Text style={styles.continueBtnText}>{isSubmitting ? "SAVING..." : "COMPLETE"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
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
  },
  backBtnText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  bodyMapFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  continueBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  continueBtnText: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  notesInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    minHeight: 100,
    marginBottom: 8,
  },
});
