import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
  } catch {
    // Notifications unavailable - silently continue
  }
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
  } catch {
    // Notifications unavailable - silently continue
  }
}
