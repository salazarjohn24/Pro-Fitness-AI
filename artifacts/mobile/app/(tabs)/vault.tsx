import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";

const CATEGORIES = [
  { id: "all", label: "ALL" },
  { id: "strength", label: "STRENGTH" },
  { id: "hypertrophy", label: "HYPERTROPHY" },
  { id: "mobility", label: "MOBILITY" },
];

const WORKOUTS = [
  {
    id: "1",
    category: "strength",
    title: "Heavy Compound Day",
    subtitle: "Squat · Deadlift · Press",
    duration: "75 min",
    sets: 18,
    tag: "Power",
    tagColor: Colors.orange,
  },
  {
    id: "2",
    category: "hypertrophy",
    title: "Back & Bicep Hypertrophy",
    subtitle: "Pull-Up · Row · Curl",
    duration: "60 min",
    sets: 24,
    tag: "Volume",
    tagColor: Colors.recovery,
  },
  {
    id: "3",
    category: "hypertrophy",
    title: "Chest & Shoulder Pump",
    subtitle: "Press · Fly · Lateral",
    duration: "55 min",
    sets: 21,
    tag: "Volume",
    tagColor: Colors.recovery,
  },
  {
    id: "4",
    category: "strength",
    title: "Leg Power Protocol",
    subtitle: "Squat · Lunge · GHD",
    duration: "80 min",
    sets: 20,
    tag: "Power",
    tagColor: Colors.orange,
  },
  {
    id: "5",
    category: "mobility",
    title: "Hip & Thoracic Flow",
    subtitle: "Stretch · Rotations · Core",
    duration: "30 min",
    sets: 12,
    tag: "Recovery",
    tagColor: "#779CAF",
  },
  {
    id: "6",
    category: "hypertrophy",
    title: "Arm Isolation Session",
    subtitle: "Curl · Extension · Forearm",
    duration: "45 min",
    sets: 18,
    tag: "Volume",
    tagColor: Colors.recovery,
  },
];

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState("all");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const filtered = activeCategory === "all"
    ? WORKOUTS
    : WORKOUTS.filter((w) => w.category === activeCategory);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.dateText}>WORKOUT VAULT</Text>
        <Text style={styles.title}>Exercise{"\n"}<Text style={styles.titleAccent}>Library</Text></Text>
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
        <View style={styles.categories}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveCategory(c.id);
              }}
              style={[styles.categoryBtn, activeCategory === c.id && styles.categoryBtnActive]}
            >
              <Text style={[styles.categoryLabel, activeCategory === c.id && styles.categoryLabelActive]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* AI Build button */}
      <Pressable
        style={({ pressed }) => [styles.aiBuildBtn, { opacity: pressed ? 0.85 : 1 }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
      >
        <View style={styles.aiBuildIcon}>
          <Feather name="cpu" size={18} color={Colors.highlight} />
        </View>
        <View style={styles.aiBuildInfo}>
          <Text style={styles.aiBuildTitle}>AI Workout Builder</Text>
          <Text style={styles.aiBuildSub}>Generate a custom session</Text>
        </View>
        <Feather name="arrow-right" size={18} color={Colors.highlight} />
      </Pressable>

      {/* Workout List */}
      <View style={styles.workoutList}>
        {filtered.map((workout) => (
          <Pressable
            key={workout.id}
            style={({ pressed }) => [styles.workoutCard, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <View style={styles.workoutTop}>
              <View style={[styles.workoutTag, { borderColor: workout.tagColor + "40", backgroundColor: workout.tagColor + "15" }]}>
                <Text style={[styles.workoutTagText, { color: workout.tagColor }]}>{workout.tag}</Text>
              </View>
              <View style={styles.workoutMeta}>
                <Feather name="clock" size={11} color={Colors.textSubtle} />
                <Text style={styles.workoutMetaText}>{workout.duration}</Text>
                <Text style={styles.workoutMetaDot}>·</Text>
                <Text style={styles.workoutMetaText}>{workout.sets} sets</Text>
              </View>
            </View>
            <Text style={styles.workoutTitle}>{workout.title}</Text>
            <Text style={styles.workoutSub}>{workout.subtitle}</Text>
            <View style={styles.workoutFooter}>
              <Pressable
                style={({ pressed }) => [styles.startSmallBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}
              >
                <Feather name="play" size={12} color="#fff" />
                <Text style={styles.startSmallText}>START</Text>
              </Pressable>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { gap: 6 },
  dateText: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 2 },
  title: { fontSize: 32, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic", lineHeight: 36 },
  titleAccent: { color: Colors.orange },
  catScroll: { marginHorizontal: -20 },
  categories: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 4 },
  categoryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryBtnActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  categoryLabel: { fontSize: 9, fontFamily: "Inter_900Black", color: Colors.textMuted, letterSpacing: 1 },
  categoryLabelActive: { color: "#fff" },
  aiBuildBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.3)",
    borderRadius: 20,
    padding: 16,
  },
  aiBuildIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(246,234,152,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  aiBuildInfo: { flex: 1 },
  aiBuildTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text, textTransform: "uppercase", letterSpacing: 0.5 },
  aiBuildSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSubtle, marginTop: 2 },
  workoutList: { gap: 12 },
  workoutCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
  workoutTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workoutTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  workoutTagText: { fontSize: 9, fontFamily: "Inter_900Black", letterSpacing: 1 },
  workoutMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  workoutMetaText: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSubtle },
  workoutMetaDot: { color: Colors.textSubtle },
  workoutTitle: { fontSize: 17, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic", textTransform: "uppercase" },
  workoutSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  workoutFooter: { flexDirection: "row", marginTop: 4 },
  startSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.orange,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  startSmallText: { fontSize: 10, fontFamily: "Inter_900Black", color: "#fff", letterSpacing: 1 },
});
