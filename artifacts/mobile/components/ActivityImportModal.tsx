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
import { getApiBase, getAuthHeaders, getFetchOptions } from "@/hooks/apiHelpers";
import { DatePickerSheet, getLocalToday, formatDisplayDate } from "@/components/DatePickerSheet";
import { ParsedWorkoutForm, type ParsedFormResult } from "@/components/ParsedWorkoutForm";
import { computeParserConfidence } from "@/utils/parserMeta";
import { track } from "@/lib/telemetry";

export interface ImportedWorkoutData {
  label: string;
  duration: number;
  workoutType: string;
  source: string;
  intensity: number;
  muscleGroups: string[];
  stimulusPoints: number;
  workoutDate?: string | null;
  movements?: Array<{ name: string; volume: string; muscleGroups: string[]; fatiguePercent: number }>;
  isMetcon?: boolean;
  metconFormat?: string | null;
  parserConfidence?: number | null;
  parserWarnings?: string[];
  workoutFormat?: string | null;
  wasUserEdited?: boolean;
  editedFields?: string[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  skillLevel?: string | null;
  onComplete: (data: ImportedWorkoutData) => void;
  onManualSubmit?: (data: Omit<ImportedWorkoutData, "source">) => void;
}

interface ImageAnalysis {
  label: string;
  workoutType: string;
  duration: number;
  intensity: number;
  muscleGroups: string[];
  movements: Array<{ name: string; volume: string; muscleGroups: string[]; fatiguePercent: number }>;
  isMetcon: boolean;
  metconFormat: string | null;
  workoutFormat: string | null;
  formatWarning?: string;
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
  const [aiParsed, setAiParsed] = useState<{
    muscleGroups: string[];
    suggestedIntensity: number;
    workoutType: string;
    movements: Array<{ name: string; volume: string; muscleGroups: string[]; fatiguePercent: number }>;
  } | null>(null);
  const [aiParserConfidence, setAiParserConfidence] = useState<number | null>(null);
  const [aiParserLabel, setAiParserLabel] = useState("");
  const [aiParserDuration, setAiParserDuration] = useState(30);
  const [aiParserFormat, setAiParserFormat] = useState<string | null>(null);
  const [aiParserFormatWarning, setAiParserFormatWarning] = useState<string | undefined>(undefined);

