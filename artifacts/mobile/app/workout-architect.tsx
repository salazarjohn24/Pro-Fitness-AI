import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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

const EXERCISE_LIBRARY = [
  { id: "sq", name: "Back Squat", muscles: "Quads · Glutes", category: "legs" },
  { id: "dl", name: "Deadlift", muscles: "Posterior Chain", category: "legs" },
  { id: "bp", name: "Bench Press", muscles: "Chest · Triceps", category: "push" },
  { id: "op", name: "Overhead Press", muscles: "Shoulders · Triceps", category: "push" },
  { id: "pu", name: "Pull-Up", muscles: "Lats · Biceps", category: "pull" },
  { id: "br", name: "Barbell Row", muscles: "Mid Back · Biceps", category: "pull" },
  { id: "lp", name: "Leg Press", muscles: "Quads · Hamstrings", category: "legs" },
  { id: "rd", name: "Romanian Deadlift", muscles: "Hamstrings · Glutes", category: "legs" },
  { id: "df", name: "DB Fly", muscles: "Chest", category: "push" },
  { id: "lr", name: "Lateral Raise", muscles: "Side Delts", category: "push" },
  { id: "cu", name: "Barbell Curl", muscles: "Biceps", category: "pull" },
  { id: "te", name: "Tricep Extension", muscles: "Triceps", category: "push" },
  { id: "fp", name: "Face Pull", muscles: "Rear Delts", category: "pull" },
  { id: "pl", name: "Plank", muscles: "Core", category: "core" },
  { id: "cr", name: "Cable Row", muscles: "Mid Back", category: "pull" },
];

const CATEGORIES = [
  { id: "all", label: "ALL" },
  { id: "push", label: "PUSH" },
  { id: "pull", label: "PULL" },
  { id: "legs", label: "LEGS" },
  { id: "core", label: "CORE" },
];

interface SelectedEx {
  id: string;
  name: string;
  muscles: string;
  sets: number;
  reps: number;
}

