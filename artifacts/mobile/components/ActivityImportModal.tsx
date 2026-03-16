import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import {
  MUSCLE_GROUPS,
  computeStimulusPoints,
  inferMuscleGroupsFromType,
  parseWorkoutDescription,
  type SkillLevel,
} from "@/utils/stimulus";

interface Props {
  visible: boolean;
  onClose: () => void;
  skillLevel?: string | null;
  onComplete: (data: {
    label: string;
    duration: number;
    workoutType: string;
    source: string;
    intensity: number;
    muscleGroups: string[];
    stimulusPoints: number;
  }) => void;
  onManualSubmit?: (data: {
    label: string;
    duration: number;
    workoutType: string;
    intensity: number;
    muscleGroups: string[];
    stimulusPoints: number;
  }) => void;
}

type Step = "choose" | "screenshot_prompt" | "scanning" | "screenshot_done" | "manual" | "ai_interpreter";

const WORKOUT_TYPES = [
  "Strength", "Cardio", "HIIT", "CrossFit", "Yoga",
  "Pilates", "Swimming", "Running", "Cycling", "Sports", "Other",
];

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 75, 90, 120];

function resolveSkillLevel(raw?: string | null): SkillLevel {
  if (raw === "Beginner" || raw === "Intermediate" || raw === "Advanced") return raw;
  return "Intermediate";
}

