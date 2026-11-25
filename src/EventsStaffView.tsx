import { useState } from "react";
import { Calendar, Users, CheckCircle2, XCircle, Plus } from "lucide-react";
import type { Snapshot } from "./types";

type Action = <T = unknown>(
  endpoint: string,
  body: unknown,
  message?: string,
) => Promise<T>;

export function EventsStaffView({
  data,
  act,
}: {
  data: Snapshot;
  act: Action;
}) {
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "DECLINED">("ALL");
  const [createModal, setCreateModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    event_date: new Date(Date.now() + 86400000 * 2 + 19800000).toISOString().slice(0, 10),
    start_time: "18:00",
    end_time: "20:30",
    event_type: "OPEN" as "OPEN" | "PRIVATE",
    host_name: data.staff?.name || "Café Host",
    host_contact: "host@smcafinity.in",
    max_participants: 16,
    table_id: 1,
  });

  const handleStatusChange = async (id: number, status: "APPROVED" | "DECLINED") => {
    setBusy(true);
    try {
      await act("event-status", { id, status }, `Event marked as ${status}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await act(
        "event-request",
        { ...form, table_id: Number(form.table_id) },
        "Event scheduled successfully"
      );
      setCreateModal(false);
    } finally {
      setBusy(false);
    }
  };

  const filtered = data.events.filter((e) => {
    if (filter === "ALL") return true;
    return e.status === filter;
  });

  const pendingCount = data.events.filter((e) => e.status === "PENDING").length;

  return (
    <div>
      <div className="section-title">
        <div>
          <h2>Café Gatherings & Event Requests</h2>
          <small style={{ color: "#7a624d" }}>Review customer event bookings and host open café happenings</small>
        </div>
        <button onClick={() => setCreateModal(true)}>
          <Plus size={16} /> Host Event
        </button>
      </div>

      <div className="filter-tabs" style={{ marginBottom: 20 }}>
        <button
          className={filter === "ALL" ? "active" : ""}
          onClick={() => setFilter("ALL")}
        >
          All ({data.events.length})
        </button>
        <button
          className={filter === "PENDING" ? "active" : ""}
          onClick={() => setFilter("PENDING")}
        >
          Pending Review {pendingCount > 0 && <b>{pendingCount}</b>}
        </button>
        <button
          className={filter === "APPROVED" ? "active" : ""}
          onClick={() => setFilter("APPROVED")}
        >
          Approved ({data.events.filter((e) => e.status === "APPROVED").length})
        </button>
        <button
          className={filter === "DECLINED" ? "active" : ""}
          onClick={() => setFilter("DECLINED")}
        >
          Declined ({data.events.filter((e) => e.status === "DECLINED").length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <p>No events in this category.</p>
        </div>
      ) : (
        <div className="event-grid">
          {filtered.map((ev) => (
            <div className="event-card" key={ev.id}>
              <div>
                <div className="event-head">
                  <h3>{ev.title}</h3>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span className={`pill ${ev.event_type === "OPEN" ? "event-open" : "event-private"}`}>
                      {ev.event_type === "OPEN" ? "Open Event" : "Private"}
                    </span>
                    <span
                      className={`pill ${
                        ev.status === "APPROVED"
                          ? "ready"
                          : ev.status === "PENDING"
                          ? "cancellation_pending"
                          : "cancelled"
                      }`}
                    >
                      {ev.status}
                    </span>
                  </div>
                </div>

                <div className="event-date-row">
                  <Calendar size={14} />
                  <span>
                    {ev.event_date} · {ev.start_time} – {ev.end_time}
                  </span>
                </div>

                <p style={{ fontSize: 12, margin: "8px 0" }}>{ev.description}</p>

                <div className="event-host-row">
                  <div>
                    <b>Host:</b> {ev.host_name} {ev.host_contact ? `· ${ev.host_contact}` : ""}
                  </div>
                  {ev.table_id && <div>Table Assigned: #{ev.table_id}</div>}
                </div>

                <div style={{ marginTop: 10 }}>
                  <span className="event-rsvps-tag">
                    <Users size={13} /> {ev.rsvp_count || 0} RSVPs {ev.max_participants ? `/ max ${ev.max_participants}` : ""}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 18, borderTop: "1px solid #dfd2be", paddingTop: 14 }}>
                {ev.status === "PENDING" && (
                  <>
                    <button
                      className="grow"
                      disabled={busy}
                      onClick={() => handleStatusChange(ev.id, "APPROVED")}
                      style={{ background: "#4a6847", color: "white" }}
                    >
                      <CheckCircle2 size={15} /> Approve
                    </button>
                    <button
                      className="danger grow"
                      disabled={busy}
                      onClick={() => handleStatusChange(ev.id, "DECLINED")}
                    >
                      <XCircle size={15} /> Decline
                    </button>
                  </>
                )}
                {ev.status === "APPROVED" && (
                  <button
                    className="secondary grow"
                    disabled={busy}
                    onClick={() => handleStatusChange(ev.id, "DECLINED")}
                  >
                    Cancel / Decline
                  </button>
                )}
                {ev.status === "DECLINED" && (
                  <button
                    className="secondary grow"
                    disabled={busy}
                    onClick={() => handleStatusChange(ev.id, "APPROVED")}
                  >
                    Re-approve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Host Event Modal */}
      {createModal && (
        <dialog open style={{ display: "block" }}>
          <div className="modal-head">
            <h2>Schedule Café Event</h2>
            <button className="icon-btn" onClick={() => setCreateModal(false)}>✕</button>
          </div>
          <form onSubmit={handleCreate}>
            <label>
              Event Title
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Catan Night, Coffee Sensory Tasting"
              />
            </label>
            <label>
              Type of Gathering
              <select
                value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value as any })}
              >
                <option value="OPEN">Open Event (Anyone in café can join & RSVP)</option>
                <option value="PRIVATE">Private Event (Host & invited guests only)</option>
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                Date
                <input
                  type="date"
                  required
                  value={form.event_date}
                  onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                />
              </label>
              <label>
                Max Participants
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.max_participants}
                  onChange={(e) => setForm({ ...form, max_participants: Number(e.target.value) })}
                />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                Start Time
                <input
                  type="time"
                  required
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                />
              </label>
              <label>
                End Time
                <input
                  type="time"
                  required
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                Host Name
                <input
                  type="text"
                  required
                  value={form.host_name}
                  onChange={(e) => setForm({ ...form, host_name: e.target.value })}
                />
              </label>
              <label>
                Table #
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.table_id}
                  onChange={(e) => setForm({ ...form, table_id: Number(e.target.value) })}
                />
              </label>
            </div>
            <label>
              Host Contact
              <input
                type="text"
                value={form.host_contact}
                onChange={(e) => setForm({ ...form, host_contact: e.target.value })}
                placeholder="Phone or email"
              />
            </label>
            <label>
              Description
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Explain the event, games being played, or activity details..."
              />
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="secondary grow" type="button" onClick={() => setCreateModal(false)}>
                Cancel
              </button>
              <button className="grow" type="submit" disabled={busy}>
                {busy ? "Publishing..." : "Schedule Event"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
