import {MenuProduct,PairSnack} from "./MenuProduct";
import {CoinWheel} from './CoinWheel';
import { TimerRing } from "./TimerRing";
import { Reveal } from "./Reveal";
import { AttendanceView } from "./AttendanceView";
import { EventsStaffView } from "./EventsStaffView";
import { CustomerEventsView } from "./CustomerEventsView";
import { StaffMobileAttendanceApp } from "./StaffMobileAttendanceApp";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Coffee,
  Utensils,
  Gamepad2,
  Coins,
  Receipt,
  ArrowUpRight,
  ArrowLeft,
  Plus,
  Minus,
  X,
  Check,
  LayoutDashboard,
  Package,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Bell,
  RefreshCw,
  QrCode,
  ShoppingBag,
  Search,
  Flame,
  Armchair,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  Calendar,
  Smartphone,
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  Snapshot,
  CartLine,
  Product,
  Order,
  Bill,
  Report,
  Game,
  Settings,
  Staff,
} from "./types";
import { api, uid, money, time } from "./api";
import { sessionCafeQuote } from "./cafeQuotes";
import QRCode from "qrcode";
const labels: Record<string, string> = {
  CANCELLATION_PENDING: "Cancellation window",
  NEW: "New order",
  PREPARING: "Preparing",
  READY: "Ready to serve",
  SERVED: "Served",
  CANCELLED: "Cancelled",
};
const nextStatus = {
  NEW: "PREPARING",
  PREPARING: "READY",
  READY: "SERVED",
} as const;
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const dismiss = () => {
    const dialog = ref.current;
    if (!dialog?.animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      close();
      return;
    }
    if (dialog.dataset.closing) return;
    dialog.dataset.closing = "true";
    dialog.animate(
      [{ transform: "translateY(0) scale(1)", opacity: 1 }, { transform: "translateY(65px) scale(.94)", opacity: 0 }],
      { duration: 190, easing: "ease-in", fill: "forwards" },
    ).finished.then(close, close);
  };
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); dismiss(); }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="modal-head"
        onTouchStart={(e) => {
          const finger = e.touches[0];
          touch.current = e.touches.length === 1 ? { x: finger.clientX, y: finger.clientY } : null;
        }}
        onTouchCancel={() => { touch.current = null; }}
        onTouchEnd={(e) => {
          const start = touch.current;
          const finger = e.changedTouches[0];
          touch.current = null;
          if (start && finger && finger.clientY - start.y > 46 &&
              finger.clientY - start.y > Math.abs(finger.clientX - start.x) * 1.5) dismiss();
        }}>
        <h2>{title}</h2>
        <button className="icon-btn" onClick={dismiss} aria-label="Close dialog">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
