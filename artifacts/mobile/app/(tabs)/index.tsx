import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CheckInModal, type CheckInData } from "@/components/CheckInModal";
import { InsightInfoModal } from "@/components/InsightInfoModal";
import { TrainingAdjustmentCard } from "@/components/TrainingAdjustmentCard";
import WorkoutReviewModal from "@/components/WorkoutReviewModal";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { sendWorkoutReadyNotification } from "@/lib/notifications";
import { loadDrafts, type WorkoutDraft } from "@/services/workoutGenerator";
import {
  useProfile,
  useUpdateProfile,
  useTodayCheckIn,
  useSubmitCheckIn,
  useSubmitExternalWorkout,
  useDeleteExternalWorkout,
  useRecentExternalWorkouts,
  computeReadinessScore,
} from "@/hooks/useProfile";
import { useGenerateWorkout, useDeloadCheck, useWorkoutHistory, useRecoveryInsights, type GeneratedWorkout, type GeneratedExercise } from "@/hooks/useWorkout";
import { useRecoveryCorrelation } from "@/hooks/useRecoveryCorrelation";

const TODAY = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).toUpperCase();

const AI_SMART_LOAD_INFO = {
  title: "AI Smart Load",
  what: "AI Smart Load analyzes your recent training history, recovery scores, and today's check-in data to determine the ideal training volume and intensity for today.",
  why: "Training with the wrong volume or intensity leads to overtraining, injury, or insufficient stimulus for growth. Smart load keeps you in the optimal zone.",
  how: "Complete your daily check-in so the AI has up-to-date biometric data. The more consistently you check in, the more accurate your recommendations become.",
};

const READINESS_INFO = {
  title: "Daily Readiness Score",
  what: "Your readiness score is computed from today's check-in data: energy level (30%), sleep quality (30%), stress level (20%), and muscle soreness (20%).",
  why: "This score helps the AI calibrate workout intensity. Higher scores mean you can handle more volume; lower scores trigger deload protocols.",
  how: "Complete your daily check-in to generate an accurate score. Consistent daily check-ins improve the AI's ability to personalize your training.",
};

function BentoCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function RationaleChip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Feather name="star" size={10} color={Colors.highlight} />
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { mutate: updateProfile } = useUpdateProfile();
  const { data: todayCheckIn, isLoading: checkInLoading } = useTodayCheckIn();
  const { mutate: submitCheckIn, isPending: isSubmittingCheckIn } = useSubmitCheckIn();
  const { mutate: submitExternalWorkout, isPending: isSubmittingRestDay } = useSubmitExternalWorkout();
  const { mutate: deleteExternalWorkout } = useDeleteExternalWorkout();
  const { data: recentExternalWorkouts } = useRecentExternalWorkouts();
  const { data: workoutHistory } = useWorkoutHistory(60);
  const { mutate: generateWorkout, isPending: isGenerating } = useGenerateWorkout();

  const { data: recoveryCorrelation } = useRecoveryCorrelation();

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);
  const [readinessInfoOpen, setReadinessInfoOpen] = useState(false);
  const [coachSecretInfoOpen, setCoachSecretInfoOpen] = useState(false);
  const [autoCheckInTriggered, setAutoCheckInTriggered] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rpeInfoOpen, setRpeInfoOpen] = useState(false);
  const [weeklySessionsInfoOpen, setWeeklySessionsInfoOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<"all" | "internal" | "external" | "apple_health">("all");
  const autoGenerateAttempted = React.useRef(false);
  const [architectDrafts, setArchitectDrafts] = React.useState<WorkoutDraft[]>([]);

  const streak = profile?.streakDays ?? 0;
  const syncProgress = profile?.dailySyncProgress ?? 0;
  const checkInDone = !!todayCheckIn;
  const { data: deloadCheck } = useDeloadCheck();
  const onboardingDone = profile?.onboardingCompleted ?? false;

  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA");

  function isToday(w: any): boolean {
    const dateStr = w.workoutDate ?? w.createdAt?.slice(0, 10);
    if (!dateStr) return false;
    return dateStr.slice(0, 10) === todayStr;
  }

  const todayRestWorkout = recentExternalWorkouts?.find((w: any) => w.workoutType === "rest" && isToday(w));
  const isRestDay = !!todayRestWorkout;

  // activityDone: true if any external workout OR any in-app session happened today
  const todayExternalWorkout = recentExternalWorkouts?.find((w: any) => isToday(w));
  const todayInAppSession = workoutHistory?.find((w) => w.type === "internal" && w.date?.slice(0, 10) === todayStr);
  const activityDone = !!(todayExternalWorkout || todayInAppSession);

  const { data: recoveryInsights, isLoading: isLoadingInsights } = useRecoveryInsights(
    activityDone && checkInDone && !isRestDay
  );

  const readinessScore = computeReadinessScore(todayCheckIn);

  const weeklyGoal = profile?.workoutFrequency ?? 3;
  const weekMonday = (() => {
    const d = new Date(now);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return d.toISOString().slice(0, 10);
  })();

  // Count all workouts this week: external (excluding rest days) + in-app sessions from unified history
  const thisWeekExternal = (recentExternalWorkouts ?? []).filter((w: any) => {
    const d = (w.workoutDate ?? w.createdAt?.slice(0, 10) ?? "");
    return d >= weekMonday && w.workoutType !== "rest";
  });
  const thisWeekInternal = (workoutHistory ?? []).filter((w) => w.type === "internal" && (w.date ?? "").slice(0, 10) >= weekMonday);
  const weeklySessionCount = thisWeekExternal.length + thisWeekInternal.length;

  // RPE only from external workouts (internal sessions don't have RPE logged the same way)
  const rpeWorkouts = thisWeekExternal.filter((w: any) => w.intensity);
  const weeklyAvgRPE = rpeWorkouts.length > 0
    ? Math.round(rpeWorkouts.reduce((s: number, w: any) => s + (w.intensity ?? 0), 0) / rpeWorkouts.length * 10) / 10
    : null;

  const completedTasks = [checkInDone, activityDone].filter(Boolean).length;
  const pct = Math.round((completedTasks / 2) * 100);

  useEffect(() => {
    loadDrafts().then(setArchitectDrafts);
  }, []);

  useEffect(() => {
    if (!isLoading && !checkInLoading && onboardingDone && !checkInDone && !autoCheckInTriggered) {
      const timer = setTimeout(() => {
        setAutoCheckInTriggered(true);
        setCheckInOpen(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isLoading, checkInLoading, onboardingDone, checkInDone, autoCheckInTriggered]);

  useEffect(() => {
    if (!isLoading && !checkInLoading && checkInDone && !activityDone && !generatedWorkout && !isGenerating && !autoGenerateAttempted.current) {
      autoGenerateAttempted.current = true;
      generateWorkout(undefined, {
        onSuccess: (workout) => {
          setGeneratedWorkout(workout);
          sendWorkoutReadyNotification(workout.workoutTitle);
        },
      });
    }
  }, [isLoading, checkInLoading, checkInDone, activityDone]);

  const handleCheckInComplete = (data: CheckInData) => {
    const wasAlreadyDone = checkInDone;
    // Mark auto-generate as attempted so the useEffect doesn't also fire a concurrent generation
    autoGenerateAttempted.current = true;
    submitCheckIn(data, {
      onSuccess: () => {
        setCheckInOpen(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (!wasAlreadyDone) {
          const newProgress = Math.min(100, syncProgress + 50);
          updateProfile({ checkInCompleted: true, dailySyncProgress: newProgress });
        }
        if (!activityDone) {
          generateWorkout(undefined, {
            onSuccess: (workout) => {
              setGeneratedWorkout(workout);
              sendWorkoutReadyNotification(workout.workoutTitle);
            },
          });
        }
      },
      onError: () => {
        // Reset so the user can try again
        autoGenerateAttempted.current = false;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Check-in Failed", "Could not save your check-in. Tap COMPLETE to try again.");
      },
    });
  };

  const handleRestDay = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    submitExternalWorkout(
      {
        label: "Rest & Recovery Day",
        duration: 0,
        workoutType: "rest",
        source: "manual",
        intensity: 0,
        muscleGroups: [],
        stimulusPoints: 0,
        workoutDate: todayStr,
      },
      {
        onSuccess: () => {
          const newProgress = Math.min(100, syncProgress + 50);
          updateProfile({ activityImported: true, dailySyncProgress: newProgress });
        },
        onError: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert("Failed", "Could not log rest day. Please try again.");
        },
      }
    );
  };

  const handleUndoRestDay = () => {
    if (!todayRestWorkout) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteExternalWorkout(todayRestWorkout.id, {
      onSuccess: () => {
        const newProgress = Math.max(0, syncProgress - 50);
        updateProfile({ activityImported: false, dailySyncProgress: newProgress });
      },
      onError: () => {
        Alert.alert("Failed", "Could not remove rest day. Please try again.");
      },
    });
  };

  const handleStartWorkout = () => {
    if (!checkInDone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (generatedWorkout) {
      setReviewOpen(true);
    } else {
      generateWorkout(undefined, {
        onSuccess: (workout) => {
          setGeneratedWorkout(workout);
          sendWorkoutReadyNotification(workout.workoutTitle);
          setReviewOpen(true);
        },
        onError: () => {
          Alert.alert(
            "Generation Failed",
            "Could not build your workout. Check your connection and try again.",
            [{ text: "OK" }]
          );
        },
      });
    }
  };

  const handleReviewStart = (workout: GeneratedWorkout, exercises: GeneratedExercise[]) => {
    setReviewOpen(false);
    router.push({
      pathname: "/workout-session",
      params: { workout: JSON.stringify({ ...workout, exercises }) },
    });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: topPad }]}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  const workoutRationale = generatedWorkout?.rationale ??
    "The AI suggests this to balance your recent volume and improve posture.";

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad + 8, paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.dateText}>{TODAY}</Text>
            <Text style={styles.logoText}>
              PRO FITNESS <Text style={styles.logoAccent}>AI</Text>
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.streakBadge}>
              <Feather name="zap" size={14} color={Colors.orange} />
              {streak > 0 ? (
                <Text style={styles.streakText}>{streak}</Text>
              ) : (
                <Text style={[styles.streakText, { fontSize: 11, color: Colors.textMuted }]}>Start!</Text>
              )}
            </View>
          </View>
        </View>

        {deloadCheck?.recommended && deloadCheck.reason && (
          <TrainingAdjustmentCard
            deloadCheck={deloadCheck}
            onAccept={() => {}}
            onOverride={() => {}}
          />
        )}

        <BentoCard>
          <View style={styles.syncHeader}>
            <View style={styles.syncTitleRow}>
              <Text style={styles.sectionLabel}>Daily Protocol Sync</Text>
              <Text style={styles.syncPct}>{pct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
            </View>
          </View>

          <View style={styles.taskList}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setCheckInOpen(true);
              }}
              style={({ pressed }) => [
                styles.taskItem,
                checkInDone ? styles.taskDone : styles.taskPending,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={[styles.taskIcon, checkInDone ? styles.taskIconDone : styles.taskIconHighlight]}>
                <Feather name={checkInDone ? "check" : "zap"} size={16} color={checkInDone ? Colors.bgPrimary : Colors.highlight} />
              </View>
              <View style={styles.taskInfo}>
                <Text style={[styles.taskTitle, checkInDone && styles.taskTitleDone]}>Intelligence Check-in</Text>
                <Text style={styles.taskSub}>{checkInDone ? "Tap to edit" : "Tap to start calibration"}</Text>
              </View>
              <Feather name={checkInDone ? "edit-2" : "chevron-right"} size={16} color={checkInDone ? Colors.highlight : Colors.textMuted} />
            </Pressable>

            <View
              style={[
                styles.taskItem,
                activityDone
                  ? (isRestDay ? styles.taskRest : styles.taskDone)
                  : (!checkInDone ? styles.taskLocked : styles.taskPending),
                !checkInDone && !activityDone ? { opacity: 0.5 } : undefined,
              ]}
            >
              <View style={[
                styles.taskIcon,
                activityDone
                  ? (isRestDay ? styles.taskIconRest : styles.taskIconDone)
                  : (checkInDone ? styles.taskIconHighlight : styles.taskIconLocked),
              ]}>
                <Feather
                  name={activityDone ? (isRestDay ? "moon" : "check") : "target"}
                  size={16}
                  color={activityDone ? (isRestDay ? Colors.recovery : Colors.bgPrimary) : (checkInDone ? Colors.highlight : "#3C3C3A")}
                />
              </View>
              <View style={styles.taskInfo}>
                <Text style={[
                  styles.taskTitle,
                  activityDone && (isRestDay ? styles.taskTitleRest : styles.taskTitleDone),
                  !checkInDone && !activityDone && styles.taskTitleLocked,
                ]}>
                {isRestDay ? "Recovery Day" : "Today's Training"}
                </Text>
                <Text style={styles.taskSub}>
                  {activityDone
                    ? isRestDay
                      ? "Stay hydrated & eat enough protein"
                      : "Completed — great work today"
                    : checkInDone
                      ? "Workout, log external, or rest below"
                      : "Locked: Complete check-in first"}
                </Text>
              </View>
              {!checkInDone && !activityDone && (
                <Feather name="lock" size={16} color="#3C3C3A" />
              )}
              {activityDone && (
                <Feather name="check-circle" size={16} color={isRestDay ? Colors.recovery : Colors.highlight} />
              )}
            </View>

          </View>
        </BentoCard>

        {activityDone && !isRestDay ? (
          <BentoCard style={[styles.recommendCard, { borderLeftColor: Colors.recovery }]}>
            <View style={styles.recommendHeader}>
              <View style={styles.recommendHeaderLeft}>
                <RationaleChip text="Recovery Coach" />
              </View>
              <View style={[styles.chip, { backgroundColor: "rgba(119,156,175,0.15)", borderColor: "rgba(119,156,175,0.2)" }]}>
                <Feather name="shield" size={10} color={Colors.recovery} />
                <Text style={[styles.chipText, { color: Colors.recovery }]}>AI Personalized</Text>
              </View>
            </View>

            {isLoadingInsights || !recoveryInsights ? (
              <View style={styles.generatingBlock}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator color={Colors.recovery} size="small" />
                  <Text style={styles.generatingText}>Analyzing your recovery...</Text>
                </View>
                <Text style={styles.generatingSubtext}>Personalizing tips based on today's workout and check-in.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.recoveryHeadline}>{recoveryInsights.headline}</Text>
                <View style={styles.recoveryTips}>
                  {recoveryInsights.tips.map((tip, i) => {
                    const iconMap: Record<string, string> = {
                      SLEEP: "moon", NUTRITION: "coffee", MOBILITY: "activity",
                      HYDRATION: "droplet", STRESS: "heart", MINDSET: "eye",
                    };
                    const colorMap: Record<string, string> = {
                      SLEEP: Colors.recovery, NUTRITION: Colors.orange, MOBILITY: Colors.highlight,
                      HYDRATION: "#5BA4CF", STRESS: "#E07B8C", MINDSET: Colors.textMuted,
                    };
                    const icon = (iconMap[tip.category] ?? "star") as any;
                    const color = colorMap[tip.category] ?? Colors.textMuted;
                    return (
                      <View key={i} style={styles.recoveryTip}>
                        <View style={[styles.recoveryTipIcon, { backgroundColor: `${color}18` }]}>
                          <Feather name={icon} size={13} color={color} />
                        </View>
                        <View style={styles.recoveryTipText}>
                          <Text style={styles.recoveryTipTitle}>{tip.title}</Text>
                          <Text style={styles.recoveryTipDetail}>{tip.detail}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </BentoCard>
        ) : (
          <BentoCard style={[styles.recommendCard, !checkInDone && styles.recommendLocked]}>
            <View style={styles.recommendHeader}>
              <View style={styles.recommendHeaderLeft}>
                <RationaleChip text="AI Smart Load" />
              </View>
              <Pressable
                onPress={() => setInsightOpen(true)}
                style={styles.infoBtn}
              >
                <Feather name="info" size={15} color={Colors.textSubtle} />
              </Pressable>
            </View>
            {isGenerating ? (
              <View style={styles.generatingBlock}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator color={Colors.orange} size="small" />
                  <Text style={styles.generatingText}>Generating your workout...</Text>
                </View>
                <Text style={styles.generatingSubtext}>This usually takes 30–60 seconds. You can leave the app — we'll send you a notification when it's ready.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.recommendTitle}>
                  {generatedWorkout ? generatedWorkout.workoutTitle.replace(" & ", "\n& ").replace(" Focus", "\nFocus") : "Back & Arms\nFocus"}
                </Text>
                <Text style={styles.recommendDesc}>{workoutRationale}</Text>
                {generatedWorkout && (
                  <View style={styles.workoutMeta}>
                    <View style={styles.metaItem}>
                      <Feather name="layers" size={12} color={Colors.recovery} />
                      <Text style={styles.metaText}>{generatedWorkout.totalSets} sets</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Feather name="clock" size={12} color={Colors.orange} />
                      <Text style={styles.metaText}>~{generatedWorkout.estimatedMinutes} min</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Feather name="list" size={12} color={Colors.highlight} />
                      <Text style={styles.metaText}>{generatedWorkout.exercises.length} exercises</Text>
                    </View>
                  </View>
                )}
              </>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.startButton,
                !checkInDone && styles.startButtonDisabled,
                { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
              onPress={handleStartWorkout}
              disabled={!checkInDone || isGenerating}
            >
              <Feather name="play" size={16} color="#fff" />
              <Text style={styles.startButtonText}>
                {isGenerating ? "GENERATING..." : checkInDone ? "START WORKOUT" : "COMPLETE CHECK-IN FIRST"}
              </Text>
            </Pressable>
          </BentoCard>
        )}

        <Pressable
          style={({ pressed }) => [styles.card, styles.architectCard, { opacity: checkInDone ? (pressed ? 0.85 : 1) : 0.4 }]}
          onPress={() => {
            if (!checkInDone) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/workout-architect");
          }}
          disabled={!checkInDone}
        >
          <View style={styles.architectIcon}>
            <Feather name="cpu" size={20} color={Colors.highlight} />
          </View>
          <View style={styles.architectInfo}>
            <Text style={styles.architectTitle}>Workout Architect</Text>
            <Text style={styles.architectSub}>Build your own custom session</Text>
          </View>
          <Feather name="arrow-right" size={18} color={Colors.highlight} />
        </Pressable>

        {architectDrafts.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.draftCTA, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/workout-architect");
            }}
          >
            <View style={styles.draftCTALeft}>
              <Feather name="bookmark" size={16} color={Colors.orange} />
              <View style={{ flex: 1 }}>
                <Text style={styles.draftCTATitle}>
                  {architectDrafts.length} SAVED DRAFT{architectDrafts.length > 1 ? "S" : ""}
                </Text>
                <Text style={styles.draftCTASub} numberOfLines={1}>
                  {architectDrafts[0].workoutName || "Untitled Workout"}
                  {architectDrafts.length > 1 ? ` + ${architectDrafts.length - 1} more` : ""}
                </Text>
              </View>
            </View>
            <View style={styles.draftCTABtn}>
              <Text style={styles.draftCTABtnText}>RESUME</Text>
              <Feather name="arrow-right" size={13} color="#fff" />
            </View>
          </Pressable>
        )}

        <View style={styles.secondaryActions}>
          <Pressable
            style={({ pressed }) => [styles.secondaryCard, { opacity: checkInDone ? (pressed ? 0.85 : 1) : 0.4 }]}
            onPress={() => {
              if (!checkInDone) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/external-workouts");
            }}
            disabled={!checkInDone}
          >
            <View style={styles.secondaryIcon}>
              <Feather name="upload" size={16} color={Colors.orange} />
            </View>
            <View style={styles.secondaryInfo}>
              <Text style={styles.secondaryTitle}>Log External Workout</Text>
              <Text style={styles.secondarySub}>Trained outside the app? Log it here</Text>
            </View>
            <Feather name="chevron-right" size={16} color={Colors.textMuted} />
          </Pressable>

          <Pressable
            style={({ pressed }) => {
              const canTap = checkInDone && (isRestDay || !activityDone) && !isSubmittingRestDay;
              return [
                styles.secondaryCard,
                isRestDay ? styles.secondaryCardDone : undefined,
                { opacity: canTap ? (pressed ? 0.85 : 1) : 0.4 },
              ];
            }}
            onPress={() => {
              if (!checkInDone || isSubmittingRestDay) return;
              if (isRestDay) {
                handleUndoRestDay();
              } else if (!activityDone) {
                handleRestDay();
              }
            }}
            disabled={isSubmittingRestDay}
          >
            <View style={[styles.secondaryIcon, styles.secondaryIconRecovery]}>
              <Feather name="moon" size={16} color={Colors.recovery} />
            </View>
            <View style={styles.secondaryInfo}>
              <Text style={styles.secondaryTitle}>Rest & Recovery Day</Text>
              <Text style={styles.secondarySub}>
                {isRestDay
                  ? "Tap to undo rest day"
                  : activityDone
                    ? "Already logged today"
                    : "Take a recovery day"}
              </Text>
            </View>
            {isRestDay ? (
              <Feather name="x-circle" size={16} color={Colors.recovery} />
            ) : activityDone ? (
              <Feather name="check-circle" size={16} color={Colors.recovery} />
            ) : (
              <Feather name="chevron-right" size={16} color={Colors.textMuted} />
            )}
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <Pressable onPress={() => setReadinessInfoOpen(true)} style={{ flex: 1 }}>
            <BentoCard style={styles.statCard}>
              <Feather name="activity" size={18} color={Colors.recovery} />
              <Text style={styles.statValue}>{checkInDone ? readinessScore : "—"}</Text>
              <Text style={styles.statLabel}>Readiness</Text>
              {checkInDone && (
                <View style={styles.scoreInfoHint}>
                  <Feather name="info" size={10} color={Colors.textSubtle} />
                </View>
              )}
            </BentoCard>
          </Pressable>
          <Pressable onPress={() => setRpeInfoOpen(true)} style={{ flex: 1 }}>
            <BentoCard style={styles.statCard}>
              <Feather name="zap" size={18} color={Colors.orange} />
              <Text style={styles.statValue}>{weeklyAvgRPE != null ? weeklyAvgRPE : "—"}</Text>
              <Text style={styles.statLabel}>Avg RPE</Text>
              <View style={styles.scoreInfoHint}>
                <Feather name="info" size={10} color={Colors.textSubtle} />
              </View>
            </BentoCard>
          </Pressable>
          <Pressable onPress={() => setWeeklySessionsInfoOpen(true)} style={{ flex: 1 }}>
            <BentoCard style={styles.statCard}>
              <Feather name="calendar" size={18} color={Colors.highlight} />
              <Text style={styles.statValue}>
                {weeklySessionCount}
                <Text style={[styles.statLabel, { fontSize: 11 }]}>/{weeklyGoal}</Text>
              </Text>
              <Text style={styles.statLabel}>This Week</Text>
              <View style={styles.scoreInfoHint}>
                <Feather name="info" size={10} color={Colors.textSubtle} />
              </View>
            </BentoCard>
          </Pressable>
        </View>

        {recoveryCorrelation?.hasEnoughData && (
          <BentoCard style={styles.coachCard}>
            <View style={styles.coachHeader}>
              <View style={styles.coachIconWrap}>
                <Feather name="eye" size={16} color={Colors.highlight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.coachLabel}>COACH'S SECRET</Text>
                <Text style={styles.coachTitle}>Recovery-to-Load Insight</Text>
              </View>
              <Pressable
                onPress={() => setCoachSecretInfoOpen(true)}
                style={styles.infoBtn}
              >
                <Feather name="info" size={15} color={Colors.textSubtle} />
              </Pressable>
            </View>
            <Text style={styles.coachText}>
              {recoveryCorrelation.percentageDifference >= 0
                ? `You perform ${recoveryCorrelation.percentageDifference}% more volume on well-recovered days. Prioritize sleep to unlock your full training potential.`
                : `Your volume is ${Math.abs(recoveryCorrelation.percentageDifference)}% lower on well-recovered days. You may be overtraining on tired days — listen to your body.`
              }
            </Text>
            <View style={styles.coachStats}>
              <View style={styles.coachStat}>
                <Text style={[styles.coachStatValue, { color: Colors.highlight }]}>{recoveryCorrelation.avgHighVolume}</Text>
                <Text style={styles.coachStatLabel}>High Recovery Vol</Text>
              </View>
              <View style={styles.coachStatDivider} />
              <View style={styles.coachStat}>
                <Text style={[styles.coachStatValue, { color: Colors.orange }]}>{recoveryCorrelation.avgLowVolume}</Text>
                <Text style={styles.coachStatLabel}>Low Recovery Vol</Text>
              </View>
              <View style={styles.coachStatDivider} />
              <View style={styles.coachStat}>
                <Text style={[styles.coachStatValue, { color: recoveryCorrelation.percentageDifference >= 0 ? Colors.highlight : Colors.orange }]}>
                  {recoveryCorrelation.percentageDifference >= 0 ? "+" : ""}{recoveryCorrelation.percentageDifference}%
                </Text>
                <Text style={styles.coachStatLabel}>Delta</Text>
              </View>
            </View>
          </BentoCard>
        )}

        {(workoutHistory && workoutHistory.length > 0) && (() => {
          // ---------------------------------------------------------------------------
          // Recent Activity filter — All / Internal / External / Apple Health
          // "External" includes manual + ai_scan. "Apple Health" is source=apple_health.
          // ---------------------------------------------------------------------------
          const countAll = workoutHistory.length;
          const countInternal = workoutHistory.filter(w => w.type === "internal").length;
          const countExternal = workoutHistory.filter(w => w.type === "external" && w.source !== "apple_health").length;
          const countAppleHealth = workoutHistory.filter(w => w.source === "apple_health").length;

          const filteredHistory = workoutHistory.filter(w => {
            if (activityFilter === "internal") return w.type === "internal";
            if (activityFilter === "external") return w.type === "external" && w.source !== "apple_health";
            if (activityFilter === "apple_health") return w.source === "apple_health";
            return true; // "all"
          });

          type FilterKey = "all" | "internal" | "external" | "apple_health";
          const filters: Array<{ key: FilterKey; label: string; count: number }> = [
            { key: "all", label: "All", count: countAll },
            { key: "internal", label: "Internal", count: countInternal },
            { key: "external", label: "External", count: countExternal },
            { key: "apple_health", label: "Apple Health", count: countAppleHealth },
          ].filter(f => f.count > 0 || f.key === "all");

          return (
            <BentoCard>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={styles.sectionLabel}>Recent Activity</Text>
                <Pressable onPress={() => router.push("/external-workouts" as any)}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textSubtle }}>All →</Text>
                </Pressable>
              </View>

              {filters.length > 1 && (
                <View style={styles.activityFilterRow}>
                  {filters.map(f => (
                    <Pressable
                      key={f.key}
                      style={[styles.activityFilterPill, activityFilter === f.key && styles.activityFilterPillActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setActivityFilter(f.key);
                      }}
                    >
                      <Text style={[styles.activityFilterText, activityFilter === f.key && styles.activityFilterTextActive]}>
                        {f.label} {f.count > 0 ? `(${f.count})` : ""}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={styles.recentList}>
                {filteredHistory.slice(0, 6).map((workout) => {
                  const isRest = (workout as any).workoutType === "rest";
                  const isInternal = workout.type === "internal";
                  const isAppleHealth = workout.source === "apple_health";
                  const dateStr = new Date(workout.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

                  const iconName: any = isRest ? "moon"
                    : isInternal ? "award"
                    : isAppleHealth ? "heart"
                    : workout.source === "ai_scan" ? "cpu"
                    : "globe";
                  const iconColor = isRest ? Colors.recovery
                    : isInternal ? Colors.highlight
                    : isAppleHealth ? "#E1306C"
                    : Colors.orange;
                  const iconBg = isRest ? styles.recentIconRest
                    : isInternal ? styles.recentIconInApp
                    : isAppleHealth ? styles.recentIconAppleHealth
                    : styles.recentIconExternal;
                  const srcLabel = isRest ? "Rest"
                    : isInternal ? "In-App"
                    : isAppleHealth ? "Apple Health"
                    : workout.source === "ai_scan" ? "AI Scan"
                    : "External";

                  const subText = isRest
                    ? "Recovery day"
                    : isInternal
                    ? `${workout.durationMinutes}m · ${workout.exerciseCount} exercises · ${workout.totalSetsCompleted} sets`
                    : `${workout.durationMinutes}m${(workout as any).intensity ? ` · RPE ${(workout as any).intensity}` : ""}${workout.stimulusPoints ? ` · ${workout.stimulusPoints} pts` : ""}${workout.exerciseCount > 0 ? ` · ${workout.exerciseCount} exercises` : ""}`;

                  return (
                    <Pressable
                      key={`${workout.type}-${workout.id}`}
                      style={({ pressed }) => [styles.recentItem, { opacity: pressed ? 0.75 : 1 }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(`/workout-detail?type=${workout.type}&id=${workout.id}` as any);
                      }}
                    >
                      <View style={[styles.recentIcon, iconBg]}>
                        <Feather name={iconName} size={14} color={iconColor} />
                      </View>
                      <View style={styles.recentInfo}>
                        <Text style={styles.recentTitle} numberOfLines={1}>{workout.label}</Text>
                        <Text style={styles.recentSub} numberOfLines={1}>{subText}</Text>
                      </View>
                      <View style={styles.recentRight}>
                        <Text style={styles.recentDate}>{dateStr}</Text>
                        <Text style={styles.recentSource}>{srcLabel}</Text>
                      </View>
                      <Feather name="chevron-right" size={13} color={Colors.textSubtle} style={{ marginLeft: 4 }} />
                    </Pressable>
                  );
                })}
                {filteredHistory.length === 0 && (
                  <Text style={{ fontSize: 12, color: Colors.textSubtle, textAlign: "center", paddingVertical: 16, fontFamily: "Inter_400Regular" }}>
                    No {activityFilter === "apple_health" ? "Apple Health" : activityFilter === "internal" ? "in-app" : activityFilter === "external" ? "external" : ""} workouts yet.
                  </Text>
                )}
              </View>
            </BentoCard>
          );
        })()}
      </ScrollView>

      <CheckInModal
        visible={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        onComplete={handleCheckInComplete}
        isSubmitting={isSubmittingCheckIn}
        initialData={todayCheckIn ? {
          energyLevel: todayCheckIn.energyLevel,
          sleepQuality: todayCheckIn.sleepQuality,
          stressLevel: todayCheckIn.stressLevel,
          sorenessScore: todayCheckIn.sorenessScore,
          soreMuscleGroups: (todayCheckIn.soreMuscleGroups as { muscle: string; severity: number }[]) ?? [],
          notes: todayCheckIn.notes ?? "",
        } : null}
      />

      <InsightInfoModal
        visible={insightOpen}
        onClose={() => setInsightOpen(false)}
        insight={AI_SMART_LOAD_INFO}
      />

      <InsightInfoModal
        visible={readinessInfoOpen}
        onClose={() => setReadinessInfoOpen(false)}
        insight={READINESS_INFO}
      />

      <InsightInfoModal
        visible={coachSecretInfoOpen}
        onClose={() => setCoachSecretInfoOpen(false)}
        insight={{
          title: "Coach's Secret: Recovery-to-Load",
          what: "This metric compares your average training volume on high-recovery days (sleep score ≥70) versus low-recovery days (sleep score <70), revealing how your recovery directly impacts performance.",
          why: "Understanding this correlation helps you optimize training timing. If the delta is large, scheduling hard sessions on well-recovered days yields significantly better results.",
          how: "Log your daily check-in consistently and complete workouts through the app. The more data points the engine has, the more accurate and actionable this insight becomes.",
        }}
      />

      <WorkoutReviewModal
        visible={reviewOpen}
        workout={generatedWorkout}
        onClose={() => setReviewOpen(false)}
        onStart={handleReviewStart}
      />

      <InsightInfoModal
        visible={rpeInfoOpen}
        onClose={() => setRpeInfoOpen(false)}
        insight={{
          title: "Average RPE This Week",
          what: "RPE (Rate of Perceived Exertion) is your subjective intensity score per workout, rated 1–10. Avg RPE reflects the mean effort across all workouts you've logged this week (Monday–Sunday).",
          why: "Tracking RPE trends reveals whether you're training too hard, too easy, or hitting the right stimulus. Chronically high RPE without recovery leads to overtraining and injury risk.",
          how: "Log your RPE after every session. A well-structured training week typically mixes 1–2 high-RPE sessions (8–10) with lower-intensity days (5–7) to balance stimulus and recovery.",
        }}
      />

      <InsightInfoModal
        visible={weeklySessionsInfoOpen}
        onClose={() => setWeeklySessionsInfoOpen(false)}
        insight={{
          title: "Weekly Sessions vs Goal",
          what: "This shows how many workouts you've logged this week (Monday–Sunday) compared to your weekly frequency goal set in your profile.",
          why: "Training frequency is one of the strongest predictors of long-term progress. Consistently hitting your weekly goal builds habit and accumulates the progressive overload needed for adaptation.",
          how: "Set your weekly goal in Profile to match your schedule. If you're consistently under, try shorter sessions. If you always exceed it, consider raising the goal to better reflect your training.",
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loadingContainer: { flex: 1, backgroundColor: Colors.bgPrimary, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 20, gap: 14 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
    marginBottom: 4,
  },
  logoText: {
    fontSize: 20,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    letterSpacing: 0.5,
    fontStyle: "italic",
  },
  logoAccent: { color: Colors.orange },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  streakBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  streakText: { fontSize: 14, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic" },
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    padding: 20,
  },
  syncHeader: { gap: 10, marginBottom: 16 },
  syncTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 2, textTransform: "uppercase" },
  syncPct: { fontSize: 10, fontFamily: "Inter_900Black", color: Colors.highlight },
  progressTrack: { height: 5, backgroundColor: "#292927", borderRadius: 10, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Colors.highlight, borderRadius: 10 },
  taskList: { gap: 8 },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  taskPending: { borderColor: "rgba(246,234,152,0.3)", backgroundColor: "rgba(246,234,152,0.04)" },
  taskDone: { borderColor: "rgba(246,234,152,0.2)", backgroundColor: "rgba(246,234,152,0.07)" },
  taskRest: { borderColor: "rgba(119,156,175,0.3)", backgroundColor: "rgba(119,156,175,0.07)" },
  taskLocked: { borderColor: "#2C2C2A", backgroundColor: "transparent" },
  taskIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  taskIconHighlight: { backgroundColor: "rgba(246,234,152,0.12)" },
  taskIconDone: { backgroundColor: Colors.highlight },
  taskIconRest: { backgroundColor: "rgba(119,156,175,0.2)" },
  taskIconLocked: { backgroundColor: "#222220" },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.text, textTransform: "uppercase", letterSpacing: 0.5 },
  taskTitleDone: { color: Colors.highlight },
  taskTitleRest: { color: Colors.recovery },
  taskTitleMuted: { color: "#A8A29E" },
  taskTitleLocked: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#78716C", textTransform: "uppercase", letterSpacing: 0.5 },
  taskSub: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textSubtle, marginTop: 2, letterSpacing: 0.5 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(246,234,152,0.12)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.25)",
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  chipText: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.highlight, textTransform: "uppercase", letterSpacing: 0.5 },
  recommendCard: { borderLeftWidth: 4, borderLeftColor: Colors.orange, gap: 12 },
  recommendLocked: { opacity: 0.5 },
  recommendHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recommendHeaderLeft: { flex: 1 },
  infoBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  recommendTitle: {
    fontSize: 30,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    lineHeight: 34,
  },
  recommendDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 20,
  },
  generatingBlock: {
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 16,
  },
  generatingText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  generatingSubtext: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    lineHeight: 17,
  },
  workoutMeta: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
  },
  recoveryHeadline: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    lineHeight: 21,
    marginBottom: 4,
  },
  recoveryTips: {
    gap: 10,
  },
  recoveryTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  recoveryTipIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  recoveryTipText: {
    flex: 1,
    gap: 3,
  },
  recoveryTipTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  recoveryTipDetail: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 18,
  },
  startButton: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startButtonDisabled: { backgroundColor: "#2C2C2A" },
  startButtonText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  architectCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderColor: "rgba(246,234,152,0.15)",
    backgroundColor: "rgba(246,234,152,0.04)",
  },
  architectIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(246,234,152,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  architectInfo: { flex: 1 },
  architectTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text, textTransform: "uppercase", letterSpacing: 0.5 },
  architectSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSubtle, marginTop: 2 },
  secondaryActions: { gap: 8 },
  secondaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  secondaryCardDone: { borderColor: "rgba(119,156,175,0.3)", backgroundColor: "rgba(119,156,175,0.05)" },
  secondaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(252,82,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryIconRecovery: {
    backgroundColor: "rgba(119,156,175,0.1)",
  },
  secondaryInfo: { flex: 1 },
  secondaryTitle: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.text, textTransform: "uppercase", letterSpacing: 0.5 },
  secondarySub: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textSubtle, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { alignItems: "center", gap: 6, paddingVertical: 16 },
  statValue: { fontSize: 28, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic" },
  statLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 1, textTransform: "uppercase" },
  scoreInfoHint: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  recentList: { gap: 8, marginTop: 12 },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  recentIconExternal: {
    backgroundColor: "rgba(252,82,0,0.1)",
  },
  recentIconInApp: {
    backgroundColor: "rgba(246,234,152,0.1)",
  },
  recentIconRest: {
    backgroundColor: "rgba(119,156,175,0.1)",
  },
  recentIconAppleHealth: {
    backgroundColor: "rgba(225,48,108,0.1)",
  },
  activityFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  activityFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "transparent",
  },
  activityFilterPillActive: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.25)",
  },
  activityFilterText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 0.5,
  },
  activityFilterTextActive: {
    color: Colors.text,
  },
  recentInfo: { flex: 1 },
  recentTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recentSub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    marginTop: 2,
  },
  recentRight: { alignItems: "flex-end" },
  recentDate: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  recentSource: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    marginTop: 2,
  },
  coachCard: {
    borderColor: "rgba(246,234,152,0.2)",
    backgroundColor: "rgba(246,234,152,0.04)",
    gap: 12,
  },
  coachHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  coachIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(246,234,152,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  coachLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.highlight,
    letterSpacing: 2,
  },
  coachTitle: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    marginTop: 2,
  },
  coachText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 18,
  },
  coachStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    padding: 12,
  },
  coachStat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  coachStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  coachStatValue: {
    fontSize: 16,
    fontFamily: "Inter_900Black",
    fontStyle: "italic",
  },
  coachStatLabel: {
    fontSize: 7,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  draftCTA: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 149, 0, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 149, 0, 0.30)",
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  draftCTALeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  draftCTATitle: {
    fontSize: 10,
    fontFamily: "Inter_900Black",
    color: Colors.orange,
    letterSpacing: 0.5,
  },
  draftCTASub: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginTop: 2,
  },
  draftCTABtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.orange,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  draftCTABtnText: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 0.5,
  },
});
