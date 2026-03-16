import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";

const MUSCLE_GROUPS_FRONT = [
  { id: "chest", label: "Chest", x: 75, y: 72, w: 50, h: 24 },
  { id: "shoulders", label: "Shoulders", x: 48, y: 56, w: 104, h: 16 },
  { id: "biceps_l", label: "L Bicep", x: 38, y: 82, w: 18, h: 28 },
  { id: "biceps_r", label: "R Bicep", x: 144, y: 82, w: 18, h: 28 },
  { id: "abs", label: "Abs", x: 80, y: 100, w: 40, h: 36 },
  { id: "quads_l", label: "L Quad", x: 62, y: 150, w: 26, h: 40 },
  { id: "quads_r", label: "R Quad", x: 112, y: 150, w: 26, h: 40 },
  { id: "shins", label: "Shins", x: 75, y: 200, w: 50, h: 30 },
];

const MUSCLE_GROUPS_BACK = [
  { id: "traps", label: "Traps", x: 75, y: 50, w: 50, h: 18 },
  { id: "upper_back", label: "Upper Back", x: 68, y: 70, w: 64, h: 20 },
  { id: "lats", label: "Lats", x: 62, y: 92, w: 76, h: 24 },
  { id: "lower_back", label: "Lower Back", x: 78, y: 118, w: 44, h: 20 },
  { id: "triceps_l", label: "L Tricep", x: 38, y: 82, w: 18, h: 28 },
  { id: "triceps_r", label: "R Tricep", x: 144, y: 82, w: 18, h: 28 },
  { id: "glutes", label: "Glutes", x: 68, y: 140, w: 64, h: 24 },
  { id: "hamstrings_l", label: "L Hamstring", x: 62, y: 168, w: 26, h: 36 },
  { id: "hamstrings_r", label: "R Hamstring", x: 112, y: 168, w: 26, h: 36 },
  { id: "calves", label: "Calves", x: 68, y: 208, w: 64, h: 24 },
];

interface Props {
  selected: string[];
  onToggle: (id: string) => void;
}

function BodySilhouette({ isFront }: { isFront: boolean }) {
  return (
    <Svg width={200} height={260} viewBox="0 0 200 260">
      <Circle cx="100" cy="22" r="18" fill="#333" stroke="#444" strokeWidth="1" />
      <Path
        d={isFront
          ? "M100 40 L100 42 C100 42 85 46 72 54 C58 62 50 58 42 68 C34 78 36 90 38 100 C40 110 44 112 48 110 C52 108 56 100 58 96 C60 92 62 88 64 86 C66 84 68 82 68 86 C68 90 66 100 66 108 C66 116 64 126 64 132 C64 138 62 140 62 148 C62 156 60 170 60 180 C60 190 58 210 58 218 C58 226 58 236 62 240 C66 244 74 244 76 240 C78 236 80 218 80 210 C80 202 82 190 84 182 C86 174 88 170 90 170 C92 170 96 170 100 170 C104 170 108 170 110 170 C112 170 114 174 116 182 C118 190 120 202 120 210 C120 218 122 236 124 240 C126 244 134 244 138 240 C142 236 142 226 142 218 C142 210 140 190 140 180 C140 170 138 156 138 148 C138 140 136 138 136 132 C136 126 134 116 134 108 C134 100 132 90 132 86 C132 82 134 84 136 86 C138 88 140 92 142 96 C144 100 148 108 152 110 C156 112 160 110 162 100 C164 90 166 78 158 68 C150 58 142 62 128 54 C115 46 100 42 100 42Z"
          : "M100 40 L100 42 C100 42 85 46 72 54 C58 62 50 58 42 68 C34 78 36 90 38 100 C40 110 44 112 48 110 C52 108 56 100 58 96 C60 92 62 88 64 86 C66 84 68 82 68 86 C68 90 66 100 66 108 C66 116 64 126 64 132 C64 138 62 140 62 148 C62 156 60 170 60 180 C60 190 58 210 58 218 C58 226 58 236 62 240 C66 244 74 244 76 240 C78 236 80 218 80 210 C80 202 82 190 84 182 C86 174 88 170 90 170 C92 170 96 170 100 170 C104 170 108 170 110 170 C112 170 114 174 116 182 C118 190 120 202 120 210 C120 218 122 236 124 240 C126 244 134 244 138 240 C142 236 142 226 142 218 C142 210 140 190 140 180 C140 170 138 156 138 148 C138 140 136 138 136 132 C136 126 134 116 134 108 C134 100 132 90 132 86 C132 82 134 84 136 86 C138 88 140 92 142 96 C144 100 148 108 152 110 C156 112 160 110 162 100 C164 90 166 78 158 68 C150 58 142 62 128 54 C115 46 100 42 100 42Z"
        }
        fill="#2A2A28"
        stroke="#444"
        strokeWidth="1"
      />
    </Svg>
  );
}

export function BodyMap({ selected, onToggle }: Props) {
  const [view, setView] = React.useState<"front" | "back">("front");

  const groups = view === "front" ? MUSCLE_GROUPS_FRONT : MUSCLE_GROUPS_BACK;

  const handleToggle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(id);
  };

  return (
    <View style={styles.container}>
      <View style={styles.viewToggle}>
        <Pressable
          onPress={() => setView("front")}
          style={[styles.toggleBtn, view === "front" && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleText, view === "front" && styles.toggleTextActive]}>FRONT</Text>
        </Pressable>
        <Pressable
          onPress={() => setView("back")}
          style={[styles.toggleBtn, view === "back" && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleText, view === "back" && styles.toggleTextActive]}>BACK</Text>
        </Pressable>
      </View>

      <View style={styles.bodyContainer}>
        <BodySilhouette isFront={view === "front"} />
        {groups.map((g) => {
          const isSelected = selected.includes(g.id);
          return (
            <Pressable
              key={g.id}
              onPress={() => handleToggle(g.id)}
              style={[
                styles.muscleZone,
                { left: g.x, top: g.y, width: g.w, height: g.h },
                isSelected && styles.muscleZoneSelected,
              ]}
            >
              <Text style={[styles.muscleLabel, isSelected && styles.muscleLabelSelected]}>
                {g.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected.length > 0 && (
        <View style={styles.selectedList}>
          {selected.map((id) => {
            const group = [...MUSCLE_GROUPS_FRONT, ...MUSCLE_GROUPS_BACK].find((g) => g.id === id);
            return (
              <View key={id} style={styles.selectedChip}>
                <Text style={styles.selectedChipText}>{group?.label ?? id}</Text>
                <Pressable onPress={() => handleToggle(id)}>
                  <Text style={styles.selectedChipX}>×</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 12 },
  viewToggle: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  toggleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: Colors.bgCard,
  },
  toggleBtnActive: {
    backgroundColor: Colors.orange,
  },
  toggleText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 1,
  },
  toggleTextActive: {
    color: "#fff",
  },
  bodyContainer: {
    width: 200,
    height: 260,
    position: "relative",
  },
  muscleZone: {
    position: "absolute",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  muscleZoneSelected: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.25)",
  },
  muscleLabel: {
    fontSize: 6,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  muscleLabelSelected: {
    color: Colors.orange,
  },
  selectedList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: "rgba(252,82,0,0.15)",
    borderWidth: 1,
    borderColor: "rgba(252,82,0,0.3)",
  },
  selectedChipText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.orange,
    textTransform: "uppercase",
  },
  selectedChipX: {
    fontSize: 14,
    color: Colors.orange,
    marginLeft: 2,
  },
});
