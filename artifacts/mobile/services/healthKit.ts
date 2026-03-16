import { Platform, Alert } from "react-native";
import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
  HealthInputOptions,
} from "react-native-health";

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
    ],
    write: [],
  },
};

export function isHealthKitAvailable(): boolean {
  return Platform.OS === "ios";
}

export function requestHealthKitPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isHealthKitAvailable()) {
      resolve(false);
      return;
    }

    AppleHealthKit.initHealthKit(PERMISSIONS, (error: string) => {
      if (error) {
        console.error("HealthKit permission error:", error);
        resolve(false);
        return;
      }
      resolve(true);
    });
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

  const granted = await requestHealthKitPermissions();
  if (!granted) {
    return { success: false };
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

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
