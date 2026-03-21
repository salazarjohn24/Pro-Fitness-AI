/**
 * useHealthDiagnostics — reads and refreshes HealthKit diagnostic state.
 *
 * Diagnostic state is persisted to AsyncStorage by healthKit.ts during every
 * sync attempt. This hook surfaces it for the dev diagnostics panel.
 * Only intended for __DEV__ builds — do not expose to production users.
 */

import { useState, useCallback, useEffect } from "react";
import { DIAG_INITIAL, type DiagnosticState } from "@/lib/healthSyncUtils";
import { readDiag, runHealthEntitlementChecklist } from "@/services/healthKit";

export type EntitlementCheck = {
  label: string;
  pass: boolean;
  detail: string;
};

export interface HealthDiagnosticsData {
  diag: DiagnosticState;
  entitlementChecks: EntitlementCheck[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  runChecklist: () => Promise<void>;
}

export function useHealthDiagnostics(): HealthDiagnosticsData {
  const [diag, setDiag] = useState<DiagnosticState>({ ...DIAG_INITIAL });
  const [entitlementChecks, setEntitlementChecks] = useState<EntitlementCheck[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const state = await readDiag();
      setDiag(state);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runChecklist = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await runHealthEntitlementChecklist();
      setEntitlementChecks(result.checks);
      const updated = await readDiag();
      setDiag(updated);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { diag, entitlementChecks, isLoading, refresh, runChecklist };
}
