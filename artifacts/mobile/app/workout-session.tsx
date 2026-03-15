import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";

const WORKOUT_TEMPLATES: Record<string, { title: string; subtitle: string; exercises: Exercise[] }> = {
  "1": {
    title: "Heavy Compound Day",
    subtitle: "Strength · Power",
    exercises: [
      { id: "a", name: "Back Squat", sets: 5, reps: 5, weight: "80kg", muscles: "Quads · Glutes" },
      { id: "b", name: "Deadlift", sets: 4, reps: 4, weight: "100kg", muscles: "Posterior Chain" },
      { id: "c", name: "Overhead Press", sets: 4, reps: 6, weight: "50kg", muscles: "Shoulders · Triceps" },
      { id: "d", name: "Barbell Row", sets: 3, reps: 8, weight: "70kg", muscles: "Back · Biceps" },
    ],
  },
  "2": {
    title: "Back & Bicep Hypertrophy",
    subtitle: "Volume · Pump",
    exercises: [
      { id: "a", name: "Weighted Pull-Up", sets: 4, reps: 8, weight: "+10kg", muscles: "Lats · Biceps" },
      { id: "b", name: "Cable Row", sets: 4, reps: 12, weight: "60kg", muscles: "Mid Back" },
      { id: "c", name: "DB Curl", sets: 3, reps: 12, weight: "16kg", muscles: "Biceps" },
      { id: "d", name: "Face Pull", sets: 3, reps: 15, weight: "30kg", muscles: "Rear Delt" },
    ],
  },
  default: {
    title: "Back & Arms Focus",
    subtitle: "AI Optimized · Today's Protocol",
    exercises: [
      { id: "a", name: "Weighted Pull-Up", sets: 4, reps: 6, weight: "+10kg", muscles: "Lats · Biceps" },
      { id: "b", name: "Barbell Row", sets: 4, reps: 8, weight: "75kg", muscles: "Mid Back" },
      { id: "c", name: "EZ Bar Curl", sets: 3, reps: 12, weight: "35kg", muscles: "Biceps" },
      { id: "d", name: "Overhead Tricep Ext", sets: 3, reps: 12, weight: "25kg", muscles: "Triceps" },
      { id: "e", name: "Face Pull", sets: 3, reps: 15, weight: "30kg", muscles: "Rear Delt" },
    ],
  },
};

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: string;
  muscles: string;
}

interface SetLog {
  completed: boolean;
  weight: string;
  reps: number;
}

