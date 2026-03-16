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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useExercises, type Exercise } from "@/hooks/useExercises";

const MUSCLE_GROUPS = [
  { id: "", label: "ALL" },
  { id: "chest", label: "CHEST" },
  { id: "back", label: "BACK" },
  { id: "legs", label: "LEGS" },
  { id: "shoulders", label: "SHOULDERS" },
  { id: "arms", label: "ARMS" },
  { id: "core", label: "CORE" },
];

const EQUIPMENT_OPTIONS = [
  { id: "", label: "ALL" },
  { id: "barbell", label: "BARBELL" },
  { id: "dumbbell", label: "DUMBBELL" },
  { id: "cable", label: "CABLE" },
  { id: "machine", label: "MACHINE" },
  { id: "bodyweight", label: "BODYWEIGHT" },
];

const GOAL_OPTIONS = [
  { id: "", label: "ALL" },
  { id: "strength", label: "STRENGTH" },
  { id: "hypertrophy", label: "HYPERTROPHY" },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "#4ADE80",
  intermediate: Colors.orange,
  advanced: "#EF4444",
};

const EQUIPMENT_ICONS: Record<string, string> = {
  barbell: "target",
  dumbbell: "box",
  cable: "link",
  machine: "settings",
  bodyweight: "user",
};

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [goal, setGoal] = useState("");
  const [activeFilter, setActiveFilter] = useState<"muscle" | "equipment" | "goal">("muscle");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: exercises, isLoading } = useExercises({
    muscle_group: muscleGroup || undefined,
    equipment: equipment || undefined,
    goal: goal || undefined,
    search: searchText || undefined,
  });

  const filterOptions = activeFilter === "muscle" ? MUSCLE_GROUPS
    : activeFilter === "equipment" ? EQUIPMENT_OPTIONS
    : GOAL_OPTIONS;

  const activeValue = activeFilter === "muscle" ? muscleGroup
    : activeFilter === "equipment" ? equipment
    : goal;

  const setActiveValue = (val: string) => {
    if (activeFilter === "muscle") setMuscleGroup(val);
    else if (activeFilter === "equipment") setEquipment(val);
    else setGoal(val);
  };

  const activeFilterCount = [muscleGroup, equipment, goal].filter(Boolean).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.dateText}>EXERCISE VAULT</Text>
        <Text style={styles.title}>Exercise{"\n"}<Text style={styles.titleAccent}>Library</Text></Text>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={16} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor={Colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchText.length > 0 && (
          <Pressable onPress={() => setSearchText("")}>
            <Feather name="x" size={16} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.filterTabs}>
        {(["muscle", "equipment", "goal"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveFilter(f);
            }}
            style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, activeFilter === f && styles.filterTabTextActive]}>
              {f === "muscle" ? "MUSCLE" : f === "equipment" ? "EQUIP" : "GOAL"}
            </Text>
          </Pressable>
        ))}
        {activeFilterCount > 0 && (
          <Pressable
            onPress={() => {
              setMuscleGroup("");
              setEquipment("");
              setGoal("");
            }}
            style={styles.clearBtn}
          >
            <Feather name="x" size={12} color={Colors.orange} />
            <Text style={styles.clearText}>CLEAR</Text>
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
        <View style={styles.categories}>
          {filterOptions.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveValue(c.id);
              }}
              style={[styles.categoryBtn, activeValue === c.id && styles.categoryBtnActive]}
            >
              <Text style={[styles.categoryLabel, activeValue === c.id && styles.categoryLabelActive]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Pressable
        style={({ pressed }) => [styles.aiBuildBtn, { opacity: pressed ? 0.85 : 1 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/workout-architect");
        }}
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

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.orange} />
          <Text style={styles.loadingText}>Loading exercises...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.resultCount}>
            {exercises?.length ?? 0} exercise{(exercises?.length ?? 0) !== 1 ? "s" : ""}
          </Text>
          <View style={styles.exerciseGrid}>
            {exercises?.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const iconName = EQUIPMENT_ICONS[exercise.equipment] || "activity";
  const diffColor = DIFFICULTY_COLORS[exercise.difficulty] || Colors.textMuted;

  return (
    <Pressable
      style={({ pressed }) => [styles.exerciseCard, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/exercise/[id]" as any, params: { id: String(exercise.id) } });
      }}
    >
      <View style={styles.cardIconContainer}>
        <Feather name={iconName as any} size={24} color={Colors.orange} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={2}>{exercise.name}</Text>
        <Text style={styles.cardMuscle}>{exercise.primaryMuscles?.[0] || exercise.muscleGroup}</Text>
      </View>
      <View style={styles.cardFooter}>
        <View style={[styles.diffBadge, { borderColor: diffColor + "40", backgroundColor: diffColor + "15" }]}>
          <Text style={[styles.diffText, { color: diffColor }]}>{exercise.difficulty.toUpperCase()}</Text>
        </View>
        <View style={styles.equipBadge}>
          <Text style={styles.equipText}>{exercise.equipment.toUpperCase()}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { gap: 6 },
  dateText: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 2 },
  title: { fontSize: 32, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic", lineHeight: 36 },
  titleAccent: { color: Colors.orange },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    padding: 0,
  },
  filterTabs: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterTabActive: {
    backgroundColor: "rgba(252,82,0,0.15)",
    borderColor: Colors.orange + "60",
  },
  filterTabText: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  filterTabTextActive: {
    color: Colors.orange,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  clearText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.orange,
    letterSpacing: 0.5,
  },
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
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  resultCount: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  exerciseGrid: {
    gap: 12,
  },
  exerciseCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(252,82,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    gap: 4,
  },
  cardName: {
    fontSize: 15,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
  },
  cardMuscle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textTransform: "capitalize",
  },
  cardFooter: {
    flexDirection: "row",
    gap: 8,
  },
  diffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  diffText: {
    fontSize: 8,
    fontFamily: "Inter_900Black",
    letterSpacing: 1,
  },
  equipBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  equipText: {
    fontSize: 8,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 1,
  },
});
