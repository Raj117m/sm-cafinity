# Local setup and configuration

## Fastest route

Run `node backend/server.mjs` in this directory. The included `dist/` is already compiled. macOS and Windows launchers are included. Node 22.13+ is required. The backend uses no external runtime packages.

Default port: 4173. It prints both localhost and available IPv4 network addresses. Open `/` to choose a table, `/staff` for the team, and `/qr` for printable cards. Tokens are persisted in SQLite and included automatically in demo links. NFC tags should contain the exact generated table URL.

For phone use, connect both devices to the same Wi-Fi, keep the laptop awake and permit local network access if the operating system asks. Guest networks often isolate devices. Use the LAN address printed by the server. This network path has not been verified in the build environment.

## Source editing

Open this folder in Antigravity. Run `npm ci`, then `npm run build`. For hot reload, run `npm start` and `npm run dev` in two terminals. Vite proxies API requests to the Node backend. No credentials for Supabase were supplied; no Supabase adapter is active.

The build environment blocked package network access; validation used existing compatible packages on the Mac. A fresh `npm ci` on an unrestricted machine is an outstanding reproducibility check. The prebuilt app needs no install.

## Variables

Copy `.env.example` to `.env` if needed, then use `node --env-file=.env backend/server.mjs`.

| Variable | Default | Meaning |
|---|---|---|
| PORT | 4173 | HTTP listen port |
| DATABASE_PATH | data/cafe.sqlite | Persistent SQLite location |
| DEMO_MODE | true | Enables test customer sign-in and confirmed reset |
| OWNER_PASSWORD | CafinityOwner!26 | Initial owner seed password only |
| STAFF_PASSWORD | CafinityStaff!26 | Initial staff seed password only |
| COOKIE_SECURE | false | Set true only behind HTTPS |

Changing seed environment passwords does not alter existing accounts. Owner Settings edits existing staff access. Demo credentials are intentionally visible in the demo login screen and must never be used for a public real-customer deployment.

## Data and backup

The database is created automatically on first start. Stop the process before copying `data/cafe.sqlite`; for live backups use SQLite's supported backup mechanism including WAL consistency. Do not delete the live database to reset a demonstration. Owner home → Reset Demo Data requires typing RESET DEMO and only clears transactional demo data, restoring balances and availability. Menu edits/accounts remain.

## Tests

`npm test` runs in-process API/database tests and React DOM integration tests. `npm run test:load` runs 30 independent cookie sessions through the actual request listener and writes `docs/performance-results.json`. Neither opens network sockets.
