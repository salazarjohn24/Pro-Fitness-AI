import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";

const GOALS = ["Build Muscle", "Lose Weight", "Improve Performance", "Increase Endurance", "Stay Healthy"];
const FREQUENCIES = [2, 3, 4, 5, 6];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { mutate: updateProfile, isPending } = useUpdateProfile();

  const [editingGoal, setEditingGoal] = useState(false);
  const [editingFreq, setEditingFreq] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await logout();
    router.replace("/welcome");
  };

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : user?.email?.split("@")[0] ?? "Athlete";

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: topPad }]}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>ATHLETE PROFILE</Text>
      </View>

      {/* Avatar + Name */}
      <View style={styles.avatarCard}>
        <View style={styles.avatarWrap}>
          {user?.profileImageUrl ? (
            <Image source={{ uri: user.profileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Feather name="zap" size={10} color={Colors.orange} />
          </View>
        </View>
        <View style={styles.nameArea}>
          <Text style={styles.displayName}>{displayName.toUpperCase()}</Text>
          <Text style={styles.email}>{user?.email ?? ""}</Text>
          <View style={styles.memberBadge}>
            <Text style={styles.memberText}>PRO MEMBER</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: "Streak", value: profile?.streakDays ?? 0, unit: "days", color: Colors.orange },
          { label: "Goal", value: (profile?.workoutFrequency ?? 3) + "x", unit: "/week", color: Colors.highlight },
          { label: "Progress", value: profile?.dailySyncProgress ?? 0, unit: "%", color: Colors.recovery },
        ].map(({ label, value, unit, color }) => (
          <View key={label} style={[styles.statCard, { borderColor: color + "25" }]}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statUnit}>{unit}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Fitness Goal */}
      <View style={styles.sectionCard}>
        <View style={styles.auditHeader}>
          <Text style={styles.auditTitle}>FITNESS GOAL</Text>
        </View>
        {!editingGoal ? (
          <Pressable
            style={styles.fieldRow}
            onPress={() => setEditingGoal(true)}
          >
            <Text style={styles.fieldValue}>{profile?.fitnessGoal ?? "Not set"}</Text>
            <Feather name="edit-2" size={14} color={Colors.textSubtle} />
          </Pressable>
        ) : (
          <View style={styles.goalOptions}>
            {GOALS.map((g) => (
              <Pressable
                key={g}
                style={({ pressed }) => [
                  styles.goalOption,
                  profile?.fitnessGoal === g && styles.goalOptionActive,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  updateProfile({ fitnessGoal: g });
                  setEditingGoal(false);
                }}
              >
                <Text style={[styles.goalOptionText, profile?.fitnessGoal === g && styles.goalOptionTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Workout Frequency */}
      <View style={styles.sectionCard}>
        <View style={styles.auditHeader}>
          <Text style={styles.auditTitle}>WEEKLY FREQUENCY</Text>
        </View>
        <View style={styles.freqRow}>
          {FREQUENCIES.map((f) => (
            <Pressable
              key={f}
              style={({ pressed }) => [
                styles.freqBtn,
                profile?.workoutFrequency === f && styles.freqBtnActive,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                updateProfile({ workoutFrequency: f });
              }}
            >
              <Text style={[styles.freqBtnText, profile?.workoutFrequency === f && styles.freqBtnTextActive]}>{f}x</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* DNA Metrics */}
      <View style={styles.sectionCard}>
        <View style={styles.auditHeader}>
          <Text style={styles.auditTitle}>PERFORMANCE DNA</Text>
        </View>
        <View style={styles.dnaGrid}>
          {[
            { label: "Recovery Rate", value: "High", icon: "shield" },
            { label: "Power Profile", value: "Moderate", icon: "zap" },
            { label: "Endurance", value: "Building", icon: "trending-up" },
            { label: "Mobility", value: "Average", icon: "refresh-cw" },
          ].map(({ label, value, icon }) => (
            <View key={label} style={styles.dnaCard}>
              <Feather name={icon as any} size={14} color={Colors.recovery} />
              <Text style={styles.dnaValue}>{value}</Text>
              <Text style={styles.dnaLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <Pressable style={styles.actionBtn}>
          <Feather name="share-2" size={16} color={Colors.textMuted} />
          <Text style={styles.actionBtnText}>Share</Text>
        </Pressable>
        <Pressable style={styles.actionBtn}>
          <Feather name="settings" size={16} color={Colors.textMuted} />
          <Text style={styles.actionBtnText}>Settings</Text>
        </Pressable>
        <Pressable style={styles.actionBtn}>
          <Feather name="bell" size={16} color={Colors.textMuted} />
          <Text style={styles.actionBtnText}>Alerts</Text>
        </Pressable>
      </View>

      {/* Logout */}
      <Pressable
        style={({ pressed }) => [styles.logoutBtn, { opacity: pressed ? 0.8 : 1 }]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={16} color="#F87171" />
        <Text style={styles.logoutText}>SIGN OUT</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loadingContainer: { flex: 1, backgroundColor: Colors.bgPrimary, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, gap: 14 },
  header: { marginBottom: 4 },
  sectionLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 2 },
  avatarCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    padding: 20,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(252,82,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(252,82,0,0.3)",
  },
  avatarInitial: { fontSize: 28, fontFamily: "Inter_900Black", color: Colors.orange },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.bgPrimary,
    borderWidth: 2,
    borderColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  nameArea: { flex: 1, gap: 4 },
  displayName: { fontSize: 18, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic" },
  email: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  memberBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(252,82,0,0.15)",
    borderWidth: 1,
    borderColor: "rgba(252,82,0,0.3)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  memberText: { fontSize: 8, fontFamily: "Inter_900Black", color: Colors.orange, letterSpacing: 1 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    gap: 2,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_900Black", fontStyle: "italic" },
  statUnit: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textSubtle },
  statLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  sectionCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  auditHeader: { borderLeftWidth: 2, borderLeftColor: Colors.orange, paddingLeft: 8 },
  auditTitle: { fontSize: 9, fontFamily: "Inter_900Black", color: Colors.textSubtle, letterSpacing: 2 },
  fieldRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldValue: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#E7E5E4" },
  goalOptions: { gap: 8 },
  goalOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  goalOptionActive: { borderColor: Colors.orange, backgroundColor: "rgba(252,82,0,0.1)" },
  goalOptionText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  goalOptionTextActive: { color: Colors.orange, fontFamily: "Inter_700Bold" },
  freqRow: { flexDirection: "row", gap: 8 },
  freqBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  freqBtnActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  freqBtnText: { fontSize: 12, fontFamily: "Inter_900Black", color: Colors.textMuted },
  freqBtnTextActive: { color: "#fff" },
  dnaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dnaCard: {
    width: "47.5%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  dnaValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#E7E5E4" },
  dnaLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textSubtle },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnText: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.2)",
    backgroundColor: "rgba(248,113,113,0.06)",
    borderRadius: 16,
    paddingVertical: 16,
  },
  logoutText: { fontSize: 12, fontFamily: "Inter_900Black", color: "#F87171", letterSpacing: 1 },
});
