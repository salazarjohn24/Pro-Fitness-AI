import { useState } from "react";

const ORANGE = "#f97316";
const BG_DEEP = "#0a0a0a";
const BG_CARD = "#1a1a1a";
const BG_SURFACE = "#252525";
const BORDER = "#333333";
const TEXT_PRIMARY = "#ffffff";
const TEXT_MUTED = "#888888";
const INDIGO = "#6366f1";
const AMBER = "#f59e0b";
const AMBER_BG = "#451a03";
const AMBER_BORDER = "#92400e";
const GREEN = "#22c55e";

const FORMAT_CHIPS = [
  { value: "AMRAP", label: "AMRAP" },
  { value: "EMOM", label: "EMOM" },
  { value: "FOR_TIME", label: "FOR TIME" },
  { value: "STANDARD", label: "STANDARD" },
  { value: "UNKNOWN", label: "?" },
];

// ─────────────────────────────────────────────
// Shared subcomponents
// ─────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>
      {children}
    </p>
  );
}

function TextRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ color: TEXT_MUTED, fontSize: 13 }}>{label}</span>
      <span style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function FormatChipRow({ selected, onSelect, disabled }: { selected: string; onSelect?: (v: string) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {FORMAT_CHIPS.map((chip) => {
        const isSelected = chip.value === selected;
        const isUnknown = chip.value === "UNKNOWN";
        let bg = BG_SURFACE;
        let border = BORDER;
        let color = TEXT_MUTED;
        if (isSelected) {
          if (isUnknown) {
            bg = AMBER_BG;
            border = AMBER_BORDER;
            color = AMBER;
          } else {
            bg = "#1e1b4b";
            border = INDIGO;
            color = INDIGO;
          }
        }
        return (
          <button
            key={chip.value}
            onClick={() => !disabled && onSelect?.(chip.value)}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: `1.5px solid ${border}`,
              background: bg,
              color,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              cursor: disabled ? "default" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, letterSpacing: "0.05em" }}>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────
// Panel 1 — Low Confidence Banner
// ─────────────────────────────────────────────
function LowConfidencePanel() {
  return (
    <div style={{ background: BG_CARD, borderRadius: 14, padding: 20, border: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 4, height: 16, borderRadius: 2, background: ORANGE }} />
        <span style={{ color: TEXT_PRIMARY, fontSize: 15, fontWeight: 700 }}>Analyze Workout</span>
      </div>

      {/* LOW CONFIDENCE BANNER */}
      <div style={{
        background: AMBER_BG,
        border: `1px solid ${AMBER_BORDER}`,
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 16,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ color: AMBER, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}>
              LOW CONFIDENCE PARSE
            </span>
            <Badge color={AMBER} bg="#78350f">45%</Badge>
          </div>
          <p style={{ color: "#fcd34d", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
            Review and correct the fields below — the parser may have missed details.
          </p>
          {["muscleGroups", "workoutType"].map((w) => (
            <p key={w} style={{ color: "#fbbf24", fontSize: 11, margin: "2px 0 0", lineHeight: 1.4 }}>
              • {w === "muscleGroups" ? "No muscle groups detected" : "Workout type defaulted to 'Other'"}
            </p>
          ))}
        </div>
      </div>

      <TextRow label="Workout Name" value="Unnamed CrossFit Session" />
      <TextRow label="Type" value="Other" />
      <TextRow label="Duration" value="30 min" />
      <TextRow label="Intensity" value="5 / 10" />

      <div style={{ marginTop: 14 }}>
        <SectionLabel>Format</SectionLabel>
        <FormatChipRow selected="UNKNOWN" disabled />
        <p style={{ color: AMBER, fontSize: 11, marginTop: 6 }}>Format not detected — please select the correct format.</p>
      </div>

      <div style={{ marginTop: 4, padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ color: TEXT_MUTED, fontSize: 13 }}>Muscle Groups</span>
        <span style={{ color: "#ef4444", fontSize: 13, float: "right" }}>None detected</span>
      </div>

      <div style={{ marginTop: 14, background: BG_SURFACE, borderRadius: 10, padding: "9px 14px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: TEXT_MUTED, fontSize: 12 }}>parserConfidence</span>
        <code style={{ color: AMBER, fontSize: 12 }}>0.45</code>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Panel 2 — Format Chip Override
// ─────────────────────────────────────────────
function FormatOverridePanel() {
  const [format, setFormat] = useState<string>("FOR_TIME");
  const original = "AMRAP";
  const overridden = format !== original;

  return (
    <div style={{ background: BG_CARD, borderRadius: 14, padding: 20, border: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 4, height: 16, borderRadius: 2, background: ORANGE }} />
        <span style={{ color: TEXT_PRIMARY, fontSize: 15, fontWeight: 700 }}>Format Override</span>
      </div>

      <TextRow label="Workout Name" value="21-15-9 Thrusters + Pull-ups" />
      <TextRow label="Type" value="CrossFit" />
      <TextRow label="Duration" value="12 min" />
      <TextRow label="Intensity" value="9 / 10" />

      <div style={{ marginTop: 14 }}>
        <SectionLabel>Format</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ color: TEXT_MUTED, fontSize: 11 }}>Detected: </span>
          <Badge color="#a5b4fc" bg="#1e1b4b">AMRAP</Badge>
          {overridden && (
            <>
              <span style={{ color: TEXT_MUTED, fontSize: 11 }}>→ Override:</span>
              <Badge color="#86efac" bg="#052e16">FOR TIME</Badge>
            </>
          )}
        </div>
        <FormatChipRow selected={format} onSelect={setFormat} />
        {overridden && (
          <div style={{ marginTop: 8, background: "#052e16", border: "1px solid #166534", borderRadius: 8, padding: "7px 12px" }}>
            <p style={{ color: "#86efac", fontSize: 11, margin: 0 }}>
              ✓ <strong>workout_format_overridden</strong> telemetry fired
              <br />
              <span style={{ color: "#4ade80", fontFamily: "monospace" }}>
                {"{ from: 'AMRAP', to: 'FOR_TIME', source: 'text' }"}
              </span>
            </p>
          </div>
        )}
        {!overridden && (
          <p style={{ color: TEXT_MUTED, fontSize: 11, marginTop: 6 }}>← Tap a chip to override</p>
        )}
      </div>

      <div style={{ marginTop: 14, background: BG_SURFACE, borderRadius: 10, padding: "9px 14px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: TEXT_MUTED, fontSize: 12 }}>parserConfidence</span>
        <code style={{ color: GREEN, fontSize: 12 }}>0.91</code>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Panel 3 — Save Result (wasUserEdited + editedFields)
// ─────────────────────────────────────────────
function SaveResultPanel() {
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 900);
  };

  const editedFields = ["label", "workoutType", "workoutFormat"];
  const dbPayload = {
    label: "Fran – for time",
    workoutType: "CrossFit",
    duration: 12,
    intensity: 9,
    workoutFormat: "FOR_TIME",
    parserConfidence: 0.91,
    parserWarnings: [],
    wasUserEdited: true,
    editedFields,
  };

  return (
    <div style={{ background: BG_CARD, borderRadius: 14, padding: 20, border: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 4, height: 16, borderRadius: 2, background: ORANGE }} />
        <span style={{ color: TEXT_PRIMARY, fontSize: 15, fontWeight: 700 }}>Save → DB Persist</span>
      </div>

      <TextRow label="Workout Name" value={dbPayload.label} />
      <TextRow label="Type" value={dbPayload.workoutType} />
      <TextRow label="Format" value="FOR TIME (user override)" />
      <TextRow label="Duration" value="12 min" />

      {!saved && (
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%",
            marginTop: 16,
            padding: "12px 0",
            borderRadius: 10,
            border: "none",
            background: saving ? "#555" : ORANGE,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.08em",
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "LOGGING…" : "LOG WORKOUT"}
        </button>
      )}

      {saved && (
        <div style={{ marginTop: 14 }}>
          <div style={{ background: "#052e16", border: "1px solid #166534", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
            <p style={{ color: "#86efac", fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>
              ✓ Saved to external_workouts
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              {editedFields.map((f) => (
                <Badge key={f} color="#86efac" bg="#14532d">{f}</Badge>
              ))}
            </div>
          </div>

          <div style={{ background: BG_SURFACE, borderRadius: 10, padding: "10px 14px" }}>
            <p style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 8 }}>DB ROW (external_workouts)</p>
            {Object.entries(dbPayload).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid #222` }}>
                <span style={{ color: TEXT_MUTED, fontSize: 11, fontFamily: "monospace" }}>{k}</span>
                <span style={{
                  color: k === "wasUserEdited" ? GREEN : k === "editedFields" ? AMBER : TEXT_PRIMARY,
                  fontSize: 11,
                  fontFamily: "monospace",
                  fontWeight: (k === "wasUserEdited" || k === "editedFields") ? 700 : 400,
                }}>
                  {JSON.stringify(v)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 8, padding: "8px 12px" }}>
            <p style={{ color: "#93c5fd", fontSize: 11, margin: 0 }}>
              ✓ <strong>import_user_edited_fields</strong> telemetry fired
              <br />
              <span style={{ color: "#60a5fa", fontFamily: "monospace", fontSize: 10 }}>
                {"{ edited_field_count: 3, had_low_confidence: false, format: 'FOR_TIME' }"}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────
export default function ParsedWorkoutFormStates() {
  return (
    <div style={{
      background: BG_DEEP,
      minHeight: "100vh",
      padding: "24px 16px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: TEXT_PRIMARY, fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
            ParsedWorkoutForm — 3 Verification States
          </h1>
          <p style={{ color: TEXT_MUTED, fontSize: 12, margin: 0 }}>
            commit fabd99b8 · 162/162 tests passing · canonical endpoint: POST /api/workouts/external
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div>
            <p style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>
              State 1 · Low Confidence Banner
            </p>
            <LowConfidencePanel />
          </div>
          <div>
            <p style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>
              State 2 · Format Chip Override (interactive)
            </p>
            <FormatOverridePanel />
          </div>
          <div>
            <p style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>
              State 3 · Save → wasUserEdited + editedFields
            </p>
            <SaveResultPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
