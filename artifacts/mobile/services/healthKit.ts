import { Platform } from "react-native";
import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
  HealthInputOptions,
} from "react-native-health";

function buildPermissions(): HealthKitPermissions | null {
  try {
    return {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.Workout,
          AppleHealthKit.Constants.Permissions.Steps,
          AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
        ],
        write: [],
      },
    };
  } catch {
    return null;
  }
}

export function isHealthKitAvailable(): boolean {
  return Platform.OS === "ios";
}

export function requestHealthKitPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isHealthKitAvailable()) {
      resolve(false);
      return;
    }

    const permissions = buildPermissions();
    if (!permissions) {
      resolve(false);
      return;
    }

    try {
      AppleHealthKit.initHealthKit(permissions, (error: string) => {
        if (error) {
          console.error("HealthKit permission error:", error);
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (e) {
      console.error("HealthKit initHealthKit threw:", e);
      resolve(false);
    }
  });
}

export function getStepCount(
  startDate: Date,
  endDate: Date
): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
    try {
      AppleHealthKit.getDailyStepCountSamples(
        options,
        (error: string, results: HealthValue[]) => {
          if (error) {
            reject(new Error(error));
            return;
          }
          resolve(results);
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

export function getActiveEnergyBurned(
  startDate: Date,
  endDate: Date
): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
    try {
      AppleHealthKit.getActiveEnergyBurned(
        options,
        (error: string, results: HealthValue[]) => {
          if (error) {
            reject(new Error(error));
            return;
          }
          resolve(results);
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

export function getWorkouts(
  startDate: Date,
  endDate: Date
): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
    try {
      AppleHealthKit.getSamples(
        { ...options, type: "Workout" } as any,
        (error: string, results: HealthValue[]) => {
          if (error) {
            reject(new Error(error));
            return;
          }
          resolve(results);
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

export async function syncWithAppleHealth(): Promise<{
  success: boolean;
  steps?: number;
  activeCalories?: number;
  workoutCount?: number;
}> {
  if (!isHealthKitAvailable()) {
    return { success: false };
  }

  let granted = false;
  try {
    granted = await requestHealthKitPermissions();
  } catch (e) {
    console.error("HealthKit permissions request failed:", e);
    return { success: false };
  }

  if (!granted) {
    return { success: false };
  }

  const endDate = new Date();
  const startDate = new Date("2010-01-01T00:00:00.000Z");

  try {
    const [steps, calories, workouts] = await Promise.all([
      getStepCount(startDate, endDate),
      getActiveEnergyBurned(startDate, endDate),
      getWorkouts(startDate, endDate),
    ]);

    const totalSteps = steps.reduce((sum, s) => sum + (s.value ?? 0), 0);
    const totalCalories = calories.reduce(
      (sum, c) => sum + (c.value ?? 0),
      0
    );

    return {
      success: true,
      steps: Math.round(totalSteps),
      activeCalories: Math.round(totalCalories),
      workoutCount: workouts.length,
    };
  } catch (error) {
    console.error("HealthKit sync error:", error);
    return { success: false };
  }
}
