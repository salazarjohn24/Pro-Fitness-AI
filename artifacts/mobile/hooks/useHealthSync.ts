/**
 * useHealthSync — React hook for Apple Health sync state machine.
 *
 * State lifecycle:
 *   not_connected  →  syncing  →  success (lastSyncedAt set)
 *                            ↘  failed   (lastError + lastErrorCode set)
 *
 * State is persisted to AsyncStorage so last_synced_at and failure context
 * survive app restarts. If the app closed while status="syncing", the hook
 * rehydrates it as "failed" to prompt the user to retry.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import {
  syncWithAppleHealth,
  isPlatformIOS,
  type SyncWorkout,
} from "@/services/healthKit";
import type { HealthErrorCode } from "@/lib/healthSyncUtils";
import { getApiBase, getAuthHeaders, getFetchOptions } from "@/hooks/apiHelpers";

export { formatLastSynced } from "@/lib/healthSyncUtils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncStatus =
  | "not_connected"
  | "connected"
  | "syncing"
  | "failed"
  | "success";

export interface HealthSyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
  lastErrorCode: HealthErrorCode | null;
  steps: number | null;
  activeCalories: number | null;
  workoutCount: number | null;
  /**
   * Number of Apple Health workouts persisted to the database on the most
   * recent successful sync.  Null until the first successful sync+import.
   */
  importedCount: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "@health_sync_state_v1";

const INITIAL_STATE: HealthSyncState = {
  status: "not_connected",
  lastSyncedAt: null,
  lastError: null,
  lastErrorCode: null,
  steps: null,
  activeCalories: null,
  workoutCount: null,
  importedCount: null,
};

// ---------------------------------------------------------------------------
// Apple Health workout import helper
// ---------------------------------------------------------------------------

/**
 * Send a batch of SyncWorkout records to the server for persistence.
 *
 * The server deduplicates by HealthKit UUID so this is safe to call on every
 * sync — already-imported workouts are silently skipped.
 *
 * Returns { imported, skipped } or null when the request fails (non-fatal).
 */
async function importHealthWorkoutsToApi(
  workouts: SyncWorkout[]
): Promise<{ imported: number; skipped: number } | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${getApiBase()}/api/workouts/health-import`, {
      ...getFetchOptions(headers),
      method: "POST",
      body: JSON.stringify({ workouts }),
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ imported: number; skipped: number }>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHealthSync() {
  const [state, setState] = useState<HealthSyncState>(INITIAL_STATE);
  const isAvailable = isPlatformIOS();
  const syncingRef = useRef(false);
  const queryClient = useQueryClient();

  // Restore persisted state on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const saved = JSON.parse(raw) as Partial<HealthSyncState>;
          setState((prev) => ({
            ...prev,
            ...saved,
            // If app closed mid-sync, surface as failed so user sees Retry
            status:
              saved.status === "syncing"
                ? "failed"
                : (saved.status ?? "not_connected"),
            lastError:
              saved.status === "syncing"
                ? "Sync was interrupted. Tap Retry to continue."
                : (saved.lastError ?? null),
          }));
        } catch {
          // Corrupt storage: start fresh
        }
      })
      .catch(() => {});
  }, []);

  const persist = useCallback(async (next: HealthSyncState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage failure is non-fatal — sync still ran; state lives in memory
    }
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    const syncing: HealthSyncState = {
      ...state,
      status: "syncing",
      lastError: null,
      lastErrorCode: null,
    };
    setState(syncing);
    await persist(syncing);

    try {
      const result = await syncWithAppleHealth();

      if (result.success) {
        // Persist Apple Health workouts to the database (best-effort, non-blocking
        // to the overall sync success status).
        let importedCount: number | null = null;
        if (result.workouts && result.workouts.length > 0) {
          const importResult = await importHealthWorkoutsToApi(result.workouts);
          importedCount = importResult?.imported ?? null;
          if (importResult && importResult.imported > 0) {
            queryClient.invalidateQueries({ queryKey: ["recent-external-workouts"] });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
          }
        }

        const next: HealthSyncState = {
          status: "success",
          lastSyncedAt: new Date().toISOString(),
          lastError: null,
          lastErrorCode: null,
          steps: result.steps ?? null,
          activeCalories: result.activeCalories ?? null,
          workoutCount: result.workoutCount ?? null,
          importedCount,
        };
        setState(next);
        await persist(next);
      } else {
        const next: HealthSyncState = {
          ...state,
          status: "failed",
          lastSyncedAt: state.lastSyncedAt,
          lastError: result.userMessage ?? "Sync failed. Please try again.",
          lastErrorCode: result.errorCode ?? null,
        };
        setState(next);
        await persist(next);
      }
    } catch (err) {
      const next: HealthSyncState = {
        ...state,
        status: "failed",
        lastSyncedAt: state.lastSyncedAt,
        lastError: "An unexpected error occurred. Please try again.",
        lastErrorCode: null,
      };
      setState(next);
      await persist(next);
    } finally {
      syncingRef.current = false;
    }
  }, [state, persist, queryClient]);

  return {
    state,
    isAvailable,
    /** Begin a sync. No-ops if already syncing. */
    sync,
  };
}