  const [screenshotData, setScreenshotData] = useState<{
    duration: number;
    intensity: number;
    muscleGroups: string[];
    stimulusPoints: number;
  } | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);
  const [screenshotLabel, setScreenshotLabel] = useState("");
  const [workoutDate, setWorkoutDate] = useState(getLocalToday);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const analyzeImage = async (uri: string, mimeType = "image/jpeg") => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workout/analyze-image`, {
        ...getFetchOptions(headers),
        method: "POST",
        body: JSON.stringify({ base64Image: uri, mimeType }),
      });
      if (res.ok) {
        const data: ImageAnalysis = await res.json();
        return data;
      }
    } catch (e) {
      console.error("Image analysis error:", e);
    }
    return null;
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setImageUri(result.assets[0].uri);
      setStep("scanning");
      const asset = result.assets[0];
      const b64 = asset.base64 ?? null;
      const mime = asset.mimeType ?? "image/jpeg";
      if (b64) {
        const analysis = await analyzeImage(b64, mime);
        if (analysis) {
          setImageAnalysis(analysis);
          setScreenshotLabel(analysis.label);
          const stimulusPoints = computeStimulusPoints({
            duration: analysis.duration,
            intensity: analysis.intensity,
            muscleGroups: analysis.muscleGroups,
            skillLevel: userSkillLevel,
          });
          setScreenshotData({ duration: analysis.duration, intensity: analysis.intensity, muscleGroups: analysis.muscleGroups, stimulusPoints });
          setStep("screenshot_done");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // telemetry: screenshot analysis complete
          const screenshotConfidence = computeParserConfidence({
            muscleGroups: analysis.muscleGroups,
            movements: analysis.movements,
            workoutType: analysis.workoutType,
          });
          const screenshotFormat = analysis.workoutFormat ?? "UNKNOWN";
          track({
            name: "parser_confidence_recorded",
            props: {
              confidence: screenshotConfidence,
              confidence_pct: Math.round(screenshotConfidence * 100),
              source: "screenshot",
              has_warning: screenshotConfidence < 0.65,
              workout_type: analysis.workoutType,
            },
          });
          track({
            name: "workout_format_detected",
            props: {
              format: screenshotFormat,
              source: "screenshot",
              has_format_warning: Boolean(analysis.formatWarning),
              confidence: screenshotConfidence,
            },
          });
          return;
        }
      }
      const duration = 47; const intensity = 6; const muscleGroups = ["Full Body"];
      const stimulusPoints = computeStimulusPoints({ duration, intensity, muscleGroups, skillLevel: userSkillLevel });
      setScreenshotData({ duration, intensity, muscleGroups, stimulusPoints });
      setScreenshotLabel("Workout");
      setStep("screenshot_done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setImageUri(result.assets[0].uri);
      setStep("scanning");
      const asset = result.assets[0];
      const b64 = asset.base64 ?? null;
      const mime = asset.mimeType ?? "image/jpeg";
      if (b64) {
        const analysis = await analyzeImage(b64, mime);
        if (analysis) {
          setImageAnalysis(analysis);
          setScreenshotLabel(analysis.label);
          const stimulusPoints = computeStimulusPoints({
            duration: analysis.duration,
            intensity: analysis.intensity,
            muscleGroups: analysis.muscleGroups,
            skillLevel: userSkillLevel,
          });
          setScreenshotData({ duration: analysis.duration, intensity: analysis.intensity, muscleGroups: analysis.muscleGroups, stimulusPoints });
          setStep("screenshot_done");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // telemetry: screenshot (camera) analysis complete
          const camConfidence = computeParserConfidence({
            muscleGroups: analysis.muscleGroups,
            movements: analysis.movements,
            workoutType: analysis.workoutType,
          });
          const camFormat = analysis.workoutFormat ?? "UNKNOWN";
          track({
            name: "parser_confidence_recorded",
            props: {
              confidence: camConfidence,
              confidence_pct: Math.round(camConfidence * 100),
              source: "screenshot",
              has_warning: camConfidence < 0.65,
              workout_type: analysis.workoutType,
            },
          });
          track({
            name: "workout_format_detected",
            props: {
              format: camFormat,
              source: "screenshot",
              has_format_warning: Boolean(analysis.formatWarning),
              confidence: camConfidence,
            },
          });
          return;
        }
      }
      const duration = 47; const intensity = 6; const muscleGroups = ["Full Body"];
      const stimulusPoints = computeStimulusPoints({ duration, intensity, muscleGroups, skillLevel: userSkillLevel });
      setScreenshotData({ duration, intensity, muscleGroups, stimulusPoints });
      setScreenshotLabel("Workout");
      setStep("screenshot_done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        workoutDate,
      });
    }
    resetState();
  };

  const [aiParseLoading, setAiParseLoading] = useState(false);

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAiParseLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/workout/parse-description`, {
        ...getFetchOptions(headers),
        method: "POST",
        body: JSON.stringify({ description: aiText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        const parsedResult = {
          muscleGroups: data.muscleGroups ?? [],
          suggestedIntensity: data.intensity ?? 5,
          workoutType: data.workoutType ?? "Other",
          movements: data.movements ?? [],
        };
        setAiParsed(parsedResult);
        setAiParserLabel(data.label ?? "");
        setAiParserDuration(data.estimatedDuration ?? 30);
        const textConfidence = computeParserConfidence({
          muscleGroups: parsedResult.muscleGroups,
          movements: parsedResult.movements,
          workoutType: parsedResult.workoutType,
        });
        setAiParserConfidence(textConfidence);
        const textFormat = data.workoutFormat ?? "UNKNOWN";
        setAiParserFormat(textFormat);
        setAiParserFormatWarning(data.formatWarning ?? undefined);
        // telemetry: text parse complete
        track({
          name: "parser_confidence_recorded",
          props: {
            confidence: textConfidence,
            confidence_pct: Math.round(textConfidence * 100),
            source: "text",
            has_warning: textConfidence < 0.65,
            workout_type: parsedResult.workoutType,
          },
        });
        track({
          name: "workout_format_detected",
          props: {
            format: textFormat,
            source: "text",
            has_format_warning: Boolean(data.formatWarning),
            confidence: textConfidence,
          },
        });
      } else {
        const parsed = parseWorkoutDescription(aiText);
        const fallback = { ...parsed, workoutType: "Other", movements: [] };
        setAiParsed(fallback);
        setAiParserLabel("");
        setAiParserDuration(30);
        setAiParserConfidence(computeParserConfidence(fallback));
        setAiParserFormat("UNKNOWN");
        setAiParserFormatWarning(undefined);
      }
    } catch {
      const parsed = parseWorkoutDescription(aiText);
      const fallback = { ...parsed, workoutType: "Other", movements: [] };
      setAiParsed(fallback);
      setAiParserLabel("");
      setAiParserDuration(30);
      setAiParserConfidence(computeParserConfidence(fallback));
      setAiParserFormat("UNKNOWN");
      setAiParserFormatWarning(undefined);
    } finally {
      setAiParseLoading(false);
    }
  };