export default function WorkoutArchitectScreen() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<SelectedEx[]>([]);
  const [workoutName, setWorkoutName] = useState("My Custom Session");
  const [step, setStep] = useState<"build" | "review">("build");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const filtered = category === "all"
    ? EXERCISE_LIBRARY
    : EXERCISE_LIBRARY.filter((e) => e.category === category);

  const isSelected = (id: string) => selected.some((s) => s.id === id);

  const toggleExercise = (ex: (typeof EXERCISE_LIBRARY)[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isSelected(ex.id)) {
      setSelected((prev) => prev.filter((s) => s.id !== ex.id));
    } else {
      setSelected((prev) => [...prev, { ...ex, sets: 3, reps: 10 }]);
    }
  };

  const adjustSets = (id: string, delta: number) => {
    Haptics.selectionAsync();
    setSelected((prev) =>
      prev.map((s) => s.id === id ? { ...s, sets: Math.max(1, Math.min(8, s.sets + delta)) } : s)
    );
  };

  const adjustReps = (id: string, delta: number) => {
    Haptics.selectionAsync();
    setSelected((prev) =>
      prev.map((s) => s.id === id ? { ...s, reps: Math.max(1, Math.min(30, s.reps + delta)) } : s)
    );
  };

  const totalVolume = selected.reduce((a, s) => a + s.sets * s.reps, 0);
  const estimatedTime = selected.reduce((a, s) => a + s.sets * 2.5, 0);

  if (step === "review") {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setStep("build")} style={styles.backBtn}>
            <Feather name="arrow-left" size={18} color={Colors.textMuted} />
          </Pressable>
          <Text style={styles.topBarTitle}>REVIEW WORKOUT</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.reviewHeader}>
            <TextInput
              style={styles.workoutNameInput}
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholderTextColor={Colors.textSubtle}
            />
            <View style={styles.reviewStats}>
              <View style={styles.reviewStat}>
                <Feather name="clock" size={14} color={Colors.recovery} />
                <Text style={styles.reviewStatVal}>~{Math.round(estimatedTime)} min</Text>
              </View>
              <View style={styles.reviewStat}>
                <Feather name="layers" size={14} color={Colors.orange} />
                <Text style={styles.reviewStatVal}>{selected.reduce((a, s) => a + s.sets, 0)} sets</Text>
              </View>
              <View style={styles.reviewStat}>
                <Feather name="trending-up" size={14} color={Colors.highlight} />
                <Text style={styles.reviewStatVal}>{totalVolume} reps total</Text>
              </View>
            </View>
          </View>

          {selected.map((ex, i) => (
            <View key={ex.id} style={styles.reviewExCard}>
              <View style={styles.reviewExHeader}>
                <View style={styles.reviewExNum}>
                  <Text style={styles.reviewExNumText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewExName}>{ex.name}</Text>
                  <Text style={styles.reviewExMuscles}>{ex.muscles}</Text>
                </View>
                <Pressable onPress={() => setSelected((prev) => prev.filter((s) => s.id !== ex.id))}>
                  <Feather name="trash-2" size={16} color="#555" />
                </Pressable>
              </View>

              <View style={styles.adjustRow}>
                <View style={styles.adjBlock}>
                  <Text style={styles.adjLabel}>SETS</Text>
                  <View style={styles.adjControls}>
                    <Pressable onPress={() => adjustSets(ex.id, -1)} style={styles.adjBtn}>
                      <Feather name="minus" size={14} color={Colors.textMuted} />
                    </Pressable>
                    <Text style={styles.adjVal}>{ex.sets}</Text>
                    <Pressable onPress={() => adjustSets(ex.id, 1)} style={styles.adjBtn}>
                      <Feather name="plus" size={14} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.adjDivider} />
                <View style={styles.adjBlock}>
                  <Text style={styles.adjLabel}>REPS</Text>
                  <View style={styles.adjControls}>
                    <Pressable onPress={() => adjustReps(ex.id, -1)} style={styles.adjBtn}>
                      <Feather name="minus" size={14} color={Colors.textMuted} />
                    </Pressable>
                    <Text style={styles.adjVal}>{ex.reps}</Text>
                    <Pressable onPress={() => adjustReps(ex.id, 1)} style={styles.adjBtn}>
                      <Feather name="plus" size={14} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: botPad + 12 }]}>
          <Pressable
            style={({ pressed }) => [styles.startBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.replace("/workout-session");
            }}
          >
            <Feather name="play" size={18} color="#fff" />
            <Text style={styles.startBtnText}>BEGIN WORKOUT</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={18} color={Colors.textMuted} />
        </Pressable>
        <Text style={styles.topBarTitle}>WORKOUT ARCHITECT</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Selected count */}
      {selected.length > 0 && (
        <View style={styles.selectionBar}>
          <Feather name="check-circle" size={14} color={Colors.highlight} />
          <Text style={styles.selectionText}>{selected.length} exercise{selected.length !== 1 ? "s" : ""} selected</Text>
          <View style={styles.selectionDot} />
          <Text style={styles.selectionText}>~{Math.round(estimatedTime)} min</Text>
        </View>
      )}

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
        <View style={styles.categories}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => { Haptics.selectionAsync(); setCategory(c.id); }}
              style={[styles.catBtn, category === c.id && styles.catBtnActive]}
            >
              <Text style={[styles.catLabel, category === c.id && styles.catLabelActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.exGrid}>
          {filtered.map((ex) => {
            const sel = isSelected(ex.id);
            return (
              <Pressable
                key={ex.id}
                onPress={() => toggleExercise(ex)}
                style={({ pressed }) => [
                  styles.exTile,
                  sel && styles.exTileSelected,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                <View style={styles.exTileTop}>
                  <View style={[styles.exTileCheck, sel && styles.exTileCheckDone]}>
                    {sel && <Feather name="check" size={12} color={Colors.bgPrimary} />}
                  </View>
                </View>
                <Text style={[styles.exTileName, sel && styles.exTileNameSel]}>{ex.name}</Text>
                <Text style={styles.exTileMuscles}>{ex.muscles}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {selected.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: botPad + 12 }]}>
          <Pressable
            style={({ pressed }) => [styles.startBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep("review"); }}
          >
            <Feather name="arrow-right" size={18} color="#fff" />
            <Text style={styles.startBtnText}>REVIEW & START ({selected.length})</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    letterSpacing: 2,
    fontStyle: "italic",
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "rgba(246,234,152,0.06)",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(246,234,152,0.15)",
  },
  selectionText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.highlight },
  selectionDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textSubtle },
  catScroll: { paddingLeft: 20, marginBottom: 4 },
  categories: { flexDirection: "row", gap: 8, paddingVertical: 8, paddingRight: 20 },
  catBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catBtnActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  catLabel: { fontSize: 9, fontFamily: "Inter_900Black", color: Colors.textMuted, letterSpacing: 1 },
  catLabelActive: { color: "#fff" },
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  exGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  exTile: {
    width: "47%",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  exTileSelected: {
    borderColor: Colors.highlight,
    backgroundColor: "rgba(246,234,152,0.07)",
  },
  exTileTop: { flexDirection: "row", justifyContent: "flex-end" },
  exTileCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#444",
    alignItems: "center",
    justifyContent: "center",
  },
  exTileCheckDone: {
    backgroundColor: Colors.highlight,
    borderColor: Colors.highlight,
  },
  exTileName: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  exTileNameSel: { color: Colors.highlight },
  exTileMuscles: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSubtle },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
  },
  startBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  reviewHeader: { gap: 12, marginBottom: 4 },
  workoutNameInput: {
    fontSize: 24,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingBottom: 8,
  },
  reviewStats: { flexDirection: "row", gap: 16 },
  reviewStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  reviewStatVal: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textMuted },
  reviewExCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  reviewExHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewExNum: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewExNumText: { fontSize: 12, fontFamily: "Inter_900Black", color: Colors.textSubtle },
  reviewExName: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text, textTransform: "uppercase", letterSpacing: 0.3 },
  reviewExMuscles: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSubtle, marginTop: 2 },
  adjustRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adjBlock: { flex: 1, alignItems: "center", padding: 12, gap: 8 },
  adjDivider: { width: 1, backgroundColor: Colors.border },
  adjLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  adjControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  adjBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  adjVal: { fontSize: 20, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic", minWidth: 28, textAlign: "center" },
});