export default function WorkoutSessionScreen() {
  const insets = useSafeAreaInsets();
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const workout = WORKOUT_TEMPLATES[workoutId ?? "default"] ?? WORKOUT_TEMPLATES["default"];

  const [setLogs, setSetLogs] = useState<Record<string, SetLog[]>>(() => {
    const logs: Record<string, SetLog[]> = {};
    workout.exercises.forEach((ex) => {
      logs[ex.id] = Array.from({ length: ex.sets }, (_, i) => ({
        completed: false,
        weight: ex.weight,
        reps: ex.reps,
      }));
    });
    return logs;
  });

  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const totalSets = workout.exercises.reduce((a, ex) => a + ex.sets, 0);
  const completedSets = Object.values(setLogs).reduce(
    (a, logs) => a + logs.filter((l) => l.completed).length,
    0
  );
  const pct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  const toggleSet = (exId: string, setIdx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSetLogs((prev) => {
      const logs = [...prev[exId]];
      logs[setIdx] = { ...logs[setIdx], completed: !logs[setIdx].completed };
      return { ...prev, [exId]: logs };
    });
  };

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (timerRef.current) clearInterval(timerRef.current);
    setFinished(true);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (finished) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.finishedBlock}>
          <View style={styles.finishedIcon}>
            <Feather name="zap" size={40} color={Colors.highlight} />
          </View>
          <Text style={styles.finishedTitle}>WORKOUT{"\n"}COMPLETE</Text>
          <Text style={styles.finishedSub}>
            {formatTime(elapsed)} · {completedSets} sets
          </Text>
          <View style={styles.finishedStats}>
            <View style={styles.finishedStat}>
              <Text style={[styles.finishedStatVal, { color: Colors.orange }]}>{completedSets}</Text>
              <Text style={styles.finishedStatLabel}>Sets Done</Text>
            </View>
            <View style={styles.finishedStat}>
              <Text style={[styles.finishedStatVal, { color: Colors.recovery }]}>{formatTime(elapsed)}</Text>
              <Text style={styles.finishedStatLabel}>Duration</Text>
            </View>
            <View style={styles.finishedStat}>
              <Text style={[styles.finishedStatVal, { color: Colors.highlight }]}>{pct}%</Text>
              <Text style={styles.finishedStatLabel}>Completion</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.doneBtn, { opacity: pressed ? 0.9 : 1 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.doneBtnText}>BACK TO DASHBOARD</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={20} color={Colors.textMuted} />
        </Pressable>
        <View style={styles.timerBlock}>
          <Feather name="clock" size={13} color={Colors.orange} />
          <Text style={styles.timer}>{formatTime(elapsed)}</Text>
        </View>
        <Pressable onPress={handleFinish} style={styles.finishBtn}>
          <Text style={styles.finishBtnText}>FINISH</Text>
        </Pressable>
      </View>

      {/* Progress */}
      <View style={styles.progressBlock}>
        <View style={styles.progressRow}>
          <Text style={styles.workoutTitle}>{workout.title}</Text>
          <Text style={styles.progressPct}>{pct}%</Text>
        </View>
        <Text style={styles.workoutSub}>{workout.subtitle}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
        </View>
      </View>

      {/* Exercise list */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {workout.exercises.map((ex) => (
          <View key={ex.id} style={styles.exCard}>
            <View style={styles.exHeader}>
              <View>
                <Text style={styles.exName}>{ex.name}</Text>
                <Text style={styles.exMuscles}>{ex.muscles}</Text>
              </View>
              <View style={styles.exMeta}>
                <Text style={styles.exMetaText}>{ex.weight}</Text>
              </View>
            </View>

            <View style={styles.setList}>
              {setLogs[ex.id]?.map((log, i) => (
                <Pressable
                  key={i}
                  onPress={() => toggleSet(ex.id, i)}
                  style={({ pressed }) => [
                    styles.setRow,
                    log.completed && styles.setRowDone,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <View style={[styles.setCircle, log.completed && styles.setCircleDone]}>
                    {log.completed
                      ? <Feather name="check" size={12} color={Colors.bgPrimary} />
                      : <Text style={styles.setNum}>{i + 1}</Text>
                    }
                  </View>
                  <Text style={[styles.setLabel, log.completed && styles.setLabelDone]}>
                    {log.reps} reps · {log.weight}
                  </Text>
                  <Feather
                    name={log.completed ? "check-circle" : "circle"}
                    size={16}
                    color={log.completed ? Colors.highlight : "#3C3C3A"}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  timerBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  timer: {
    fontSize: 15,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    letterSpacing: 1,
  },
  finishBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  finishBtnText: {
    fontSize: 11,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  progressBlock: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workoutTitle: {
    fontSize: 20,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
  },
  workoutSub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    letterSpacing: 0.5,
  },
  progressPct: {
    fontSize: 16,
    fontFamily: "Inter_900Black",
    color: Colors.highlight,
    fontStyle: "italic",
  },
  progressTrack: { height: 4, backgroundColor: "#292927", borderRadius: 4, overflow: "hidden", marginTop: 2 },
  progressFill: { height: "100%", backgroundColor: Colors.orange, borderRadius: 4 },
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },
  exCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  exHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  exName: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text, textTransform: "uppercase", letterSpacing: 0.4 },
  exMuscles: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSubtle, marginTop: 2 },
  exMeta: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  exMetaText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textMuted },
  setList: { gap: 6 },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  setRowDone: {
    borderColor: "rgba(246,234,152,0.2)",
    backgroundColor: "rgba(246,234,152,0.05)",
  },
  setCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2A2A28",
    borderWidth: 1,
    borderColor: "#3C3C3A",
    alignItems: "center",
    justifyContent: "center",
  },
  setCircleDone: {
    backgroundColor: Colors.highlight,
    borderColor: Colors.highlight,
  },
  setNum: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textSubtle },
  setLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  setLabelDone: { color: Colors.text, textDecorationLine: "line-through" },
  finishedBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 18,
  },
  finishedIcon: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: "rgba(246,234,152,0.1)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  finishedTitle: {
    fontSize: 40,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 44,
  },
  finishedSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSubtle,
    letterSpacing: 1,
  },
  finishedStats: { flexDirection: "row", gap: 16 },
  finishedStat: { alignItems: "center", gap: 4 },
  finishedStatVal: { fontSize: 24, fontFamily: "Inter_900Black", fontStyle: "italic" },
  finishedStatLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 1 },
  doneBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  doneBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
});
