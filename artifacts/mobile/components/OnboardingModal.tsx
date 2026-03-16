import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";

const GOALS = [
  { id: "muscle_gain", label: "Build Muscle", emoji: "💪", desc: "Hypertrophy-focused training" },
  { id: "fat_loss", label: "Lose Fat", emoji: "🔥", desc: "Cut body fat while preserving muscle" },
  { id: "strength", label: "Get Stronger", emoji: "🏋️", desc: "Increase max lifts & power" },
  { id: "endurance", label: "Endurance", emoji: "🏃", desc: "Improve cardio & stamina" },
  { id: "general", label: "General Fitness", emoji: "⚡", desc: "Overall health & wellness" },
];

const SKILL_LEVELS = [
  { id: "beginner", label: "Beginner", emoji: "🌱", desc: "< 6 months training" },
  { id: "intermediate", label: "Intermediate", emoji: "🌿", desc: "6 months – 2 years" },
  { id: "advanced", label: "Advanced", emoji: "🌳", desc: "2+ years consistent training" },
];

const EQUIPMENT_OPTIONS = [
  "Barbell", "Dumbbells", "Kettlebells", "Pull-up Bar",
  "Resistance Bands", "Cable Machine", "Smith Machine",
  "Bench", "Squat Rack", "Leg Press", "Treadmill",
  "Rowing Machine", "Battle Ropes", "TRX", "None",
];

interface Props {
  visible: boolean;
  onComplete: (data: {
    fitnessGoal: string;
    skillLevel: string;
    equipment: string[];
    injuries: string[];
  }) => void;
}

