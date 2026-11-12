# Deployment status and next steps

## Delivered deployment: local Node + SQLite demo

The included compiled frontend and Node server can run on the café computer, with customers reaching its LAN address. This is intended for demonstration, not an approved public production deployment. Current local URLs use HTTP. They do not provide encrypted public access.

## Cloudflare Pages compatibility

`npm run build` produces a static `dist/` directory suitable for Cloudflare Pages assets. It includes SPA redirects. **Uploading dist alone does not provide a functional café system**: `/api/*` still needs the shared backend. Cloudflare Pages cannot directly run this Node SQLite server on its filesystem.

Two future hosted options:

1. A single small Node host with persistent disk, serving frontend and API on one HTTPS origin. Configure TLS/reverse proxy, secure cookies, process restart, backups and health checks; disable demo accounts/reset and change credentials. SSE proxy buffering must be off and timeouts must support long-lived streams.
2. Supabase PostgreSQL/Auth/Realtime, as requested for hosted production. Port transactional handlers into audited SQL/RPC or server functions, replace SQLite-specific statements, add RLS, connect verified customer OTP, and repeat the full integrity suite. That adapter and PostgreSQL deployment have **not** been implemented or validated. SQLite migration files are not directly deployable to Supabase.

The same-origin API boundary keeps either change limited to the backend and transport layer. Do not expose a Supabase service-role secret in browser variables.

## Production acceptance gates still open

- Real phone/laptop synchronization on café Wi-Fi and across reconnects.
- Browser rendering at 390 px mobile and the actual staff monitor; QR scanning on hardware.
- Measured page usability and end-to-end actionable-order latency.
- HTTPS, secure-cookie/session hardening, provider-backed customer identity and password recovery.
- Actual café menu, photography, taxes/receipt requirements and owner-approved reward/refund policies.
- Independent authorization/security review, real-network load testing, backup/restore and crash tests.
- Data retention, session expiry cleanup, privacy handling and operational monitoring.

No claim of production readiness is made by this delivery.
