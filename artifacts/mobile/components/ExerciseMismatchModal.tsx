/**
 * ExerciseMismatchModal
 *
 * Alignment Item 2 — shown before saving an external workout when one or more
 * movement names don't match an existing exercise in the library.
 *
 * For each unmatched movement the user picks one of three resolutions:
 *   [Auto-create]  — create a new exercise with the original name (default)
 *   [Use best-fit] — swap to the suggested library match (shown when available)
 *   [Edit name]    — type a custom name; proceeds as auto-create with that name
 *
 * Resolutions are returned via `onResolve` and persisted in the workout payload.
 */

import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import type { ExerciseMatchCheck, ExerciseResolution } from "@/hooks/useProfile";

interface ChoiceState {
  resolution: "auto-create" | "use-fit" | "manual";
  resolvedName: string;
}

interface Props {
  visible: boolean;
  unmatched: ExerciseMatchCheck[];
  onResolve: (resolutions: ExerciseResolution[]) => void;
  onCancel: () => void;
}

export function ExerciseMismatchModal({ visible, unmatched, onResolve, onCancel }: Props) {
  const [choices, setChoices] = useState<Record<string, ChoiceState>>({});

  useEffect(() => {
    if (visible && unmatched.length > 0) {
      const initial: Record<string, ChoiceState> = {};
      for (const u of unmatched) {
        initial[u.name] = { resolution: "auto-create", resolvedName: u.name };
      }
      setChoices(initial);
    }
  }, [visible, unmatched]);

  const setChoice = (name: string, resolution: "auto-create" | "use-fit" | "manual", resolvedName: string) => {
    setChoices((prev) => ({ ...prev, [name]: { resolution, resolvedName } }));
  };

  const allResolved = unmatched.every((u) => {
    const c = choices[u.name];
    return c && c.resolvedName.trim().length > 0;
  });

  const handleConfirm = () => {
    const resolutions: ExerciseResolution[] = unmatched.map((u) => {
      const c = choices[u.name] ?? { resolution: "auto-create" as const, resolvedName: u.name };
      return {
        originalName: u.name,
        resolution: c.resolution,
        resolvedName: c.resolvedName.trim() || u.name,
        suggestedId: u.suggestion?.id ?? null,
      };
    });
    onResolve(resolutions);
  };

  if (unmatched.length === 0) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>New exercises will be created</Text>
          <Text style={styles.subtitle}>
            {unmatched.length === 1
              ? "1 movement wasn't found in your exercise library."
              : `${unmatched.length} movements weren't found in your exercise library.`}{" "}
            Choose how to handle each:
          </Text>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {unmatched.map((item) => {
              const choice = choices[item.name];
              if (!choice) return null;
              return (
                <View key={item.name} style={styles.card}>
                  <Text style={styles.movementName} numberOfLines={2}>
                    {item.name}
                  </Text>

                  <View style={styles.pills}>
                    <Pressable
                      style={[styles.pill, choice.resolution === "auto-create" && styles.pillActive]}
                      onPress={() => setChoice(item.name, "auto-create", item.name)}
                    >
                      <Text style={[styles.pillText, choice.resolution === "auto-create" && styles.pillTextActive]}>
                        Auto-create
                      </Text>
                    </Pressable>

                    {item.suggestion && (
                      <Pressable
                        style={[styles.pill, choice.resolution === "use-fit" && styles.pillActive]}
                        onPress={() => setChoice(item.name, "use-fit", item.suggestion!.name)}
                      >
                        <Text
                          style={[styles.pillText, choice.resolution === "use-fit" && styles.pillTextActive]}
                          numberOfLines={1}
                        >
                          Use "{item.suggestion.name}"
                        </Text>
                      </Pressable>
                    )}

                    <Pressable
                      style={[styles.pill, choice.resolution === "manual" && styles.pillActive]}
                      onPress={() => setChoice(item.name, "manual", item.name)}
                    >
                      <Text style={[styles.pillText, choice.resolution === "manual" && styles.pillTextActive]}>
                        Edit name
                      </Text>
                    </Pressable>
                  </View>

                  {choice.resolution === "manual" && (
                    <TextInput
                      style={styles.nameInput}
                      value={choice.resolvedName}
                      onChangeText={(text) => setChoice(item.name, "manual", text)}
                      placeholder="Enter exercise name"
                      placeholderTextColor="#888"
                      autoFocus={false}
                      returnKeyType="done"
                    />
                  )}

                  {choice.resolution === "auto-create" && (
                    <Text style={styles.hint}>
                      A new exercise "{item.name}" will be added to your library.
                    </Text>
                  )}

                  {choice.resolution === "use-fit" && item.suggestion && (
                    <Text style={styles.hint}>
                      Will track as "{item.suggestion.name}" from your library.
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <Pressable
            style={[styles.confirmBtn, !allResolved && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!allResolved}
          >
            <Text style={styles.confirmBtnText}>Save Workout</Text>
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#444",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#AAAAAA",
    marginBottom: 16,
    lineHeight: 20,
  },
  list: {
    flexGrow: 0,
  },
  card: {
    backgroundColor: "#242424",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  movementName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  pill: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#2A2A2A",
  },
  pillActive: {
    borderColor: "#FF6B2E",
    backgroundColor: "rgba(255,107,46,0.15)",
  },
  pillText: {
    fontSize: 13,
    color: "#999",
  },
  pillTextActive: {
    color: "#FF6B2E",
    fontWeight: "600",
  },
  nameInput: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#FFFFFF",
    fontSize: 14,
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: "#777",
    marginTop: 4,
    fontStyle: "italic",
  },
  confirmBtn: {
    backgroundColor: "#FF6B2E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  confirmBtnDisabled: {
    backgroundColor: "#5A3020",
    opacity: 0.6,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelBtnText: {
    color: "#888",
    fontSize: 15,
  },
});
