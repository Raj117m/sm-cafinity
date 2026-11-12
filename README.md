# SM Cafinity × ATOMZ

A local-first café demonstration with a React/TypeScript frontend and one Node.js + SQLite backend. Orders, payments and loyalty live in SQLite, not browser storage. Customer and staff views share this backend through real HTTP endpoints and server-sent events.

## Run the included compiled app

Requires **Node.js 22.13+** (validated with Node 26.13).

- macOS: double-click `Start-Cafinity.command`, or run `node backend/server.mjs` from this folder.
- Windows: double-click `Start-Cafinity.bat` after installing Node.
- No npm installation is necessary to run the included `dist/` frontend and backend: the server uses Node built-ins only.

After the server starts:

| View | Address |
|---|---|
| Demo home | http://localhost:4173/ |
| Staff | http://localhost:4173/staff |
| QR cards | http://localhost:4173/qr |
| Phone | Use the **LAN address printed by the server**, e.g. http://192.168.1.20:4173/ |

The laptop must stay awake, the terminal must remain open, and both devices must use the same reachable network. Never enter `localhost` on the phone to reach the laptop. Guest Wi-Fi client isolation or a firewall can block access.

## Demo credentials

| Role | Username | Password |
|---|---|---|
| Owner | owner | CafinityOwner!26 |
| Staff | staff | CafinityStaff!26 |

Customer Rewards offers **Aarav** and **Diya**, explicitly labelled test accounts. No SMS or real phone authentication is implemented. Staff and customer browser cookies are separate, so both views can be used in separate tabs without logging each other out.

## Implemented

- Table selector and controlled per-table links; printable QR cards.
- Configurable menu, categories, ingredients, product links, options and prices.
- Authoritative paise pricing, saved orders, persistent idempotency, server cancellation deadlines.
- Kitchen status progression, pending holds, alerts, live invalidation and reconnect snapshots.
- Ingredient cascading availability and independent product switches.
- Game management, requests, delivery/return and grouped recommendations.
- Table bills, counter entry, manually verified cash/UPI, separate payment/preparation states.
- Payment correction history and matching loyalty-credit reversal.
- Optional demo loyalty, atomic coin reservations, cancellation restoration and suggestion cooldown.
- Owner-only sales reports, quantity tallies, estimated ingredient demand and CSV export.
- Role checks, HTTP-only sessions, basic rate limits, transaction boundaries and audit records.

## Validation status — read before demonstrating

`docs/qa-report.md` and `docs/performance-results.json` describe measured checks. The build compiles and the in-process API/database and DOM integration tests run against the actual backend code. The execution environment denied local listening sockets (`EPERM`), so **the app was not launched here, real browser rendering was not verified, and physical phone-to-laptop synchronization was not tested**. These remain acceptance checks on your Mac. This is not a production-readiness claim.

Demo menu images are locally bundled illustrations, not confirmed café photography. No external image/font network is needed.

## Develop

```sh
npm ci
npm run build
npm start
# Optional hot reload, second terminal while backend runs:
npm run dev
# Automated checks:
npm test
npm run test:load
```

Open this folder in Antigravity to continue development; no Antigravity agent or CLI was used during this build. `docs/demo-checklist.md` contains the exact presentation clicks. See `docs/setup.md`, `docs/architecture.md`, `docs/deployment.md`, and `docs/known-limitations.md`.
