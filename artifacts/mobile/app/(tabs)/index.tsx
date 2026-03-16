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
import { ActivityImportModal } from "@/components/ActivityImportModal";
import { InsightInfoModal } from "@/components/InsightInfoModal";
import { OnboardingModal } from "@/components/OnboardingModal";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
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
import { useGenerateWorkout, type GeneratedWorkout } from "@/hooks/useWorkout";
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
  const { mutate: submitExternalWorkout } = useSubmitExternalWorkout();
  const { mutate: deleteExternalWorkout } = useDeleteExternalWorkout();
  const { data: recentExternalWorkouts } = useRecentExternalWorkouts();
  const { mutate: generateWorkout, isPending: isGenerating } = useGenerateWorkout();

  const { data: recoveryCorrelation } = useRecoveryCorrelation();

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);
  const [readinessInfoOpen, setReadinessInfoOpen] = useState(false);
  const [coachSecretInfoOpen, setCoachSecretInfoOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [autoCheckInTriggered, setAutoCheckInTriggered] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);

  const streak = profile?.streakDays ?? 0;
  const syncProgress = profile?.dailySyncProgress ?? 0;
  const checkInDone = !!todayCheckIn;
  const activityDone = profile?.activityImported ?? false;
  const onboardingDone = profile?.onboardingCompleted ?? false;

  const now = new Date();
  const todayRestWorkout = recentExternalWorkouts?.find((w: any) => {
    if (w.workoutType !== "rest") return false;
    const d = new Date(w.createdAt);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });
  const isRestDay = !!todayRestWorkout;

  const readinessScore = computeReadinessScore(todayCheckIn);

  const completedTasks = [checkInDone, activityDone].filter(Boolean).length;
  const pct = Math.round((completedTasks / 2) * 100);

  useEffect(() => {
    if (!isLoading && !checkInLoading && profile && !onboardingDone) {
      setOnboardingOpen(true);
    }
  }, [isLoading, checkInLoading, profile, onboardingDone]);

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
    if (!isLoading && !checkInLoading && checkInDone && !generatedWorkout && !isGenerating) {
      generateWorkout(undefined, {
        onSuccess: (workout) => setGeneratedWorkout(workout),
      });
    }
  }, [isLoading, checkInLoading, checkInDone, generatedWorkout, isGenerating]);

  const handleOnboardingComplete = (data: {
    fitnessGoal: string;
    skillLevel: string;
    equipment: string[];
    injuries: string[];
  }) => {
    updateProfile({
      fitnessGoal: data.fitnessGoal,
      skillLevel: data.skillLevel,
      equipment: data.equipment,
      injuries: data.injuries,
      onboardingCompleted: true,
    }, {
      onSuccess: () => setOnboardingOpen(false),
    });
  };

  const handleCheckInComplete = (data: CheckInData) => {
    const wasAlreadyDone = checkInDone;
    submitCheckIn(data, {
      onSuccess: () => {
        setCheckInOpen(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (!wasAlreadyDone) {
          const newProgress = Math.min(100, syncProgress + 50);
          updateProfile({ checkInCompleted: true, dailySyncProgress: newProgress, streakDays: streak + 1 });
        }
        generateWorkout(undefined, {
          onSuccess: (workout) => {
            setGeneratedWorkout(workout);
          },
        });
      },
      onError: () => {
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
      },
      {
        onSuccess: () => {
          const newProgress = Math.min(100, syncProgress + 50);
          updateProfile({ activityImported: true, dailySyncProgress: newProgress });
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
    });
  };

  const handleStartWorkout = () => {
    if (!checkInDone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (generatedWorkout) {
      router.push({
        pathname: "/workout-session",
        params: { workout: JSON.stringify(generatedWorkout) },
      });
    } else {
      generateWorkout(undefined, {
        onSuccess: (workout) => {
          setGeneratedWorkout(workout);
          router.push({
            pathname: "/workout-session",
            params: { workout: JSON.stringify(workout) },
          });
        },
      });
    }
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

  const workoutTitle = generatedWorkout?.workoutTitle ?? "Back & Arms\nFocus";
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
              <Text style={styles.streakText}>{streak}</Text>
            </View>
          </View>
        </View>

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

            <Pressable
              onPress={handleStartWorkout}
              style={({ pressed }) => [
                styles.taskItem,
                checkInDone ? styles.taskPending : styles.taskLocked,
                { opacity: checkInDone ? (pressed ? 0.85 : 1) : 0.5 },
              ]}
            >
              <View style={[styles.taskIcon, checkInDone ? styles.taskIconHighlight : styles.taskIconLocked]}>
                <Feather name="activity" size={16} color={checkInDone ? Colors.highlight : "#3C3C3A"} />
              </View>
              <View style={styles.taskInfo}>
                <Text style={[styles.taskTitle, !checkInDone && styles.taskTitleLocked]}>Physique Protocol</Text>
                <Text style={styles.taskSub}>{checkInDone ? "Generate AI workout" : "Locked: Complete check-in first"}</Text>
              </View>
              {checkInDone ? (
                <Feather name="chevron-right" size={16} color={Colors.textMuted} />
              ) : (
                <Feather name="lock" size={16} color="#3C3C3A" />
              )}
            </Pressable>
          </View>
        </BentoCard>

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
              <ActivityIndicator color={Colors.orange} size="small" />
              <Text style={styles.generatingText}>Generating your workout...</Text>
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
              const canTap = checkInDone && (isRestDay || !activityDone);
              return [
                styles.secondaryCard,
                isRestDay ? styles.secondaryCardDone : undefined,
                { opacity: canTap ? (pressed ? 0.85 : 1) : 0.4 },
              ];
            }}
            onPress={() => {
              if (!checkInDone) return;
              if (isRestDay) {
                handleUndoRestDay();
              } else if (!activityDone) {
                handleRestDay();
              }
            }}
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
          <BentoCard style={[styles.statCard, { flex: 1 }]}>
            <Feather name="zap" size={18} color={Colors.orange} />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </BentoCard>
          <BentoCard style={[styles.statCard, { flex: 1 }]}>
            <Feather name="target" size={18} color={Colors.highlight} />
            <Text style={styles.statValue}>{profile?.workoutFrequency ?? 3}x</Text>
            <Text style={styles.statLabel}>/ Week</Text>
          </BentoCard>
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

        {(recentExternalWorkouts && recentExternalWorkouts.length > 0) && (
          <BentoCard>
            <Text style={styles.sectionLabel}>Recent Activity</Text>
            <View style={styles.recentList}>
              {recentExternalWorkouts.slice(0, 5).map((workout: any) => {
                const isRest = workout.workoutType === "rest";
                const isExternal = workout.source !== "in-app";
                const dateStr = new Date(workout.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
                const iconName = isRest ? "moon" : isExternal ? "globe" : "award";
                const iconColor = isRest ? Colors.recovery : isExternal ? Colors.orange : Colors.highlight;
                const iconBg = isRest ? styles.recentIconRest : isExternal ? styles.recentIconExternal : styles.recentIconInApp;
                const sourceLabel = isRest ? "Rest Day" : isExternal ? "External" : "In-App";
                return (
                  <View key={workout.id} style={styles.recentItem}>
                    <View style={[styles.recentIcon, iconBg]}>
                      <Feather name={iconName} size={14} color={iconColor} />
                    </View>
                    <View style={styles.recentInfo}>
                      <Text style={styles.recentTitle}>{workout.label}</Text>
                      <Text style={styles.recentSub}>
                        {isRest
                          ? "Recovery day"
                          : `${workout.duration} min${workout.intensity ? ` · RPE ${workout.intensity}` : ""}${workout.stimulusPoints ? ` · ${workout.stimulusPoints} pts` : ""}`
                        }
                      </Text>
                    </View>
                    <View style={styles.recentRight}>
                      <Text style={styles.recentDate}>{dateStr}</Text>
                      <Text style={styles.recentSource}>{sourceLabel}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </BentoCard>
        )}
      </ScrollView>

      <OnboardingModal
        visible={onboardingOpen}
        onComplete={handleOnboardingComplete}
      />

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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  generatingText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
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
});
