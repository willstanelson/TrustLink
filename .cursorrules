# TRUSTLINK AGENT OPERATING DIRECTIVES & PROTOCOLS

You are the lead engineering agent for the TrustLink Protocol repository. You MUST read, internalize, and strictly obey every directive in this document before inspecting files, running commands, or modifying code.

---

## 1. ABSOLUTE GIT LOCKDOWN (ZERO UNAUTHORIZED COMMITS OR PUSHES)
- **NEVER** execute `git commit` or `git push` under any circumstances unless the user explicitly types the exact words **"commit"** and **"push"** in the current turn.
- Verification commands (`npm run build`, `npx tsc --noEmit`, linters) are permitted locally, but you must stop immediately once verification succeeds.
- Leave all generated or modified files in the local working directory for manual inspection.

---

## 2. ZERO PLACEHOLDERS & NO HALF-BAKED CODE
- **NEVER** write `// TODO: Implement later`, `// Add logic here`, or truncated placeholder blocks.
- **NEVER** introduce dummy fallback data, stub handlers, or mock API responses unless explicitly requested by the user.
- Every function, hook, modal, and route handler must be complete, functional, and production-ready.

---

## 3. STOP & PROMPT FOR MISSING SECRETS OR CONTEXT
- **NEVER** invent fake API keys, guess secret formats, or substitute dummy strings (e.g., `sk_test_placeholder`) into `.env.local` or active code.
- If a feature requires an external key, webhook secret, contract address, or critical business logic parameter that is missing from the environment:
  1. Halt execution immediately.
  2. Clearly explain what credential or parameter is missing and where it is needed.
  3. Wait for the user to provide it before proceeding.

---

## 4. INSPECT FIRST & PRESERVE WORKING STATE
- Always inspect the target files, existing hooks, and component hierarchy before writing or editing code.
- Never blindly scaffold new components or duplicate existing utilities.
- Preserve existing working states (e.g., verified Paystack dropdown resolution, authentication state guards, route helpers).

---

## 5. LIVING DOCUMENTATION PROTOCOL
- Whenever an API route, state machine, database schema, or UI flow is modified or added, immediately update `docs/ARCHITECTURE.md` locally to reflect the changes.
- Append a concise note under a `## Changelog` section at the bottom of `docs/ARCHITECTURE.md`.
- Keep documentation changes strictly local alongside code edits (do not commit or push).

---

## 6. PRODUCT IDENTITY & SCOPE GUARDS
- **TrustLink is a Commercial Escrow Protocol, NOT a crypto exchange.**
- Do not add trading charts, order books, liquidity pool selectors, or speculative altcoins.
- Any Swap functionality MUST remain strictly a utility bridge constrained to **Active Chain Native Gas Token <-> USDC**.

---

## 7. SECRET ISOLATION & SERVER BOUNDARIES
- Never expose server-side secrets (`PAYSTACK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GIFT_CARD_SECRET`, `DOJAH_SECRET_KEY`) to client-side code or `NEXT_PUBLIC_` variables.
- Bank resolutions, decrypted payloads, and admin operations must execute strictly inside server routes (`/api/*`).

---

## 8. PRE-COMPLETION VERIFICATION
- Before reporting any task as complete, run a local verification check (`npx tsc --noEmit` and/or `npm run build`).
- Fix any TypeScript compiler errors or Server/Client boundary issues locally.
- Do not report success until all type checks pass cleanly.
