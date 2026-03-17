import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useRef } from "react";

type FeatherIcon = ComponentProps<typeof Feather>["name"];
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useUpdateProfile } from "@/hooks/useProfile";

const STEPS = ["Biometrics", "Experience", "Injuries", "Goal", "Review"];

const GENDERS: { label: string; icon: FeatherIcon }[] = [
  { label: "Male", icon: "user" },
  { label: "Female", icon: "user" },
  { label: "Other", icon: "users" },
];

const EXPERIENCE_LEVELS: { label: string; desc: string; icon: FeatherIcon }[] = [
  { label: "Beginner", desc: "New to training or less than 6 months experience", icon: "star" },
  { label: "Intermediate", desc: "1-3 years of consistent training", icon: "trending-up" },
  { label: "Advanced", desc: "3+ years with strong technique foundations", icon: "award" },
];

const BODY_PARTS = [
  "Neck", "Shoulders", "Upper Back", "Lower Back",
  "Chest", "Elbows", "Wrists", "Hips",
  "Knees", "Ankles", "Feet",
];

const GOALS: { label: string; desc: string; icon: FeatherIcon }[] = [
  { label: "Muscle Growth", desc: "Build lean muscle mass and size", icon: "zap" },
  { label: "Fat Loss", desc: "Reduce body fat while maintaining muscle", icon: "trending-down" },
  { label: "Strength", desc: "Maximize raw strength and power output", icon: "shield" },
  { label: "Flexibility · Longevity", desc: "Improve mobility and long-term health", icon: "heart" },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { mutateAsync: updateProfile, isPending } = useUpdateProfile();
  const progressAnim = useRef(new Animated.Value(0.2)).current;

  const [step, setStep] = useState(0);
  const [unitSystem, setUnitSystem] = useState<"imperial" | "metric">("imperial");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [gender, setGender] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [injuries, setInjuries] = useState<string[]>([]);
  const [injuryNotes, setInjuryNotes] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const animateProgress = (toStep: number) => {
    Animated.spring(progressAnim, {
      toValue: (toStep + 1) / STEPS.length,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  };

  const goNext = () => {
    if (step < STEPS.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const next = step + 1;
      setStep(next);
      animateProgress(next);
    }
  };

  const goBack = () => {
    if (step > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const prev = step - 1;
      setStep(prev);
      animateProgress(prev);
    }
  };

  const toggleInjury = (part: string) => {
    Haptics.selectionAsync();
    setInjuries((prev) =>
      prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]
    );
  };

  const computedHeight = (): number | null => {
    if (unitSystem === "imperial") {
      const ft = parseInt(heightFt) || 0;
      const inches = parseInt(heightIn) || 0;
      const total = ft * 12 + inches;
      return total > 0 ? total : null;
    }
    return heightCm ? parseInt(heightCm) : null;
  };

  const handleConfirm = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateProfile({
      age: age ? parseInt(age) : null,
      weight: weight ? parseInt(weight) : null,
      height: computedHeight(),
      gender: gender || null,
      experienceLevel: experienceLevel || null,
      injuries,
      injuryNotes: injuryNotes || null,
      primaryGoal: primaryGoal || null,
      unitSystem,
      onboardingCompleted: true,
    });
    router.replace("/gym-setup");
  };

  const canProceed = () => {
    switch (step) {
      case 0: {
        const heightOk = unitSystem === "imperial" ? heightFt !== "" : heightCm !== "";
        return age !== "" && weight !== "" && heightOk && gender !== "";
      }
      case 1: return experienceLevel !== "";
      case 2: return true;
      case 3: return primaryGoal !== "";
      case 4: return true;
      default: return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>YOUR BIOMETRICS</Text>
            <Text style={styles.stepSubtitle}>Help us personalize your training</Text>

            <View style={styles.unitToggleRow}>
              <Pressable
                style={[styles.unitToggleBtn, unitSystem === "imperial" && styles.unitToggleBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setUnitSystem("imperial"); }}
              >
                <Text style={[styles.unitToggleText, unitSystem === "imperial" && styles.unitToggleTextActive]}>
                  IMPERIAL
                </Text>
                <Text style={[styles.unitToggleSub, unitSystem === "imperial" && styles.unitToggleSubActive]}>
                  lb · ft / in
                </Text>
              </Pressable>
              <Pressable
                style={[styles.unitToggleBtn, unitSystem === "metric" && styles.unitToggleBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setUnitSystem("metric"); }}
              >
                <Text style={[styles.unitToggleText, unitSystem === "metric" && styles.unitToggleTextActive]}>
                  METRIC
                </Text>
                <Text style={[styles.unitToggleSub, unitSystem === "metric" && styles.unitToggleSubActive]}>
                  kg · cm
                </Text>
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AGE</Text>
              <TextInput
                style={styles.textInput}
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
                placeholder="25"
                placeholderTextColor={Colors.textSubtle}
                maxLength={3}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>WEIGHT ({unitSystem === "imperial" ? "LBS" : "KG"})</Text>
                <TextInput
                  style={styles.textInput}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  placeholder={unitSystem === "imperial" ? "175" : "80"}
                  placeholderTextColor={Colors.textSubtle}
                  maxLength={4}
                />
              </View>

              {unitSystem === "imperial" ? (
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>HEIGHT</Text>
                  <View style={styles.inputRow}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={[styles.textInput, { textAlign: "center" }]}
                        value={heightFt}
                        onChangeText={setHeightFt}
                        keyboardType="numeric"
                        placeholder="5 ft"
                        placeholderTextColor={Colors.textSubtle}
                        maxLength={1}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={[styles.textInput, { textAlign: "center" }]}
                        value={heightIn}
                        onChangeText={(v) => {
                          const n = parseInt(v);
                          if (!v || (n >= 0 && n <= 11)) setHeightIn(v);
                        }}
                        keyboardType="numeric"
                        placeholder="10 in"
                        placeholderTextColor={Colors.textSubtle}
                        maxLength={2}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>HEIGHT (CM)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={heightCm}
                    onChangeText={setHeightCm}
                    keyboardType="numeric"
                    placeholder="178"
                    placeholderTextColor={Colors.textSubtle}
                    maxLength={3}
                  />
                </View>
              )}
            </View>

            <Text style={styles.inputLabel}>GENDER</Text>
            <View style={styles.cardRow}>
              {GENDERS.map((g) => (
                <Pressable
                  key={g.label}
                  style={[styles.selectCard, gender === g.label && styles.selectCardActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setGender(g.label);
                  }}
                >
                  <Feather name={g.icon} size={20} color={gender === g.label ? Colors.orange : Colors.textMuted} />
                  <Text style={[styles.selectCardText, gender === g.label && styles.selectCardTextActive]}>
                    {g.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>EXPERIENCE LEVEL</Text>
            <Text style={styles.stepSubtitle}>We'll tailor intensity and volume accordingly</Text>
            <View style={styles.cardColumn}>
              {EXPERIENCE_LEVELS.map((lvl) => (
                <Pressable
                  key={lvl.label}
                  style={[styles.largeCard, experienceLevel === lvl.label && styles.largeCardActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setExperienceLevel(lvl.label);
                  }}
                >
                  <View style={styles.largeCardIcon}>
                    <Feather name={lvl.icon} size={22} color={experienceLevel === lvl.label ? Colors.orange : Colors.textMuted} />
                  </View>
                  <View style={styles.largeCardContent}>
                    <Text style={[styles.largeCardTitle, experienceLevel === lvl.label && styles.largeCardTitleActive]}>
                      {lvl.label}
                    </Text>
                    <Text style={styles.largeCardDesc}>{lvl.desc}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>INJURY VAULT</Text>
            <Text style={styles.stepSubtitle}>Select any areas with current issues (optional)</Text>
            <View style={styles.chipGrid}>
              {BODY_PARTS.map((part) => {
                const isActive = injuries.includes(part);
                return (
                  <Pressable
                    key={part}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => toggleInjury(part)}
                  >
                    {isActive && <Feather name="alert-circle" size={12} color={Colors.orange} />}
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{part}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ADDITIONAL NOTES</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={injuryNotes}
                onChangeText={setInjuryNotes}
                placeholder="Any details about injuries or limitations..."
                placeholderTextColor={Colors.textSubtle}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>PRIMARY GOAL</Text>
            <Text style={styles.stepSubtitle}>What's your #1 training focus?</Text>
            <View style={styles.cardColumn}>
              {GOALS.map((goal) => (
                <Pressable
                  key={goal.label}
                  style={[styles.largeCard, primaryGoal === goal.label && styles.largeCardActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPrimaryGoal(goal.label);
                  }}
                >
                  <View style={styles.largeCardIcon}>
                    <Feather name={goal.icon} size={22} color={primaryGoal === goal.label ? Colors.orange : Colors.textMuted} />
                  </View>
                  <View style={styles.largeCardContent}>
                    <Text style={[styles.largeCardTitle, primaryGoal === goal.label && styles.largeCardTitleActive]}>
                      {goal.label}
                    </Text>
                    <Text style={styles.largeCardDesc}>{goal.desc}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        );

      case 4: {
        const weightDisplay = weight
          ? `${weight} ${unitSystem === "imperial" ? "lbs" : "kg"}`
          : "—";
        const heightDisplay = (() => {
          if (unitSystem === "imperial") {
            if (!heightFt) return "—";
            return `${heightFt}′ ${heightIn || "0"}″`;
          }
          return heightCm ? `${heightCm} cm` : "—";
        })();
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>REVIEW & CONFIRM</Text>
            <Text style={styles.stepSubtitle}>Make sure everything looks good</Text>
            <View style={styles.reviewCard}>
              <ReviewRow label="Units" value={unitSystem === "imperial" ? "Imperial" : "Metric"} />
              <ReviewRow label="Age" value={age ? `${age} years` : "—"} />
              <ReviewRow label="Weight" value={weightDisplay} />
              <ReviewRow label="Height" value={heightDisplay} />
              <ReviewRow label="Gender" value={gender || "—"} />
              <ReviewRow label="Experience" value={experienceLevel || "—"} />
              <ReviewRow label="Injuries" value={injuries.length > 0 ? injuries.join(", ") : "None"} />
              {injuryNotes ? <ReviewRow label="Notes" value={injuryNotes} /> : null}
              <ReviewRow label="Primary Goal" value={primaryGoal || "—"} />
            </View>
          </View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.headerArea, { paddingTop: topPad + 12 }]}>
        <View style={styles.progressBarBg}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
        <View style={styles.stepIndicator}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[styles.stepDot, i <= step && styles.stepDotActive]}
            />
          ))}
        </View>
        <Text style={styles.stepCounter}>
          STEP {step + 1} OF {STEPS.length} — {STEPS[step].toUpperCase()}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ paddingBottom: botPad + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: botPad + 12 }]}>
        {step > 0 && (
          <Pressable style={styles.backBtn} onPress={goBack}>
            <Feather name="arrow-left" size={18} color={Colors.textMuted} />
            <Text style={styles.backBtnText}>BACK</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {step < STEPS.length - 1 ? (
          <Pressable
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={goNext}
            disabled={!canProceed()}
          >
            <Text style={styles.nextBtnText}>CONTINUE</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.nextBtn, isPending && styles.nextBtnDisabled]}
            onPress={handleConfirm}
            disabled={isPending}
          >
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.nextBtnText}>{isPending ? "SAVING..." : "CONFIRM"}</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  headerArea: { paddingHorizontal: 20, gap: 10, paddingBottom: 8 },
  progressBarBg: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.orange,
    borderRadius: 2,
  },
  stepIndicator: { flexDirection: "row", gap: 6, justifyContent: "center" },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  stepDotActive: { backgroundColor: Colors.orange },
  stepCounter: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
    textAlign: "center",
  },
  scrollArea: { flex: 1 },
  stepContent: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  stepTitle: {
    fontSize: 22,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    letterSpacing: 1,
  },
  stepSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginBottom: 8,
  },
  unitToggleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  unitToggleBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    gap: 3,
  },
  unitToggleBtnActive: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.1)",
  },
  unitToggleText: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  unitToggleTextActive: { color: Colors.orange },
  unitToggleSub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  unitToggleSubActive: { color: "rgba(252,82,0,0.7)" },
  inputGroup: { gap: 6 },
  inputLabel: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  textInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  textArea: { minHeight: 80, textAlignVertical: "top", paddingTop: 14 },
  inputRow: { flexDirection: "row", gap: 12 },
  cardRow: { flexDirection: "row", gap: 10 },
  cardColumn: { gap: 12 },
  selectCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    gap: 8,
  },
  selectCardActive: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.1)",
  },
  selectCardText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  selectCardTextActive: { color: Colors.orange },
  largeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 20,
  },
  largeCardActive: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.1)",
  },
  largeCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  largeCardContent: { flex: 1, gap: 4 },
  largeCardTitle: {
    fontSize: 16,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
  },
  largeCardTitleActive: { color: Colors.orange },
  largeCardDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 18,
  },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.1)",
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  chipTextActive: {
    color: Colors.orange,
    fontFamily: "Inter_700Bold",
  },
  reviewCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  reviewLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 1,
    width: 90,
  },
  reviewValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    flex: 1,
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  backBtnText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
});
