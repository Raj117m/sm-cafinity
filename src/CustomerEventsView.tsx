import { useState } from "react";
import { Calendar, Users, CheckCircle2 } from "lucide-react";
import type { Snapshot, CafeEvent } from "./types";

type Action = <T = unknown>(
  endpoint: string,
  body: unknown,
  message?: string,
) => Promise<T>;

export function CustomerEventsView({
  data,
  act,
  tableId,
}: {
  data: Snapshot;
  act: Action;
  tableId: number;
}) {
  const [requestModal, setRequestModal] = useState(false);
  const [rsvpEvent, setRsvpEvent] = useState<CafeEvent | null>(null);
  const [guestName, setGuestName] = useState(data.customer?.name || "");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    event_date: new Date(Date.now() + 86400000 * 2 + 19800000).toISOString().slice(0, 10),
    start_time: "18:00",
    end_time: "20:00",
    event_type: "OPEN" as "OPEN" | "PRIVATE",
    host_name: data.customer?.name || "",
    host_contact: "",
    max_participants: 12,
    table_id: tableId || 1,
  });

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await act(
        "event-request",
        { ...form, table_id: Number(form.table_id) },
        "Event request submitted! Our team will review and confirm."
      );
      setRequestModal(false);
    } finally {
      setBusy(false);
    }
  };

  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rsvpEvent) return;
    setBusy(true);
    try {
      await act(
        "event-rsvp",
        { event_id: rsvpEvent.id, guest_name: guestName || "Guest" },
        "RSVP confirmed! See you at the gathering."
      );
      setRsvpEvent(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">COMMUNITY & EXPERIENCES</span>
        <h1>
          Café Gatherings
          <em> & Events.</em>
        </h1>
        <p>Join open board game nights and tasting sessions, or request a private gathering for your table.</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button
          className="wide"
          onClick={() => setRequestModal(true)}
          style={{ minHeight: 46, fontSize: 13 }}
        >
          <Calendar size={17} /> Request or Host an Event
        </button>
      </div>

      <div className="section-title">
        <h2>Upcoming Café Events</h2>
        <span style={{ fontSize: 11, color: "#876b50" }}>
          <Users size={13} style={{ display: "inline", marginRight: 4 }} />
          Open & Private
        </span>
      </div>

      {data.events.length === 0 ? (
        <div className="empty">
          <p>No upcoming events scheduled right now. Tap above to host the next one!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {data.events.map((ev) => (
            <article className="event-card" key={ev.id}>
              <div>
                <div className="event-head">
                  <h3>{ev.title}</h3>
                  <div style={{ display: "flex", gap: 5 }}>
                    <span className={`pill ${ev.event_type === "OPEN" ? "event-open" : "event-private"}`}>
                      {ev.event_type === "OPEN" ? "Open Event" : "Private (Invite)"}
                    </span>
                    {ev.status === "PENDING" && (
                      <span className="pill cancellation_pending">Review Pending</span>
                    )}
                  </div>
                </div>

                <div className="event-date-row">
                  <Calendar size={14} />
                  <span>
                    {ev.event_date} · {ev.start_time} – {ev.end_time}
                  </span>
                </div>

                <p style={{ fontSize: 12, margin: "8px 0", color: "#6a523a", lineHeight: 1.5 }}>
                  {ev.description}
                </p>

                <div className="event-host-row">
                  <b>Host:</b> {ev.host_name} {ev.table_id ? `· Table ${ev.table_id}` : ""}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 12,
                  borderTop: "1px solid #e7ded2",
                  paddingTop: 12,
                }}
              >
                <span className="event-rsvps-tag">
                  <Users size={13} /> {ev.rsvp_count || 0} RSVPs {ev.max_participants ? `/ max ${ev.max_participants}` : ""}
                </span>

                {ev.event_type === "OPEN" && ev.status === "APPROVED" && (
                  ev.joined ? (
                    <span className="pill ready" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} /> Joined
                    </span>
                  ) : (
                    <button
                      className="secondary"
                      style={{ minHeight: 34, padding: "6px 14px", fontSize: 11 }}
                      onClick={() => {
                        setRsvpEvent(ev);
                        setGuestName(data.customer?.name || "");
                      }}
                    >
                      Join / RSVP
                    </button>
                  )
                )}

                {ev.event_type === "PRIVATE" && (
                  <span className="pill" style={{ fontSize: 9 }}>
                    Private Table Gathering
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal: Request / Host an Event */}
      {requestModal && (
        <dialog open style={{ display: "block" }}>
          <div className="modal-head">
            <h2>Request Café Event</h2>
            <button className="icon-btn" onClick={() => setRequestModal(false)}>✕</button>
          </div>
          <form onSubmit={handleRequestSubmit}>
            <label>
              Event Title
              <input
                type="text"
                required
                placeholder="e.g. Catan Strategy Afternoon, Book Reading, Coffee Tasting"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Gathering Privacy
              <select
                value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value as any })}
              >
                <option value="OPEN">Open Event (Anyone in the café can view & RSVP)</option>
                <option value="PRIVATE">Private Event (Only invited guests / your table)</option>
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
                  placeholder="Your name"
                  value={form.host_name}
                  onChange={(e) => setForm({ ...form, host_name: e.target.value })}
                />
              </label>
              <label>
                Host Contact (Phone/Email)
                <input
                  type="text"
                  required
                  placeholder="Contact details"
                  value={form.host_contact}
                  onChange={(e) => setForm({ ...form, host_contact: e.target.value })}
                />
              </label>
            </div>
            <label>
              Description & Notes
              <textarea
                placeholder="What games will you play? Any snacks or coffee pairing preferences?"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="secondary grow" type="button" onClick={() => setRequestModal(false)}>
                Cancel
              </button>
              <button className="grow" type="submit" disabled={busy}>
                {busy ? "Submitting..." : "Submit Event Request"}
              </button>
            </div>
          </form>
        </dialog>
      )}

      {/* Modal: RSVP for Open Event */}
      {rsvpEvent && (
        <dialog open style={{ display: "block" }}>
          <div className="modal-head">
            <h2>Join {rsvpEvent.title}</h2>
            <button className="icon-btn" onClick={() => setRsvpEvent(null)}>✕</button>
          </div>
          <form onSubmit={handleRsvpSubmit}>
            <p style={{ fontSize: 12, color: "#6a523a", margin: "6px 0 16px" }}>
              Join this open gathering on <b>{rsvpEvent.event_date}</b> from <b>{rsvpEvent.start_time}</b> to <b>{rsvpEvent.end_time}</b> hosted by <b>{rsvpEvent.host_name}</b>.
            </p>
            <label>
              Your Name
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter your name"
              />
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="secondary grow" type="button" onClick={() => setRsvpEvent(null)}>
                Cancel
              </button>
              <button className="grow" type="submit" disabled={busy}>
                {busy ? "Confirming..." : "Confirm RSVP"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
