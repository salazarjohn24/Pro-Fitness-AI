import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";

export const EQUIPMENT_CATEGORIES: Record<string, string[]> = {
  "Weights": [
    "Barbell", "Dumbbells", "Kettlebells", "EZ Curl Bar",
    "Weight Plates", "Trap Bar",
  ],
  "Machines": [
    "Cable Machine", "Smith Machine", "Leg Press", "Lat Pulldown",
    "Chest Press Machine", "Leg Extension", "Leg Curl", "Rowing Machine",
  ],
  "Bodyweight · Rig": [
    "Pull-Up Bar", "Dip Station", "Gymnastics Rings", "TRX / Suspension",
    "Resistance Bands", "Ab Wheel", "Plyo Box", "Battle Ropes",
  ],
};

interface EquipmentChecklistProps {
  selected: Record<string, string[]>;
  onToggle: (category: string, item: string) => void;
}

export function EquipmentChecklist({ selected, onToggle }: EquipmentChecklistProps) {
  return (
    <View style={styles.container}>
      {Object.entries(EQUIPMENT_CATEGORIES).map(([category, items]) => (
        <View key={category} style={styles.categoryBlock}>
          <View style={styles.categoryHeader}>
            <View style={styles.categoryDot} />
            <Text style={styles.categoryTitle}>{category.toUpperCase()}</Text>
          </View>
          <View style={styles.itemsGrid}>
            {items.map((item) => {
              const isSelected = selected[category]?.includes(item) ?? false;
              return (
                <Pressable
                  key={item}
                  style={[styles.equipmentChip, isSelected && styles.equipmentChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onToggle(category, item);
                  }}
                >
                  {isSelected && (
                    <Feather name="check" size={12} color={Colors.orange} />
                  )}
                  <Text style={[styles.equipmentText, isSelected && styles.equipmentTextActive]}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  categoryBlock: { gap: 10 },
  categoryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.orange,
  },
  categoryTitle: {
    fontSize: 10,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  itemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  equipmentChip: {
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
  equipmentChipActive: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.1)",
  },
  equipmentText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  equipmentTextActive: {
    color: Colors.orange,
    fontFamily: "Inter_700Bold",
  },
});
