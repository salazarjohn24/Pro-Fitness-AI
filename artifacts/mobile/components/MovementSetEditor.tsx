import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";
import {
  defaultSetRow,
  inferMovementTypeFromName,
  inferMovementTypeFromWorkout,
  parseVolumeToSets,
  generateVolumeString,
  type MovementType,
  type SetRow,
  type RichMovement,
} from "@/utils/movementSets";

export type { MovementType, SetRow, RichMovement };
export {
  defaultSetRow,
  inferMovementTypeFromName,
  inferMovementTypeFromWorkout,
  parseVolumeToSets,
  generateVolumeString,
};

const TYPE_CHIPS: Array<{ value: MovementType; label: string }> = [
  { value: "strength", label: "STRENGTH" },
  { value: "bodyweight", label: "BW" },
  { value: "hold", label: "HOLD" },
  { value: "cardio", label: "CARDIO" },
];

interface Props {
  movement: RichMovement;
  index: number;
  onChange: (updated: RichMovement) => void;
  onDelete: () => void;
}

export function MovementSetEditor({ movement, onChange, onDelete }: Props) {
  const updateSet = (setIdx: number, patch: Partial<SetRow>) => {
    const newRows = movement.setRows.map((r, i) =>
      i === setIdx ? { ...r, ...patch } : r,
    );
    onChange({ ...movement, setRows: newRows });
  };

  const addSet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const last = movement.setRows[movement.setRows.length - 1];
    const newRow: SetRow = last ? { ...last } : defaultSetRow(movement.movementType);
    onChange({ ...movement, setRows: [...movement.setRows, newRow] });
  };

  const removeSet = (setIdx: number) => {
    if (movement.setRows.length <= 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange({ ...movement, setRows: movement.setRows.filter((_, i) => i !== setIdx) });
  };

  const changeType = (t: MovementType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newRows = movement.setRows.map(() => defaultSetRow(t));
    onChange({ ...movement, movementType: t, setRows: newRows });
  };

  const isStrength = movement.movementType === "strength";
  const isBodyweight = movement.movementType === "bodyweight";
  const isHold = movement.movementType === "hold";
  const isCardio = movement.movementType === "cardio";
  const hasReps = isStrength || isBodyweight;
  const hasDuration = isHold || isCardio;

  return (
    <View style={styles.card} accessibilityLabel={`Exercise: ${movement.name}`}>
      <View style={styles.cardHeader}>
        <Text style={styles.movementName} numberOfLines={1}>
          {movement.name}
        </Text>
        <Pressable
          onPress={onDelete}
          style={styles.deleteBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${movement.name}`}
        >
          <Feather name="trash-2" size={14} color="#F87171" />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeChipScroll}
        contentContainerStyle={styles.typeChipRow}
      >
        {TYPE_CHIPS.map(({ value, label }) => {
          const selected = movement.movementType === value;
          return (
            <Pressable
              key={value}
              onPress={() => changeType(value)}
              style={[styles.typeChip, selected && styles.typeChipSelected]}
              accessibilityRole="button"
              accessibilityLabel={`Set type to ${label}`}
              accessibilityState={{ selected }}
            >
              <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.setHeader}>
        <Text style={[styles.setHeaderLabel, { width: 22 }]}>SET</Text>
        {hasReps && <Text style={[styles.setHeaderLabel, { flex: 2 }]}>REPS</Text>}
        {isStrength && (
          <Text style={[styles.setHeaderLabel, { flex: 3 }]}>WEIGHT (LBS)</Text>
        )}
        {hasDuration && <Text style={[styles.setHeaderLabel, { flex: 2 }]}>SECS</Text>}
        {isCardio && <Text style={[styles.setHeaderLabel, { flex: 2 }]}>DIST (M)</Text>}
        {isCardio && <Text style={[styles.setHeaderLabel, { flex: 2 }]}>CAL</Text>}
        <View style={{ width: 28 }} />
      </View>

      {movement.setRows.map((row, setIdx) => (
        <View key={setIdx} style={styles.setRow}>
          <Text style={styles.setNumber}>{setIdx + 1}</Text>

          {hasReps && (
            <TextInput
              style={[styles.setInput, { flex: 2 }]}
              value={row.reps?.toString() ?? ""}
              onChangeText={(t) =>
                updateSet(setIdx, {
                  reps: t === "" ? undefined : Math.max(1, parseInt(t) || 1),
                })
              }
              keyboardType="number-pad"
              returnKeyType="done"
              blurOnSubmit
              placeholder="–"
              placeholderTextColor={Colors.textSubtle}
              accessibilityLabel={`Set ${setIdx + 1} reps`}
            />
          )}

          {isStrength && (
            <TextInput
              style={[styles.setInput, { flex: 3 }]}
              value={row.weight ?? ""}
              onChangeText={(t) => updateSet(setIdx, { weight: t })}
              keyboardType="default"
              returnKeyType="done"
              blurOnSubmit
              placeholder="BW / 135"
              placeholderTextColor={Colors.textSubtle}
              accessibilityLabel={`Set ${setIdx + 1} weight`}
            />
          )}

          {hasDuration && (
            <TextInput
              style={[styles.setInput, { flex: 2 }]}
              value={row.durationSeconds?.toString() ?? ""}
              onChangeText={(t) =>
                updateSet(setIdx, {
                  durationSeconds: t === "" ? undefined : Math.max(1, parseInt(t) || 1),
                })
              }
              keyboardType="number-pad"
              returnKeyType="done"
              blurOnSubmit
              placeholder="–"
              placeholderTextColor={Colors.textSubtle}
              accessibilityLabel={`Set ${setIdx + 1} duration seconds`}
            />
          )}

          {isCardio && (
            <TextInput
              style={[styles.setInput, { flex: 2 }]}
              value={row.distance?.toString() ?? ""}
              onChangeText={(t) =>
                updateSet(setIdx, {
                  distance: t === "" ? undefined : Math.max(1, parseInt(t) || 1),
                })
              }
              keyboardType="number-pad"
              returnKeyType="done"
              blurOnSubmit
              placeholder="–"
              placeholderTextColor={Colors.textSubtle}
              accessibilityLabel={`Set ${setIdx + 1} distance meters`}
            />
          )}

          {isCardio && (
            <TextInput
              style={[styles.setInput, { flex: 2 }]}
              value={row.calories?.toString() ?? ""}
              onChangeText={(t) =>
                updateSet(setIdx, {
                  calories: t === "" ? undefined : Math.max(1, parseInt(t) || 1),
                })
              }
              keyboardType="number-pad"
              returnKeyType="done"
              blurOnSubmit
              placeholder="–"
              placeholderTextColor={Colors.textSubtle}
              accessibilityLabel={`Set ${setIdx + 1} calories`}
            />
          )}

          <Pressable
            onPress={() => removeSet(setIdx)}
            style={[
              styles.removeSetBtn,
              movement.setRows.length <= 1 && styles.removeSetBtnDisabled,
            ]}
            disabled={movement.setRows.length <= 1}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Remove set ${setIdx + 1}`}
            accessibilityState={{ disabled: movement.setRows.length <= 1 }}
          >
            <Feather
              name="minus"
              size={12}
              color={movement.setRows.length > 1 ? "#F87171" : Colors.textSubtle}
            />
          </Pressable>
        </View>
      ))}

      <Pressable
        onPress={addSet}
        style={styles.addSetBtn}
        accessibilityRole="button"
        accessibilityLabel="Add a set"
      >
        <Feather name="plus" size={12} color={Colors.orange} />
        <Text style={styles.addSetText}>ADD SET</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  movementName: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  deleteBtn: {
    padding: 4,
  },
  typeChipScroll: {
    marginBottom: 10,
  },
  typeChipRow: {
    flexDirection: "row",
    gap: 6,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  typeChipSelected: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.12)",
  },
  typeChipText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 1,
  },
  typeChipTextSelected: { color: Colors.orange },
  setHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  setHeaderLabel: {
    flex: 1,
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  setNumber: {
    width: 22,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    textAlign: "center",
  },
  setInput: {
    backgroundColor: "#1A1A18",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 7,
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    textAlign: "center",
    minWidth: 36,
  },
  removeSetBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "rgba(248,113,113,0.08)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeSetBtnDisabled: {
    backgroundColor: "transparent",
    borderColor: Colors.border,
  },
  addSetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  addSetText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.orange,
    letterSpacing: 1,
  },
});
