import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const NOTIF_PREFS_KEY = "notif_prefs_v1";
const ID_CHECKIN = "daily-checkin-reminder";
const ID_WORKOUT = "daily-workout-reminder";

export interface NotifPrefs {
  checkInEnabled: boolean;
  checkInHour: number;
  checkInMinute: number;
  workoutEnabled: boolean;
  workoutHour: number;
  workoutMinute: number;
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  checkInEnabled: true,
  checkInHour: 8,
  checkInMinute: 0,
  workoutEnabled: true,
  workoutHour: 18,
  workoutMinute: 0,
};

const CHECKIN_MESSAGES = [
  { title: "Morning check-in ⚡", body: "How's your energy? 30 seconds of data makes today's workout smarter." },
  { title: "Quick check-in time", body: "Log your sleep, energy & soreness so your AI coach can calibrate your session." },
  { title: "Start smart today", body: "Your readiness score is waiting. Check in to unlock today's optimized workout." },
];

const WORKOUT_MESSAGES = [
  { title: "Time to move 🔥", body: "Your streak is counting on you. Tap to log today's session." },
  { title: "Don't break the chain", body: "Even a short session beats zero. Your body will thank you tomorrow." },
  { title: "Your muscles are waiting", body: "Progressive overload doesn't happen by itself. Let's get it done." },
  { title: "Streak alert 🔥", body: "You're building something great. Keep the momentum going today." },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function loadNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_PREFS_KEY);
    if (!raw) return { ...DEFAULT_NOTIF_PREFS };
    return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIF_PREFS };
  }
}

export async function saveNotifPrefs(prefs: NotifPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

async function cancelById(id: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

async function scheduleDaily(
  id: string,
  title: string,
  body: string,
  hour: number,
  minute: number
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await cancelById(id);
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
      },
    });
  } catch (e) {
    console.warn("[notifications] scheduleDaily error:", e);
  }
}

export async function applyNotifPrefs(prefs: NotifPrefs): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await requestNotificationPermission();
  if (!granted) return;

  if (prefs.checkInEnabled) {
    const msg = pickRandom(CHECKIN_MESSAGES);
    await scheduleDaily(ID_CHECKIN, msg.title, msg.body, prefs.checkInHour, prefs.checkInMinute);
  } else {
    await cancelById(ID_CHECKIN);
  }

  if (prefs.workoutEnabled) {
    const msg = pickRandom(WORKOUT_MESSAGES);
    await scheduleDaily(ID_WORKOUT, msg.title, msg.body, prefs.workoutHour, prefs.workoutMinute);
  } else {
    await cancelById(ID_WORKOUT);
  }
}

export async function initNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await requestNotificationPermission();
  if (!granted) return;
  const prefs = await loadNotifPrefs();
  await applyNotifPrefs(prefs);
}

export async function sendTestNotification(type: "checkin" | "workout"): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
    const msg = type === "checkin" ? pickRandom(CHECKIN_MESSAGES) : pickRandom(WORKOUT_MESSAGES);
    await Notifications.scheduleNotificationAsync({
      content: { title: msg.title, body: msg.body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3,
      },
    });
  } catch (e) {
    console.warn("[notifications] sendTestNotification error:", e);
  }
}

export async function sendWorkoutReadyNotification(workoutTitle: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Workout Ready",
        body: `Your workout "${workoutTitle}" has been generated. Tap to review it.`,
        sound: true,
      },
      trigger: null,
    });
  } catch {}
}

export async function sendArchitectWorkoutReadyNotification(workoutTitle: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Custom Workout Ready",
        body: `"${workoutTitle}" is ready to review. Tap to check it out.`,
        sound: true,
      },
      trigger: null,
    });
  } catch {}
}
