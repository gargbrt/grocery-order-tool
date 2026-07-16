# Product Spec

*This is the original product spec, updated to match what's actually been
built and tested. For a shorter product overview, see the
[main README](../README.md).*

## 1. Problem Statement

Small grocery store owners receive orders informally over WhatsApp text. The
process today is manual and lives entirely in chat history: customer texts →
owner reads → forwards to helper → helper collects items → owner bills →
verify → deliver → manually update a paper/notebook ledger.

This tool digitizes that workflow **without forcing the customer to change
behavior** — the customer still just sends a text message, on WhatsApp or
Telegram.

## 2. Users & Roles

| Role | Access |
|---|---|
| **Store Owner** | Full access: all orders, billing, ledger, contacts, staff management, channel settings |
| **Store Helper** | Order fulfillment view only: sees incoming order, marks items collected/unavailable, cannot see billing totals, ledger, or customer contact details unless the owner grants it |
| **Customer** | No login — interacts purely via WhatsApp or Telegram chat |

Single-store for now. Multi-store (one owner running several branches) is on
the Phase 3 roadmap.

## 3. Core User Flow

1. **Order received** — Customer messages the store's WhatsApp or Telegram
   bot/number with their item list (free text).
2. **Order captured** — The message is checked against a conservative
   heuristic (`src/lib/orderParsing.ts`): does this look like a list of
   grocery items, or conversational chit-chat? Either way it's saved as an
   Order — ambiguous ones go to a **Needs review** tab instead of being
   silently dropped or wrongly treated as a real order.
3. **Assigned to helper** — Owner assigns the order to a helper, who works it
   on their own login.
4. **Fulfillment** — Helper checks off items as collected; marks any item
   unavailable or substituted. Helper does not see pricing or the customer's
   phone number unless permitted.
5. **Billing** — Owner (or a permitted helper) enters quantity/price per
   item. Per-customer price overrides can be saved once and auto-fill next
   time. An overall discount can be applied. Total is computed automatically.
6. **Verification & send** — Owner reviews the final item list + bill,
   finalizes it, and it's sent back over the same channel the order came in
   on.
7. **Ledger entry** — The bill auto-logs to that Home's ledger: a running
   credit balance, updated only when the order isn't paid immediately.
8. **Contact book** — Every phone number maps to a "Home" profile (e.g.
   "Sharma Household — Flat 4B") the owner can rename and annotate.

## 4. Channel Connection

### Telegram
Fully automated from day one. Free, no business verification, self-serve via
@BotFather. This is the fastest path to a working bot.

### WhatsApp
Meta's restriction is on **business-initiated** messages, not on receiving.
Receiving works immediately with a free Meta test number — no business
verification wait. Sending is unrestricted within the 24-hour window after
the customer's last message, which covers the "send the bill back"
use case. Two modes are supported:

- **Cloud API** — automated, using the free test number (or a verified
  production number later)
- **Manual mode** — zero setup: the owner/helper pastes the customer's
  message into the dashboard by hand

Owners choose per-store which channel(s) to enable, and can run both
WhatsApp and Telegram simultaneously.

### Claude MCP ordering
A separate, optional channel: the `mcp-server/` package exposes the store's
catalog and order-placement as MCP tools, so anyone with a Claude
subscription can browse a store and place an order conversationally, no app
needed. Orders placed this way are tagged with channel `MCP` and flow through
the exact same Fulfillment → Billing → Ledger pipeline as any other order.
This is additive — it requires the store to have set up a `CatalogItem` list
(see §5), but falls back to freeform item names if not. See
[`mcp-server/README.md`](../mcp-server/README.md).

## 5. Data Model

See `prisma/schema.prisma` for the authoritative version. High level:

- **Store** — name, address, channel config (Telegram/WhatsApp credentials),
  payments-module flag
- **User** — role (owner/helper), login credentials, fine-grained permission
  overrides for helpers
- **Contact** ("Home") — display label, address, phone, linked
  Telegram/WhatsApp IDs, notes
- **Order** — source channel, raw message, `isLikelyOrder` flag + reason,
  status, assigned helper
- **OrderItem** — item name, requested/fulfilled quantity, unit price, line
  total, availability
- **Bill** — itemized total, discount, payment status/mode
- **LedgerEntry** — running balance per Home
- **PriceOverride** — per-customer, per-item saved price
- **AuditLog** — who changed what, when

## 6. Privacy & Security

- Helper role cannot view customer phone numbers or billing totals unless
  the owner explicitly grants that permission — least-privilege by default.
- Passwords hashed with bcrypt; sessions are signed JWTs in HTTP-only
  cookies.
- All database access goes through authenticated server-side API routes —
  no client-side code talks to the database directly.
- Customer data (phone numbers, order history) should be handled with
  India's **DPDP Act 2023** in mind — consent, right to erasure, breach
  notification. This tool doesn't currently implement automated data export
  or erasure flows; that's a good first contribution if you need it.
- Not a lawyer's sign-off — get a real compliance review before handling
  real customer payment data at scale.

## 7. Payments Module (Phase 2, India-specific, subscription-gated)

Not yet built. Design:

- Billing/ledger stays free always (cash/credit tracked manually).
- Online payment collection is a separate, optional paid module, gated by a
  `paymentsModuleEnabled` flag per store.
- **Gateway**: Razorpay or Cashfree — India-first, UPI-native, pay-as-you-go
  (no fixed cost until the owner unlocks the module and transacts).
- Bill would include a UPI payment link/QR code; payment status auto-updates
  in the ledger when the customer pays.
- RBI data-localization rules apply to payment data (the gateway handles
  this as long as we only store transaction references, not card/UPI
  credentials ourselves).

## 8. Taxation & Accounting Module (Phase 4+, India-specific)

Not yet built. Design direction, sketched here so the schema/data work isn't
a surprise when this gets picked up:

- **Sales & COGS reporting** — total sales already exists implicitly (sum of
  finalized bills); COGS doesn't, since the schema has no cost-price field
  today. Needs a "cost price" per `CatalogItem`/order line, captured at time
  of billing (cost can change over time, so it must be snapshotted per sale,
  not just looked up live from the catalog).
- **Financial statements** — a real balance sheet, income statement, and cash
  flow statement need a proper chart of accounts underneath (assets,
  liabilities, revenue, expense categories), not just the current single
  running-balance ledger per Home. The existing `LedgerEntry` model tracks
  receivables only — it isn't a general ledger.
- **GST filing & reports** — GSTR-1/GSTR-3B-style summaries need HSN/SAC
  codes and applicable tax rates captured per catalog item (or per order
  line for freeform items), plus a place to record the store's own GSTIN.
  None of that exists in the schema yet.
- This is explicitly a later-phase, schema-first effort — see the Phase 4
  entry in the [Roadmap](../README.md#roadmap) — not scoped for near-term
  implementation.

## 9. Design Language

Mobile-first web app, installable as a PWA, following current Material 3
(Android) / iOS Human Interface Guidelines conventions: large tap targets,
bottom nav for the core screens (Orders, Homes, Ledger), color-coded status
chips, minimal typing — mostly tap-to-check-off for the helper's fulfillment
screen.

## 10. Phasing

See the [Roadmap section of the main README](../README.md#roadmap) — kept in
one place so it doesn't drift out of sync between two documents.
