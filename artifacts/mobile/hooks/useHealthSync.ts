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
import {
  syncWithAppleHealth,
  isPlatformIOS,
} from "@/services/healthKit";
import type { HealthErrorCode } from "@/lib/healthSyncUtils";

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
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHealthSync() {
  const [state, setState] = useState<HealthSyncState>(INITIAL_STATE);
  const isAvailable = isPlatformIOS();
  const syncingRef = useRef(false);

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
        const next: HealthSyncState = {
          status: "success",
          lastSyncedAt: new Date().toISOString(),
          lastError: null,
          lastErrorCode: null,
          steps: result.steps ?? null,
          activeCalories: result.activeCalories ?? null,
          workoutCount: result.workoutCount ?? null,
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
  }, [state, persist]);

  return {
    state,
    isAvailable,
    /** Begin a sync. No-ops if already syncing. */
    sync,
  };
}