let customerBrandShown = false;
function Brand({ intro = false }: { intro?: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const logo = ref.current;
    if (!intro || customerBrandShown || !logo?.animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    customerBrandShown = true;
    const bounds = logo.getBoundingClientRect();
    const x = window.innerWidth / 2 - bounds.left - bounds.width / 2;
    const y = window.innerHeight / 2 - bounds.top - bounds.height / 2;
    logo.animate([
      { transform: `translate(${x}px, ${y}px) scale(1.24)`, offset: 0 },
      { transform: `translate(${x}px, ${y}px) scale(1.24)`, offset: .55, easing: "cubic-bezier(.22, 1, .36, 1)" },
      { transform: "translate(0, 0) scale(1)" },
    ], { duration: 1700 });
    logo.closest(".customer, .landing")?.querySelector(".customer-content, main")?.animate(
      [{ opacity: 0 }, { opacity: 0, offset: .62 }, { opacity: 1 }],
      { duration: 1700 },
    );
  }, [intro]);
  return (
    <a href="/" className="brand" ref={ref}>
      <span className="brand-mark">
        <Coffee size={23} />
      </span>
      <span>
        SM Cafinity<small>COFFEE · FOOD · GOOD COMPANY</small>
      </span>
    </a>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Coffee size={32} />
      <p>{children}</p>
    </div>
  );
}
function Pill({ status }: { status: string }) {
  return (
    <span className={"pill " + status.toLowerCase()}>
      {labels[status] || status.replaceAll("_", " ")}
    </span>
  );
}
export function App() {
  const [data, setData] = useState<Snapshot | null>(null),
    [connection, setConnection] = useState("connecting"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState<{ message: string; gameRequest: boolean } | null>(null);
  const [path, setPath] = useState(location.pathname),
    [search, setSearch] = useState(location.search);
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const next = await api<Snapshot>("snapshot");
      if (seq === loadSeq.current) {
        setData(next);
        setConnection("live");
      }
    } catch (e) {
      setConnection("offline");
      throw e;
    }
  }, []);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    const ev = new EventSource("/api/events");
    ev.addEventListener("change", () => void load().catch(() => {}));
    ev.onerror = () => setConnection("reconnecting");
    ev.onopen = () => void load().catch(() => {});
    const online = () => void load().catch(() => {}),
      offline = () => setConnection("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    const pop = () => {
      setPath(location.pathname);
      setSearch(location.search);
    };
    window.addEventListener("popstate", pop);
    return () => {
      ev.close();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("popstate", pop);
    };
  }, [load]);
  const go = (url: string) => {
    history.pushState({}, "", url);
    setPath(location.pathname);
    setSearch(location.search);
    window.scrollTo(0, 0);
    void load().catch(() => {});
  };
  const act = async <T,>(endpoint: string, body: unknown, message = "") => {
    try {
      setError("");
      const result = await api<T>(endpoint, body);
      await load();
      if (message) setNotice({ message, gameRequest: endpoint === "game-request" });
      return result;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Connection lost. This action has not been confirmed. Retry safely.",
      );
      throw e;
    }
  };
  useEffect(() => {
    if (notice) {
      const id = setTimeout(() => setNotice(null), 4500);
      return () => clearTimeout(id);
    }
  }, [notice]);
  if (!data)
    return (
      <div className="loading">
        <Coffee size={44} />
        <h2>Brewing your café experience…</h2>
        {error && (
          <>
            <p>{error}</p>
            <button onClick={() => void load().catch(() => {})}>
              Retry connection
            </button>
          </>
        )}
      </div>
    );
  return (
    <>
      <div
        className={
          "connection " + (connection === "live" ? "" : "disconnected")
        }
      >
        {connection === "live" ? <Wifi size={12} /> : <WifiOff size={12} />}{" "}
        {connection === "live"
          ? "Live café connection"
          : `${connection} · saved orders are safe`}
        {data.demo && " · Demonstration menu & test accounts"}
      </div>
      {error && (
        <div className="toast error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className={notice.gameRequest ? "toast game-request-toast" : "toast"} role="status">
          {notice.gameRequest ? (
            <>
              <span className="game-request-toast-icon"><Gamepad2 size={19} aria-hidden="true" /></span>
              <div><strong>Game requested</strong><p>{notice.message}</p></div>
            </>
          ) : (
            <><CheckCircle2 size={18} />{notice.message}</>
          )}
        </div>
      )}
      {path === "/menu" ? (
        <Customer key={search} data={data} search={search} act={act} go={go} />
      ) : path === "/staff" ? (
        <StaffView data={data} act={act} />
      ) : path === "/attendance" || path === "/clockin" ? (
        <StaffMobileAttendanceApp data={data} act={act} go={go} />
      ) : path === "/qr" ? (
        <QRPage data={data} />
      ) : (
        <Landing data={data} go={go} act={act} />
      )}
    </>
  );
}
type Action = <T = unknown>(
  endpoint: string,
  body: unknown,
  message?: string,
) => Promise<T>;
function Landing({
  data,
  go,
  act,
}: {
  data: Snapshot;
  go: (url: string) => void;
  act: Action;
}) {
  const [table, setTable] = useState(4),
    [reset, setReset] = useState(false),
    [confirm, setConfirm] = useState("");
  const selected = data.tables.find((t) => t.id === table) || data.tables[0];
  return (
    <div className="landing">
      <header>
        <Brand intro />
        <span className="atomz">
          ATOMZ <span>×</span> SM CAFINITY
        </span>
      </header>
      <main>
        <div className="eyebrow">WELCOME TO SM CAFINITY</div>
        <h1>
          Pull up a chair.
          <br />
          <em>Stay for another cup.</em>
        </h1>
        <p className="lead">
          Order something you love. Pick a game. Make yourself at home.
        </p>
        <div className="entry-grid">
          <button
            className="entry customer-entry"
            onClick={() =>
              go(`/menu?table=${selected.id}&key=${selected.token}`)
            }
          >
            <span className="entry-icon">
              <Coffee />
            </span>
            <div>
              <small>TAKE A SEAT</small>
              <h2>Open the menu</h2>
              <p>Find your next favourite.</p>
            </div>
            <ArrowUpRight />
          </button>
          <button className="entry staff-entry" onClick={() => go("/staff")}>
            <span className="entry-icon">
              <LayoutDashboard />
            </span>
            <div>
              <small>BEHIND THE COUNTER</small>
              <h2>Staff workspace</h2>
              <p>Orders, tables and the daily details.</p>
            </div>
            <ArrowUpRight />
          </button>
          <button
            className="entry attendance-entry"
            onClick={() => go("/attendance")}
          >
            <span className="entry-icon">
              <Smartphone />
            </span>
            <div>
              <small>MOBILE ATTENDANCE PORTAL</small>
              <h2>Staff clock-in</h2>
              <p>Geolocked attendance & break timer.</p>
            </div>
            <ArrowUpRight />
          </button>
        </div>
        <section className="table-chooser">
          <div>
            <span className="eyebrow">CHOOSE YOUR TABLE</span>
            <p>The same table link works with NFC or QR.</p>
          </div>
          <div className="table-buttons">
            {data.tables.map((t) => (
              <button
                key={t.id}
                className={table === t.id ? "selected" : ""}
                onClick={() => setTable(t.id)}
              >
                {String(t.id).padStart(2, "0")}
              </button>
            ))}
          </div>
        </section>
        <div className="landing-tools">
          <button className="text-btn" onClick={() => go("/qr")}>
            <QrCode size={17} /> Printable table QR codes
          </button>
          {data.demo && data.staff?.role === "owner" && (
            <button className="text-btn" onClick={() => setReset(true)}>
              <RefreshCw size={16} /> Reset Demo Data
            </button>
          )}
        </div>
        <p className="fine">
          Demonstration products and prices. Orders and payments saved here are
          real demo records.
        </p>
      </main>
      <footer>
        Good things take a little time.
        <span>
          Powered by <b>ATOMZ</b>
        </span>
      </footer>
      {reset && (
        <Modal
          title="Reset demonstration transactions?"
          close={() => setReset(false)}
        >
          <p>
            This clears orders, payments, rewards activity and game requests.
            Menu edits and staff accounts remain.
          </p>
          <label>
            Type RESET DEMO
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <button
            className="danger"
            disabled={confirm !== "RESET DEMO"}
            onClick={() =>
              void act("reset", { confirm }, "Demo transactions reset")
                .then(() => setReset(false))
                .catch(() => {})
            }
          >
            Reset demo records
          </button>
        </Modal>
      )}
    </div>
  );
}
function CustomerOrderTracker({ order, now }: { order: Order; now: number }) {
  const preparing = order.status === "PREPARING";
  const finished = order.status === "READY" || order.status === "SERVED";
  const start = preparing ? order.preparing_at : order.created_at;
  const end = finished ? order.ready_at || order.served_at : now;
  const seconds =
    start && end ? Math.max(0, Math.floor((end - start) / 1000)) : null;
  const elapsed =
    seconds === null
      ? "—"
      : `${Math.floor(seconds / 60)
          .toString()
          .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  return (
    <section
      className="customer-tracker"
      aria-label={`Order ${order.id} tracking`}
    >
      <div className="tracker-heading">
        <span>
          <small>ORDER #{order.id}</small>
          <strong>
            {order.status === "SERVED"
              ? "Enjoy your order"
              : finished
                ? "Your order is ready"
                : preparing
                  ? "We’re preparing your order"
                  : "Order received"}
          </strong>
        </span>
        <Coffee size={26} />
      </div>
      <div className="tracker-steps">
        <span className="done">
          <CheckCircle2 size={17} /> Received
        </span>
        <span className={preparing || finished ? "done" : ""}>
          <Flame size={17} /> Preparing
        </span>
        <span className={finished ? "done" : ""}>
          <Check size={17} /> Ready
        </span>
      </div>
      {order.queueAhead !== undefined && order.queueAhead > 0 && (
        <div className="queue-ahead-tag" role="status">
          <Clock size={15} />
          <span><b>{order.queueAhead}</b> {order.queueAhead === 1 ? 'order' : 'orders'} ahead in kitchen queue</span>
        </div>
      )}
      {order.queueAhead === 0 && (order.status === 'NEW' || order.status === 'PREPARING') && (
        <div className="queue-ahead-tag" style={{ background: '#ecf4eb', borderColor: '#c2dcbe', color: '#2d5e2a' }} role="status">
          <Flame size={15} />
          <span><b>Next up in kitchen!</b> Fresh preparation underway.</span>
        </div>
      )}
      <div className="customer-ring-wrap">
        <TimerRing
          value={elapsed}
          label={
            finished
              ? "Time to ready"
              : preparing
                ? "Preparing for"
                : "Since you ordered"
          }
          running={!finished}
        />
      </div>
      <p>
        {order.status === "CANCELLATION_PENDING"
          ? "Your order is saved. Preparation starts after the cancellation window."
          : order.status === "NEW"
            ? "The team has your order. We’ll update you when preparation starts."
            : preparing
              ? "The kitchen is working on it. This timer shows elapsed preparation time."
              : order.status === "READY"
                ? "The team will bring it to your table shortly."
                : "Thanks for spending time with us."}
      </p>
    </section>
  );
}
function Customer({
  data,
  search,
  act,
  go,
}: {
  data: Snapshot;
  search: string;
  act: Action;
  go: (url: string) => void;
}) {
  const params = new URLSearchParams(search),
    tableId = Number(params.get("table")),
    tableToken =
      params.get("key") ||
      data.tables.find((t) => t.id === tableId)?.token ||
      "";
  const validTable = data.tables.some((t) => t.id === tableId);
  const [quote] = useState(sessionCafeQuote),
    [tab, setTab] = useState("Menu"),
    [category, setCategory] = useState(0),
    [query, setQuery] = useState(""),
    [cart, setCart] = useState<CartLine[]>(() => {
      try {
        return JSON.parse(localStorage.getItem("cart-" + tableId) || "[]");
      } catch {
        return [];
      }
    }),
    [checkout, setCheckout] = useState(false),
    [detail, setDetail] = useState<Product | null>(null),
    [opts, setOpts] = useState<string[]>([]),
    [notes, setNotes] = useState(""),
    [coins, setCoins] = useState(0),
    [busy, setBusy] = useState(false),
    [suggestion, setSuggestion] = useState(""),
    [now, setNow] = useState(Date.now()),
    [pending, setPending] = useState(
      () => !!localStorage.getItem("submission-" + tableId),
    );
  useEffect(() => {
    localStorage.setItem("cart-" + tableId, JSON.stringify(cart));
  }, [cart, tableId]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const offset = useMemo(() => data.now - Date.now(), [data.now]);
  const currentOrders = data.orders.filter((o) => o.table_id === tableId);
  const currentBills = data.bills.filter((b) => b.table_id === tableId);
  const gross = cart.reduce((v, l) => {
    const p = data.products.find((p) => p.id === l.productId);
    return (
      v +
      (p
        ? p.price +
          p.options
            .filter((o) => l.options.includes(o.id))
            .reduce((s, o) => s + o.price, 0)
        : 0) *
        l.quantity
    );
  }, 0);
  const coinLimit = Math.max(0, Math.min(
    data.customer?.balance ?? 0,
    Math.floor(gross * data.settings.maxDiscountPercent / 100 / data.settings.coinValue),
  ));
  const redeemCoins = Math.min(coins, coinLimit);
  const add = (p: Product, options: string[] = []) => {
    if (pending) return;
    setCart((prev) => {
      const i = prev.findIndex(
        (l) =>
          l.productId === p.id &&
          JSON.stringify(l.options) === JSON.stringify(options),
      );
      return i < 0
        ? [...prev, { productId: p.id, quantity: 1, options }]
        : prev.map((l, n) =>
            n === i ? { ...l, quantity: Math.min(30, l.quantity + 1) } : l,
          );
    });
  };
  async function submit() {
    if (busy || (!cart.length && !pending)) return;
    setBusy(true);
    try {
      let body;
      const existing = localStorage.getItem("submission-" + tableId);
      if (existing) body = JSON.parse(existing);
      else {
        body = { tableId, tableToken, items: cart, notes, coins: redeemCoins, key: uid() };
        localStorage.setItem("submission-" + tableId, JSON.stringify(body));
        setPending(true);
      }
      await act(
        "order",
        body,
        "Order saved. Your cancellation window is open.",
      );
      localStorage.removeItem("submission-" + tableId);
      setPending(false);
      setCart([]);
      setCoins(0);
      setNotes("");
      setCheckout(false);
      setTab("My Table");
      window.scrollTo(0, 0);
    } catch (e) {
      /* Preserve exact request for safe retry. */
    } finally {
      setBusy(false);
    }
  }
  if (!validTable)
    return (
      <div className="loading">
        <h2>Choose your table first</h2>
        <button onClick={() => go("/")}>Choose Table</button>
      </div>
    );
  return (
    <div className="customer">
      <header className="customer-header">
        <Brand intro />
        <button className="table-badge" onClick={() => go("/")}>
          <Armchair size={17} /> Table {String(tableId).padStart(2, "0")}
        </button>
      </header>
      <div className="customer-content">
        <div className="early-cancel">
          {currentOrders.filter(o => o.status === "CANCELLATION_PENDING").map(o => (
            <button
              key={o.id}
              className="danger"
              disabled={busy || o.deadline <= now + offset}
              onClick={() => {
                setBusy(true);
                void act("cancel", { id: o.id }, "Order cancelled.")
                  .catch(() => {})
                  .finally(() => setBusy(false));
              }}
            >
              Cancel order · {Math.max(0, Math.ceil((o.deadline - now - offset) / 1000))}s
            </button>
          ))}
        </div>
        {currentOrders
          .filter((o) => !["CANCELLED", "SERVED"].includes(o.status))
          .map((o) => (
            <CustomerOrderTracker key={o.id} order={o} now={now + offset} />
          ))}
        {tab === "Menu" && (
          <>
            {data.kitchenQueueCount > 0 && (
              <div className="queue-banner" role="status">
                <Clock size={16} />
                <div>
                  <strong>Kitchen queue:</strong> {data.kitchenQueueCount} {data.kitchenQueueCount === 1 ? 'order' : 'orders'} currently being prepared in the kitchen.
                </div>
              </div>
            )}
            <section className="menu-hero">
              <div className="eyebrow">SM CAFINITY</div>
              <h1>
                {quote.lead}
                <br />
                <em>{quote.accent}</em>
              </h1>
              <p>{quote.line}</p>
              <span className="hero-stamp">
                <Coffee size={33} />
                <small>
                  BREWED
                  <br />
                  FOR YOU
                </small>
              </span>
            </section>
            <section
              className="craving-picker"
              aria-label="Choose what you feel like"
            >
              <p>What are you in the mood for?</p>
              <div>
                {data.categories.map((c) => (
                  <button
                    key={c.id}
                    aria-pressed={category === c.id}
                    onClick={() => setCategory(category === c.id ? 0 : c.id)}
                  >
                    {(
                      {
                        Coffee: "A coffee break",
                        "Cold Beverages": "Something chilled",
                        Snacks: "A savoury bite",
                        Desserts: "Something sweet",
                      } as Record<string, string>
                    )[c.name] || c.name}
                  </button>
                ))}
              </div>
            </section>
            <div className="search">
              <Search size={18} />
              <input
                aria-label="Search menu"
                placeholder="What are you craving?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="category-tabs">
              <button
                className={category === 0 ? "active" : ""}
                onClick={() => setCategory(0)}
              >
                Everything
              </button>
              {data.categories.map((c) => (
                <button
                  className={category === c.id ? "active" : ""}
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="section-title">
              <h2>From our kitchen</h2>
              <span>
                <Flame size={14} /> Café favourites
              </span>
            </div>
            <div className="product-grid">
              {data.products
                .filter(
                  (p) =>
                    (!category || p.category_id === category) &&
                    p.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((p, index) => (
                  <Reveal
                    index={index}
                    className={
                      "product-card " + (!p.orderable ? "soldout" : "")
                    }
                    key={p.id}
                  >
                    <MenuProduct product={p} quantity={cart.filter(l=>l.productId===p.id).reduce((s,l)=>s+l.quantity,0)} disabled={pending}
                      add={()=>add(p,cart.filter(l=>l.productId===p.id).at(-1)?.options||[])}
                      customize={()=>{setDetail(p);setOpts([]);}}>
                      {cart.some(l=>l.productId===p.id)&&data.products.filter(t=>t.id===p.pairing_product_id&&t.id!==p.id&&t.orderable).map(target=><PairSnack key={target.id} source={p} target={target} quantity={cart.filter(l=>l.productId===target.id).reduce((s,l)=>s+l.quantity,0)} disabled={pending} add={()=>add(target)}/>)}
                    </MenuProduct>
                  </Reveal>
                ))}
            </div>
            <p className="fine">
              Demo menu & prices · Please tell the team about allergies.
              <br />
              Wrong table? Ask staff before ordering, or choose your table
              above.
            </p>
          </>
        )}
        {tab === "Games" && (
          <>
            <div className="page-heading">
              <span className="eyebrow">AT THE TABLE</span>
              <h1>
                A little friendly
                <br />
                <em>competition.</em>
              </h1>
              <p>Pick a game. Our team will bring it over.</p>
            </div>
            <div className="game-grid">
              {data.games.map((g, i) => (
                <article className="game-card" key={g.id}>
                  {g.image ? (
                    <img className="game-image" src={g.image} alt={g.name} />
                  ) : (
                    <div className={"game-art art-" + (i % 4)}>
                      {["✦", "♞", "▥", "●"][i % 4]}
                    </div>
                  )}
                  <div>
                    <h2>{g.name}</h2>
                    <p>{g.description}</p>
                    <button
                      disabled={!g.available || busy}
                      onClick={() => {
                        setBusy(true);
                        void act(
                          "game-request",
                          { gameId: g.id, tableId, tableToken },
                          "The team will bring it over when a copy is free.",
                        )
                          .catch(() => {})
                          .finally(() => setBusy(false));
                      }}
                    >
                      {g.available ? "Request for my table" : "Unavailable"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {data.gameRequests
              .filter((r) => r.table_id === tableId)
              .map((r) => (
                <div className="list-row" key={r.id}>
                  <span>{r.name}</span>
                  <Pill status={r.status} />
                </div>
              ))}
            <section className="suggest-card">
              <Coins />
              <h2>What game should we add next?</h2>
              <p>
                Help choose our next game. Signed-in test accounts earn{" "}
                {data.settings.suggestionCoins} coins once every{" "}
                {data.settings.cooldownDays} days.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act<{ message: string }>("suggest", { name: suggestion })
                    .then((r) => {
                      setSuggestion("");
                      alert(r.message);
                    })
                    .catch(() => {});
                }}
              >
                <input
                  value={suggestion}
                  maxLength={60}
                  required
                  onChange={(e) => setSuggestion(e.target.value)}
                  placeholder="Monopoly? Scrabble? Your call."
                />
                <button>
                  Send suggestion <ArrowUpRight size={16} />
                </button>
              </form>
            </section>
          </>
        )}
        {tab === "Events" && (
          <CustomerEventsView data={data} act={act} tableId={tableId} />
        )}
        {tab === "Rewards" && (
          <>
            <div className="page-heading">
              <span className="eyebrow">A LITTLE SOMETHING BACK</span>
              <h1>
                Your coffee.
                <br />
                <em>Your ATOMZ Coins.</em>
              </h1>
            </div>
            <section className="coin-card">
              <Coins size={32} />
              <small>AVAILABLE BALANCE</small>
              <strong>
                {data.customer?.balance ?? "—"} <span>coins</span>
              </strong>
              <p>
                {data.customer?.name ||
                  "Order freely. Sign in only when you want rewards."}
              </p>
            </section>
            <div className="reward-rules">
              <p>
                <b>{data.settings.earnCoins} coins</b> per{" "}
                {money(data.settings.earnPer)} paid
              </p>
              <p>
                <b>1 coin = {money(data.settings.coinValue)}</b> toward a future
                order
              </p>
              <p>
                Redeem up to <b>{data.settings.maxDiscountPercent}%</b> at
                checkout
              </p>
            </div>
            {data.customer ? (
              <>
                <button
                  className="secondary"
                  onClick={() => void act("logout", {}).catch(() => {})}
                >
                  <LogOut size={16} /> Continue as guest
                </button>
                <h2 className="spaced">Your coin history</h2>
                {data.loyalty.map((l) => (
                  <div className="list-row" key={l.id}>
                    <span>
                      {l.reason}
                      <small>{time(l.created_at)}</small>
                    </span>
                    <b className={l.coins > 0 ? "green" : "orange"}>
                      {l.coins > 0 ? "+" : ""}
                      {l.coins}
                    </b>
                  </div>
                ))}
              </>
            ) : (
              <section className="panel">
                <h2>Try a test account</h2>
                <p>
                  Demo sign-in only. No phone numbers collected and no SMS sent.
                </p>
                {data.demoCustomers.map((c) => (
                  <button
                    className="account-choice"
                    key={c.id}
                    onClick={() =>
                      void act(
                        "customer-login",
                        { id: c.id },
                        "Test account signed in",
                      ).catch(() => {})
                    }
                  >
                    {c.name}
                    <ArrowUpRight size={18} />
                  </button>
                ))}
              </section>
            )}
          </>
        )}
        {tab === "My Table" && (
          <>
            <div className="page-heading">
              <span className="eyebrow">YOUR TABLE</span>
              <h1>
                Table {String(tableId).padStart(2, "0")}
                <em> at a glance.</em>
              </h1>
              <p>Your orders and bills from this browser session.</p>
            </div>
            {currentBills.length === 0 ? (
              <Empty>Your table is ready for its first order.</Empty>
            ) : (
              currentBills.map((b) => (
                <section className="panel bill-panel" key={b.id}>
                  <div className="section-title">
                    <h2>Bill #{b.id}</h2>
                    <Pill status={b.status} />
                  </div>
                  <div className="bill-total">
                    <span>
                      {b.status === "OPEN" ? "Table outstanding" : "Bill total"}
                    </span>
                    <strong>
                      {money(b.status === "OPEN" ? b.outstanding : b.total)}
                    </strong>
                  </div>
                  {b.discount > 0 && <p>Coin discount: {money(b.discount)}</p>}
                  <p className="fine">
                    Shared table total. Account details stay private. Pay cash
                    or UPI with the team.
                  </p>
                  {b.orders.map((o) => (
                    <div className="customer-order" key={o.id}>
                      <div className="section-title">
                        <b>Order #{o.id}</b>
                        <Pill status={o.status} />
                      </div>
                      {o.queueAhead !== undefined && o.queueAhead > 0 && (
                        <div className="queue-ahead-tag" role="status">
                          <Clock size={13} />
                          <span><b>{o.queueAhead}</b> {o.queueAhead === 1 ? 'order' : 'orders'} ahead in kitchen queue</span>
                        </div>
                      )}
                      {o.queueAhead === 0 && (o.status === 'NEW' || o.status === 'PREPARING') && (
                        <div className="queue-ahead-tag" style={{ background: '#ecf4eb', borderColor: '#c2dcbe', color: '#2d5e2a' }} role="status">
                          <Flame size={13} />
                          <span><b>Next up in kitchen!</b></span>
                        </div>
                      )}
                      {o.items.map((i) => (
                        <p key={i.id}>
                          {i.quantity} × {i.name}{" "}
                          <b>{money(i.quantity * i.unit_price)}</b>
                        </p>
                      ))}

                    </div>
                  ))}
                </section>
              ))
            )}
            {currentOrders.some((o) => o.status === "CANCELLED") && (
              <p className="fine">
                Cancelled orders remain recorded and earn no purchase coins.
              </p>
            )}
          </>
        )}
        <footer className="customer-footer">
          See you for another cup.{" "}
          <span>
            Powered by <b>ATOMZ</b>
          </span>
        </footer>
      </div>
      {!checkout && (cart.length > 0 || pending) && (
        <div className="cart-bar cart-bar-actions">
          {!pending && (
            <button className="cart-place-order" disabled={busy} onClick={() => void submit()}>
              {busy ? "Placing…" : "Place Order"}
            </button>
          )}
          <button className="cart-review-order" onClick={() => setCheckout(true)}>
          <span>
            <ShoppingBag size={18} />
            {pending
              ? "Resolve pending submission"
              : `${cart.reduce((n, l) => n + l.quantity, 0)} items · Review order`}
          </span>
          <b>
            {money(gross - redeemCoins * data.settings.coinValue)} <ArrowUpRight size={17} />
          </b>
          </button>
        </div>
      )}
      <nav className="bottom-nav">
        {[
          { name: "Menu", icon: Utensils },
          { name: "Games", icon: Gamepad2 },
          { name: "Events", icon: Calendar },
          { name: "Rewards", icon: Coins },
          { name: "My Table", icon: Receipt },
        ].map((t) => (
          <button
            key={t.name}
            className={tab === t.name ? "active" : ""}
            onClick={() => setTab(t.name)}
          >
            <t.icon size={21} />
            {t.name}
          </button>
        ))}
      </nav>
      {detail && (
        <Modal title={detail.name} close={() => setDetail(null)}>
          <img className="detail-photo" src={detail.image} alt={detail.name} />
          <p className="sensory-description">{detail.description}</p>
          {detail.options.length > 0 && (
            <h3 className="personalise-heading">
              Make it your {detail.name.toLowerCase()}
            </h3>
          )}
          {detail.options.map((o) => (
            <label className="check-row" key={o.id}>
              <input
                type="checkbox"
                checked={opts.includes(o.id)}
                onChange={(e) =>
                  setOpts((prev) =>
                    e.target.checked
                      ? [
                          ...prev.filter(
                            (id) =>
                              o.group === "Add-ons" ||
                              detail.options.find((x) => x.id === id)?.group !==
                                o.group,
                          ),
                          o.id,
                        ]
                      : prev.filter((id) => id !== o.id),
                  )
                }
              />
              {o.name}
              <b>+{money(o.price)}</b>
            </label>
          ))}
          <div className="your-selection" aria-live="polite">
            <small>YOUR SELECTION</small>
            <strong>{detail.name}</strong>
            <p>
              {opts.length
                ? detail.options
                    .filter((o) => opts.includes(o.id))
                    .map((o) => o.name)
                    .join(" · ")
                : "Original recipe"}
            </p>
          </div>
          <button
            disabled={!detail.orderable || pending}
            onClick={() => {
              add(detail, opts);
            }}
          >
            Add to order ·{" "}
            {money(
              detail.price +
                detail.options
                  .filter((o) => opts.includes(o.id))
                  .reduce((n, o) => n + o.price, 0),
            )}
          </button>
          <p className="fine" aria-live="polite">{cart.filter(l=>l.productId===detail.id).reduce((s,l)=>s+l.quantity,0)} added to your order</p>
          {cart.some(l=>l.productId===detail.id)&&data.products.filter(t=>t.id===detail.pairing_product_id&&t.id!==detail.id&&t.orderable).map(target=><PairSnack key={target.id} source={detail} target={target} quantity={cart.filter(l=>l.productId===target.id).reduce((s,l)=>s+l.quantity,0)} disabled={pending} add={()=>add(target)}/>)}
        </Modal>
      )}
      {checkout && (
        <Modal
          title={`Your order · Table ${tableId}`}
          close={() => setCheckout(false)}
        >
          <div className="checkout-first">
            <button
              className="wide"
              disabled={busy || (!cart.length && !pending)}
              onClick={() => void submit()}
            >
              {busy ? "Confirming with café…" : pending ? "Retry saved submission" : "Place Order"}
              <ArrowUpRight size={17} />
            </button>
            <strong>{money(gross - redeemCoins * data.settings.coinValue)}</strong>
          </div>
          {cart.map((l, n) => {
            const p = data.products.find((p) => p.id === l.productId);
            return (
              <div className="cart-line" key={n}>
                <div>
                  <b>{p?.name || "Removed product"}</b>
                  <small>
                    {p?.options
                      .filter((o) => l.options.includes(o.id))
                      .map((o) => o.name)
                      .join(", ")}
                  </small>
                </div>
                <div className="stepper">
                  <button
                    disabled={pending}
                    aria-label={"Decrease " + p?.name}
                    onClick={() =>
                      setCart((prev) =>
                        prev
                          .map((l, i) =>
                            i === n ? { ...l, quantity: l.quantity - 1 } : l,
                          )
                          .filter((l) => l.quantity > 0),
                      )
                    }
                  >
                    <Minus size={15} />
                  </button>
                  <b>{l.quantity}</b>
                  <button
                    disabled={pending || l.quantity >= 30}
                    aria-label={"Increase " + p?.name}
                    onClick={() =>
                      setCart((prev) =>
                        prev.map((l, i) =>
                          i === n ? { ...l, quantity: l.quantity + 1 } : l,
                        ),
                      )
                    }
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            );
          })}
          <label>
            Anything we should know?
            <textarea
              maxLength={300}
              value={notes}
              disabled={pending}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Less sugar, please…"
            />
          </label>
          {data.customer && (
            <CoinWheel
                balance={data.customer.balance}
                coinValue={data.settings.coinValue}
                max={Math.min(
                  data.customer.balance,
                  Math.floor(
                    (gross * data.settings.maxDiscountPercent) /
                      100 /
                      data.settings.coinValue,
                  ),
                )}
                value={coins}
                disabled={pending}
                onChange={setCoins}
              />
          )}
          <div className="bill-total">
            <span>Total</span>
            <strong>{money(gross - redeemCoins * data.settings.coinValue)}</strong>
          </div>
          <p className="fine">
            You have {data.settings.cancellationSeconds} seconds to cancel after
            the server confirms. Payment is collected by staff.
          </p>
          {pending && (
            <div className="warning">
              An earlier submission is unresolved. Retry uses its exact saved
              cart, notes and coins to prevent a duplicate order.
            </div>
          )}
          {pending && (
            <button
              className="text-btn"
              onClick={() => {
                if (
                  confirm(
                    "Only discard if the café confirms this order was NOT saved. Otherwise retry first. Discard?",
                  )
                ) {
                  localStorage.removeItem("submission-" + tableId);
                  setPending(false);
                }
              }}
            >
              Discard failed submission after checking with staff
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}
function StaffView({ data, act }: { data: Snapshot; act: Action }) {
  const [tab, setTab] = useState("Orders"),
    [username, setUsername] = useState("owner"),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("ACTIVE"),
    [audio, setAudio] = useState(false),
    [now, setNow] = useState(Date.now()),
    [counter, setCounter] = useState(false),
    [gameEdit, setGameEdit] = useState<Game | Partial<Game> | null>(null),
    [productEdit, setProductEdit] = useState<Product | Partial<Product> | null>(
      null,
    ),
    [staffEdit, setStaffEdit] = useState<Partial<Staff> | null>(null);
  const audioRef = useRef<AudioContext | null>(null),
    known = useRef<Set<number>>(new Set());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const incoming = data.orders.filter((o) => o.status === "NEW");
    if (
      audio &&
      incoming.some((o) => !known.current.has(o.id)) &&
      audioRef.current
    ) {
      const ctx = audioRef.current;
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 740;
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
    known.current = new Set(incoming.map((o) => o.id));
  }, [data.orders, audio]);
  const safe = (p: Promise<unknown>) => void p.catch(() => {});
  if (!data.staff)
    return (
      <div className="login">
        <Brand />
        <div className="panel">
          <div className="eyebrow">SM CAFINITY · STAFF</div>
          <h1>Welcome back.</h1>
          <p>Sign in to your café workspace.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              void act("login", { username, password })
                .catch(() => {})
                .finally(() => setBusy(false));
            }}
          >
            <label>
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="wide" disabled={busy}>
              {busy ? "Signing in…" : "Open dashboard"}
              <ArrowUpRight size={17} />
            </button>
          </form>
          {data.demo && import.meta.env?.VITE_HOSTED_DEMO !== "true" && (
            <p className="fine">
              Demo owner: <code>owner / CafinityOwner!26</code>
              <br />
              Demo staff: <code>staff / CafinityStaff!26</code>
            </p>
          )}
        </div>
      </div>
    );
  const owner = data.staff.role === "owner",
    active = data.orders.filter(
      (o) => !["SERVED", "CANCELLED"].includes(o.status),
    ),
    newCount = active.filter((o) => o.status === "NEW").length;
  const nav = [
    { name: "Orders", icon: LayoutDashboard },
    { name: "Tables & Billing", icon: Receipt },
    { name: "Attendance", icon: Clock },
    { name: "Events", icon: Calendar },
    { name: "Ingredients", icon: Package },
    { name: "Games", icon: Gamepad2 },
    ...(owner
      ? [
          { name: "Menu", icon: Utensils },
          { name: "Analytics", icon: BarChart3 },
          { name: "Settings", icon: SettingsIcon },
        ]
      : []),
  ];
  return (
    <div className="staff-shell">
      <aside>
        <Brand />
        <div className="sidebar-label">CAFÉ WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.name}
              className={tab === n.name ? "active" : ""}
              onClick={() => setTab(n.name)}
            >
              <n.icon size={19} />
              {n.name === "Tables & Billing"
                ? "Tables & payments"
                : n.name === "Ingredients"
                  ? "Availability"
                  : n.name === "Menu"
                    ? "Products"
                    : n.name === "Analytics"
                      ? "Reports"
                      : n.name}
              {n.name === "Orders" && newCount > 0 && <b>{newCount}</b>}
              {n.name === "Events" && data.events.some(e=>e.status==="PENDING") && <b className="game-request-badge" aria-label="Pending event requests" role="status">{data.events.filter(e=>e.status==="PENDING").length}</b>}
              {n.name === "Games" && data.gameRequests.some(r=>r.status==="REQUESTED") && <b className="game-request-badge" aria-label="Pending game requests" role="status">{data.gameRequests.filter(r=>r.status==="REQUESTED").length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">{data.staff.name[0]}</span>
          <div>
            <b>{data.staff.name}</b>
            <small>{data.staff.role}</small>
          </div>
          <button
            className="icon-btn"
            aria-label="Sign out"
            onClick={() => safe(act("logout", {}))}
          >
            <LogOut size={18} />
          </button>
        </div>
        <div className="powered">
          Powered by <b>ATOMZ</b>
        </div>
      </aside>
      <div className="staff-main">
        <header>
          <div>
            <span className="eyebrow">SM CAFINITY / {tab.toUpperCase()}</span>
            <h1>{tab === "Orders" ? "Orders" : tab}</h1>
            <p>
              {tab === "Orders"
                ? "Start new orders, then mark them ready and served."
                : ""}
            </p>
          </div>
          <div className="staff-actions">
            <button
              className="secondary"
              onClick={() => {
                if (!audioRef.current) audioRef.current = new AudioContext();
                void audioRef.current.resume();
                setAudio(!audio);
              }}
            >
              <Bell size={17} />
              {audio ? "Alerts enabled" : "Enable Alerts"}
            </button>
            <button onClick={() => setCounter(true)}>
              <Plus size={17} /> Counter order
            </button>
          </div>
        </header>
        {tab === "Orders" && (
          <>
            <div className="stats">
              <Stat
                label="LIVE ORDERS"
                value={active.length}
                icon={<ShoppingBag />}
              />
              <Stat
                label="READY TO SERVE"
                value={active.filter((o) => o.status === "READY").length}
                icon={<CheckCircle2 />}
              />
              <Stat
                label="OPEN TABLES"
                value={data.bills.filter((b) => b.status === "OPEN").length}
                icon={<Armchair />}
              />
              <Stat
                label="OUTSTANDING"
                value={money(data.bills.reduce((n, b) => n + b.outstanding, 0))}
                icon={<Receipt />}
              />
            </div>
            {newCount > 0 && (
              <div className="incoming">
                <span className="pulse-dot" />
                <b>
                  {newCount} {newCount === 1 ? "order needs" : "orders need"}{" "}
                  your attention
                </b>
                <span>Start preparation to acknowledge.</span>
              </div>
            )}
            <div className="section-title">
              <h2>Current orders</h2>
              <div className="filter-tabs">
                {["ACTIVE", "SERVED", "CANCELLED"].map((f) => (
                  <button
                    key={f}
                    className={filter === f ? "active" : ""}
                    onClick={() => setFilter(f)}
                  >
                    {f === "ACTIVE"
                      ? "Live orders"
                      : f === "SERVED"
                        ? "Served"
                        : "Cancelled"}
                  </button>
                ))}
              </div>
            </div>
            <div className="order-grid">
              {data.orders
                .filter((o) =>
                  filter === "ACTIVE"
                    ? !["SERVED", "CANCELLED"].includes(o.status)
                    : o.status === filter,
                )
                .map((o) => (
                  <OrderCard
                    key={o.id}
                    o={o}
                    now={now}
                    bill={data.bills.find((b) => b.id === o.bill_id)}
                    act={act}
                  />
                ))}
            </div>
            {!data.orders.filter((o) =>
              filter === "ACTIVE"
                ? !["SERVED", "CANCELLED"].includes(o.status)
                : o.status === filter,
            ).length && (
              <Empty>
                All caught up. New orders will arrive here automatically.
              </Empty>
            )}
          </>
        )}
        {tab === "Tables & Billing" && <Billing data={data} act={act} />}
        {tab === "Attendance" && <AttendanceView data={data} act={act} />}
        {tab === "Events" && <EventsStaffView data={data} act={act} />}
        {tab === "Ingredients" && (
          <>
            <div className="section-title">
              <div>
                <h2>Ingredient availability</h2>
                <p>Availability only — no weighing or inventory counting.</p>
              </div>
              {owner && (
                <button
                  className="secondary"
                  onClick={() => {
                    const name = prompt("New ingredient name");
                    if (name) safe(act("ingredient-save", { name }));
                  }}
                >
                  <Plus size={16} /> Add ingredient
                </button>
              )}
            </div>
            <div className="ingredient-grid">
              {data.ingredients.map((i) => (
                <section className="panel ingredient-card" key={i.id}>
                  <div>
                    <Package size={24} />
                    <h2>{i.name}</h2>
                    <p>
                      {data.products
                        .filter((p) => p.ingredients.includes(i.id))
                        .map((p) => p.name)
                        .join(" · ") || "No linked products"}
                    </p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={!!i.available}
                    aria-label={i.name + " availability"}
                    className={"toggle " + (i.available ? "on" : "")}
                    onClick={() =>
                      safe(
                        act("ingredient", {
                          id: i.id,
                          available: !i.available,
                        }),
                      )
                    }
                  >
                    <span />
                    {i.available ? "Available" : "Out of stock"}
                  </button>
                  {owner && (
                    <button
                      className="text-btn"
                      onClick={() => {
                        const name = prompt("Ingredient name", i.name);
                        if (name)
                          safe(act("ingredient-save", { id: i.id, name }));
                      }}
                    >
                      Rename
                    </button>
                  )}
                </section>
              ))}
            </div>
            <h2 className="spaced">Individual product switches</h2>
            <div className="panel">
              {data.products.map((p) => (
                <div className="list-row" key={p.id}>
                  <span>
                    <b>{p.name}</b>
                    <small>
                      {p.orderable
                        ? "Orderable"
                        : !p.available
                          ? "Manually sold out"
                          : "Blocked by ingredient availability"}
                    </small>
                  </span>
                  <button
                    className="secondary"
                    onClick={() =>
                      safe(
                        act("product-toggle", {
                          id: p.id,
                          available: !p.available,
                        }),
                      )
                    }
                  >
                    {p.available ? "Mark sold out" : "Enable product"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "Games" && (
          <>
            <h2 className="spaced">Game requests · {data.gameRequests.filter(r=>r.status==="REQUESTED").length} waiting</h2>
            <div className="panel">
              {!data.gameRequests.length && <p>No requests yet.</p>}
              {[...data.gameRequests].sort((a,b)=>({REQUESTED:0,DELIVERED:1,RETURNED:2}[a.status]-{REQUESTED:0,DELIVERED:1,RETURNED:2}[b.status])||b.created_at-a.created_at||b.id-a.id).map((r) => (
                <div className={`list-row ${r.status==="REQUESTED"?"game-request-waiting":""}`} key={r.id}>
                  <span>
                    <b>
                      Table {r.table_id} · {r.name}
                    </b>
                    <small>{time(r.created_at)}</small>
                  </span>
                  <Pill status={r.status} />
                  {r.status !== "RETURNED" && (
                    <button
                      onClick={() =>
                        safe(
                          act("game-status", {
                            id: r.id,
                            status:
                              r.status === "REQUESTED"
                                ? "DELIVERED"
                                : "RETURNED",
                          }),
                        )
                      }
                    >
                      {r.status === "REQUESTED"
                        ? "Mark delivered"
                        : "Mark returned"}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="section-title">
              <h2>Games & requests</h2>
              <button
                onClick={() =>
                  setGameEdit({
                    name: "",
                    description: "",
                    image: "",
                    available: 1,
                    quantity_total: 1,
                  })
                }
              >
                <Plus size={16} /> Add game
              </button>
            </div>
            <div className="game-grid">
              {data.games.map((g, i) => (
                <article className="game-card" key={g.id}>
                  <div className={"game-art art-" + (i % 4)}>
                    {["✦", "♞", "▥", "●"][i % 4]}
                  </div>
                  <div>
                    <h2>{g.name}</h2>
                    <p>{g.description}</p>
                    <p>
                      <b>{g.available_count} of {g.quantity_total}</b> copies free
                      {g.in_use > 0 && ` · ${g.in_use} at tables`}
                    </p>
                    <button
                      className="secondary"
                      onClick={() =>
                        safe(act("game", { id: g.id, available: !g.available }))
                      }
                    >
                      {g.available
                        ? "Available · disable"
                        : "Unavailable · enable"}
                    </button>
                    <div className="inline-actions">
                      <button
                        className="text-btn"
                        onClick={() => setGameEdit(g)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-btn"
                        onClick={() => {
                          if (confirm("Remove " + g.name + " from the menu?"))
                            safe(act("game", { id: g.id, remove: true }));
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <h2 className="spaced">Your guests have ideas</h2>
            <div className="panel">
              {data.suggestions.length === 0 && (
                <p>Game recommendations will appear here.</p>
              )}
              {data.suggestions.map((g) => (
                <div className="list-row" key={g.normalized}>
                  <span>
                    <b>{g.name}</b>
                    <small>
                      {g.people} guests · {g.count} suggestions
                    </small>
                  </span>
                  {g.reviewed ? (
                    <Pill status="REVIEWED" />
                  ) : (
                    <button
                      className="secondary"
                      onClick={() =>
                        safe(act("review", { normalized: g.normalized }))
                      }
                    >
                      Mark reviewed
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "Menu" && (
          <>
            <div className="section-title">
              <h2>Products & customisation</h2>
              <button
                onClick={() =>
                  setProductEdit({
                    name: "",
                    description: "",
                    price: 0,
                    category_id: data.categories[0].id,
                    image: "",
                    ingredients: [],
                    options: [],
                  })
                }
              >
                <Plus size={16} /> Add product
              </button>
            </div>
            <div className="panel">
              {data.products.map((p) => (
                <div className="list-row" key={p.id}>
                  <img className="thumb" src={p.image} alt="" />
                  <span className="grow">
                    <b>{p.name}</b>
                    <small>
                      {
                        data.categories.find((c) => c.id === p.category_id)
                          ?.name
                      }{" "}
                      · {money(p.price)}
                    </small>
                  </span>
                  <Pill status={p.orderable ? "AVAILABLE" : "SOLD_OUT"} />
                  <button
                    className="secondary"
                    onClick={() => setProductEdit(p)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-btn"
                    onClick={() => {
                      if (
                        confirm(
                          "Remove " +
                            p.name +
                            "? Existing orders are preserved.",
                        )
                      )
                        safe(act("product", { id: p.id, remove: true }));
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="section-title spaced">
              <h2>Categories</h2>
              <button
                className="secondary"
                onClick={() => {
                  const name = prompt("Category name");
                  if (name) safe(act("category", { name }));
                }}
              >
                Add category
              </button>
            </div>
            {data.categories.map((c) => (
              <button
                className="secondary category-edit"
                key={c.id}
                onClick={() => {
                  const name = prompt("Rename category", c.name);
                  if (name) safe(act("category", { id: c.id, name }));
                }}
              >
                {c.name}
              </button>
            ))}
          </>
        )}
        {tab === "Analytics" && <Analytics data={data} />}
        {tab === "Settings" && (
          <>
            <SettingsForm value={data.settings} act={act} />
            <div className="section-title spaced">
              <h2>Team access</h2>
              <button
                className="secondary"
                onClick={() =>
                  setStaffEdit({
                    name: "",
                    username: "",
                    role: "staff",
                    active: 1,
                  })
                }
              >
                Add staff account
              </button>
            </div>
            <div className="panel">
              {data.staffAccounts.map((p) => (
                <div className="list-row" key={p.id}>
                  <span>
                    {p.name}
                    <small>
                      {p.username} · {p.role} ·{" "}
                      {p.active ? "Active" : "Disabled"}
                    </small>
                  </span>
                  <button className="secondary" onClick={() => setStaffEdit(p)}>
                    Edit access
                  </button>
                </div>
              ))}
            </div>
            <div className="section-title spaced">
              <h2>Activity trail</h2>
              <a className="button secondary" href="/qr">
                <QrCode size={17} /> Table QR codes
              </a>
            </div>
            <div className="panel audit">
              {data.audit.map((a) => (
                <div className="list-row" key={a.id}>
                  <span>
                    <b>{a.action.replaceAll("_", " ")}</b>
                    <small>
                      Record {a.entity} · Actor {a.actor} · {a.details}
                    </small>
                  </span>
                  <small>{time(a.created_at)}</small>
                </div>
              ))}
            </div>
            {data.demo && (
              <a className="button secondary spaced" href="/">
                Demo home & reset controls
              </a>
            )}
          </>
        )}
      </div>
      {counter && (
        <Counter data={data} act={act} close={() => setCounter(false)} />
      )}
      {gameEdit && (
        <GameForm value={gameEdit} act={act} close={() => setGameEdit(null)} />
      )}
      {productEdit && (
        <ProductForm
          value={productEdit}
          data={data}
          act={act}
          close={() => setProductEdit(null)}
        />
      )}
      {staffEdit && (
        <StaffForm
          value={staffEdit}
          act={act}
          close={() => setStaffEdit(null)}
        />
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="stat">
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
      <span>{icon}</span>
    </div>
  );
}
function OrderCard({
  o,
  now,
  bill,
  act,
}: {
  o: Order;
  now: number;
  bill?: Bill;
  act: Action;
}) {
  const [busy, setBusy] = useState(false);
  const next = nextStatus[o.status as keyof typeof nextStatus];
  const elapsed = (start: number, end: number = now) => {
    const seconds = Math.max(0, Math.floor((end - start) / 1000));
    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  };
  return (
    <article className={"order-card status-" + o.status.toLowerCase()}>
      <div className="order-head">
        <span className="table-number">
          {o.table_id ? String(o.table_id).padStart(2, "0") : "C"}
          <small>{o.table_id ? "TABLE" : "COUNTER"}</small>
        </span>
        <div>
          <b>Order #{o.id}</b>
          <small>
            <Clock size={12} />
            {time(o.created_at)}
          </small>
        </div>
        <Pill status={bill?.status === "OPEN" ? "UNPAID" : "PAID"} />
      </div>
      <div className="staff-ring-timers">
        {o.status !== "CANCELLED" && (
          <TimerRing
            value={elapsed(o.created_at, o.served_at || now)}
            label={o.status === "SERVED" ? "Total time" : "Since ordered"}
            running={!o.served_at}
          />
        )}
        {o.preparing_at && (
          <TimerRing
            value={elapsed(o.preparing_at, o.ready_at || now)}
            label={o.ready_at ? "Preparation" : "Preparing"}
            running={!o.ready_at}
          />
        )}{" "}
        {o.status === "READY" && o.ready_at && (
          <TimerRing value={elapsed(o.ready_at)} label="Awaiting pickup" />
        )}
      </div>
      <div className="order-items">
        {o.items.map((i) => (
          <div key={i.id}>
            <span className="qty">{i.quantity}</span>
            <span>
              <b>{i.name}</b>
              {JSON.parse(i.options).length > 0 && (
                <small>
                  {JSON.parse(i.options)
                    .map((x: { name: string }) => x.name)
                    .join(", ")}
                </small>
              )}
            </span>
          </div>
        ))}
      </div>
      {o.notes && <p className="order-note">“{o.notes}”</p>}
      <div className="order-total">
        <span>{money(o.total)}</span>
        <Pill status={o.status} />
      </div>
      {o.status === "CANCELLATION_PENDING" ? (
        <div className="hold">
          <Clock size={16} /> Hold ·{" "}
          {Math.max(0, Math.ceil((o.deadline - now) / 1000))}s · Do not prepare
        </div>
      ) : next ? (
        <button
          className="wide"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void act("status", { id: o.id, status: next })
              .catch(() => {})
              .finally(() => setBusy(false));
          }}
        >
          {o.status === "NEW"
            ? "Start Preparing"
            : o.status === "PREPARING"
              ? "Mark Ready"
              : "Mark Served"}{" "}
          <Check size={17} />
        </button>
      ) : null}
    </article>
  );
}
function Billing({ data, act }: { data: Snapshot; act: Action }) {
  const [selected, setSelected] = useState<number | null>(null),
    [pay, setPay] = useState(false),
    [method, setMethod] = useState("CASH"),
    [reference, setReference] = useState(""),
    [verified, setVerified] = useState(false),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(uid());
  const b = data.bills.find((b) => b.id === selected);
  const safe = (p: Promise<unknown>) => void p.catch(() => {});
  return (
    <>
      <div className="tables-grid">
        {data.tables.map((t) => {
          const v = data.bills.find(
            (b) => b.table_id === t.id && b.status !== "CLOSED",
          );
          return (
            <button
              className={"table-card " + (v ? "occupied" : "")}
              key={t.id}
              onClick={() => setSelected(v?.id ?? null)}
            >
              <Armchair />
              <b>Table {String(t.id).padStart(2, "0")}</b>
              <span>{v ? money(v.outstanding) : "Ready for guests"}</span>
              <small>{v?.status || "NO OPEN BILL"}</small>
            </button>
          );
        })}
      </div>
      <h2 className="spaced">All bills</h2>
      <div className="panel">
        {data.bills.length === 0 && (
          <p>
            No bills yet. Table and counter orders will open one automatically.
          </p>
        )}
        {data.bills.map((v) => (
          <button
            className="bill-list"
            key={v.id}
            onClick={() => setSelected(v.id)}
          >
            <span>
              <b>
                Bill #{v.id} · {v.table_id ? "Table " + v.table_id : "Counter"}
              </b>
              <small>
                {v.orders.length} orders · {money(v.outstanding)} outstanding
              </small>
            </span>
            <Pill status={v.status} />
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
      {b && (
        <Modal
          title={`Bill #${b.id} · ${b.table_id ? "Table " + b.table_id : "Counter"}`}
          close={() => setSelected(null)}
        >
          {b.orders.map((o) => (
            <div className="customer-order" key={o.id}>
              <div className="section-title">
                <b>Order #{o.id}</b>
                <Pill status={o.status} />
              </div>
              {o.items.map((i) => (
                <p key={i.id}>
                  {i.quantity} × {i.name}
                  <b>{money(i.quantity * i.unit_price)}</b>
                </p>
              ))}
            </div>
          ))}
          <div className="list-row">
            <span>Gross</span>
            <b>{money(b.gross)}</b>
          </div>
          <div className="list-row">
            <span>Coin discount</span>
            <b>−{money(b.discount)}</b>
          </div>
          <div className="bill-total">
            <span>Outstanding</span>
            <strong>{money(b.outstanding)}</strong>
          </div>
          {b.payments.map((p) => (
            <div className="panel" key={p.id}>
              <b>
                Payment #{p.id}: {money(p.amount)} · {p.method}
              </b>
              <p>
                {p.voided_at ? "VOIDED: " + p.void_reason : time(p.created_at)}
              </p>
              {data.staff?.role === "owner" && !p.voided_at && (
                <button
                  className="text-btn"
                  onClick={() => {
                    const reason = prompt(
                      "Reason for voiding this payment and reopening the bill. This reverses earned coins; reserved discounts stay attached for corrected payment.",
                    );
                    if (reason)
                      safe(
                        act(
                          "void",
                          { id: p.id, reason },
                          "Payment voided. Original record retained.",
                        ),
                      );
                  }}
                >
                  Correct / void payment
                </button>
              )}
            </div>
          ))}
          {b.status === "OPEN" && (
            <button
              className="wide"
              onClick={() => {
                setKey(uid());
                setPay(true);
                setVerified(false);
              }}
            >
              Record Payment
            </button>
          )}
          {b.status === "PAID" && (
            <button
              className="wide"
              onClick={() => safe(act("close", { id: b.id }, "Bill closed"))}
            >
              Close Bill
            </button>
          )}
          <p className="fine">
            Payment and food preparation are separate. Closing a paid bill does
            not change the kitchen queue.
          </p>
        </Modal>
      )}
      {pay && b && (
        <Modal title="Confirm received payment" close={() => setPay(false)}>
          <div className="bill-total">
            <span>Amount to collect</span>
            <strong>{money(b.outstanding)}</strong>
          </div>
          <label>
            Payment method
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="UPI">Manually verified UPI</option>
            </select>
          </label>
          {method === "UPI" && (
            <label>
              UPI transaction reference
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                minLength={4}
              />
            </label>
          )}
          <label className="check-row">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />
            I have verified that {money(b.outstanding)} was received.
          </label>
          <button
            disabled={!verified || busy}
            className="wide"
            onClick={() => {
              setBusy(true);
              void act(
                "payment",
                {
                  billId: b.id,
                  method,
                  reference,
                  verified,
                  amount: b.outstanding,
                  key,
                },
                "Payment recorded",
              )
                .then(() => setPay(false))
                .catch(() => {})
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Recording…" : "Confirm Payment"}
          </button>
        </Modal>
      )}
    </>
  );
}
function Counter({
  data,
  act,
  close,
}: {
  data: Snapshot;
  act: Action;
  close: () => void;
}) {
  const [tableId, setTable] = useState(""),
    [cart, setCart] = useState<Record<number, number>>({}),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [key] = useState(uid());
  return (
    <Modal title="New counter / table order" close={close}>
      <label>
        Destination
        <select value={tableId} onChange={(e) => setTable(e.target.value)}>
          <option value="">Counter / takeaway</option>
          {data.tables.map((t) => (
            <option key={t.id} value={t.id}>
              Table {t.id}
            </option>
          ))}
        </select>
      </label>
      {data.products.map((p) => (
        <div className="list-row" key={p.id}>
          <span>
            {p.name}
            <small>
              {money(p.price)} {p.orderable ? "" : "· Sold out"}
            </small>
          </span>
          <div className="stepper">
            <button
              aria-label={"Remove " + p.name}
              disabled={busy || !cart[p.id]}
              onClick={() =>
                setCart({ ...cart, [p.id]: (cart[p.id] || 0) - 1 })
              }
            >
              <Minus size={16} />
            </button>
            <b>{cart[p.id] || 0}</b>
            <button
              aria-label={"Add " + p.name}
              disabled={busy || !p.orderable}
              onClick={() =>
                setCart({
                  ...cart,
                  [p.id]: Math.min(30, (cart[p.id] || 0) + 1),
                })
              }
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      ))}
      <label>
        Notes
        <textarea
          value={notes}
          maxLength={300}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <p className="fine">
        This staff-confirmed order goes directly to the kitchen. Record cash or
        verified UPI in Tables & Billing.
      </p>
      <button
        className="wide"
        disabled={busy || !Object.values(cart).some((n) => n > 0)}
        onClick={() => {
          setBusy(true);
          void act(
            "counter",
            {
              tableId: tableId ? Number(tableId) : null,
              items: Object.entries(cart)
                .filter(([, q]) => q > 0)
                .map(([id, quantity]) => ({
                  productId: Number(id),
                  quantity,
                  options: [],
                })),
              notes,
              key,
            },
            "Counter order sent to kitchen",
          )
            .then(close)
            .catch(() => {})
            .finally(() => setBusy(false));
        }}
      >
        Confirm & send order
      </button>
    </Modal>
  );
}
function GameForm({
  value,
  act,
  close,
}: {
  value: Partial<Game>;
  act: Action;
  close: () => void;
}) {
  const [v, setV] = useState(value);
  return (
    <Modal title={value.id ? "Edit game" : "Add game"} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void act("game", v, "Game saved")
            .then(close)
            .catch(() => {});
        }}
      >
        <label>
          Name
          <input
            required
            maxLength={60}
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </label>
        <label>
          Description
          <textarea
            maxLength={200}
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
          />
        </label>
        <label>
          Image URL (HTTPS, optional)
          <input
            value={v.image}
            onChange={(e) => setV({ ...v, image: e.target.value })}
          />
        </label>
        <label>
          Number of physical copies
          <input
            type="number"
            min={1}
            max={50}
            required
            value={v.quantity_total ?? 1}
            onChange={(e) =>
              setV({ ...v, quantity_total: Number(e.target.value) })
            }
          />
        </label>
        <p className="fine">
          Requests wait in the queue. Delivered copies are assigned to their
          tables until staff marks them returned.
        </p>
        <button className="wide">Save game</button>
      </form>
    </Modal>
  );
}
function ProductForm({
  value,
  data,
  act,
  close,
}: {
  value: Partial<Product>;
  data: Snapshot;
  act: Action;
  close: () => void;
}) {
  const [v, setV] = useState(value),
    [options, setOptions] = useState(value.options || []),
    [err, setErr] = useState("");
  return (
    <Modal title={value.id ? "Edit product" : "Add product"} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const parsed = options;
            void act("product", { ...v, options: parsed }, "Menu saved")
              .then(close)
              .catch(() => {});
          } catch {
            setErr("Please check the product options");
          }
        }}
      >
        <label>
          Name
          <input
            required
            value={v.name}
            maxLength={100}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </label>
        <label>
          Category
          <select
            value={v.category_id}
            onChange={(e) =>
              setV({ ...v, category_id: Number(e.target.value) })
            }
          >
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Price (₹)
          <input
            required
            min={0}
            step="0.01"
            type="number"
            value={(v.price || 0) / 100}
            onChange={(e) =>
              setV({ ...v, price: Math.round(Number(e.target.value) * 100), compare_at_price: v.compare_at_price && v.compare_at_price > Math.round(Number(e.target.value) * 100) ? v.compare_at_price : null })
            }
          />
        </label>
        <label>
          Menu Priority / Manual Surplus Boost (0–50)
          <input
            type="number"
            min={0}
            max={50}
            value={v.priority || 0}
            onChange={(e) => setV({ ...v, priority: Number(e.target.value) })}
          />
          <small>Products with higher priority or surplus inventory are pushed up on the guest menu.</small>
        </label>
        {value.id && (v.price||0)<(value.price||0) && <label className="check-row sale-setting">
          <input type="checkbox" checked={!!v.compare_at_price} onChange={e=>setV({...v,compare_at_price:e.target.checked?value.price:null})}/>
          <span><b>Highlight this price drop</b><small>Show guests the previous price alongside the new one.</small><span className="sale-preview"><del>{money(value.price||0)}</del><strong>{money(v.price||0)}</strong></span></span>
        </label>}
        {v.compare_at_price && !((v.price||0)<(value.price||0)) && <label className="check-row sale-setting"><input type="checkbox" checked onChange={()=>setV({...v,compare_at_price:null})}/><span><b>Price drop is visible</b><small>Turn off to show only the current price.</small><span className="sale-preview"><del>{money(v.compare_at_price)}</del><strong>{money(v.price||0)}</strong></span></span></label>}
        <label>
          Description
          <textarea
            value={v.description}
            maxLength={300}
            onChange={(e) => setV({ ...v, description: e.target.value })}
          />
        </label>
        <label>
          Image URL (HTTPS or /images/)
          <input
            value={v.image}
            onChange={(e) => setV({ ...v, image: e.target.value })}
          />
        </label>
        <fieldset>
          <legend>Taste-pairing suggestion</legend>
          <label>
            Matching product
            <select
              value={v.pairing_product_id || 0}
              onChange={(e) =>
                setV({
                  ...v,
                  pairing_product_id: Number(e.target.value) || null,
                })
              }
            >
              <option value={0}>No pairing suggestion</option>
              {data.products
                .filter((p) => p.id !== v.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          {v.pairing_product_id ? (
            <label>
              Why they taste good together
              <textarea
                maxLength={240}
                required
                value={v.pairing_reason || ""}
                placeholder="Its bold coffee flavour pairs with something buttery and sweet."
                onChange={(e) =>
                  setV({ ...v, pairing_reason: e.target.value })
                }
              />
            </label>
          ) : null}
        </fieldset>
        <fieldset>
          <legend>Required ingredients</legend>
          {data.ingredients.map((i) => (
            <label className="check-row" key={i.id}>
              <input
                type="checkbox"
                checked={v.ingredients?.includes(i.id) || false}
                onChange={(e) =>
                  setV({
                    ...v,
                    ingredients: e.target.checked
                      ? [...(v.ingredients || []), i.id]
                      : (v.ingredients || []).filter((n) => n !== i.id),
                  })
                }
              />
              {i.name}
            </label>
          ))}
        </fieldset>
        <fieldset className="option-editor">
          <legend>Customise this product</legend>
          <p>
            Offer choices such as size or milk, and optional extras. Prices
            below are added to the base price.
          </p>
          {options.map((option, index) => (
            <div className="option-row" key={option.id}>
              <label>
                Option name
                <input
                  required
                  maxLength={70}
                  placeholder="Extra shot"
                  value={option.name}
                  onChange={(e) =>
                    setOptions(
                      options.map((o, i) =>
                        i === index ? { ...o, name: e.target.value } : o,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Choice group
                <input
                  required
                  maxLength={40}
                  placeholder="Size, Milk, or Add-ons"
                  value={option.group}
                  onChange={(e) =>
                    setOptions(
                      options.map((o, i) =>
                        i === index ? { ...o, group: e.target.value } : o,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Extra price (₹)
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                  required
                  value={option.price / 100}
                  onChange={(e) =>
                    setOptions(
                      options.map((o, i) =>
                        i === index
                          ? {
                              ...o,
                              price: Math.round(Number(e.target.value) * 100),
                            }
                          : o,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="text-btn"
                onClick={() =>
                  setOptions(options.filter((_, i) => i !== index))
                }
              >
                Remove option
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={options.length >= 12}
            onClick={() =>
              setOptions([
                ...options,
                {
                  id: uid().slice(0, 20),
                  name: "",
                  group: "Add-ons",
                  price: 0,
                },
              ])
            }
          >
            <Plus size={16} /> Add a choice or extra
          </button>
          <p className="fine">
            Customers can choose one option per named group, or several options
            in Add-ons.
          </p>
        </fieldset>
        {err && <p>{err}</p>}
        <button className="wide">Save product</button>
      </form>
    </Modal>
  );
}
function StaffForm({
  value,
  act,
  close,
}: {
  value: Partial<Staff>;
  act: Action;
  close: () => void;
}) {
  const [v, setV] = useState({ ...value, password: "" });
  return (
    <Modal title="Staff access" close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void act("staff", v, "Staff account saved")
            .then(close)
            .catch(() => {});
        }}
      >
        <label>
          Display name
          <input
            required
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </label>
        <label>
          Username
          <input
            required
            value={v.username}
            onChange={(e) => setV({ ...v, username: e.target.value })}
          />
        </label>
        <label>
          Password {v.id ? "(blank keeps current)" : ""}
          <input
            type="password"
            required={!v.id}
            minLength={10}
            value={v.password}
            onChange={(e) => setV({ ...v, password: e.target.value })}
          />
        </label>
        <label>
          Role
          <select
            value={v.role}
            onChange={(e) =>
              setV({ ...v, role: e.target.value as "owner" | "staff" })
            }
          >
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={!!v.active}
            onChange={(e) => setV({ ...v, active: e.target.checked ? 1 : 0 })}
          />
          Active account
        </label>
        <button className="wide">Save access</button>
      </form>
    </Modal>
  );
}
function SettingsForm({ value, act }: { value: Settings; act: Action }) {
  const [v, setV] = useState(value);
  type NumberSetting = "tableCount" | "cancellationSeconds" | "earnCoins" | "earnPer" | "coinValue" | "maxDiscountPercent" | "suggestionCoins" | "cooldownDays";
  const fields: {
    key: NumberSetting;
    label: string;
    min: number;
    max: number;
  }[] = [
    { key: "tableCount", label: "Active tables", min: 1, max: 50 },
    {
      key: "cancellationSeconds",
      label: "Cancellation window (seconds)",
      min: 1,
      max: 60,
    },
    {
      key: "earnCoins",
      label: "Coins earned per qualifying spend",
      min: 0,
      max: 100,
    },
    {
      key: "earnPer",
      label: "Qualifying spend (paise; 10000 = ₹100)",
      min: 100,
      max: 100000,
    },
    {
      key: "coinValue",
      label: "One coin value (paise; 100 = ₹1)",
      min: 1,
      max: 10000,
    },
    {
      key: "maxDiscountPercent",
      label: "Maximum redemption (%)",
      min: 0,
      max: 100,
    },
    {
      key: "suggestionCoins",
      label: "Game suggestion bonus coins",
      min: 0,
      max: 100,
    },
    {
      key: "cooldownDays",
      label: "Suggestion reward cooldown (days)",
      min: 1,
      max: 365,
    },
  ];
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        void act("settings", v, "Café settings saved").catch(() => {});
      }}
    >
      <h2>Your café, your rules</h2>
      <div className="form-grid">
        <label>
          Café name
          <input
            value={v.cafeName}
            onChange={(e) => setV({ ...v, cafeName: e.target.value })}
          />
        </label>
        {fields.map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              type="number"
              min={f.min}
              max={f.max}
              required
              value={v[f.key]}
              onChange={(e) => setV({ ...v, [f.key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <div style={{ margin: "18px 0" }}>
        <label className="check-row">
          <input
            type="checkbox"
            checked={v.smartInventory ?? true}
            onChange={(e) => setV({ ...v, smartInventory: e.target.checked })}
          />
          <div>
            <b>Smart Dynamic Inventory Menu Promotion</b>
            <small>Automatically balances café inventory by promoting products with surplus ingredients and lower recent sales.</small>
          </div>
        </label>
      </div>
      <button>Save settings</button>
    </form>
  );
}
function Analytics({ data }: { data: Snapshot }) {
  const [period, setPeriod] = useState("week"),
    [r, setR] = useState<Report | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    void api<Report>("report?period=" + period)
      .then(setR)
      .catch((e) => setError(e.message));
  }, [period, data.now]);
  return (
    <>
      <div className="section-title">
        <div>
          <h2>Sales overview</h2>
          <p>Paid, non-voided sales · Asia/Kolkata</p>
        </div>
        <div className="inline-actions">
          <select
            aria-label="Reporting period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <a
            className="button"
            href={"/api/export?scope=staff&period=" + period}
          >
            Download CSV
          </a>
        </div>
      </div>
      {error && <p>{error}</p>}
      {r && (
        <>
          <div className="stats">
            <Stat
              label="COMPLETED SALES"
              value={money(r.sales)}
              icon={<BarChart3 />}
            />
            <Stat label="PAID ORDERS" value={r.paidOrders} icon={<Receipt />} />
            <Stat
              label="AVERAGE PAID ORDER"
              value={money(r.average)}
              icon={<Coins />}
            />
            <Stat
              label="PAYMENT CORRECTIONS"
              value={r.refunds.length}
              icon={<RefreshCw />}
            />
          </div>
          <div className="analytics-grid">
            <section className="panel">
              <h2>On the favourites list</h2>
              <p>Product quantities sold</p>
              {!r.products.length && (
                <Empty>Paid orders will build your first report.</Empty>
              )}
              {r.products.map((p) => (
                <div className="bar-row" key={p.name}>
                  <div>
                    <b>{p.name}</b>
                    <span>{p.quantity}</span>
                  </div>
                  <div className="bar">
                    <span
                      style={{
                        width:
                          (p.quantity /
                            Math.max(...r.products.map((p) => p.quantity))) *
                            100 +
                          "%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </section>
            <section className="panel">
              <h2>Ingredient demand</h2>
              <p>
                Estimated from current product links, not stock consumption.
              </p>
              {r.ingredients.map((i) => (
                <div className="list-row" key={i.name}>
                  <b>{i.name}</b>
                  <span>{i.quantity} sold product servings</span>
                </div>
              ))}
            </section>
            <section className="panel">
              <h2>Most requested games</h2>
              {r.games.map((g) => (
                <div className="list-row" key={g.name}>
                  <span>{g.name}</span>
                  <b>{g.quantity}</b>
                </div>
              ))}
            </section>
            <section className="panel">
              <h2>Game recommendations</h2>
              {data.suggestions.map((g) => (
                <div className="list-row" key={g.normalized}>
                  <span>{g.name}</span>
                  <b>{g.people} guests</b>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </>
  );
}
function QRPage({ data }: { data: Snapshot }) {
  const [base, setBase] = useState(location.origin),
    [images, setImages] = useState<
      { id: number; url: string; image: string }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    try {
      const u = new URL(base);
      if (!["http:", "https:"].includes(u.protocol)) return;
      void Promise.all(
        data.tables.map(async (t) => {
          const url = `${u.origin}/menu?table=${t.id}&key=${t.token}`;
          return {
            id: t.id,
            url,
            image: await QRCode.toDataURL(url, {
              width: 240,
              margin: 1,
              errorCorrectionLevel: "M",
            }),
          };
        }),
      )
        .then(setImages)
        .catch((e) => setError(e.message));
    } catch {
      setError("Enter a valid base URL");
    }
  }, [base, data.tables.length]);
  return (
    <div className="qr-page">
      <div className="no-print">
        <a href="/" className="text-btn">
          <ArrowLeft size={16} /> Back to demo
        </a>
        <h1>A seat at the table.</h1>
        <p>
          Use the laptop’s LAN address for phones on the same Wi-Fi. localhost
          only works on this computer.
        </p>
        <label>
          Website base URL
          <input
            value={base}
            onChange={(e) => {
              setError("");
              setBase(e.target.value);
            }}
          />
        </label>
        <button onClick={() => window.print()}>Print table cards</button>
        {error && <p>{error}</p>}
      </div>
      <div className="qr-grid">
        {images.map((t) => (
          <section key={t.id}>
            <Brand />
            <h2>Table {String(t.id).padStart(2, "0")}</h2>
            <p>Scan. Settle in. Enjoy.</p>
            <img src={t.image} alt={"Table " + t.id + " QR code"} />
            <small>Menu · Games · Rewards</small>
            <a href={t.url}>Open Table {t.id}</a>
            <p className="fine">Powered by ATOMZ</p>
          </section>
        ))}
      </div>
    </div>
  );
}
