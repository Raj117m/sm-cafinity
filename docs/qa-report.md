# Validation report

## Tested

- TypeScript typecheck and Vite frontend build.
- 22 backend integration test groups exercising the actual HTTP handler and SQLite transactions without sockets.
- 3 React DOM integration tests against that backend: the ₹520 customer order/cancellation journey; test loyalty/suggestion and ingredient disabling; staff authentication/counter entry/payment.
- 30 independent cookie sessions with file-backed SQLite; all orders persisted, idempotent retries made no duplicates, actionable events fired and reconnect snapshots recovered a missed order.

Backend coverage includes table validation, quantity/price validation, price options, empty carts, unauthorized staff access, cross-session privacy, cancellation deadlines, valid preparation transitions, ingredient cascading, product overrides, games CRUD/status, suggestion deduplication/cooldown, concurrent redemption, verified payment totals, duplicate payment/reward prevention, account deactivation, reward reversal, atomic rollback, CSV permission checks, period boundaries, persistence after reopening the database, and explicit demo-reset authorization.

## Measured simulation

See `performance-results.json` for raw results and scope. The recorded 30-session run measured:

| Metric | p95 | Maximum |
|---|---:|---:|
| Menu request handler | 19.12 ms | 21.03 ms |
| Order request handler | 21.87 ms | 22.01 ms |
| Actionable event after cancellation deadline | 127 ms | 128 ms |
| SQLite status query | 0.12 ms | 1.86 ms |

These measurements exclude network transit, browser rendering, Wi-Fi, mobile hardware and SMS. They do not establish the requested end-to-end 2-second targets.

## Not tested / blocked

The managed execution environment returned `listen EPERM: operation not permitted 0.0.0.0:4173`. Consequently the live app was not launched here. Physical phone/laptop synchronization, real browser rendering, alert audio, camera QR scanning, network reconnection and HTTPS deployment remain unverified.

Dependency registry access was unavailable. Builds used compatible installed dependencies copied from the pre-existing project. A fresh npm install on a clean machine is not validated. The included compiled app runs with Node built-ins and needs no npm installation.

## Delivery status

Implemented and tested within the above limits: local demo backend and principal customer/staff workflows. Not a complete production release. Read `known-limitations.md` for explicit scope gaps, including hosted Supabase/OTP, photography, partial/refund handling and the separate counter-payment step.
