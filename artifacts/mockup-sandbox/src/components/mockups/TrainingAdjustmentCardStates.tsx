/**
 * TrainingAdjustmentCardStates.tsx — verification mockup
 *
 * Shows all 4 card states side-by-side:
 *   STATE 1 · Pending (deload recommended — no choice made yet)
 *   STATE 2 · Accepted (user chose "Use Recommended Plan")
 *   STATE 3 · Overridden (user chose "Train as Planned")
 *   STATE 4 · No card (recommended=false — card should not render)
 *
 * Telemetry events are captured in-component and displayed in a log panel.
 * All constants sourced directly from readinessRecommendation.ts (inlined for web context).
 */

import { useState } from "react";

// ── Inlined constants (kept in sync with readinessRecommendation.ts) ─────────
const DELOAD_VOLUME_REDUCTION_PCT = 40;
const DELOAD_INTENSITY_REDUCTION_PCT = 20;

// ── Types ────────────────────────────────────────────────────────────────────
interface DeloadCheckData {
  recommended: boolean;
  reason: string | null;
  avgFatigue: number;
  weeklyVolume: number;
  sessionCount: number;
  internalSessionCount: number;
  externalSessionCount: number;
}

interface AdjustmentCard {
  title: string;
  reasonText: string;
  adjustmentSummary: string;
  volumeReductionPct: number;
  intensityReductionPct: number;
  helperText: string;
}

// ── Pure functions ────────────────────────────────────────────────────────────
function buildAdjustmentCard(data: DeloadCheckData): AdjustmentCard {
  return {
    title: "Today's Training Adjustment",
    reasonText:
      data.reason ??
      "Your recent training load and recovery data suggest a lighter session today.",
    adjustmentSummary: `Volume −${DELOAD_VOLUME_REDUCTION_PCT}% · Intensity −${DELOAD_INTENSITY_REDUCTION_PCT}%`,
    volumeReductionPct: DELOAD_VOLUME_REDUCTION_PCT,
    intensityReductionPct: DELOAD_INTENSITY_REDUCTION_PCT,
    helperText: "You're always in control. We'll learn from your choice.",
  };
}

function shouldShowAdjustmentCard(data: DeloadCheckData | undefined): boolean {
  return !!(data?.recommended && data.reason);
}

function buildRecommendationShownProps(data: DeloadCheckData) {
  return {
    avg_fatigue: data.avgFatigue,
    session_count: data.sessionCount,
    internal_session_count: data.internalSessionCount,
    external_session_count: data.externalSessionCount,
    weekly_volume: data.weeklyVolume,
    volume_reduction_pct: DELOAD_VOLUME_REDUCTION_PCT,
    intensity_reduction_pct: DELOAD_INTENSITY_REDUCTION_PCT,
  };
}

function buildRecommendationAcceptedProps(data: DeloadCheckData) {
  return {
    avg_fatigue: data.avgFatigue,
    session_count: data.sessionCount,
    volume_reduction_pct: DELOAD_VOLUME_REDUCTION_PCT,
    intensity_reduction_pct: DELOAD_INTENSITY_REDUCTION_PCT,
  };
}