export function ActivityImportModal({ visible, onClose, onComplete, onManualSubmit, skillLevel: rawSkillLevel }: Props) {
  const userSkillLevel = resolveSkillLevel(rawSkillLevel);
  const [step, setStep] = useState<Step>("choose");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [manualLabel, setManualLabel] = useState("");
  const [manualDuration, setManualDuration] = useState(30);
  const [manualType, setManualType] = useState("Strength");
  const [manualIntensity, setManualIntensity] = useState(5);
  const [manualMuscleGroups, setManualMuscleGroups] = useState<string[]>([]);

  const [aiText, setAiText] = useState("");
  const [aiParsed, setAiParsed] = useState<{ muscleGroups: string[]; suggestedIntensity: number } | null>(null);
  const [aiLabel, setAiLabel] = useState("");
  const [aiDuration, setAiDuration] = useState(30);

  const [screenshotData, setScreenshotData] = useState<{
    duration: number;
    intensity: number;
    muscleGroups: string[];
    stimulusPoints: number;
  } | null>(null);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setImageUri(result.assets[0].uri);
      setStep("scanning");
      setTimeout(() => {
        const duration = 47;
        const intensity = 6;
        const muscleGroups = ["Full Body"];
        const stimulusPoints = computeStimulusPoints({ duration, intensity, muscleGroups, skillLevel: userSkillLevel });
        setScreenshotData({ duration, intensity, muscleGroups, stimulusPoints });
        setStep("screenshot_done");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 2200);
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === "web") {
      handlePickImage();
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setImageUri(result.assets[0].uri);
      setStep("scanning");
      setTimeout(() => {
        const duration = 47;
        const intensity = 6;
        const muscleGroups = ["Full Body"];
        const stimulusPoints = computeStimulusPoints({ duration, intensity, muscleGroups, skillLevel: userSkillLevel });
        setScreenshotData({ duration, intensity, muscleGroups, stimulusPoints });
        setStep("screenshot_done");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 2200);
    }
  };

  const toggleMuscleGroup = (group: string, setter: React.Dispatch<React.SetStateAction<string[]>>, current: string[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (current.includes(group)) {
      setter(current.filter((g) => g !== group));
    } else {
      setter([...current, group]);
    }
  };

  const handleManualSubmit = () => {
    if (!manualLabel.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const groups = manualMuscleGroups.length > 0 ? manualMuscleGroups : inferMuscleGroupsFromType(manualType);
    const stimulusPoints = computeStimulusPoints({
      duration: manualDuration,
      intensity: manualIntensity,
      muscleGroups: groups,
      skillLevel: userSkillLevel,
    });
    if (onManualSubmit) {
      onManualSubmit({
        label: manualLabel.trim(),
        duration: manualDuration,
        workoutType: manualType,
        intensity: manualIntensity,
        muscleGroups: groups,
        stimulusPoints,
      });
    }
    resetState();
  };

  const handleAiParse = () => {
    if (!aiText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const parsed = parseWorkoutDescription(aiText);
    setAiParsed(parsed);
  };

  const handleAiSubmit = () => {
    if (!aiParsed || !aiLabel.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const stimulusPoints = computeStimulusPoints({
      duration: aiDuration,
      intensity: aiParsed.suggestedIntensity,
      muscleGroups: aiParsed.muscleGroups,
      skillLevel: userSkillLevel,
    });
    if (onManualSubmit) {
      onManualSubmit({
        label: aiLabel.trim(),
        duration: aiDuration,
        workoutType: "Custom",
        intensity: aiParsed.suggestedIntensity,
        muscleGroups: aiParsed.muscleGroups,
        stimulusPoints,
      });
    }
    resetState();
  };

  const handleFinish = () => {
    if (screenshotData) {
      onComplete({
        label: "Screenshot Import",
        duration: screenshotData.duration,
        workoutType: "Imported",
        source: "screenshot",
        intensity: screenshotData.intensity,
        muscleGroups: screenshotData.muscleGroups,
        stimulusPoints: screenshotData.stimulusPoints,
      });
    } else {
      onComplete({
        label: "Screenshot Import",
        duration: 47,
        workoutType: "Imported",
        source: "screenshot",
        intensity: 6,
        muscleGroups: ["Full Body"],
        stimulusPoints: computeStimulusPoints({ duration: 47, intensity: 6, muscleGroups: ["Full Body"], skillLevel: userSkillLevel }),
      });
    }
    resetState();
  };

  const handleClose = () => {
    onClose();
    resetState();
  };

  const resetState = () => {
    setTimeout(() => {
      setStep("choose");
      setImageUri(null);
      setManualLabel("");
      setManualDuration(30);
      setManualType("Strength");
      setManualIntensity(5);
      setManualMuscleGroups([]);
      setAiText("");
      setAiParsed(null);
      setAiLabel("");
      setAiDuration(30);
      setScreenshotData(null);
    }, 300);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {step === "choose" && (
            <>
              <Text style={styles.overline}>LOG EXTERNAL WORKOUT</Text>
              <Text style={styles.title}>How would you{"\n"}like to <Text style={styles.titleAccent}>log</Text>?</Text>

              <View style={styles.btnGroup}>
                <Pressable
                  style={({ pressed }) => [styles.choiceBtn, { opacity: pressed ? 0.9 : 1 }]}
                  onPress={() => setStep("screenshot_prompt")}
                >
                  <View style={styles.choiceIcon}>
                    <Feather name="camera" size={20} color={Colors.orange} />
                  </View>
                  <View style={styles.choiceInfo}>
                    <Text style={styles.choiceTitle}>Screenshot Import</Text>
                    <Text style={styles.choiceDesc}>Upload from Strava, Apple Fitness, etc.</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={Colors.textMuted} />
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.choiceBtn, { opacity: pressed ? 0.9 : 1 }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep("manual"); }}
                >
                  <View style={[styles.choiceIcon, { backgroundColor: "rgba(246,234,152,0.1)" }]}>
                    <Feather name="edit-3" size={20} color={Colors.highlight} />
                  </View>
                  <View style={styles.choiceInfo}>
                    <Text style={styles.choiceTitle}>Manual Entry</Text>
                    <Text style={styles.choiceDesc}>Type in workout details</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={Colors.textMuted} />
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.choiceBtn, { opacity: pressed ? 0.9 : 1 }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep("ai_interpreter"); }}
                >
                  <View style={[styles.choiceIcon, { backgroundColor: "rgba(252,82,0,0.08)" }]}>
                    <Feather name="cpu" size={20} color={Colors.orange} />
                  </View>
                  <View style={styles.choiceInfo}>
                    <Text style={styles.choiceTitle}>AI Interpreter</Text>
                    <Text style={styles.choiceDesc}>Paste a workout description to parse</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={Colors.textMuted} />
                </Pressable>
              </View>
            </>
          )}

          {step === "screenshot_prompt" && (
            <>
              <Text style={styles.overline}>SCREENSHOT IMPORT</Text>
              <Text style={styles.title}>AI Vision{"\n"}<Text style={styles.titleAccent}>Scan</Text></Text>
              <Text style={styles.desc}>
                Upload a screenshot from Strava, Apple Fitness, Garmin, or any fitness app.
              </Text>

              <View style={styles.supportedRow}>
                {["Strava", "Apple Fitness", "Garmin", "Whoop"].map((app) => (
                  <View key={app} style={styles.supportedChip}>
                    <Text style={styles.supportedText}>{app}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.btnGroup}>
                <Pressable
                  style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                  onPress={handlePickImage}
                >
                  <Feather name="image" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>UPLOAD SCREENSHOT</Text>
                </Pressable>

                {Platform.OS !== "web" && (
                  <Pressable
                    style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.9 : 1 }]}
                    onPress={handleTakePhoto}
                  >
                    <Feather name="camera" size={16} color={Colors.text} />
                    <Text style={styles.secondaryBtnText}>Take Photo</Text>
                  </Pressable>
                )}

                <Pressable onPress={() => setStep("choose")} style={styles.backLink}>
                  <Feather name="arrow-left" size={14} color={Colors.textSubtle} />
                  <Text style={styles.backLinkText}>Back</Text>
                </Pressable>
              </View>
            </>
          )}

          {step === "scanning" && (
            <View style={styles.centerBlock}>
              {imageUri && (
                <View style={styles.imagePrev}>
                  <Image source={{ uri: imageUri }} style={styles.previewImg} resizeMode="cover" />
                  <View style={styles.scanOverlay}>
                    <View style={styles.scanLine} />
                  </View>
                </View>
              )}
              <ActivityIndicator color={Colors.orange} size="large" style={{ marginTop: 20 }} />
              <Text style={styles.scanTitle}>AI VISION SCAN</Text>
              <Text style={styles.scanDesc}>Extracting workout data from your screenshot...</Text>
            </View>
          )}

          {step === "screenshot_done" && (
            <View style={styles.centerBlock}>
              <View style={styles.doneIcon}>
                <Feather name="check" size={30} color={Colors.highlight} />
              </View>
              <Text style={styles.doneTitle}>ACTIVITY{"\n"}SYNCED</Text>
              <Text style={styles.doneDesc}>Your workout data has been extracted and added to your training log.</Text>

              <View style={styles.extractedCard}>
                <View style={styles.extractedRow}>
                  <Feather name="clock" size={14} color={Colors.recovery} />
                  <Text style={styles.extractedLabel}>Duration</Text>
                  <Text style={styles.extractedVal}>{screenshotData?.duration ?? 47} min</Text>
                </View>
                <View style={styles.extractedRow}>
                  <Feather name="zap" size={14} color={Colors.orange} />
                  <Text style={styles.extractedLabel}>Intensity</Text>
                  <Text style={styles.extractedVal}>{screenshotData?.intensity ?? 6} / 10</Text>
                </View>
                <View style={styles.extractedRow}>
                  <Feather name="target" size={14} color={Colors.highlight} />
                  <Text style={styles.extractedLabel}>Muscle Groups</Text>
                  <Text style={styles.extractedVal}>{(screenshotData?.muscleGroups ?? ["Full Body"]).join(", ")}</Text>
                </View>
                <View style={styles.extractedRow}>
                  <Feather name="trending-up" size={14} color={Colors.highlight} />
                  <Text style={styles.extractedLabel}>Stimulus Points</Text>
                  <Text style={styles.extractedVal}>{screenshotData?.stimulusPoints ?? 0} pts</Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                onPress={handleFinish}
              >
                <Feather name="check-circle" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>SYNC TO PROTOCOL</Text>
              </Pressable>
            </View>
          )}

          {step === "ai_interpreter" && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <Text style={styles.overline}>AI INTERPRETER</Text>
              <Text style={styles.title}>Paste your{"\n"}<Text style={styles.titleAccent}>workout</Text></Text>
              <Text style={styles.desc}>
                Paste a workout description and we'll identify muscle groups and intensity.
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>WORKOUT DESCRIPTION</Text>
                <TextInput
                  style={[styles.textInput, { height: 100, textAlignVertical: "top", paddingTop: 12 }]}
                  placeholder='e.g. "5 Rounds: 10 Thrusters, 10 Pull-ups, 400m Run"'
                  placeholderTextColor={Colors.textSubtle}
                  value={aiText}
                  onChangeText={(t) => { setAiText(t); setAiParsed(null); }}
                  multiline
                />
              </View>

              {!aiParsed && (
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    !aiText.trim() && styles.primaryBtnDisabled,
                    { opacity: pressed ? 0.9 : 1, marginTop: 12 },
                  ]}
                  onPress={handleAiParse}
                  disabled={!aiText.trim()}
                >
                  <Feather name="cpu" size={16} color={Colors.text} />
                  <Text style={styles.secondaryBtnText}>Analyze Workout</Text>
                </Pressable>
              )}

              {aiParsed && (
                <>
                  <View style={[styles.extractedCard, { marginTop: 12 }]}>
                    <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>DETECTED MUSCLE GROUPS</Text>
                    <View style={styles.muscleTagRow}>
                      {aiParsed.muscleGroups.map((g) => (
                        <View key={g} style={[styles.typeChip, styles.typeChipSelected]}>
                          <Text style={[styles.typeChipText, styles.typeChipTextSelected]}>{g}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.extractedRow}>
                      <Feather name="zap" size={14} color={Colors.orange} />
                      <Text style={styles.extractedLabel}>Suggested Intensity</Text>
                      <Text style={styles.extractedVal}>{aiParsed.suggestedIntensity} / 10</Text>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>WORKOUT NAME</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder='e.g. "CrossFit WOD"'
                      placeholderTextColor={Colors.textSubtle}
                      value={aiLabel}
                      onChangeText={setAiLabel}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>DURATION (MINUTES)</Text>
                    <View style={styles.durationRow}>
                      {DURATION_OPTIONS.map((d) => {
                        const selected = aiDuration === d;
                        return (
                          <Pressable
                            key={d}
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAiDuration(d); }}
                            style={[styles.durationChip, selected && styles.durationChipSelected]}
                          >
                            <Text style={[styles.durationChipText, selected && styles.durationChipTextSelected]}>{d}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      !aiLabel.trim() && styles.primaryBtnDisabled,
                      { opacity: pressed ? 0.9 : 1, marginTop: 8 },
                    ]}
                    onPress={handleAiSubmit}
                    disabled={!aiLabel.trim()}
                  >
                    <Feather name="check-circle" size={16} color="#fff" />
                    <Text style={styles.primaryBtnText}>LOG WORKOUT</Text>
                  </Pressable>
                </>
              )}

              <Pressable onPress={() => { setStep("choose"); setAiParsed(null); setAiText(""); }} style={[styles.backLink, { marginTop: 12 }]}>
                <Feather name="arrow-left" size={14} color={Colors.textSubtle} />
                <Text style={styles.backLinkText}>Back</Text>
              </Pressable>
            </ScrollView>
          )}

          {step === "manual" && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <Text style={styles.overline}>MANUAL ENTRY</Text>
              <Text style={styles.title}>Log your{"\n"}<Text style={styles.titleAccent}>workout</Text></Text>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>WORKOUT NAME</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder='e.g. "CrossFit WOD", "Morning Run"'
                  placeholderTextColor={Colors.textSubtle}
                  value={manualLabel}
                  onChangeText={setManualLabel}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>WORKOUT TYPE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                  <View style={styles.typeRow}>
                    {WORKOUT_TYPES.map((type) => {
                      const selected = manualType === type;
                      return (
                        <Pressable
                          key={type}
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setManualType(type); }}
                          style={[styles.typeChip, selected && styles.typeChipSelected]}
                        >
                          <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>{type}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>DURATION (MINUTES)</Text>
                <View style={styles.durationRow}>
                  {DURATION_OPTIONS.map((d) => {
                    const selected = manualDuration === d;
                    return (
                      <Pressable
                        key={d}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setManualDuration(d); }}
                        style={[styles.durationChip, selected && styles.durationChipSelected]}
                      >
                        <Text style={[styles.durationChipText, selected && styles.durationChipTextSelected]}>{d}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>RPE / INTENSITY (1–10)</Text>
                <View style={styles.rpeRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
                    const selected = manualIntensity === v;
                    return (
                      <Pressable
                        key={v}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setManualIntensity(v); }}
                        style={[styles.rpeChip, selected && styles.rpeChipSelected]}
                      >
                        <Text style={[styles.rpeChipText, selected && styles.rpeChipTextSelected]}>{v}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.rpeHint}>
                  {manualIntensity <= 3 ? "Light effort" : manualIntensity <= 5 ? "Moderate effort" : manualIntensity <= 7 ? "Hard effort" : manualIntensity <= 9 ? "Very hard" : "Max effort"}
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>PRIMARY FOCUS (MUSCLE GROUPS)</Text>
                <View style={styles.muscleTagRow}>
                  {MUSCLE_GROUPS.map((group) => {
                    const selected = manualMuscleGroups.includes(group);
                    return (
                      <Pressable
                        key={group}
                        onPress={() => toggleMuscleGroup(group, setManualMuscleGroups, manualMuscleGroups)}
                        style={[styles.typeChip, selected && styles.muscleChipSelected]}
                      >
                        <Text style={[styles.typeChipText, selected && styles.muscleChipTextSelected]}>{group}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  !manualLabel.trim() && styles.primaryBtnDisabled,
                  { opacity: pressed ? 0.9 : 1, marginTop: 8 },
                ]}
                onPress={handleManualSubmit}
                disabled={!manualLabel.trim()}
              >
                <Feather name="check-circle" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>LOG WORKOUT</Text>
              </Pressable>

              <Pressable onPress={() => setStep("choose")} style={[styles.backLink, { marginTop: 12 }]}>
                <Feather name="arrow-left" size={14} color={Colors.textSubtle} />
                <Text style={styles.backLinkText}>Back</Text>
              </Pressable>
            </ScrollView>
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
    gap: 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#444",
    alignSelf: "center",
    marginBottom: 10,
  },
  overline: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    lineHeight: 32,
  },
  titleAccent: { color: Colors.orange },
  desc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 20,
  },
  supportedRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  supportedChip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  supportedText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  btnGroup: { gap: 10 },
  choiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  choiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(252,82,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceInfo: { flex: 1 },
  choiceTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  choiceDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnDisabled: {
    backgroundColor: "#3A3A38",
  },
  primaryBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  secondaryBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    paddingVertical: 4,
  },
  backLinkText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  centerBlock: { alignItems: "center", gap: 14 },
  imagePrev: {
    width: "100%",
    height: 140,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  previewImg: { width: "100%", height: "100%" },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(252,82,0,0.1)",
    justifyContent: "center",
  },
  scanLine: {
    height: 2,
    backgroundColor: Colors.orange,
    width: "100%",
    opacity: 0.8,
  },
  scanTitle: {
    fontSize: 18,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    letterSpacing: 1,
  },
  scanDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "rgba(246,234,152,0.1)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    fontSize: 30,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textAlign: "center",
    textTransform: "uppercase",
    lineHeight: 34,
  },
  doneDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  extractedCard: {
    width: "100%",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  extractedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  extractedLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  extractedVal: {
    fontSize: 14,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
  },
  formGroup: { gap: 8, marginTop: 8 },
  fieldLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  textInput: {
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
  typeScroll: { marginHorizontal: -4 },
  typeRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 4,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  typeChipSelected: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.12)",
  },
  typeChipText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  typeChipTextSelected: {
    color: Colors.orange,
  },
  muscleChipSelected: {
    borderColor: Colors.highlight,
    backgroundColor: "rgba(246,234,152,0.12)",
  },
  muscleChipTextSelected: {
    color: Colors.highlight,
  },
  muscleTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationChip: {
    width: 52,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  durationChipSelected: {
    borderColor: Colors.highlight,
    backgroundColor: "rgba(246,234,152,0.1)",
  },
  durationChipText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  durationChipTextSelected: {
    color: Colors.highlight,
  },
  rpeRow: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
  },
  rpeChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  rpeChipSelected: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.15)",
  },
  rpeChipText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  rpeChipTextSelected: {
    color: Colors.orange,
  },
  rpeHint: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    letterSpacing: 0.5,
  },
});
