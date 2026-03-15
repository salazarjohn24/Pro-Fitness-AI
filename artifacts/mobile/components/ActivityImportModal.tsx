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
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";

interface Props {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Step = "prompt" | "scanning" | "done";

export function ActivityImportModal({ visible, onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>("prompt");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return;
    }
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
        setStep("done");
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
        setStep("done");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 2200);
    }
  };

  const handleFinish = () => {
    onComplete();
    setTimeout(() => {
      setStep("prompt");
      setImageUri(null);
    }, 300);
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep("prompt");
      setImageUri(null);
    }, 300);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {step === "prompt" && (
            <>
              <Text style={styles.overline}>ACTIVITY IMPORT</Text>
              <Text style={styles.title}>AI Vision{"\n"}<Text style={styles.titleAccent}>Scan</Text></Text>
              <Text style={styles.desc}>
                Upload a screenshot from Strava, Apple Fitness, Garmin, or any fitness app. Our AI will extract your workout data automatically.
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
              <Text style={styles.scanDesc}>Extracting workout data from your screenshot…</Text>
              <View style={styles.scanStats}>
                {["Distance", "Duration", "Pace", "Effort"].map((s) => (
                  <View key={s} style={styles.scanStat}>
                    <View style={[styles.scanStatDot, { backgroundColor: Colors.orange }]} />
                    <Text style={styles.scanStatText}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {step === "done" && (
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
                  <Text style={styles.extractedVal}>47 min</Text>
                </View>
                <View style={styles.extractedRow}>
                  <Feather name="zap" size={14} color={Colors.orange} />
                  <Text style={styles.extractedLabel}>Calories</Text>
                  <Text style={styles.extractedVal}>412 kcal</Text>
                </View>
                <View style={styles.extractedRow}>
                  <Feather name="trending-up" size={14} color={Colors.highlight} />
                  <Text style={styles.extractedLabel}>Effort Score</Text>
                  <Text style={styles.extractedVal}>82 / 100</Text>
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
    fontSize: 32,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    lineHeight: 36,
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
  primaryBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
  scanStats: { flexDirection: "row", gap: 16 },
  scanStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  scanStatDot: { width: 6, height: 6, borderRadius: 3 },
  scanStatText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 0.5,
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
});