export function OnboardingModal({ visible, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [skill, setSkill] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [injuries, setInjuries] = useState<string[]>([]);
  const [injuryInput, setInjuryInput] = useState("");

  const totalSteps = 4;

  const toggleEquipment = (item: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item === "None") {
      setEquipment([]);
      return;
    }
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  };

  const addInjury = () => {
    const trimmed = injuryInput.trim();
    if (trimmed && !injuries.includes(trimmed)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setInjuries((prev) => [...prev, trimmed]);
      setInjuryInput("");
    }
  };

  const removeInjury = (item: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInjuries((prev) => prev.filter((i) => i !== item));
  };

  const canProceed = () => {
    if (step === 0) return !!goal;
    if (step === 1) return !!skill;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete({ fitnessGoal: goal, skillLevel: skill, equipment, injuries });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <View style={styles.progressRow}>
            <Text style={styles.overline}>PROFILE SETUP</Text>
            <Text style={styles.stepCount}>{step + 1} / {totalSteps}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((step + 1) / totalSteps) * 100}%` as any }]} />
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {step === 0 && (
              <View style={styles.stepContent}>
                <Text style={styles.questionText}>What's your{"\n"}primary goal?</Text>
                <View style={styles.optionList}>
                  {GOALS.map((g) => {
                    const selected = goal === g.id;
                    return (
                      <Pressable
                        key={g.id}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setGoal(g.id); }}
                        style={[styles.optionRow, selected && styles.optionRowSelected]}
                      >
                        <Text style={styles.optionEmoji}>{g.emoji}</Text>
                        <View style={styles.optionInfo}>
                          <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{g.label}</Text>
                          <Text style={styles.optionDesc}>{g.desc}</Text>
                        </View>
                        {selected && <Feather name="check-circle" size={18} color={Colors.highlight} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {step === 1 && (
              <View style={styles.stepContent}>
                <Text style={styles.questionText}>Your experience{"\n"}level?</Text>
                <View style={styles.optionList}>
                  {SKILL_LEVELS.map((s) => {
                    const selected = skill === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSkill(s.id); }}
                        style={[styles.optionRow, selected && styles.optionRowSelected]}
                      >
                        <Text style={styles.optionEmoji}>{s.emoji}</Text>
                        <View style={styles.optionInfo}>
                          <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{s.label}</Text>
                          <Text style={styles.optionDesc}>{s.desc}</Text>
                        </View>
                        {selected && <Feather name="check-circle" size={18} color={Colors.highlight} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={styles.stepContent}>
                <Text style={styles.questionText}>Available{"\n"}equipment?</Text>
                <View style={styles.chipGrid}>
                  {EQUIPMENT_OPTIONS.map((item) => {
                    const selected = equipment.includes(item);
                    return (
                      <Pressable
                        key={item}
                        onPress={() => toggleEquipment(item)}
                        style={[styles.equipChip, selected && styles.equipChipSelected]}
                      >
                        <Text style={[styles.equipChipText, selected && styles.equipChipTextSelected]}>{item}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {step === 3 && (
              <View style={styles.stepContent}>
                <Text style={styles.questionText}>Any injuries or{"\n"}limitations?</Text>
                <Text style={styles.hintText}>Add any current injuries, chronic pain, or limitations so we can avoid aggravating them.</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Lower back pain"
                    placeholderTextColor={Colors.textSubtle}
                    value={injuryInput}
                    onChangeText={setInjuryInput}
                    onSubmitEditing={addInjury}
                    returnKeyType="done"
                  />
                  <Pressable onPress={addInjury} style={styles.addBtn}>
                    <Feather name="plus" size={18} color={Colors.highlight} />
                  </Pressable>
                </View>
                {injuries.length > 0 && (
                  <View style={styles.tagList}>
                    {injuries.map((injury) => (
                      <View key={injury} style={styles.tag}>
                        <Text style={styles.tagText}>{injury}</Text>
                        <Pressable onPress={() => removeInjury(injury)}>
                          <Feather name="x" size={12} color={Colors.textMuted} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                {injuries.length === 0 && (
                  <Pressable
                    onPress={handleNext}
                    style={styles.skipLink}
                  >
                    <Text style={styles.skipText}>No injuries — skip this step</Text>
                  </Pressable>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {step > 0 && (
              <Pressable onPress={() => { Haptics.selectionAsync(); setStep(step - 1); }} style={styles.backBtn}>
                <Feather name="arrow-left" size={14} color={Colors.textSubtle} />
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleNext}
              style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
              disabled={!canProceed()}
            >
              <Text style={styles.nextBtnText}>
                {step === totalSteps - 1 ? "COMPLETE SETUP" : "CONTINUE"}
              </Text>
              <Feather name={step === totalSteps - 1 ? "check" : "arrow-right"} size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxHeight: "90%",
    backgroundColor: "#242422",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  overline: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  stepCount: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.highlight,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#333",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 24,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.highlight,
    borderRadius: 4,
  },
  scrollArea: {
    maxHeight: 420,
  },
  stepContent: {
    gap: 16,
    paddingBottom: 16,
  },
  questionText: {
    fontSize: 24,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    lineHeight: 28,
  },
  hintText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 20,
  },
  optionList: { gap: 8 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  optionRowSelected: {
    borderColor: "rgba(246,234,152,0.4)",
    backgroundColor: "rgba(246,234,152,0.06)",
  },
  optionEmoji: { fontSize: 24 },
  optionInfo: { flex: 1 },
  optionLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  optionLabelSelected: { color: Colors.highlight },
  optionDesc: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    marginTop: 2,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  equipChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  equipChipSelected: {
    borderColor: Colors.highlight,
    backgroundColor: "rgba(246,234,152,0.1)",
  },
  equipChipText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  equipChipTextSelected: {
    color: Colors.highlight,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.highlight,
    backgroundColor: "rgba(246,234,152,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  tagList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: "rgba(252,82,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(252,82,0,0.3)",
  },
  tagText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.orange,
  },
  skipLink: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    textDecorationLine: "underline",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
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
  nextBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
  },
  nextBtnDisabled: {
    backgroundColor: "#3A3A38",
  },
  nextBtnText: {
    fontSize: 12,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
});
