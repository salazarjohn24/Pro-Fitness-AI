/**
 * TrainingAdjustmentCard.tsx
 *
 * Rendered on the home screen when the deload-check API recommends
 * a lighter session. Fires three telemetry events:
 *   - recommendation_shown  (once on mount, after today's persisted choice is loaded)
 *   - recommendation_accepted  (on "Use Recommended Plan" press)
 *   - recommendation_overridden  (on "Train as Planned" press)
 *
 * Choice is persisted to AsyncStorage keyed by today's date so the card
 * does not reappear if the user navigates away and returns.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";
import { track } from "@/lib/telemetry";
import {
  buildAdjustmentCard,
  buildRecommendationAcceptedProps,
  buildRecommendationOverriddenProps,
  buildRecommendationShownProps,
  recommendationStorageKey,
  type DeloadCheckData,
  type RecommendationOutcome,
} from "@/lib/readinessRecommendation";

interface Props {
  deloadCheck: DeloadCheckData;
  onAccept: () => void;
  onOverride: () => void;
}

export function TrainingAdjustmentCard({ deloadCheck, onAccept, onOverride }: Props) {
  const [outcome, setOutcome] = useState<RecommendationOutcome | "loading">("loading");
  const card = buildAdjustmentCard(deloadCheck);

  // On mount: restore any persisted choice from today; fire shown event only
  // when the card is actually presented (no persisted choice yet).
  useEffect(() => {
    const storageKey = recommendationStorageKey();
    AsyncStorage.getItem(storageKey).then((stored) => {
      if (stored === "accepted" || stored === "overridden") {
        setOutcome(stored as RecommendationOutcome);
      } else {
        setOutcome(null);
        track({
          name: "readiness_recommendation_shown",
          props: buildRecommendationShownProps(deloadCheck),
        });
      }
    });
  }, []);

  const persistAndSet = (choice: "accepted" | "overridden") => {
    const storageKey = recommendationStorageKey();
    AsyncStorage.setItem(storageKey, choice);
    setOutcome(choice);
  };

  const handleAccept = () => {
    if (outcome !== null && outcome !== "loading") return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    persistAndSet("accepted");
    track({
      name: "readiness_recommendation_accepted",
      props: buildRecommendationAcceptedProps(deloadCheck),
    });
    onAccept();
  };

  const handleOverride = () => {
    if (outcome !== null && outcome !== "loading") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    persistAndSet("overridden");
    track({
      name: "readiness_recommendation_overridden",
      props: buildRecommendationOverriddenProps(deloadCheck),
    });
    onOverride();
  };

  if (outcome === "loading") {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#f59e0b" />
      </View>
    );
  }

  if (outcome === "accepted") {
    return (
      <View style={[styles.container, styles.containerOutcome]}>
        <View style={styles.outcomeRow}>
          <Feather name="check-circle" size={15} color="#34d399" />
          <Text style={styles.outcomeText}>Lighter session applied — good call.</Text>
        </View>
      </View>
    );
  }

  if (outcome === "overridden") {
    return (
      <View style={[styles.container, styles.containerOutcome]}>
        <View style={styles.outcomeRow}>
          <Feather name="zap" size={15} color={Colors.orange} />
          <Text style={styles.outcomeText}>Training as planned — we'll track it.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Feather name="alert-triangle" size={14} color="#f59e0b" />
        </View>
        <Text style={styles.title}>{card.title}</Text>
      </View>

      <Text style={styles.reason}>{card.reasonText}</Text>

      <View style={styles.adjustmentPill}>
        <Feather name="bar-chart-2" size={11} color="#f59e0b" />
        <Text style={styles.adjustmentText}>{card.adjustmentSummary}</Text>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [styles.btnAccept, { opacity: pressed ? 0.85 : 1 }]}
          onPress={handleAccept}
          testID="btn-accept-recommendation"
        >
          <Feather name="check" size={13} color={Colors.bgPrimary} />
          <Text style={styles.btnAcceptText}>Use Recommended Plan</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btnOverride, { opacity: pressed ? 0.7 : 1 }]}
          onPress={handleOverride}
          testID="btn-override-recommendation"
        >
          <Text style={styles.btnOverrideText}>Train as Planned</Text>
        </Pressable>
      </View>

      <Text style={styles.helperText}>{card.helperText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f59e0b0f",
    borderWidth: 1,
    borderColor: "#f59e0b30",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  containerOutcome: {
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#f59e0b18",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#f59e0b",
    flex: 1,
  },
  reason: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 19,
  },
  adjustmentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#f59e0b14",
    borderWidth: 1,
    borderColor: "#f59e0b28",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  adjustmentText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#f59e0b",
    letterSpacing: 0.4,
  },
  buttonRow: {
    gap: 8,
  },
  btnAccept: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#f59e0b",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  btnAcceptText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.bgPrimary,
  },
  btnOverride: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  btnOverrideText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  helperText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    textAlign: "center",
  },
  outcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  outcomeText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
});
