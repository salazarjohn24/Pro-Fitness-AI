/**
 * MuscleEmphasisMap.tsx — Step 10: relative muscle-emphasis visualization.
 *
 * Renders a compact bar-chart of muscle emphasis from a BodyMapDisplayModel.
 * Used in both workout-detail and activity-history to give the user an at-a-glance
 * understanding of what muscles were emphasized, relative to each other.
 *
 * Design rules:
 *   - All values are relative — no absolute numbers shown.
 *   - Emphasis tiers map to brand colors (low=steel, medium=gold, high=orange).
 *   - Low-data states show a qualifier note rather than hiding the map.
 *   - The optional onModeChange handler adds a RECENT/CUMULATIVE toggle
 *     (for the history view). Without it, a static subtitle is shown.
 *   - Returns null when vm.hasData is false — callers need not check themselves.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import type { BodyMapDisplayModel, BodyMapMode } from "@/lib/viewModels/bodyMapViewModel";

// ---------------------------------------------------------------------------
// Emphasis tier → fill color (design system)
// ---------------------------------------------------------------------------

const EMPHASIS_COLOR: Record<string, string> = {
  none:   "rgba(255,255,255,0.04)",
  low:    "rgba(119,156,175,0.55)",   // steel blue
  medium: "rgba(246,234,152,0.65)",   // gold
  high:   "rgba(252,82,0,0.75)",      // orange
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  vm: BodyMapDisplayModel;
  /**
   * Optional mode toggle handler — supply for history view to enable the
   * RECENT / ALL (cumulative) toggle. Without it a static source label is shown.
   */
  onModeChange?: (mode: BodyMapMode) => void;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MuscleEmphasisMap({ vm, onModeChange, testID }: Props) {
  if (!vm.hasData) return null;

  return (
    <View style={styles.card} testID={testID ?? "muscle-emphasis-map"}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>MUSCLE EMPHASIS</Text>

        {onModeChange ? (
          <View style={styles.modeToggle}>
            <Pressable
              style={[
                styles.modeBtn,
                vm.mode === "cumulative" && styles.modeBtnActive,
              ]}
              onPress={() => onModeChange("cumulative")}
              testID="emphasis-mode-all"
            >
              <Text
                style={[
                  styles.modeBtnText,
                  vm.mode === "cumulative" && styles.modeBtnTextActive,
                ]}
              >
                ALL
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.modeBtn,
                vm.mode === "recent" && styles.modeBtnActive,
              ]}
              onPress={() => onModeChange("recent")}
              testID="emphasis-mode-recent"
            >
              <Text
                style={[
                  styles.modeBtnText,
                  vm.mode === "recent" && styles.modeBtnTextActive,
                ]}
              >
                RECENT
              </Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.subtitle}>{vm.sourceLabel}</Text>
        )}
      </View>

      {/* ── Muscle bar rows ────────────────────────────────────── */}
      {vm.rows.map((row) => (
        <View
          key={row.key}
          style={styles.row}
          testID={`emphasis-row-${row.key}`}
        >
          <Text style={styles.muscleLabel} numberOfLines={1}>
            {row.label}
          </Text>

          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.max(
                    Math.round(row.normalizedScore * 100),
                    4
                  )}%` as any,
                  backgroundColor: EMPHASIS_COLOR[row.emphasisTier],
                },
              ]}
              testID={`emphasis-bar-${row.key}`}
            />
          </View>
        </View>
      ))}

      {/* ── Legend ─────────────────────────────────────────────── */}
      <View style={styles.legend} testID="emphasis-legend">
        <View style={styles.legendSwatches}>
          {(["low", "medium", "high"] as const).map((tier) => (
            <View
              key={tier}
              style={[
                styles.legendSwatch,
                { backgroundColor: EMPHASIS_COLOR[tier] },
              ]}
            />
          ))}
        </View>
        <Text style={styles.legendText}>Less · · · · · · More</Text>
      </View>

      {/* ── Low-data qualifier ─────────────────────────────────── */}
      {vm.hasLowData && (
        <Text
          style={styles.qualityNote}
          testID="emphasis-map-quality-note"
        >
          Muscle emphasis estimated — some movements used generic patterns
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 6,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    letterSpacing: 0.5,
  },

  // Mode toggle (history)
  modeToggle: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "transparent",
  },
  modeBtnActive: {
    backgroundColor: Colors.orange,
  },
  modeBtnText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  modeBtnTextActive: {
    color: "#fff",
  },

  // Muscle bar row
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 18,
  },
  muscleLabel: {
    width: 100,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.70)",
    flexShrink: 0,
  },
  barTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  barFill: {
    height: 5,
    borderRadius: 3,
  },

  // Legend
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  legendSwatches: {
    flexDirection: "row",
    gap: 2,
  },
  legendSwatch: {
    width: 14,
    height: 4,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 8,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    letterSpacing: 0.3,
  },

  // Low-data qualifier
  qualityNote: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    letterSpacing: 0.2,
    marginTop: 2,
  },
});