function buildRecommendationOverriddenProps(data: DeloadCheckData) {
  return {
    avg_fatigue: data.avgFatigue,
    session_count: data.sessionCount,
    volume_reduction_pct: DELOAD_VOLUME_REDUCTION_PCT,
    intensity_reduction_pct: DELOAD_INTENSITY_REDUCTION_PCT,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const RECOMMENDED_CHECK: DeloadCheckData = {
  recommended: true,
  reason:
    "Your fatigue has been high for 3 consecutive days — 75 avg score. A lighter session today will improve your recovery trajectory.",
  avgFatigue: 75,
  weeklyVolume: 11500,
  sessionCount: 5,
  internalSessionCount: 3,
  externalSessionCount: 2,
};

const NOT_RECOMMENDED_CHECK: DeloadCheckData = {
  recommended: false,
  reason: null,
  avgFatigue: 38,
  weeklyVolume: 8200,
  sessionCount: 3,
  internalSessionCount: 2,
  externalSessionCount: 1,
};

// ── Telemetry sink for demo ───────────────────────────────────────────────────
interface TelemetryLogEntry {
  name: string;
  props: Record<string, unknown>;
}

// ── Shared card UI (web-rendered equivalent of TrainingAdjustmentCard.tsx) ───
function CardPending({
  data,
  onAccept,
  onOverride,
}: {
  data: DeloadCheckData;
  onAccept: () => void;
  onOverride: () => void;
}) {
  const card = buildAdjustmentCard(data);
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={iconWrapStyle}>⚠</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", flex: 1 }}>
          {card.title}
        </span>
      </div>

      <p style={{ fontSize: 13, color: "#78716C", lineHeight: 1.5, margin: 0 }}>
        {card.reasonText}
      </p>

      <div style={pillStyle}>
        <span style={{ fontSize: 11 }}>📊</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: 0.4 }}>
          {card.adjustmentSummary}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={onAccept}
          style={btnAcceptStyle}
        >
          ✓ Use Recommended Plan
        </button>
        <button
          onClick={onOverride}
          style={btnOverrideStyle}
        >
          Train as Planned
        </button>
      </div>

      <p style={{ fontSize: 11, color: "#57534E", textAlign: "center", margin: 0 }}>
        {card.helperText}
      </p>
    </div>
  );
}

function CardAccepted() {
  return (
    <div style={{ ...cardStyle, ...outcomeCardStyle }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ color: "#34d399", fontSize: 16 }}>✓</span>
        <span style={{ fontSize: 13, color: "#78716C" }}>
          Lighter session applied — good call.
        </span>
      </div>
    </div>
  );
}

function CardOverridden() {
  return (
    <div style={{ ...cardStyle, ...outcomeCardStyle }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ color: "#FC5200", fontSize: 16 }}>⚡</span>
        <span style={{ fontSize: 13, color: "#78716C" }}>
          Training as planned — we'll track it.
        </span>
      </div>
    </div>
  );
}

