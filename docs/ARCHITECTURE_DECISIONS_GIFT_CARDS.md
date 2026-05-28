# TrustLink Software Firm: Gift Card Escrow Architecture Decisions

**Date:** May 2026
**Component:** `/api/giftcard/create` & Postgres Database Schema
**Context:** This document captures the security, cryptographic, and architectural decisions made during the hardening of the Gift Card escrow creation pipeline.

## 1. Cryptographic Hashes (Duplicate Detection)
**Decision:** Implement `HMAC-SHA256` instead of bare `SHA-256`.
**Reasoning:** Gift card codes often have low entropy (12-16 characters). A bare SHA-256 hash is highly susceptible to rainbow table attacks if the database is ever compromised. By using `crypto.createHmac` with a secure server-side `GIFT_CARD_HASH_SECRET`, the hashes become computationally irreversible, protecting the raw gift card codes even in the event of a read-only database leak.

## 2. Race Condition Prevention (TOCTOU)
**Decision:** Enforce duplicate checks at both the Application layer and the Database layer.
**Reasoning:** To prevent "Time-of-Check to Time-of-Use" (TOCTOU) race conditions where two simultaneous network requests attempt to escrow the same card, the database enforces a `UNIQUE` index on the `gc_code_hash`. The application gracefully catches the Postgres `23505` error and surfaces it as a standard Validation Error, rather than throwing an unhandled 500 Server Error.

## 3. The Partial Unique Index
**Decision:** Use a partial unique index (`WHERE status NOT IN ('cancelled', 'refunded')`) rather than a strict global unique index.
**Reasoning:** If a user escrows a card but the trade is subsequently cancelled or refunded, the card's asset value is still intact and secure. A global unique index would permanently burn that card, preventing the seller from ever attempting a new trade with it. The partial index frees up the hash for reuse only if the previous order reached a safe, unrevealed terminal state.

## 4. Strict Identity Mapping (AuthZ)
**Decision:** The `assertIdentityMatch` function enforces that every identity anchor provided in the request body (email or wallet) *must* strictly match the verified JWT session of the caller.
**Reasoning:** Early iterations used permissive OR-logic. This was hardened because an attacker possessing a victim's email could have injected their own wallet to bypass authorization. The current architecture strictly validates Web2/Web3 hybrid users.

## 5. Principle of Least Privilege (API Responses)
**Decision:** Explicitly scope the Supabase `.select()` chain to exclude `gift_card_code` (ciphertext) and `gc_code_hash` from the API response payload.
**Reasoning:** Over-fetching. Even though the ciphertext is secure, broadcasting it back to the client unnecessarily exposes it to frontend performance monitors, browser extensions, and network interceptors. 

## 6. Null-Hash Backfill Awareness
**Decision:** Pre-flight SQL audits prior to schema migrations.
**Reasoning:** Because the plaintext code is encrypted with a random IV (AES-256-CBC), the database cannot dynamically reverse-engineer the hashes for existing active rows. Schema migrations must include an audit for `gc_code_hash IS NULL` to ensure legacy active orders do not bypass the duplicate check system.