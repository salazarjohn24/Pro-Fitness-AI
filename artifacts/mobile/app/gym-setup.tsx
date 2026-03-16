import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";

type FeatherIcon = ComponentProps<typeof Feather>["name"];
import {
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
import { EquipmentChecklist } from "@/components/EquipmentChecklist";
import { useCreateEnvironment } from "@/hooks/useEnvironments";
import { useUpdateProfile } from "@/hooks/useProfile";

const GYM_TYPES: { label: string; icon: FeatherIcon }[] = [
  { label: "Home Gym", icon: "home" },
  { label: "Commercial Gym", icon: "map-pin" },
  { label: "CrossFit Box", icon: "target" },
  { label: "Other", icon: "grid" },
];

export default function GymSetupScreen() {
  const insets = useSafeAreaInsets();
  const { mutateAsync: createEnv, isPending } = useCreateEnvironment();
  const { mutateAsync: updateProfile } = useUpdateProfile();

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [equipment, setEquipment] = useState<Record<string, string[]>>({});

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const toggleEquipment = (category: string, item: string) => {
    setEquipment((prev) => {
      const catItems = prev[category] ?? [];
      const updated = catItems.includes(item)
        ? catItems.filter((i) => i !== item)
        : [...catItems, item];
      return { ...prev, [category]: updated };
    });
  };

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await createEnv({
      name: name || "My Gym",
      type: type || "Other",
      equipment,
      isActive: true,
    });
    await updateProfile({ onboardingCompleted: true });
    router.replace("/(tabs)");
  };

  const canSave = name.trim() !== "" && type !== "";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.headerArea, { paddingTop: topPad + 12 }]}>
        <View style={styles.iconRow}>
          <View style={styles.iconCircle}>
            <Feather name="map-pin" size={24} color={Colors.orange} />
          </View>
        </View>
        <Text style={styles.headerTitle}>SET UP YOUR GYM</Text>
        <Text style={styles.headerSubtitle}>
          Define your primary training environment so the AI knows what equipment you have
        </Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ paddingBottom: botPad + 120, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formSection}>
          <Text style={styles.inputLabel}>GYM NAME</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Home Garage, Gold's Gym"
            placeholderTextColor={Colors.textSubtle}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.inputLabel}>GYM TYPE</Text>
          <View style={styles.typeGrid}>
            {GYM_TYPES.map((t) => (
              <Pressable
                key={t.label}
                style={[styles.typeCard, type === t.label && styles.typeCardActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setType(t.label);
                }}
              >
                <Feather
                  name={t.icon}
                  size={22}
                  color={type === t.label ? Colors.orange : Colors.textMuted}
                />
                <Text style={[styles.typeText, type === t.label && styles.typeTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.inputLabel}>AVAILABLE EQUIPMENT</Text>
          <EquipmentChecklist selected={equipment} onToggle={toggleEquipment} />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: botPad + 12 }]}>
        <Pressable
          style={[styles.saveBtn, styles.saveFullWidth, (!canSave || isPending) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || isPending}
        >
          <Feather name="check" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>{isPending ? "SAVING..." : "SAVE & START"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  headerArea: { paddingHorizontal: 20, gap: 8, paddingBottom: 16 },
  iconRow: { alignItems: "center", marginBottom: 4 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(252,82,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(252,82,0,0.25)",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    letterSpacing: 1,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  scrollArea: { flex: 1 },
  formSection: { gap: 10, marginBottom: 24 },
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
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  typeCard: {
    width: "47%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
    gap: 8,
  },
  typeCardActive: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.1)",
  },
  typeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  typeTextActive: { color: Colors.orange },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  saveFullWidth: { flex: 1, justifyContent: "center" },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
});
