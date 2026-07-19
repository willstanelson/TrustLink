# Architecture Decisions: Bendansalet Marketplace

This document captures the key architectural design decisions, compliance rules, and security frameworks established during the integration of the **Bendansalet** Trust Marketplace into the **Macqet Portal**.

---

## 1. Single Profiles Identity vs. Separate Vendor Profiles

### Context
Vendors on TrustLink shouldn't have fragmented identities across the platform. A vendor who also participates in P2P escrow should retain a single trust reputation history.

### Decision
We **extend** the existing `profiles` table rather than creating a separate `vendors` table.
- Added columns like `is_vendor`, `vendor_category`, `vendor_subcategory`, `location_lat`, `location_lng`, etc.
- Prevents database fragmentation.
- Single source of truth for calculations of Bayesian success rates, clean streaks, and lifetime statistics.

---

## 2. Escrow Order Re-use (`MARKETPLACE_ORDER`)

### Context
A marketplace negotiation must culminate in a secure transaction handled via on-chain or off-chain escrow.

### Decision
We reuse the existing `escrow_orders` schema by introducing a new `trade_type` value: `'MARKETPLACE_ORDER'`.
- Avoids the duplication of order creation, tracking, status checking, Paystack verification, and dispute resolution logic.
- Integrates seamlessly with the existing `release_escrow_and_update_reputation` RPC, which already operates purely on order status (`locked`, `code_revealed`, etc.) and automatically increments the lifetime counters.

---

## 3. Strict Vendor Search Security & Safe Serialization

### Context
TrustLink profiles contain highly sensitive banking details (bank name, account number, bank code, account name). These must **never** be exposed in public searches or lookup views.

### Decision
We isolate security-sensitive data via an allowlist-only approach:
1. Database query optimization: using explicit column selections (`VENDOR_SELECT_CLAUSE`) instead of wildcard selections.
2. In-memory serialization: implementing a shared serializer function (`serializeVendorProfile`) that strictly maps to public fields and strips out any adjacent data before returning JSON responses.
3. Decoupling search lookup routes: public search uses `/api/vendor/lookup` instead of `/api/profile/lookup`.

---

## 4. Virtual NIN (vNIN) for Identity Verification (NDPA Compliance)

### Context
NIMC policy requires verifying users using tokenized identity verification (Virtual NIN or vNIN) instead of collecting raw 11-digit National Identification Numbers. Additionally, the Nigeria Data Protection Act (NDPA) mandates strict data minimization.

### Decision
We configure Dojah NIN verification to strictly require the 16-character alphanumeric vNIN token.
1. The user generates a vNIN token via NIMC mobile app or USSD (*346*3*NIN*OTP#) valid for 72 hours.
2. The verify endpoint hits Dojah's `/api/v1/kyc/vnin` using the token.
3. **compliance**: The vNIN token is used only for the API call and is **never** saved to the database. Only the Dojah transaction reference is stored for auditing. The `profiles` row is simply flag-updated to `nin_verified: true`.

---

## 5. CAC Registration as an Optional Badging Tier

### Context
Ensuring a low friction onboarding experience for casual vendors while still supporting commercial/corporate vendor trust badges.

### Decision
CAC corporate lookup (using Dojah `/api/v1/kyc/cac/basic`) is configured as an **optional, additive tier** in the onboarding flow.
- A vendor can register and list services immediately after vNIN verification.
- CAC is handled as a separate verification step that awards a `CAC Badged` indicator on successful validation, without acting as a gatekeeper.

---

## 6. Real-Time Proximity Geo-Ranking (Haversine Formula)

### Context
Buyers looking for services (like cash out, physical logistics, or local delivery) need proximity sorting. However, storing fixed geo-distance fields in static tables is impractical.

### Decision
Proximity is calculated dynamically at query-time using the **Haversine Formula**.
- Buyer coordinates are sent as optional query parameters `lat` & `lng`.
- Proximity ranking is blended with trust score calculations: `70% trust score + 30% geo-proximity`.
- Absolute distance is displayed, but is not cached or stored permanently to respect privacy.

---

## 7. Rating Storage vs. Counter Integration

### Context
The rating endpoint `/api/marketplace/rate` must record 1-5 stars and feedback comments for completed orders. However, updating trust volumes or transaction counts in parallel could lead to double-counting.

### Decision
The rating handler inserts ratings into the `ratings` table but does **not** update transaction counters.
- The `release_escrow_and_update_reputation` RPC already updates `lifetime_completed_tx` and `lifetime_volume_usd` atomically upon release.
- Rating records are kept independent for future average calculations or as weighted scoring factors, preventing double-counting.

---

## 8. Atomic Request Acceptance via Postgres RPC

### Context
When a vendor accepts a request, a matching escrow order must be created, and the request status must transition to `accepted` in unison. Doing this sequentially via Node.js can leave requests in an orphaned accepted state if the order insert fails.

### Decision
Acceptance and order creation are executed atomically inside a dedicated PL/pgSQL function: `accept_request_and_create_order`.
- Handled as a single database transaction.
- Ensures consistency, transaction rollback on failure, and avoids race conditions.