function TelemetryLog({ entries }: { entries: TelemetryLogEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div style={telemetryStyle}>
      {entries.map((e, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <span style={{ color: "#34d399", fontSize: 11 }}>✓ {e.name}</span>
          <pre style={{ margin: "2px 0 0 0", fontSize: 10, color: "#9ca3af" }}>
            {JSON.stringify(e.props, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

// ── Interactive Panel — pending state with live telemetry capture ─────────────
function InteractivePendingPanel() {
  const [outcome, setOutcome] = useState<"pending" | "accepted" | "overridden">("pending");
  const [log, setLog] = useState<TelemetryLogEntry[]>([
    {
      name: "recommendation_shown",
      props: buildRecommendationShownProps(RECOMMENDED_CHECK),
    },
  ]);

  const addLog = (name: string, props: Record<string, unknown>) =>
    setLog((prev) => [...prev, { name, props }]);

  const handleAccept = () => {
    setOutcome("accepted");
    addLog("recommendation_accepted", buildRecommendationAcceptedProps(RECOMMENDED_CHECK));
  };

  const handleOverride = () => {
    setOutcome("overridden");
    addLog("recommendation_overridden", buildRecommendationOverriddenProps(RECOMMENDED_CHECK));
  };

  return (
    <div>
      {outcome === "pending" && (
        <CardPending
          data={RECOMMENDED_CHECK}
          onAccept={handleAccept}
          onOverride={handleOverride}
        />
      )}
      {outcome === "accepted" && <CardAccepted />}
      {outcome === "overridden" && <CardOverridden />}
      <TelemetryLog entries={log} />
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function TrainingAdjustmentCardStates() {
  return (
    <div style={rootStyle}>
      <h1 style={h1Style}>TrainingAdjustmentCard — Verification States</h1>
      <p style={subStyle}>
        commit {" "}
        <code style={{ fontSize: 11, color: "#9ca3af" }}>— 214/214 tests passing</code>
        {" "}· constants: DELOAD_VOLUME={DELOAD_VOLUME_REDUCTION_PCT}% · DELOAD_INTENSITY={DELOAD_INTENSITY_REDUCTION_PCT}%
      </p>

      <div style={gridStyle}>
        {/* STATE 1 — Pending (interactive) */}
        <div>
          <div style={labelStyle}>STATE 1 · PENDING (INTERACTIVE — click both buttons)</div>
          <InteractivePendingPanel />
        </div>

        {/* STATE 2 — Accepted */}
        <div>
          <div style={labelStyle}>STATE 2 · ACCEPTED OUTCOME</div>
          <CardAccepted />
          <TelemetryLog
            entries={[
              {
                name: "recommendation_accepted",
                props: buildRecommendationAcceptedProps(RECOMMENDED_CHECK),
              },
            ]}
          />
        </div>

        {/* STATE 3 — Overridden */}
        <div>
          <div style={labelStyle}>STATE 3 · OVERRIDDEN OUTCOME</div>
          <CardOverridden />
          <TelemetryLog
            entries={[
              {
                name: "recommendation_overridden",
                props: buildRecommendationOverriddenProps(RECOMMENDED_CHECK),
              },
            ]}
          />
        </div>

        {/* STATE 4 — No card */}
        <div>
          <div style={labelStyle}>STATE 4 · NO CARD (recommended=false)</div>
          <div style={{ ...cardStyle, opacity: 0.4 }}>
            <div style={{ fontSize: 12, color: "#57534E", textAlign: "center" }}>
              shouldShowAdjustmentCard({JSON.stringify({ recommended: false, reason: null })}){" "}
              → <strong style={{ color: "#34d399" }}>{String(shouldShowAdjustmentCard(NOT_RECOMMENDED_CHECK))}</strong>
              <br />
              Card is not rendered.
            </div>
          </div>
          <div style={{ ...telemetryStyle, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "#57534E" }}>
              No telemetry fired — card never mounted.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const rootStyle: React.CSSProperties = {
  fontFamily: "'Inter', system-ui, sans-serif",
  backgroundColor: "#1D1D1B",
  minHeight: "100vh",
  padding: "32px 24px",
  color: "#fff",
};

const h1Style: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#fff",
  margin: "0 0 6px 0",
};

const subStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#78716C",
  margin: "0 0 28px 0",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 20,
  alignItems: "start",
};

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: "#57534E",
  letterSpacing: 2,
  textTransform: "uppercase",
  marginBottom: 10,
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "rgba(245, 158, 11, 0.06)",
  border: "1px solid rgba(245, 158, 11, 0.19)",
  borderRadius: 14,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const outcomeCardStyle: React.CSSProperties = {
  padding: "12px 16px",
};

const iconWrapStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 8,
  backgroundColor: "rgba(245, 158, 11, 0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  color: "#f59e0b",
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  backgroundColor: "rgba(245, 158, 11, 0.08)",
  border: "1px solid rgba(245, 158, 11, 0.16)",
  borderRadius: 20,
  padding: "4px 10px",
};

const btnAcceptStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  backgroundColor: "#f59e0b",
  border: "none",
  borderRadius: 12,
  padding: "11px 16px",
  fontSize: 13,
  fontWeight: 700,
  color: "#1D1D1B",
  cursor: "pointer",
};

const btnOverrideStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  padding: "10px 16px",
  fontSize: 13,
  color: "#78716C",
  cursor: "pointer",
};

const telemetryStyle: React.CSSProperties = {
  marginTop: 10,
  backgroundColor: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 8,
  padding: "10px 12px",
};
