import { useState } from "react";
import {
  Clock,
  Coffee,
  CheckCircle2,
  Calendar,
  AlertCircle,
  PlusCircle,
  Play,
  LogOut,
  Users,
  Timer,
  Smartphone,
  ArrowUpRight,
} from "lucide-react";
import { Modal } from "./Modal";
import type { Snapshot, RosterStaff, StaffShift } from "./types";
import { time } from "./api";

type Action = <T = unknown>(
  endpoint: string,
  body: unknown,
  message?: string,
) => Promise<T>;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function AttendanceView({
  data,
  act,
}: {
  data: Snapshot;
  act: Action;
}) {
  const owner = data.staff?.role === "owner";
  const [activeTab, setActiveTab] = useState<"console" | "roster" | "shifts" | "logs">(
    owner ? "roster" : "console"
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Manual Punch Modal State
  const [punchModalStaff, setPunchModalStaff] = useState<RosterStaff | null>(null);
  const [manualType, setManualType] = useState<"CHECK_IN" | "START_BREAK" | "END_BREAK" | "CHECK_OUT">("CHECK_IN");
  const [manualTime, setManualTime] = useState("08:00");
  const [manualNotes, setManualNotes] = useState("Manual punch adjustment");

  // Shift Edit Modal State
  const [editShift, setEditShift] = useState<StaffShift | null>(null);

  const myAtt = data.attendance;

  const handlePunch = async (type: "CHECK_IN" | "START_BREAK" | "END_BREAK" | "CHECK_OUT") => {
    setBusy(true);
    try {
      await act("attendance/punch", { type, notes }, `Attendance recorded: ${type.replace("_", " ")}`);
      setNotes("");
    } finally {
      setBusy(false);
    }
  };

  const handleManualPunchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!punchModalStaff) return;
    setBusy(true);
    try {
      // Convert HH:MM to timestamp today
      const today = new Date().toISOString().slice(0, 10);
      const [h, m] = manualTime.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      await act(
        "attendance/manual-punch",
        {
          staff_id: punchModalStaff.staff_id,
          type: manualType,
          date: today,
          timestamp: d.getTime(),
          notes: manualNotes,
        },
        "Manual punch logged successfully"
      );
      setPunchModalStaff(null);
    } finally {
      setBusy(false);
    }
  };

  const handleShiftSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editShift) return;
    setBusy(true);
    try {
      await act("attendance/shift-save", editShift, "Staff shift updated");
      setEditShift(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="attendance-layout">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fcf6ec", border: "1px solid #ebd9c2", borderRadius: 10, padding: "12px 16px", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ background: "#493527", color: "#f7ede0", padding: 8, borderRadius: 8, display: "flex" }}>
            <Smartphone size={18} />
          </span>
          <div>
            <strong style={{ fontSize: 13, color: "#3c2a1c", display: "block" }}>Staff Mobile Attendance Portal</strong>
            <small style={{ fontSize: 10, color: "#8a735c" }}>Individual geolocked clock-in app for staff mobile browsers at /attendance</small>
          </div>
        </div>
        <a
          href="/attendance"
          target="_blank"
          rel="noreferrer"
          style={{ background: "#925638", color: "#fff", textDecoration: "none", fontSize: 11, padding: "7px 12px", borderRadius: 7, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          Open Mobile Portal <ArrowUpRight size={13} />
        </a>
      </div>

      {owner && (
        <div className="filter-tabs" style={{ marginBottom: 16 }}>
          <button
            className={activeTab === "roster" ? "active" : ""}
            onClick={() => setActiveTab("roster")}
          >
            <Users size={14} style={{ display: "inline", marginRight: 5 }} />
            Today's Live Roster ({data.attendanceRoster.length})
          </button>
          <button
            className={activeTab === "console" ? "active" : ""}
            onClick={() => setActiveTab("console")}
          >
            <Clock size={14} style={{ display: "inline", marginRight: 5 }} />
            My Punch Console
          </button>
          <button
            className={activeTab === "shifts" ? "active" : ""}
            onClick={() => setActiveTab("shifts")}
          >
            <Calendar size={14} style={{ display: "inline", marginRight: 5 }} />
            Shift Schedules & Hours ({data.staffShifts.length})
          </button>
          <button
            className={activeTab === "logs" ? "active" : ""}
            onClick={() => setActiveTab("logs")}
          >
            <Timer size={14} style={{ display: "inline", marginRight: 5 }} />
            Attendance History Logs
          </button>
        </div>
      )}

      {/* Staff Personal Console */}
      {(!owner || activeTab === "console") && myAtt && (
        <div className="attendance-card">
          <div className="attendance-status-header">
            <div>
              <span className="eyebrow">STAFF ATTENDANCE PORTAL</span>
              <h2>{data.staff?.name}</h2>
              <small>
                Role: <b>{data.staff?.role}</b> · Scheduled Shift: {myAtt.shift.shift_start} – {myAtt.shift.shift_end} ({myAtt.shift.target_hours}h target)
              </small>
            </div>
            <div>
              <span
                className={`pill ${
                  myAtt.status === "WORKING"
                    ? "ready"
                    : myAtt.status === "ON_BREAK"
                    ? "cancellation_pending"
                    : myAtt.status === "CHECKED_OUT"
                    ? "cancelled"
                    : ""
                }`}
                style={{ fontSize: 11, padding: "7px 12px" }}
              >
                {myAtt.status === "WORKING"
                  ? "● WORKING / ON SHIFT"
                  : myAtt.status === "ON_BREAK"
                  ? "☕ ON BREAK"
                  : myAtt.status === "CHECKED_OUT"
                  ? "✓ SHIFT COMPLETED"
                  : "○ NOT CHECKED IN"}
              </span>
            </div>
          </div>

          <div className="attendance-metric-grid">
            <div className="attendance-metric">
              <small>Time Worked Today</small>
              <strong>{formatDuration(myAtt.workedSeconds)}</strong>
            </div>
            <div className="attendance-metric">
              <small>Break Time Taken</small>
              <strong>{formatDuration(myAtt.breakSeconds)}</strong>
            </div>
            <div className="attendance-metric">
              <small>Target Hours</small>
              <strong>{myAtt.shift.target_hours.toFixed(1)} hrs</strong>
            </div>
            <div className="attendance-metric">
              <small>Allowed Break</small>
              <strong>{myAtt.shift.break_minutes} mins</strong>
            </div>
          </div>

          {/* 30-Minute Break Buffer Callout */}
          {myAtt.status === "ON_BREAK" && (
            <div className="break-buffer-callout">
              <div>
                <strong style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                  <AlertCircle size={17} /> 30-Minute Break Buffer Countdown
                </strong>
                <small style={{ fontSize: 11, color: "#77502c" }}>
                  Please return and punch End Break before your 30-minute break buffer expires.
                </small>
              </div>
              <div>
                <b>{formatCountdown(myAtt.breakBufferRemainingSeconds)}</b>
              </div>
            </div>
          )}

          <div style={{ marginTop: 15 }}>
            <label style={{ fontSize: 11, margin: "0 0 6px" }}>Punch Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Barista shift opening prep, inventory count..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ fontSize: 12, padding: "8px 12px" }}
            />
          </div>

          <div className="punch-actions-grid">
            <button
              className="punch-btn check-in"
              disabled={busy || myAtt.status === "WORKING" || myAtt.status === "ON_BREAK"}
              onClick={() => handlePunch("CHECK_IN")}
            >
              <Play size={16} /> Check In
            </button>
            <button
              className="punch-btn break-start"
              disabled={busy || myAtt.status !== "WORKING"}
              onClick={() => handlePunch("START_BREAK")}
            >
              <Coffee size={16} /> Start Break (30m Buffer)
            </button>
            <button
              className="punch-btn break-end"
              disabled={busy || myAtt.status !== "ON_BREAK"}
              onClick={() => handlePunch("END_BREAK")}
            >
              <CheckCircle2 size={16} /> End Break
            </button>
            <button
              className="punch-btn check-out"
              disabled={busy || myAtt.status === "NOT_CHECKED_IN" || myAtt.status === "CHECKED_OUT"}
              onClick={() => handlePunch("CHECK_OUT")}
            >
              <LogOut size={16} /> Check Out
            </button>
          </div>

          {/* Today's punch log timeline */}
          <div style={{ marginTop: 24, borderTop: "1px solid #dfd2be", paddingTop: 16 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12, color: "#4e3828" }}>Today's Punch Activity</h3>
            {myAtt.punches.length === 0 ? (
              <p style={{ fontSize: 12, color: "#8a7560" }}>No punches recorded yet today.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myAtt.punches.map((p) => (
                  <div className="list-row" key={p.id} style={{ padding: "8px 0" }}>
                    <span>
                      <b>{p.type.replace("_", " ")}</b>
                      {p.notes && <small style={{ marginLeft: 8 }}>· {p.notes}</small>}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums", color: "#6e5239" }}>
                      {time(p.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Owner: Live Today Roster */}
      {owner && activeTab === "roster" && (
        <>
          <div className="section-title">
            <h2>Live Staff Roster Today ({data.attendanceRoster.length} Members)</h2>
            <small style={{ color: "#7a624d" }}>Real-time attendance, shifts, and punch status</small>
          </div>
          <div className="roster-grid">
            {data.attendanceRoster.map((st) => (
              <div className={`roster-card ${st.status.toLowerCase()}`} key={st.staff_id}>
                <div>
                  <div className="roster-head">
                    <span className="avatar">{st.name[0]}</span>
                    <div className="roster-info">
                      <b>{st.name}</b>
                      <small>@{st.username} · {st.role}</small>
                    </div>
                    <span
                      className={`pill ${
                        st.status === "WORKING"
                          ? "ready"
                          : st.status === "ON_BREAK"
                          ? "cancellation_pending"
                          : st.status === "CHECKED_OUT"
                          ? "cancelled"
                          : ""
                      }`}
                      style={{ marginLeft: "auto", fontSize: 9 }}
                    >
                      {st.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="roster-stats">
                    <div>
                      <small>Worked</small>
                      <b>{formatDuration(st.workedSeconds)}</b>
                    </div>
                    <div>
                      <small>Break Taken</small>
                      <b>{formatDuration(st.breakSeconds)}</b>
                    </div>
                    <div>
                      <small>Shift</small>
                      <b>{st.shift.shift_start}–{st.shift.shift_end}</b>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: "#8a7560", marginBottom: 12 }}>
                    {st.lastPunch ? (
                      <>Last: <b>{st.lastPunch.type.replace("_", " ")}</b> at {time(st.lastPunch.timestamp)}</>
                    ) : (
                      <>No punch yet today</>
                    )}
                  </div>
                </div>

                <div className="roster-actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      setPunchModalStaff(st);
                      setManualType(st.status === "WORKING" ? "START_BREAK" : "CHECK_IN");
                    }}
                  >
                    <PlusCircle size={13} /> Punch
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setEditShift(st.shift)}
                  >
                    <Calendar size={13} /> Edit Shift
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Owner: Shift Schedules & Hours Editor */}
      {owner && activeTab === "shifts" && (
        <div className="panel">
          <div className="section-title">
            <h2>Shift Schedules & Customizable Hours</h2>
            <small style={{ color: "#7a624d" }}>Edit shift times, 1-hour break, and 30-min buffer per staff member</small>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.staffShifts.map((sh) => (
              <div className="list-row" key={sh.staff_id} style={{ alignItems: "center" }}>
                <span className="grow">
                  <b style={{ fontSize: 14 }}>{sh.staff_name || `Staff #${sh.staff_id}`}</b>
                  <small>
                    Shift: <b>{sh.shift_start} – {sh.shift_end}</b> · Target: <b>{sh.target_hours}h</b> · Break: <b>{sh.break_minutes}m</b> · Buffer: <b>{sh.break_buffer_minutes}m</b>
                  </small>
                </span>
                <button
                  className="secondary"
                  onClick={() => setEditShift(sh)}
                >
                  Customize Shift
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Owner: Attendance History Logs */}
      {owner && activeTab === "logs" && (
        <div className="panel">
          <div className="section-title">
            <h2>Authoritative Attendance Logs</h2>
            <small style={{ color: "#7a624d" }}>Recent punches across all staff</small>
          </div>
          {data.attendanceLogs.length === 0 ? (
            <p style={{ color: "#8a7560", fontSize: 12 }}>No attendance punches logged yet.</p>
          ) : (
            <div style={{ maxHeight: 480, overflowY: "auto" }}>
              {data.attendanceLogs.map((log) => (
                <div className="list-row" key={log.id}>
                  <span>
                    <b>{log.staff_name || `Staff #${log.staff_id}`}</b>
                    <small>
                      {log.date} · {time(log.timestamp)} · Source: {log.source} {log.notes ? `· "${log.notes}"` : ""}
                    </small>
                  </span>
                  <span
                    className={`pill ${
                      log.type === "CHECK_IN"
                        ? "ready"
                        : log.type === "START_BREAK"
                        ? "cancellation_pending"
                        : log.type === "END_BREAK"
                        ? "ready"
                        : "cancelled"
                    }`}
                  >
                    {log.type.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Manual Punch Adjustment */}
      {punchModalStaff && (
        <Modal title={`Manual Punch: ${punchModalStaff.name}`} close={() => setPunchModalStaff(null)}>
          <form onSubmit={handleManualPunchSubmit}>
            <label>
              Action Type
              <select
                value={manualType}
                onChange={(e) => setManualType(e.target.value as any)}
              >
                <option value="CHECK_IN">Check In</option>
                <option value="START_BREAK">Start Break</option>
                <option value="END_BREAK">End Break</option>
                <option value="CHECK_OUT">Check Out</option>
              </select>
            </label>
            <label>
              Time (HH:MM today)
              <input
                type="time"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                required
              />
            </label>
            <label>
              Adjustment Reason / Notes
              <input
                type="text"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                required
              />
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="secondary grow" type="button" onClick={() => setPunchModalStaff(null)}>
                Cancel
              </button>
              <button className="grow" type="submit" disabled={busy}>
                {busy ? "Saving..." : "Log Punch"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Customize Shift & Hours */}
      {editShift && (
        <Modal title={`Customize Shift: ${editShift.staff_name || `Staff #${editShift.staff_id}`}`} close={() => setEditShift(null)}>
          <form onSubmit={handleShiftSave}>
            <label>
              Shift Start Time
              <input
                type="time"
                value={editShift.shift_start}
                onChange={(e) => setEditShift({ ...editShift, shift_start: e.target.value })}
                required
              />
            </label>
            <label>
              Shift End Time
              <input
                type="time"
                value={editShift.shift_end}
                onChange={(e) => setEditShift({ ...editShift, shift_end: e.target.value })}
                required
              />
            </label>
            <label>
              Target Work Hours (e.g. 8.0)
              <input
                type="number"
                step="0.5"
                min="1"
                max="16"
                value={editShift.target_hours}
                onChange={(e) => setEditShift({ ...editShift, target_hours: Number(e.target.value) })}
                required
              />
            </label>
            <label>
              Break Allowance (Minutes; default 60 min)
              <input
                type="number"
                min="0"
                max="180"
                value={editShift.break_minutes}
                onChange={(e) => setEditShift({ ...editShift, break_minutes: Number(e.target.value) })}
                required
              />
            </label>
            <label>
              Break Buffer Timer (Minutes; default 30 min buffer)
              <input
                type="number"
                min="5"
                max="90"
                value={editShift.break_buffer_minutes}
                onChange={(e) => setEditShift({ ...editShift, break_buffer_minutes: Number(e.target.value) })}
                required
              />
              <small>Staff who punch break will see this buffer countdown timer.</small>
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="secondary grow" type="button" onClick={() => setEditShift(null)}>
                Cancel
              </button>
              <button className="grow" type="submit" disabled={busy}>
                {busy ? "Saving..." : "Save Shift Settings"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