  const handleAiFormSubmit = (formData: ParsedFormResult) => {
    if (onManualSubmit) {
      onManualSubmit({
        label: formData.label,
        duration: formData.duration,
        workoutType: formData.workoutType,
        intensity: formData.intensity,
        muscleGroups: formData.muscleGroups,
        stimulusPoints: formData.stimulusPoints,
        workoutDate: formData.workoutDate,
        movements: formData.movements,
        parserConfidence: formData.parserConfidence,
        parserWarnings: formData.parserWarnings,
        workoutFormat: formData.workoutFormat,
        wasUserEdited: formData.wasUserEdited,
        editedFields: formData.editedFields,
      });
    }
    resetState();
  };

  const handleScreenshotFormSubmit = (formData: ParsedFormResult) => {
    onComplete({
      label: formData.label,
      duration: formData.duration,
      workoutType: formData.workoutType,
      source: "screenshot",
      intensity: formData.intensity,
      muscleGroups: formData.muscleGroups,
      stimulusPoints: formData.stimulusPoints,
      workoutDate: formData.workoutDate,
      movements: formData.movements,
      isMetcon: imageAnalysis?.isMetcon ?? false,
      metconFormat: imageAnalysis?.metconFormat ?? null,
      parserConfidence: formData.parserConfidence,
      parserWarnings: formData.parserWarnings,
      workoutFormat: formData.workoutFormat,
      wasUserEdited: formData.wasUserEdited,
      editedFields: formData.editedFields,
    });
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
      setAiParserConfidence(null);
      setAiParserLabel("");
      setAiParserDuration(30);
      setAiParserFormat(null);
      setAiParserFormatWarning(undefined);
      setScreenshotData(null);
      setImageAnalysis(null);
      setScreenshotLabel("");
      setWorkoutDate(getLocalToday());
      setDatePickerOpen(false);
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
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 560 }}>
              <View style={styles.doneIcon}>
                <Feather name="check" size={30} color={Colors.highlight} />
              </View>
              <Text style={styles.doneTitle}>ACTIVITY{"\n"}ANALYZED</Text>

              {imageAnalysis?.isMetcon && imageAnalysis.metconFormat && (
                <View style={styles.metconBadge}>
                  <Feather name="zap" size={12} color={Colors.orange} />
                  <Text style={styles.metconBadgeText}>{imageAnalysis.metconFormat}</Text>
                </View>
              )}

              {imageAnalysis?.movements && imageAnalysis.movements.length > 0 && (() => {
                const muscleFatigueMap: Record<string, number> = {};
                for (const mv of imageAnalysis.movements) {
                  if (mv.muscleGroups.length === 0) continue;
                  const perMuscle = mv.fatiguePercent / mv.muscleGroups.length;
                  for (const mg of mv.muscleGroups) {
                    const key = mg.toLowerCase();
                    muscleFatigueMap[key] = (muscleFatigueMap[key] ?? 0) + perMuscle;
                  }
                }
                const sortedMuscles = Object.entries(muscleFatigueMap)
                  .sort(([, a], [, b]) => b - a)
                  .map(([muscle, pct]) => ({ muscle, pct: Math.min(100, Math.round(pct)) }));
                const intensity = imageAnalysis?.intensity ?? 5;
                const impactedMuscles = sortedMuscles.filter(m => m.pct >= 15);
                const flagLabel = intensity >= 9
                  ? { text: "AVOID — high overload risk", color: "#ef4444" }
                  : intensity >= 7
                  ? { text: "REDUCE VOLUME — moderately fatigued", color: Colors.orange }
                  : { text: "MONITOR — light fatigue", color: Colors.recovery };

                return (
                  <>
                    <View style={styles.formGroup}>
                      <Text style={styles.fieldLabel}>MOVEMENTS & FATIGUE LOAD</Text>
                      {imageAnalysis.movements.map((mv, i) => (
                        <View key={i} style={styles.imgMvRow}>
                          <View style={styles.imgMvInfo}>
                            <Text style={styles.imgMvName}>{mv.name}</Text>
                            <Text style={styles.imgMvVolume}>{mv.volume}</Text>
                            <Text style={styles.imgMvMuscles}>{mv.muscleGroups.join(", ")}</Text>
                          </View>
                          <View style={styles.imgMvFatigue}>
                            <Text style={styles.imgMvFatiguePct}>{mv.fatiguePercent}%</Text>
                            <View style={styles.imgMvFatigueBar}>
                              <View style={[styles.imgMvFatigueFill, { width: `${mv.fatiguePercent}%` as any }]} />
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>

                    {impactedMuscles.length > 0 && (
                      <View style={styles.fatigueImpactPanel}>
                        <View style={styles.fatigueImpactHeader}>
                          <Feather name="alert-triangle" size={13} color={flagLabel.color} />
                          <Text style={[styles.fatigueImpactTitle, { color: flagLabel.color }]}>NEXT WORKOUT IMPACT</Text>
                        </View>
                        <Text style={styles.fatigueImpactDesc}>
                          These muscles will be flagged in your next AI workout — the builder will adjust volume automatically.
                        </Text>
                        <View style={styles.fatigueImpactBadge}>
                          <View style={[styles.fatigueImpactDot, { backgroundColor: flagLabel.color }]} />
                          <Text style={[styles.fatigueImpactBadgeText, { color: flagLabel.color }]}>{flagLabel.text}</Text>
                        </View>
                        {impactedMuscles.map(({ muscle, pct }) => {
                          const barColor = pct >= 60 ? "#ef4444" : pct >= 35 ? Colors.orange : Colors.recovery;
                          return (
                            <View key={muscle} style={styles.muscleFatigueRow}>
                              <Text style={styles.muscleFatigueName}>
                                {muscle.charAt(0).toUpperCase() + muscle.slice(1)}
                              </Text>
                              <View style={styles.muscleFatigueTrack}>
                                <View style={[styles.muscleFatigueFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                              </View>
                              <Text style={[styles.muscleFatiguePct, { color: barColor }]}>{pct}%</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                );
              })()}

              <ParsedWorkoutForm
                key="screenshot-form"
                importSource="screenshot"
                initial={{
                  label: screenshotLabel || imageAnalysis?.label || "Screenshot Import",
                  workoutType: imageAnalysis?.workoutType ?? "Imported",
                  duration: screenshotData?.duration ?? 47,
                  intensity: screenshotData?.intensity ?? 6,
                  muscleGroups: screenshotData?.muscleGroups ?? imageAnalysis?.muscleGroups ?? ["Full Body"],
                  movements: imageAnalysis?.movements ?? [],
                  workoutDate: getLocalToday(),
                  parserConfidence: imageAnalysis
                    ? computeParserConfidence({
                        muscleGroups: imageAnalysis.muscleGroups,
                        movements: imageAnalysis.movements,
                        workoutType: imageAnalysis.workoutType,
                      })
                    : 0.4,
                  parserWarnings: imageAnalysis?.formatWarning ? [imageAnalysis.formatWarning] : [],
                  workoutFormat: imageAnalysis?.workoutFormat ?? "UNKNOWN",
                }}
                onSubmit={handleScreenshotFormSubmit}
                skillLevel={rawSkillLevel}
                submitLabel="SYNC TO PROTOCOL"
              />
            </ScrollView>
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
                    (!aiText.trim() || aiParseLoading) && styles.primaryBtnDisabled,
                    { opacity: pressed ? 0.9 : 1, marginTop: 12 },
                  ]}
                  onPress={handleAiParse}
                  disabled={!aiText.trim() || aiParseLoading}
                >
                  {aiParseLoading ? (
                    <ActivityIndicator size="small" color={Colors.text} />
                  ) : (
                    <Feather name="cpu" size={16} color={Colors.text} />
                  )}
                  <Text style={styles.secondaryBtnText}>
                    {aiParseLoading ? "Analyzing with AI..." : "Analyze Workout"}
                  </Text>
                </Pressable>
              )}

              {aiParsed && (
                <>
                  <View style={[styles.extractedCard, { marginTop: 12 }]}>
                    {aiParsed.movements.length > 0 && (
                      <>
                        <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>MOVEMENTS DETECTED</Text>
                        {aiParsed.movements.map((mv, idx) => (
                          <View key={idx} style={styles.movementRow}>
                            <View style={styles.movementLeft}>
                              <Text style={styles.movementName}>{mv.name}</Text>
                              {mv.volume ? (
                                <Text style={styles.movementVolume}>{mv.volume}</Text>
                              ) : null}
                              <View style={styles.movementTagRow}>
                                {mv.muscleGroups.slice(0, 3).map((mg) => (
                                  <View key={mg} style={styles.movementTag}>
                                    <Text style={styles.movementTagText}>{mg}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                            <View style={styles.movementFatigueWrap}>
                              <Text style={styles.movementFatigue}>{mv.fatiguePercent}%</Text>
                              <Text style={styles.movementFatigueLabel}>fatigue</Text>
                            </View>
                          </View>
                        ))}
                        <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 2 }} />
                      </>
                    )}
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

                  {(() => {
                    const muscleFatigueMapAI: Record<string, number> = {};
                    for (const mv of aiParsed.movements) {
                      if (mv.muscleGroups.length === 0) continue;
                      const perMuscle = mv.fatiguePercent / mv.muscleGroups.length;
                      for (const mg of mv.muscleGroups) {
                        const key = mg.toLowerCase();
                        muscleFatigueMapAI[key] = (muscleFatigueMapAI[key] ?? 0) + perMuscle;
                      }
                    }
                    const sortedAI = Object.entries(muscleFatigueMapAI)
                      .sort(([, a], [, b]) => b - a)
                      .map(([muscle, pct]) => ({ muscle, pct: Math.min(100, Math.round(pct)) }));
                    const intensityAI = aiParsed.suggestedIntensity ?? 5;
                    const impactedAI = sortedAI.filter(m => m.pct >= 15);
                    const flagLabelAI = intensityAI >= 9
                      ? { text: "AVOID — high overload risk", color: "#ef4444" }
                      : intensityAI >= 7
                      ? { text: "REDUCE VOLUME — moderately fatigued", color: Colors.orange }
                      : { text: "MONITOR — light fatigue", color: Colors.recovery };

                    if (impactedAI.length === 0) return null;

                    return (
                      <View style={[styles.fatigueImpactPanel, { marginTop: 12 }]}>
                        <View style={styles.fatigueImpactHeader}>
                          <Feather name="alert-triangle" size={13} color={flagLabelAI.color} />
                          <Text style={[styles.fatigueImpactTitle, { color: flagLabelAI.color }]}>NEXT WORKOUT IMPACT</Text>
                        </View>
                        <Text style={styles.fatigueImpactDesc}>
                          These muscles will be flagged in your next AI workout — the builder will adjust volume automatically.
                        </Text>
                        <View style={styles.fatigueImpactBadge}>
                          <View style={[styles.fatigueImpactDot, { backgroundColor: flagLabelAI.color }]} />
                          <Text style={[styles.fatigueImpactBadgeText, { color: flagLabelAI.color }]}>{flagLabelAI.text}</Text>
                        </View>
                        {impactedAI.map(({ muscle, pct }) => {
                          const barColor = pct >= 60 ? "#ef4444" : pct >= 35 ? Colors.orange : Colors.recovery;
                          return (
                            <View key={muscle} style={styles.muscleFatigueRow}>
                              <Text style={styles.muscleFatigueName}>
                                {muscle.charAt(0).toUpperCase() + muscle.slice(1)}
                              </Text>
                              <View style={styles.muscleFatigueTrack}>
                                <View style={[styles.muscleFatigueFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                              </View>
                              <Text style={[styles.muscleFatiguePct, { color: barColor }]}>{pct}%</Text>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })()}

                  <ParsedWorkoutForm
                    key={JSON.stringify(aiParsed)}
                    importSource="text"
                    initial={{
                      label: aiParserLabel,
                      workoutType: aiParsed.workoutType || "Other",
                      duration: aiParserDuration,
                      intensity: aiParsed.suggestedIntensity,
                      muscleGroups: aiParsed.muscleGroups,
                      movements: aiParsed.movements,
                      workoutDate: getLocalToday(),
                      parserConfidence: aiParserConfidence,
                      parserWarnings: aiParserFormatWarning ? [aiParserFormatWarning] : [],
                      workoutFormat: aiParserFormat ?? "UNKNOWN",
                    }}
                    onSubmit={handleAiFormSubmit}
                    skillLevel={rawSkillLevel}
                    submitLabel="LOG WORKOUT"
                  />
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

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>LOG FOR DATE</Text>
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDatePickerOpen(true); }}
                  style={styles.dateTrigger}
                >
                  <Feather name="calendar" size={16} color={Colors.highlight} />
                  <Text style={styles.dateTriggerText}>{formatDisplayDate(workoutDate)}</Text>
                  <Feather name="chevron-down" size={14} color={Colors.textSubtle} />
                </Pressable>
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

      <DatePickerSheet
        visible={datePickerOpen}
        value={workoutDate}
        onClose={() => setDatePickerOpen(false)}
        onSelect={(date) => setWorkoutDate(date)}
      />
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
  movementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 8,
  },
  movementLeft: {
    flex: 1,
    gap: 3,
  },
  movementName: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  movementVolume: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  movementTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  movementTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(246,234,152,0.1)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.2)",
  },
  movementTagText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.highlight,
    letterSpacing: 0.5,
  },
  movementFatigueWrap: {
    alignItems: "center",
    minWidth: 44,
  },
  movementFatigue: {
    fontSize: 16,
    fontFamily: "Inter_900Black",
    color: Colors.orange,
    fontStyle: "italic",
  },
  movementFatigueLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 1,
    textTransform: "uppercase",
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
  dateTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.3)",
    backgroundColor: "rgba(246,234,152,0.06)",
  },
  dateTriggerText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.highlight,
  },
  metconBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(252,82,0,0.35)",
    backgroundColor: "rgba(252,82,0,0.08)",
    marginTop: 4,
  },
  metconBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: Colors.orange,
    letterSpacing: 1,
    fontStyle: "italic",
  },
  imgMvRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  imgMvInfo: { flex: 1, gap: 2 },
  imgMvName: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  imgMvVolume: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  imgMvMuscles: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  imgMvFatigue: { alignItems: "flex-end", gap: 4, minWidth: 64 },
  imgMvFatiguePct: {
    fontSize: 12,
    fontFamily: "Inter_900Black",
    color: Colors.orange,
    fontStyle: "italic",
  },
  imgMvFatigueBar: {
    width: 64,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    overflow: "hidden",
  },
  imgMvFatigueFill: {
    height: "100%" as any,
    backgroundColor: Colors.orange,
    borderRadius: 2,
  },
  fatigueImpactPanel: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    marginBottom: 16,
  },
  fatigueImpactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  fatigueImpactTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },
  fatigueImpactDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    lineHeight: 17,
    marginBottom: 10,
  },
  fatigueImpactBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  fatigueImpactDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  fatigueImpactBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  muscleFatigueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 7,
  },
  muscleFatigueName: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    width: 80,
  },
  muscleFatigueTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  muscleFatigueFill: {
    height: "100%" as any,
    borderRadius: 3,
  },
  muscleFatiguePct: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    width: 34,
    textAlign: "right",
  },
});
