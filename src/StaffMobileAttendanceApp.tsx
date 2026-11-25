import { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  LogOut,
  Smartphone,
  RotateCcw,
  ShieldCheck,
  ArrowLeft,
  UserCheck,
} from "lucide-react";
import type { Snapshot, PunchType } from "./types";
import { time } from "./api";

const CAFE_COORDS = {
  lat: 19.2584498,
  lng: 72.977272,
  radius: 150, // 150 meters geofence
  name: "SM Cafinity",
};

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const numLat1 = Number(lat1);
  const numLon1 = Number(lon1);
  const numLat2 = Number(lat2);
  const numLon2 = Number(lon2);
  if (isNaN(numLat1) || isNaN(numLon1) || isNaN(numLat2) || isNaN(numLon2)) return Infinity;

  const R = 6371000; // Earth radius in meters
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(numLat2 - numLat1);
  const dLon = toRad(numLon2 - numLon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(numLat1)) * Math.cos(toRad(numLat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatDistance(meters: number): string {
  if (!isFinite(meters)) return "Unknown distance";
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

type Action = <T = unknown>(
  endpoint: string,
  body: unknown,
  message?: string
) => Promise<T>;

const PRESET_STAFF = [
  { id: 1, username: "owner", name: "Rajdeep · Café Owner", role: "owner", shift: "08:00 - 17:00 (8.5h)" },
  { id: 2, username: "staff", name: "Aarav Sharma · Head Barista", role: "staff", shift: "08:00 - 16:30 (8.0h)" },
  { id: 3, username: "rohan", name: "Rohan Mehta · Senior Barista", role: "staff", shift: "08:30 - 17:00 (8.0h)" },
  { id: 4, username: "priya", name: "Priya Verma · Kitchen & Pastry Chef", role: "staff", shift: "09:00 - 17:30 (8.0h)" },
  { id: 5, username: "vikram", name: "Vikram Rao · Board Games & Host", role: "staff", shift: "11:00 - 19:30 (8.0h)" },
  { id: 6, username: "ananya", name: "Ananya Sen · Operations Lead", role: "staff", shift: "14:00 - 22:30 (8.0h)" },
];

export function StaffMobileAttendanceApp({
  data,
  act,
  go,
}: {
  data: Snapshot;
  act: Action;
  go: (url: string) => void;
}) {
  // Device pairing persistence
  const [deviceStaff, setDeviceStaff] = useState<{
    id: number;
    username: string;
    name: string;
    role: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem("cafinity_staff_device");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [selectedStaffUser, setSelectedStaffUser] = useState("staff");
  const [staffPassword, setStaffPassword] = useState("okay");
  const [pairingError, setPairingError] = useState("");
  const [busy, setBusy] = useState(false);

  // Geo state
  const [geoMode, setGeoMode] = useState<"inside" | "away" | "real">("inside");
  const [realCoords, setRealCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Clock tick for live timers
  const [, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync session with paired device on mount or switch
  const autoLoginAttempted = useRef(false);
  useEffect(() => {
    if (deviceStaff && (!data.staff || data.staff.id !== deviceStaff.id) && !autoLoginAttempted.current) {
      autoLoginAttempted.current = true;
      act("login", { username: deviceStaff.username, password: "okay" }).catch(() => {
        // If password changed, prompt to re-pair
        setPairingError("Device session expired. Please sign in again.");
      });
    }
  }, [deviceStaff, data.staff, act]);

  // Real GPS watch position
  useEffect(() => {
    if (geoMode !== "real" || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setRealCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeoError(null);
      },
      (err) => {
        setGeoError(err.message || "GPS signal unavailable");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [geoMode]);

  // Determine current active coordinates based on geoMode
  const currentCoords =
    geoMode === "inside"
      ? { lat: CAFE_COORDS.lat + 0.00004, lng: CAFE_COORDS.lng + 0.00004 }
      : geoMode === "away"
      ? { lat: CAFE_COORDS.lat - 0.012, lng: CAFE_COORDS.lng - 0.01 }
      : realCoords;

  const distanceMeters = currentCoords
    ? calculateDistanceMeters(
        currentCoords.lat,
        currentCoords.lng,
        CAFE_COORDS.lat,
        CAFE_COORDS.lng
      )
    : Infinity;

  const isInsideGeofence = isFinite(distanceMeters) && distanceMeters <= CAFE_COORDS.radius;

  // Handle Device Pairing
  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairingError("");
    setBusy(true);
    try {
      const staffRes = await act<{ id: number; username: string; name: string; role: string }>(
        "login",
        { username: selectedStaffUser, password: staffPassword },
        "Device paired successfully! Welcome to your attendance terminal."
      );
      const staffObj = staffRes || PRESET_STAFF.find((s) => s.username === selectedStaffUser);
      if (staffObj) {
        const payload = {
          id: staffObj.id,
          username: staffObj.username,
          name: staffObj.name,
          role: staffObj.role,
        };
        localStorage.setItem("cafinity_staff_device", JSON.stringify(payload));
        setDeviceStaff(payload);
      }
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : "Invalid password for selected staff");
    } finally {
      setBusy(false);
    }
  };

  const handleUnpairDevice = () => {
    localStorage.removeItem("cafinity_staff_device");
    setDeviceStaff(null);
    autoLoginAttempted.current = false;
  };

  // Punch actions
  const handlePunch = async (type: PunchType, note?: string) => {
    if (!isInsideGeofence) {
      alert("Geolock restriction: You must be physically inside SM Cafinity (within 150m) to punch.");
      return;
    }
    setBusy(true);
    try {
      const label =
        type === "CHECK_IN"
          ? "Clocked in for shift"
          : type === "START_BREAK"
          ? "Break started (30m buffer active)"
          : type === "END_BREAK"
          ? "Break ended · resumed shift"
          : "Shift completed · Clocked out";
      await act(
        "attendance/punch",
        { type, notes: note || `Mobile GPS Verified (${formatDistance(distanceMeters)})` },
        label
      );
    } finally {
      setBusy(false);
    }
  };

  // Extract attendance state
  const attendance = data.attendance;
  const punches = attendance?.punches || [];
  const status = attendance?.status || "NOT_CHECKED_IN";
  const workedSeconds = attendance?.workedSeconds || 0;
  const breakSeconds = attendance?.breakSeconds || 0;
  const breakBufferRemainingSeconds = attendance?.breakBufferRemainingSeconds || 0;

  const formatTimer = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // 1. If device is not yet paired with an employee profile, show Pairing UI
  if (!deviceStaff || !data.staff) {
    return (
      <div className="mobile-attendance-app">
        <header className="mobile-attendance-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="brand-mark"><Smartphone size={20} /></span>
            <div className="brand">
              SM CAFINITY
              <small style={{ display: "block", fontSize: 8, letterSpacing: 1.5, color: "#d9be9e" }}>
                STAFF ATTENDANCE PORTAL
              </small>
            </div>
          </div>
          <button
            className="text-btn"
            onClick={() => go("/")}
            style={{ color: "#d9be9e", fontSize: 11, padding: "4px 8px" }}
          >
            <ArrowLeft size={14} style={{ display: "inline", marginRight: 4 }} />
            Demo Hub
          </button>
        </header>

        <div className="mobile-attendance-content">
          <div className="attendance-main-card">
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <span
                style={{
                  display: "inline-flex",
                  padding: 12,
                  borderRadius: "50%",
                  background: "#f0e3d2",
                  color: "#7e5229",
                  marginBottom: 12,
                }}
              >
                <Smartphone size={28} />
              </span>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#3c2a1c", margin: "0 0 6px" }}>
                Pair Staff Mobile Device
              </h2>
              <p style={{ fontSize: 12, color: "#77634f", margin: 0 }}>
                Lock this browser to your staff profile. Each mobile device is paired individually for geolocked attendance.
              </p>
            </div>

            {pairingError && (
              <div
                style={{
                  background: "#fcefed",
                  border: "1px solid #f2c7c2",
                  color: "#9e3427",
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle size={16} />
                <span>{pairingError}</span>
              </div>
            )}

            <form onSubmit={handlePairDevice} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#8a745d" }}>
                  Select Staff Member
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {PRESET_STAFF.map((staff) => {
                    const isSelected = selectedStaffUser === staff.username;
                    return (
                      <div
                        key={staff.username}
                        onClick={() => setSelectedStaffUser(staff.username)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: `1.5px solid ${isSelected ? "#925638" : "#e6dac7"}`,
                          background: isSelected ? "#fcf5ed" : "#fff",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: isSelected ? "#925638" : "#eee1d0",
                              color: isSelected ? "#fff" : "#6a492a",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            {staff.name.charAt(0)}
                          </span>
                          <div>
                            <strong style={{ fontSize: 13, color: "#3c2a1c", display: "block" }}>
                              {staff.name}
                            </strong>
                            <small style={{ fontSize: 10, color: "#8d7963" }}>
                              {staff.shift}
                            </small>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 size={18} color="#925638" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#8a745d" }}>
                  Staff Password
                </label>
                <input
                  type="password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="Enter staff password (default: okay)"
                  required
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 8,
                    border: "1px solid #d9ccb9",
                    background: "#fff",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
                <small style={{ color: "#927b65", fontSize: 10, marginTop: 4 }}>
                  Demo hint: Use password <b>okay</b>
                </small>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="punch-btn-primary"
                style={{ marginTop: 8 }}
              >
                <UserCheck size={18} />
                {busy ? "Pairing Device..." : "Pair Device & Open Terminal"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 2. Main Mobile Attendance Terminal for Paired Device
  return (
    <div className="mobile-attendance-app">
      {/* Top App Bar */}
      <header className="mobile-attendance-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="brand-mark"><Smartphone size={20} /></span>
          <div className="brand">
            SM CAFINITY
            <small style={{ display: "block", fontSize: 8, letterSpacing: 1.5, color: "#d9be9e" }}>
              STAFF ATTENDANCE PORTAL
            </small>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="text-btn"
            onClick={() => go("/staff")}
            style={{ color: "#f7ede0", fontSize: 11, padding: "5px 10px", background: "rgba(255,255,255,0.1)", borderRadius: 6 }}
          >
            Full Workspace
          </button>
          <button
            className="text-btn"
            onClick={() => go("/")}
            style={{ color: "#d9be9e", fontSize: 11, padding: "5px 8px" }}
          >
            <ArrowLeft size={14} style={{ display: "inline", marginRight: 3 }} />
            Hub
          </button>
        </div>
      </header>

      <div className="mobile-attendance-content">
        {/* Paired Device Card */}
        <div className="device-lock-banner">
          <div className="device-lock-info">
            <span className="device-lock-avatar">
              {deviceStaff.name.charAt(0)}
            </span>
            <div className="device-lock-name">
              <b>{deviceStaff.name}</b>
              <small>
                <ShieldCheck size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 3, color: "#4f7a4a" }} />
                Locked Device Profile · Role: {deviceStaff.role}
              </small>
            </div>
          </div>
          <button
            onClick={handleUnpairDevice}
            title="Switch staff profile on this device"
            style={{
              background: "transparent",
              border: "1px solid #d5c5b0",
              color: "#7b634d",
              fontSize: 10,
              padding: "5px 9px",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <RotateCcw size={11} /> Switch
          </button>
        </div>

        {/* Geolock Status Card */}
        <div className={`geofence-card ${isInsideGeofence ? "inside" : "outside"}`}>
          <div className="geofence-head">
            <span className="geofence-pill">
              <MapPin size={13} />
              {isInsideGeofence ? "Inside Geofence" : "Outside Geofence"}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700 }}>
              {isFinite(distanceMeters) ? formatDistance(distanceMeters) : "Detecting..."}
            </span>
          </div>

          <div className="geofence-details">
            <b>{isInsideGeofence ? "📍 At SM Cafinity Café" : "📍 Away from Café Perimeter"}</b>
            <span>
              {isInsideGeofence
                ? `GPS verified (${formatDistance(distanceMeters)} from center · within ${CAFE_COORDS.radius}m). Punching unlocked.`
                : `You are ${formatDistance(distanceMeters)} away. Clock-in is geolocked to the café perimeter (${CAFE_COORDS.radius}m).`}
            </span>
            {geoError && <span style={{ color: "#a83e30" }}>GPS Notice: {geoError}</span>}
          </div>

          {/* Interactive Demo Mode Switcher for remote evaluation */}
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, color: "#8a7056", marginBottom: 4, fontWeight: 600 }}>
              DEMO GPS SIMULATOR (TRY BOTH STATES):
            </div>
            <div className="geo-mode-switcher">
              <button
                className={geoMode === "inside" ? "active" : ""}
                onClick={() => setGeoMode("inside")}
              >
                🟢 Inside (6m)
              </button>
              <button
                className={geoMode === "away" ? "active" : ""}
                onClick={() => setGeoMode("away")}
              >
                🔴 Outside (1.3km)
              </button>
              <button
                className={geoMode === "real" ? "active" : ""}
                onClick={() => setGeoMode("real")}
              >
                📡 Device GPS
              </button>
            </div>
          </div>
        </div>

        {/* Hero Attendance & Timers */}
        <div className="attendance-main-card">
          <div className="attendance-hero-status">
            <span
              className={`status-badge-lg ${
                status === "WORKING"
                  ? "status-working"
                  : status === "ON_BREAK"
                  ? "status-on-break"
                  : status === "CHECKED_OUT"
                  ? "status-checked-out"
                  : "status-not-checked-in"
              }`}
            >
              {status === "WORKING"
                ? "🟢 Shift Active · Working"
                : status === "ON_BREAK"
                ? "☕ On Break · 30m Buffer"
                : status === "CHECKED_OUT"
                ? "⏹️ Shift Completed"
                : "⚪ Not Checked In Today"}
            </span>

            <div className="live-timer-dial">
              {formatTimer(workedSeconds)}
            </div>
            <small style={{ fontSize: 11, color: "#87725e" }}>
              Total Worked Today · Shift Target: {attendance?.shift?.target_hours || 8}h
            </small>

            {status === "ON_BREAK" && (
              <div
                style={{
                  marginTop: 6,
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: "#faedd9",
                  border: "1px solid #ebd3b4",
                  fontSize: 12,
                  color: "#83521b",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Clock size={15} />
                <span>
                  Break buffer remaining: <b>{Math.floor(breakBufferRemainingSeconds / 60)}m {breakBufferRemainingSeconds % 60}s</b>
                </span>
              </div>
            )}
          </div>

          <div className="attendance-stat-row">
            <div className="attendance-stat-box">
              <small>Break Time</small>
              <strong>{formatTimer(breakSeconds)}</strong>
            </div>
            <div className="attendance-stat-box">
              <small>Scheduled Shift</small>
              <strong>{attendance?.shift?.shift_start || "08:00"} - {attendance?.shift?.shift_end || "16:30"}</strong>
            </div>
          </div>

          {/* Punch Actions */}
          <div className="punch-actions-group">
            {(status === "NOT_CHECKED_IN" || status === "CHECKED_OUT") && (
              <button
                disabled={busy || !isInsideGeofence}
                className="punch-btn-primary"
                onClick={() => handlePunch("CHECK_IN")}
              >
                <Play size={18} />
                {busy ? "Punching..." : "Clock In for Shift"}
              </button>
            )}

            {status === "WORKING" && (
              <div className="punch-split-row">
                <button
                  disabled={busy || !isInsideGeofence}
                  className="punch-btn-secondary"
                  onClick={() => handlePunch("START_BREAK")}
                >
                  <Pause size={15} style={{ display: "inline", marginRight: 5 }} />
                  Start Break (30m)
                </button>
                <button
                  disabled={busy || !isInsideGeofence}
                  className="punch-btn-primary"
                  style={{ background: "#75402a" }}
                  onClick={() => handlePunch("CHECK_OUT")}
                >
                  <LogOut size={16} />
                  Clock Out
                </button>
              </div>
            )}

            {status === "ON_BREAK" && (
              <button
                disabled={busy || !isInsideGeofence}
                className="punch-btn-primary"
                style={{ background: "#3d6342" }}
                onClick={() => handlePunch("END_BREAK")}
              >
                <Play size={18} />
                End Break & Resume Work
              </button>
            )}

            {!isInsideGeofence && (
              <p
                style={{
                  fontSize: 11,
                  color: "#963a2c",
                  textAlign: "center",
                  margin: "4px 0 0",
                  lineHeight: 1.4,
                }}
              >
                <AlertCircle size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                Punch buttons disabled while outside café geofence. Use the simulator above to test "Inside (6m)".
              </p>
            )}
          </div>
        </div>

        {/* Today's Punch Timeline */}
        <div className="punch-timeline-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Today's Punch Log</h3>
            <span style={{ fontSize: 10, color: "#8c765e" }}>
              {punches.length} {punches.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {punches.length === 0 ? (
            <div style={{ textAlign: "center", padding: "18px 0", color: "#9c8873", fontSize: 12 }}>
              No punches recorded yet today. Clock in when you arrive at SM Cafinity.
            </div>
          ) : (
            <div className="punch-timeline-list">
              {punches.map((p, idx) => {
                const label =
                  p.type === "CHECK_IN"
                    ? "Clock In"
                    : p.type === "START_BREAK"
                    ? "Break Start"
                    : p.type === "END_BREAK"
                    ? "Break End"
                    : "Clock Out";
                return (
                  <div key={p.id || idx} className="punch-timeline-item">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background:
                            p.type === "CHECK_IN"
                              ? "#e4efe4"
                              : p.type === "START_BREAK"
                              ? "#faeedc"
                              : p.type === "END_BREAK"
                              ? "#e4efe4"
                              : "#eee7de",
                          color:
                            p.type === "CHECK_IN"
                              ? "#2e6033"
                              : p.type === "START_BREAK"
                              ? "#905b1f"
                              : p.type === "END_BREAK"
                              ? "#2e6033"
                              : "#6d5f50",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {p.type === "CHECK_IN" || p.type === "END_BREAK" ? (
                          <Play size={13} />
                        ) : p.type === "START_BREAK" ? (
                          <Pause size={13} />
                        ) : (
                          <LogOut size={13} />
                        )}
                      </span>
                      <div>
                        <strong style={{ fontSize: 12, color: "#3a271a" }}>{label}</strong>
                        {p.notes && (
                          <small style={{ fontSize: 10, color: "#887460", display: "block" }}>
                            {p.notes}
                          </small>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong style={{ fontSize: 12, color: "#4f3927" }}>{time(p.timestamp)}</strong>
                      <span
                        style={{
                          display: "block",
                          fontSize: 9,
                          color: "#6c8c68",
                          letterSpacing: 0.5,
                        }}
                      >
                        ✓ Geolocked
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div style={{ textAlign: "center", fontSize: 10, color: "#998672", padding: "10px 0" }}>
          SM Cafinity Staff Attendance Engine · Geolocked to 19.2584498, 72.977272 (150m)
        </div>
      </div>
    </div>
  );
}
