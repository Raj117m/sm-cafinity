# Architecture

## One source of truth

`src/` contains the Vite/React/TypeScript interface. `backend/server.mjs` binds to 0.0.0.0 and serves `dist/` plus `/api/*`. `backend/app.mjs` owns authorization, validation, state transitions and transactions. `backend/store.mjs` initializes SQLite WAL and seed records. Node's built-in SQLite eliminates runtime package installation for the bundled app.

SQLite persists under `data/cafe.sqlite`. Every multi-record mutation is enclosed in `BEGIN IMMEDIATE / COMMIT / ROLLBACK`. All money is integer paise. Frontend currency formatting does not determine charged amounts.

## Relational schema

`backend/migrations/001_initial.sql` creates settings, controlled table links, categories, products, ingredients, dependency links, staff roles and profiles, customers, sessions, table bills, bill access, orders, item snapshots, payments, loyalty ledger, redemptions, games, requests, suggestions and audit events. Foreign keys, checks, uniqueness and indexes are present. Migration 1 is recorded in `schema_migrations`. This initial migration is idempotent; future ALTER migrations must be explicitly versioned before rollout.

## Ordering and cancellation

A guest must possess a valid table token. Demo mode deliberately publishes table links for easy selection; a URL is never treated as proof of physical presence. Staff acknowledge NEW orders by starting preparation. Basic IP request limits apply.

Order creation stores the exact server price and selected option snapshots. `(session_token, idempotency_key)` is unique; reuse with a different request returns a conflict. The browser stores the exact unresolved submission until acknowledgement, enabling safe retries after refresh. This is the only order-related browser persistence apart from the draft cart; orders themselves are in SQLite.

The database stores `CANCELLATION_PENDING` and an absolute deadline. A 200 ms server loop releases eligible orders to `NEW`. Every API request also performs deadline-aware release, recovering after process sleep or restart. Cancellation compares current server time, independent of browser time. The UI's countdown is informational.

Allowed flow: CANCELLATION_PENDING → NEW → PREPARING → READY → SERVED, or CANCELLATION_PENDING → CANCELLED before deadline. Counter orders start at NEW.

## Real-time recovery

SSE carries only an invalidation event, no private records. Clients request an authorized snapshot when notified and when reconnecting. Heartbeats occur every 15 seconds. `EventSource` automatically reconnects; missed events do not mean missed orders because snapshots are authoritative. The latest issued snapshot request wins in the UI to avoid older requests overwriting new state.

## Identity and access

Guest/customer and staff sessions use different HTTP-only cookies. Owner/staff passwords use salted scrypt hashes. Server checks active staff and role on every privileged operation; hiding a tab is not the authorization mechanism. Sessions expire after 24 hours.

A guest sees their own order history. Creating an order grants access to its shared table bill; the shared bill hides other customers' identities and notes. Scanning a table URL alone does not grant its bill history. Staff can see all operational bills. Customer balances and ledgers are returned only for the current customer session. Test sign-in explicitly selects a synthetic demo account and is disabled when DEMO_MODE=false.

## Billing and rewards

One OPEN bill exists per table. Further orders join it; once paid, new orders create a new open bill. Preparation and payment status are independent. Fully paid bills may be closed even while preparation continues. A closed bill cannot accept new orders.

Version 1 accepts a single full verified payment per bill. Partial payments are disabled. Cash and manually verified UPI are supported. The submitted amount must equal the latest outstanding amount. Payment keys are unique and checked against a request fingerprint.

Coin redemption is selected by the customer at checkout. Coins are reserved with an immediate negative ledger entry in the order transaction. Cancellation returns the reservation exactly once. This prevents two sessions from spending the same balance. Payment marks reservations applied. Earned coins use the sum of that customer's eligible net purchases on the bill: floor(net paid / qualifying spend) × earn rate. Another customer's purchases are not included. New earned coins never fund that same bill's already-reserved discount.

Owner payment correction keeps the original record with void timestamp/reason, reopens the bill and reverses its earned credits. Its discounts remain reserved for corrected payment. Negative balances can result if previously earned coins were spent before a correction; no further redemption is possible until sufficient balance is restored. This is a payment-correction workflow, not cash-out or item-refund processing.

## Reports

Period boundaries use Asia/Kolkata and Monday-start weeks. Reports tally paid non-cancelled product quantities and exclude voided receipts. Discounts are proportionally allocated to item rows with integer rounding; the last line absorbs the remainder so CSV net amounts sum exactly to payment totals. Voided rows carry zero net paid. Payment corrections are separately counted. Ingredient demand uses current dependency links, labelled servings rather than physical stock units.
