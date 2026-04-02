/**
 * health-debug.tsx — Hidden HealthKit forensic diagnostics screen.
 *
 * Access in TestFlight: Profile → long-press the version label at the bottom.
 * NOT __DEV__ gated — intentionally visible in production builds so QA can
 * capture the exact diagnostic state from a real signed binary.
 *
 * Payload mapped from DiagnosticState:
 *   healthkit_available    → diag.hkAvailable
 *   init_called            → diag.initCalledAt !== null
 *   init_called_at         → diag.initCalledAt (ISO timestamp)
 *   init_error             → diag.initHealthKitError
 *   auth_request_attempted → diag.authRequestAttempted
 *   auth_status_workout    → diag.authResult?.Workout
 *   auth_status_steps      → diag.authResult?.Steps
 *   auth_status_energy     → diag.authResult?.ActiveEnergyBurned
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Clipboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { readDiag, checkHealthKitAvailableViaAPI, syncWithAppleHealth } from "@/services/healthKit";
import { DIAG_STORAGE_KEY, type DiagnosticState } from "@/lib/healthSyncUtils";
import { Colors } from "@/constants/colors";

// ── Payload shape (maps to the 7 required fields + extras) ──────────────────

interface DebugPayload {
  build_number: string;
  platform: string;
  snapshot_at: string;
  healthkit_available: boolean | null;
  hk_available_checked: boolean;
  init_called: boolean;
  init_called_at: string | null;
  init_error: string | null;
  auth_request_attempted: boolean;
  auth_status_workout: string | null;
  auth_status_steps: string | null;
  auth_status_energy: string | null;
  last_stage_reached: string | null;
  last_error_code: string | null;
  last_error_msg: string | null;
  last_sync_attempt_at: string | null;
}

function buildPayload(diag: DiagnosticState): DebugPayload {
  return {
    build_number: "23",
    platform: Platform.OS,
    snapshot_at: new Date().toISOString(),
    healthkit_available: diag.hkAvailable,
    hk_available_checked: diag.hkAvailableChecked,
    init_called: diag.initCalledAt !== null,
    init_called_at: diag.initCalledAt,
    init_error: diag.initHealthKitError,
    auth_request_attempted: diag.authRequestAttempted,
    auth_status_workout: diag.authResult?.Workout ?? null,
    auth_status_steps: diag.authResult?.Steps ?? null,
    auth_status_energy: diag.authResult?.ActiveEnergyBurned ?? null,
    last_stage_reached: diag.lastStageReached,
    last_error_code: diag.lastErrorCode,
    last_error_msg: diag.lastErrorMsg,
    last_sync_attempt_at: diag.lastSyncAttemptAt,
  };
}

// ── Verdict helpers ──────────────────────────────────────────────────────────

function verdict(payload: DebugPayload): string {
  if (!payload.hk_available_checked) return "⚪ SYNC NOT YET ATTEMPTED";
  if (!payload.healthkit_available) {
    return "🔴 NOT_AVAILABLE — entitlement missing or device restricted";
  }
  if (!payload.init_called) return "🟡 isAvailable=true but initHealthKit never called";
  if (payload.init_error) return `🔴 initHealthKit ERROR: ${payload.init_error}`;
  if (!payload.auth_request_attempted) return "🟡 initHealthKit called, no auth request tracked";
  const statuses = [
    payload.auth_status_workout,
    payload.auth_status_steps,
    payload.auth_status_energy,
  ];
  if (statuses.every((s) => s === "SharingAuthorized")) return "🟢 ALL PERMISSIONS GRANTED";
  if (statuses.some((s) => s === "SharingDenied")) return "🟠 SOME PERMISSIONS DENIED";
  if (statuses.every((s) => s === "NotDetermined")) return "🟡 PERMISSIONS NOT YET SHOWN";
  return "🟠 PARTIAL PERMISSIONS";
}

// ── Row component ────────────────────────────────────────────────────────────

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean | null }) {
  const color =
    ok === true ? "#4ADE80" : ok === false ? "#F87171" : Colors.textSubtle;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color }]}>{value}</Text>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function HealthDebugScreen() {
  const [payload, setPayload] = useState<DebugPayload | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const diag = await readDiag();
    setPayload(buildPayload(diag));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLiveCheck = useCallback(async () => {
    setSyncing(true);
    try {
      await checkHealthKitAvailableViaAPI();
      await refresh();
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  const handleTriggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncWithAppleHealth();
      await refresh();
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  const handleClear = useCallback(() => {
    Alert.alert(
      "Clear Diagnostics",
      "This resets all stored HealthKit diagnostic state. The next sync will start fresh.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem(DIAG_STORAGE_KEY);
            await refresh();
          },
        },
      ],
    );
  }, [refresh]);

  const handleCopy = useCallback(() => {
    if (!payload) return;
    Clipboard.setString(JSON.stringify(payload, null, 2));
    Alert.alert("Copied", "Diagnostic payload copied to clipboard.");
  }, [payload]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>HEALTHKIT DIAGNOSTICS</Text>
        <Text style={styles.buildBadge}>BUILD 23</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {payload && (
          <View style={styles.verdictBox}>
            <Text style={styles.verdictText}>{verdict(payload)}</Text>
          </View>
        )}

        <Text style={styles.section}>AVAILABILITY</Text>
        {payload ? (
          <>
            <Row
              label="healthkit_available"
              value={String(payload.healthkit_available)}
              ok={payload.healthkit_available === true}
            />
            <Row
              label="hk_available_checked"
              value={String(payload.hk_available_checked)}
              ok={payload.hk_available_checked}
            />
            <Row label="platform" value={payload.platform} />
          </>
        ) : (
          <Text style={styles.loading}>Loading…</Text>
        )}

        <Text style={styles.section}>INIT PATH</Text>
        {payload && (
          <>
            <Row
              label="init_called"
              value={String(payload.init_called)}
              ok={payload.init_called}
            />
            <Row
              label="init_called_at"
              value={payload.init_called_at ?? "—"}
            />
            <Row
              label="init_error"
              value={payload.init_error ?? "none"}
              ok={payload.init_error === null ? null : false}
            />
            <Row
              label="auth_request_attempted"
              value={String(payload.auth_request_attempted)}
              ok={payload.auth_request_attempted}
            />
          </>
        )}

        <Text style={styles.section}>AUTH STATUS</Text>
        {payload && (
          <>
            <Row
              label="auth_status_workout"
              value={payload.auth_status_workout ?? "—"}
              ok={
                payload.auth_status_workout === "SharingAuthorized"
                  ? true
                  : payload.auth_status_workout === "SharingDenied"
                  ? false
                  : null
              }
            />
            <Row
              label="auth_status_steps"
              value={payload.auth_status_steps ?? "—"}
              ok={
                payload.auth_status_steps === "SharingAuthorized"
                  ? true
                  : payload.auth_status_steps === "SharingDenied"
                  ? false
                  : null
              }
            />
            <Row
              label="auth_status_energy"
              value={payload.auth_status_energy ?? "—"}
              ok={
                payload.auth_status_energy === "SharingAuthorized"
                  ? true
                  : payload.auth_status_energy === "SharingDenied"
                  ? false
                  : null
              }
            />
            <Text style={styles.privacyNote}>
              ⚠ iOS read-permission status is privacy-limited. SharingAuthorized{"\n"}
              can appear even when the user denied the category — only write-permission{"\n"}
              status is definitively accurate on iOS.
            </Text>
          </>
        )}

        <Text style={styles.section}>LAST SYNC</Text>
        {payload && (
          <>
            <Row label="last_stage_reached" value={payload.last_stage_reached ?? "—"} />
            <Row
              label="last_error_code"
              value={payload.last_error_code ?? "none"}
              ok={payload.last_error_code === null ? null : false}
            />
            <Row label="last_error_msg" value={payload.last_error_msg ?? "—"} />
            <Row label="last_sync_attempt_at" value={payload.last_sync_attempt_at ?? "—"} />
            <Row label="snapshot_at" value={payload.snapshot_at} />
          </>
        )}

        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={handleLiveCheck}
            disabled={syncing}
          >
            <Feather name="activity" size={14} color="#000" />
            <Text style={styles.actionBtnTextDark}>
              {syncing ? "CHECKING…" : "LIVE isAvailable CHECK"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={handleTriggerSync}
            disabled={syncing}
          >
            <Feather name="refresh-cw" size={14} color={Colors.text} />
            <Text style={styles.actionBtnText}>
              {syncing ? "SYNCING…" : "TRIGGER FULL SYNC"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={handleCopy}
          >
            <Feather name="copy" size={14} color={Colors.text} />
            <Text style={styles.actionBtnText}>COPY JSON PAYLOAD</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={handleClear}
          >
            <Feather name="trash-2" size={14} color="#F87171" />
            <Text style={styles.actionBtnTextDanger}>CLEAR DIAGNOSTICS</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          Access: Profile → long-press version label{"\n"}
          Not visible to users. For QA and developer use only.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F1F",
  },
  backBtn: { marginRight: 12 },
  title: {
    flex: 1,
    color: Colors.text,
    fontFamily: "Inter_900Black",
    fontSize: 13,
    letterSpacing: 1,
  },
  buildBadge: {
    color: Colors.orange,
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    backgroundColor: "#2A1A00",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },
  verdictBox: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  verdictText: {
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    lineHeight: 20,
  },
  section: {
    color: Colors.textSubtle,
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 20,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
    gap: 12,
  },
  rowLabel: {
    color: Colors.textSubtle,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    flexShrink: 0,
  },
  rowValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    flexShrink: 1,
    textAlign: "right",
  },
  loading: {
    color: Colors.textSubtle,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    paddingVertical: 12,
  },
  actions: { marginTop: 28, gap: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 8,
    gap: 8,
  },
  actionBtnPrimary: { backgroundColor: Colors.orange },
  actionBtnSecondary: { backgroundColor: "#1F1F1F", borderWidth: 1, borderColor: "#2A2A2A" },
  actionBtnDanger: { backgroundColor: "#1A0A0A", borderWidth: 1, borderColor: "#3A1010" },
  actionBtnText: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 0.5 },
  actionBtnTextDark: { color: "#000", fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 0.5 },
  actionBtnTextDanger: { color: "#F87171", fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 0.5 },
  privacyNote: {
    color: "#8B6914",
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    marginTop: 10,
    lineHeight: 16,
    backgroundColor: "#1A1500",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "#2A2000",
  },
  note: {
    color: "#444",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    marginTop: 32,
    lineHeight: 18,
  },
});
