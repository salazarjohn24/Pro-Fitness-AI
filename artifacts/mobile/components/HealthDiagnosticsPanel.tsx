/**
 * HealthDiagnosticsPanel — dev-only diagnostics overlay for Apple Health sync.
 *
 * Shows:
 *   - HealthKit available (from isAvailable API)
 *   - authRequestAttempted (did initHealthKit fire?)
 *   - Authorization result by category (Workout / Steps / ActiveEnergyBurned)
 *   - Last sync stage reached (permission → read → transform → dedupe → save)
 *   - Last error code + message
 *   - Entitlement checklist (run on demand)
 *
 * Rendered ONLY when __DEV__ === true. Must be excluded from production builds.
 * Wrap usage in: {__DEV__ && <HealthDiagnosticsPanel />}
 */

import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useHealthDiagnostics } from "@/hooks/useHealthDiagnostics";

const STATUS_COLOR: Record<string, string> = {
  SharingAuthorized: "#22c55e",
  SharingDenied: "#ef4444",
  NotDetermined: "#f59e0b",
};

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, color ? { color } : undefined]}>{value}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export function HealthDiagnosticsPanel() {
  if (!__DEV__) return null;

  const { diag, entitlementChecks, isLoading, refresh, runChecklist } = useHealthDiagnostics();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable style={styles.toggleRow} onPress={() => setExpanded((v) => !v)}>
        <View style={styles.toggleLeft}>
          <View style={[styles.devBadge]}>
            <Text style={styles.devBadgeText}>DEV</Text>
          </View>
          <Text style={styles.toggleLabel}>HealthKit Diagnostics</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>

      {expanded && (
        <ScrollView style={styles.body} nestedScrollEnabled>
          {isLoading && (
            <ActivityIndicator size="small" color="#818cf8" style={{ marginVertical: 8 }} />
          )}

          <SectionHeader title="Device / API" />
          <Row
            label="Platform"
            value={diag.hkAvailableChecked ? (diag.hkAvailable ? "iOS ✓" : "iOS (HK unavailable)") : "not checked"}
            color={diag.hkAvailable === true ? "#22c55e" : diag.hkAvailable === false ? "#ef4444" : "#888"}
          />
          <Row
            label="HK Available (API)"
            value={
              diag.hkAvailableChecked
                ? diag.hkAvailable === true
                  ? "true ✓"
                  : "false ✗"
                : "not checked yet"
            }
            color={diag.hkAvailable === true ? "#22c55e" : diag.hkAvailable === false ? "#ef4444" : "#888"}
          />

          <SectionHeader title="Authorization" />
          <Row
            label="Auth requested"
            value={diag.authRequestAttempted ? "yes ✓" : "NO — initHealthKit never called ✗"}
            color={diag.authRequestAttempted ? "#22c55e" : "#ef4444"}
          />
          <Row
            label="initHealthKit error"
            value={diag.initHealthKitError ?? "none"}
            color={diag.initHealthKitError ? "#ef4444" : "#22c55e"}
          />

          {diag.authResult ? (
            <>
              <SectionHeader title="Auth by Category" />
              {(["Workout", "Steps", "ActiveEnergyBurned"] as const).map((cat) => (
                <Row
                  key={cat}
                  label={cat}
                  value={diag.authResult![cat]}
                  color={STATUS_COLOR[diag.authResult![cat]]}
                />
              ))}
              <View style={styles.privacyNote}>
                <Text style={styles.privacyNoteText}>
                  ⚠ iOS read-permission status is privacy-limited. SharingAuthorized may appear even when the user denied a category. Only write-permission status is definitively accurate.
                </Text>
              </View>
            </>
          ) : (
            <Row label="Auth by category" value="not yet fetched" color="#888" />
          )}

          <SectionHeader title="Last Sync" />
          <Row
            label="Stage reached"
            value={diag.lastStageReached ?? "none"}
            color={diag.lastStageReached === "save" ? "#22c55e" : "#f59e0b"}
          />
          <Row
            label="Last attempt"
            value={diag.lastSyncAttemptAt ? new Date(diag.lastSyncAttemptAt).toLocaleTimeString() : "never"}
          />
          <Row
            label="Error code"
            value={diag.lastErrorCode ?? "none"}
            color={diag.lastErrorCode ? "#ef4444" : "#22c55e"}
          />
          {diag.lastErrorMsg && (
            <View style={styles.errorMsgBox}>
              <Text style={styles.errorMsgText}>{diag.lastErrorMsg}</Text>
            </View>
          )}

          {entitlementChecks.length > 0 && (
            <>
              <SectionHeader title="Entitlement Checklist" />
              {entitlementChecks.map((c, i) => (
                <View key={i} style={styles.checkRow}>
                  <Text style={[styles.checkIcon, { color: c.pass ? "#22c55e" : "#ef4444" }]}>
                    {c.pass ? "✓" : "✗"}
                  </Text>
                  <View style={styles.checkContent}>
                    <Text style={styles.checkLabel}>{c.label}</Text>
                    <Text style={styles.checkDetail}>{c.detail}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.btn} onPress={refresh} disabled={isLoading}>
              <Text style={styles.btnText}>Refresh</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={runChecklist} disabled={isLoading}>
              <Text style={[styles.btnText, styles.btnPrimaryText]}>Run Checklist</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 12,
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: "#0f0f1a",
    borderWidth: 1,
    borderColor: "#312e81",
    overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  devBadge: {
    backgroundColor: "#4f46e5",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  devBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#e0e7ff",
    letterSpacing: 1,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#a5b4fc",
  },
  chevron: {
    fontSize: 11,
    color: "#6366f1",
  },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    maxHeight: 400,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6366f1",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1e1b4b",
  },
  rowLabel: {
    fontSize: 12,
    color: "#94a3b8",
    flex: 1,
  },
  rowValue: {
    fontSize: 12,
    color: "#e2e8f0",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  errorMsgBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  errorMsgText: {
    fontSize: 11,
    color: "#fca5a5",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1e1b4b",
  },
  checkIcon: {
    fontSize: 14,
    fontWeight: "700",
    width: 16,
    marginTop: 1,
  },
  checkContent: {
    flex: 1,
  },
  checkLabel: {
    fontSize: 12,
    color: "#e2e8f0",
    fontWeight: "600",
  },
  checkDetail: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 1,
  },
  privacyNote: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderRadius: 5,
    padding: 7,
    marginTop: 6,
  },
  privacyNoteText: {
    fontSize: 10,
    color: "#f59e0b",
    lineHeight: 15,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    marginBottom: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#312e81",
    alignItems: "center",
  },
  btnText: {
    fontSize: 12,
    color: "#818cf8",
    fontWeight: "600",
  },
  btnPrimary: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  btnPrimaryText: {
    color: "#ffffff",
  },
});
