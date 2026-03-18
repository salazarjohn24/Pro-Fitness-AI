import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";

const TOUR_KEY = "app_tour_v1_completed";
const { width } = Dimensions.get("window");

interface TourStep {
  tabIcon: string;
  tabLabel: string;
  tabIndex: number;
  accentColor: string;
  bgColor: string;
  headline: string;
  description: string;
  tip: string;
  tipIcon: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    tabIcon: "home",
    tabLabel: "HOME",
    tabIndex: 0,
    accentColor: Colors.highlight,
    bgColor: "rgba(246,234,152,0.08)",
    headline: "Your daily command center",
    description:
      "Every morning starts here. Your readiness score — built from sleep, energy, and soreness — tells the AI how hard to push you today.",
    tip: "Check in daily for smarter workouts. Skipping check-ins means generic programming.",
    tipIcon: "zap",
  },
  {
    tabIcon: "book-open",
    tabLabel: "VAULT",
    tabIndex: 1,
    accentColor: Colors.orange,
    bgColor: "rgba(252,82,0,0.08)",
    headline: "Your exercise library",
    description:
      "Browse 100+ exercises filtered by muscle, equipment, or goal. Tap the heart icon on any exercise to save it — favorites get prioritized in your AI-built workouts.",
    tip: "Save the exercises you love and the AI will reach for them first.",
    tipIcon: "heart",
  },
  {
    tabIcon: "bar-chart-2",
    tabLabel: "PROGRESS",
    tabIndex: 2,
    accentColor: "#A78BFA",
    bgColor: "rgba(167,139,250,0.08)",
    headline: "Your performance audit",
    description:
      "The more you log, the sharper the insights. See which muscles are undertrained, track volume trends, and get alerted before a plateau hits.",
    tip: "Patterns emerge after 4–6 sessions. The data compounds over time.",
    tipIcon: "trending-up",
  },
  {
    tabIcon: "user",
    tabLabel: "PROFILE",
    tabIndex: 3,
    accentColor: Colors.recovery,
    bgColor: "rgba(119,156,175,0.08)",
    headline: "Personalize everything",
    description:
      "Tell the AI about your injuries, set your gym equipment, and dial in your training goal. This is what separates a generic plan from one built for you.",
    tip: "Keep your injuries up to date — the AI actively avoids them.",
    tipIcon: "shield",
  },
];

const TAB_ICONS = ["home", "book-open", "bar-chart-2", "user"] as const;

interface AppTourOverlayProps {
  visible: boolean;
  onDone: () => void;
}

export function AppTourOverlay({ visible, onDone }: AppTourOverlayProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardSlide = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  useEffect(() => {
    if (visible) {
      setStep(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
      startPulse();
    }
  }, [visible]);

  function startPulse() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }

  function animateToStep(next: number) {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: -20, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      cardSlide.setValue(24);
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(cardSlide, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }

  function handleNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLast) {
      handleDone();
    } else {
      animateToStep(step + 1);
    }
  }

  function handleDone() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 40, duration: 280, useNativeDriver: true }),
    ]).start(() => {
      onDone();
    });
  }

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.contentWrapper,
            {
              paddingBottom: botPad + 100,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.card,
              { opacity: cardOpacity, transform: [{ translateY: cardSlide }] },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconRing, { backgroundColor: current.bgColor, borderColor: current.accentColor + "40" }]}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Feather name={current.tabIcon as any} size={32} color={current.accentColor} />
                </Animated.View>
              </View>
              <View style={styles.stepInfo}>
                <Text style={[styles.tabLabel, { color: current.accentColor }]}>
                  {current.tabLabel}
                </Text>
                <View style={styles.stepDots}>
                  {TOUR_STEPS.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i === step
                          ? [styles.dotActive, { backgroundColor: current.accentColor }]
                          : styles.dotInactive,
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.headline}>{current.headline}</Text>
            <Text style={styles.description}>{current.description}</Text>

            <View style={[styles.tipBox, { backgroundColor: current.bgColor, borderColor: current.accentColor + "30" }]}>
              <Feather name={current.tipIcon as any} size={13} color={current.accentColor} style={{ marginTop: 1 }} />
              <Text style={[styles.tipText, { color: current.accentColor }]}>{current.tip}</Text>
            </View>

            <View style={styles.actions}>
              {!isLast && (
                <Pressable onPress={handleDone} style={styles.skipBtn}>
                  <Text style={styles.skipText}>Skip tour</Text>
                </Pressable>
              )}
              <Pressable
                onPress={handleNext}
                style={[styles.nextBtn, { backgroundColor: current.accentColor }]}
              >
                <Text style={[styles.nextText, { color: isLast ? Colors.bgPrimary : Colors.bgPrimary }]}>
                  {isLast ? "Let's go!" : "Next"}
                </Text>
                <Feather
                  name={isLast ? "check" : "arrow-right"}
                  size={15}
                  color={Colors.bgPrimary}
                />
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>

        <View style={[styles.tabPreview, { paddingBottom: botPad + 12 }]}>
          <View style={styles.tabBar}>
            {TAB_ICONS.map((icon, i) => {
              const isActive = i === current.tabIndex;
              return (
                <View key={i} style={styles.tabItem}>
                  {isActive && (
                    <Animated.View
                      style={[
                        styles.tabGlow,
                        {
                          backgroundColor: current.accentColor + "25",
                          borderColor: current.accentColor + "60",
                          transform: [{ scale: pulseAnim }],
                        },
                      ]}
                    />
                  )}
                  <Feather
                    name={icon as any}
                    size={22}
                    color={isActive ? current.accentColor : Colors.textSubtle + "55"}
                  />
                  {isActive && (
                    <View style={[styles.tabDot, { backgroundColor: current.accentColor }]} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

export async function markTourSeen() {
  try {
    await AsyncStorage.setItem(TOUR_KEY, "true");
  } catch {}
}

export async function hasTourBeenSeen(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(TOUR_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "flex-end",
  },
  contentWrapper: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 28,
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepInfo: {
    flex: 1,
    gap: 8,
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    letterSpacing: 2,
  },
  stepDots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
  },
  dotInactive: {
    width: 6,
    backgroundColor: Colors.border,
  },
  headline: {
    fontSize: 22,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    lineHeight: 26,
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 22,
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  skipBtn: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
  },
  nextBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  nextText: {
    fontSize: 14,
    fontFamily: "Inter_900Black",
    letterSpacing: 0.5,
  },
  tabPreview: {
    alignItems: "center",
    paddingTop: 20,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 28,
    alignItems: "center",
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    position: "relative",
  },
  tabGlow: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabDot: {
    position: "absolute",
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
