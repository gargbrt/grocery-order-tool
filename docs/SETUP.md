# Setup & Deployment Guide

*This is the detailed technical setup doc. For the project overview, feature
list, and roadmap, see the [main README](../README.md).*

## 0. This has now been tested end-to-end against a real database

During development, a real Supabase project (free tier, confirmed ₹0/month)
was created and the schema in `prisma/schema.prisma` was pushed to it and
verified — `prisma/supabase_test_migration.sql` is a faithful copy of that
schema for reference. That project was specific to development and isn't
something this repo's users share; follow "One-time setup" below to create
your own. What was actually verified against real rows, not just simulated:

- Full order lifecycle: contact created → order + items → helper fulfillment →
  bill finalized with a discount → ledger entry written, matching hand-computed
  totals exactly
- A second order for the same customer, paid immediately, correctly did **not**
  inflate their outstanding balance (confirms credit-vs-paid logic)
- The zero-quantity billing bug (see below) was re-verified against a real
  `UNAVAILABLE` item with a price typed in — correctly billed ₹0
- Unique constraints work (duplicate phone-per-store correctly rejected)
- The "Needs review" flow: a flagged message correctly stored with 0 items and
  excluded from the main orders query, included in the review-only query
- Price override upsert: setting the same item's price twice updates in place,
  doesn't duplicate
- Supabase's own security/performance advisors were run; findings and fixes
  below

**Two real bugs were found and fixed during testing** (already applied in this
codebase):
1. `src/lib/orderParsing.ts` — the order/non-order classifier had a broken
   condition that let almost any sentence through, and a regex (`l\b`) that
   was matching the "l" inside ordinary words like "will". Both fixed.
2. `src/app/api/orders/[id]/route.ts` — an item with fulfilled quantity
   explicitly set to `"0"` was being billed as if quantity were 1, because the
   original formula treated `0` as falsy. Fixed, plus added a safety net so
   `UNAVAILABLE` items always bill ₹0 regardless of what's typed.

**Security note (from Supabase's advisor, not dismissed):** Row Level
Security is off on all tables. This is safe as built, because the app never
uses the Supabase anon/browser key — every query goes through our Next.js
server with authorization enforced in the API routes (see section on Roles &
permissions). It's still good defense-in-depth to enable: run
`ALTER TABLE "<TableName>" ENABLE ROW LEVEL SECURITY;` for each table in
`prisma/schema.prisma`, then add policies scoped to your own access pattern
(or just service-role-only if, like this app, nothing queries Supabase
directly from the browser).

**Still not tested, because it needs live network I don't have:** the actual
npm install / Next.js dev server, and the Telegram/WhatsApp webhook round
trip. The database layer underneath all of that is now confirmed solid.

**MCP server, tested the same way (real DB, not simulated):** a `CatalogItem`
table and `MCP` channel value were added to the live schema. Every query the
MCP tools run was executed by hand against real rows first: listing an
in-stock-only catalog correctly excluded an out-of-stock item; placing an
order correctly matched item names against the catalog case-insensitively
(prefilling price for exact matches, leaving it `null` for a freeform item
the store doesn't stock, so the owner prices it manually); the order-status
phone-verification query returns the real owner phone for the caller to
compare against. Development used a demo store with 5 catalog items to
verify this end-to-end - to try it yourself, add a few `CatalogItem` rows
to your own store once the MCP server is deployed and connected.

**Multi-tenant isolation, audited and one real bug fixed:** every API route
that reads or writes data was checked line-by-line for whether it actually
scopes to the logged-in owner's store, not just the requested record's ID.
One real cross-tenant vulnerability was found: `PATCH /api/orders/[id]`'s
item-update loop trusted a client-supplied `OrderItem` id without checking
it belonged to the store-scoped order, so a request could in principle
modify another store's order item. Fixed (now validates every item id
against the order's actual items, plus a defense-in-depth `orderId` clause
on the update query itself), and **verified against real data**: created two
separate stores, attempted the exact cross-store update the bug would have
allowed, confirmed the target row was untouched.

**Plug-and-play onboarding added:** `/signup` creates a store + owner login
in one step (no SQL/CLI), and the owner can invite helper logins from a Team
page in the dashboard (no Prisma Studio). Verified against real data: the
signup transaction, and the duplicate-phone rejection it depends on.

**Still not run, because it needs a real MCP client + deployed HTTP
endpoint, neither of which exist yet in this sandbox:** the actual MCP
protocol handshake and tool-calling round trip from Claude itself. The
database-layer logic underneath every tool has been verified; the transport
layer (`mcp-server/src/index.ts`'s stdio/HTTP setup) has only been
typechecked, not executed.

## 1. One-time setup

```bash
npm install
cp .env.example .env
```

### Database (Supabase, free tier)
1. Create a project at supabase.com
2. Settings → Database → Connection string → copy the "URI" (use the pooled
   connection string for `DATABASE_URL`, and the direct one if you hit pooling
   issues with Prisma migrations)
3. Paste into `.env` as `DATABASE_URL`
4. Push the schema:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
5. Seed a sample store + owner/helper login:
   ```bash
   npx tsx prisma/seed.ts
   ```
   This prints an owner login (`+919800000000` / `changeme123`) — **change this
   password before going live.**

### Session secret
Generate any long random string for `JWT_SECRET` in `.env`, e.g.:
```bash
openssl rand -hex 32
```

## 2. Run locally

```bash
npm run dev
```
Visit `http://localhost:3000`, log in with the seeded owner credentials.

## 3. Connect Telegram (fully automated, do this first)

1. Message [@BotFather](https://t.me/BotFather) on Telegram → `/newbot` → follow
   prompts → copy the bot token it gives you.
2. Save it against your store (via Prisma Studio `npx prisma studio`, or SQL):
   ```sql
   UPDATE "Store" SET "telegramBotToken" = 'YOUR_TOKEN' WHERE id = 'YOUR_STORE_ID';
   ```
3. Deploy the app (see below) so it has a public URL, set `PUBLIC_BASE_URL` in
   your deployed environment, then register the webhook:
   ```bash
   npx tsx scripts/register-telegram-webhook.ts YOUR_STORE_ID
   ```
4. Message your bot on Telegram — an Order should appear in the dashboard
   immediately.

## 4. WhatsApp — receiving works now, no business verification needed

Correction worth knowing: Meta's restriction is on **business-initiated**
messages, not on receiving. You can receive customer messages via the
WhatsApp Cloud API right away using a **free Meta test number** — no business
verification wait. Sending replies is unrestricted within the 24-hour window
after the customer's last message (which is exactly when we send the bill
back), so that works too. Verification only becomes necessary later if you
want a production phone number with your own business name instead of the
test number.

Setup:
1. Create a Meta for Developers app → add the WhatsApp product → it gives you
   a free test phone number, a `phone_number_id`, and a temporary access token
   (24h) or a permanent one via a System User (recommended for production).
2. Save on the Store row: `whatsappPhoneNumberId`, `whatsappAccessToken`, and
   pick any random string for `whatsappVerifyToken` (Meta will send this back
   to prove it's really Meta calling your webhook).
3. In the Meta app dashboard, set the webhook URL to:
   ```
   https://your-deployed-url/api/whatsapp/webhook?storeId=YOUR_STORE_ID
   ```
   and the verify token to the same value you saved in step 2. Meta calls this
   URL once to confirm ownership (`GET` handshake, already implemented).
4. Subscribe the webhook to the `messages` field.
5. Message the test number from your own WhatsApp — an Order (or a "Needs
   review" entry, if it doesn't look like an order) should appear.
6. Flip `Store.whatsappMode` to `"CLOUD_API"` once you're ready to rely on it
   as your primary channel instead of manual mode.

## 5. WhatsApp manual mode (fallback, works with zero setup)

If you'd rather not touch Meta at all yet: on the Orders tab, tap **"+
WhatsApp order"** and paste the customer's message in manually — it flows
through the same pipeline as everything else.

## 6. "Needs review" tab — nothing is ever silently dropped

Every incoming message (Telegram or WhatsApp) is checked against a simple,
conservative heuristic (`src/lib/orderParsing.ts`): does this look like a list
of grocery items, or does it look like a greeting/question/chit-chat? If it's
ambiguous, the message still gets saved as an Order — it just goes to a
**"Needs review"** tab instead of your main Orders list, with a plain-English
reason shown. From there you tap **"This is an order"** to move it into the
normal pipeline, or **"Not an order"** to dismiss it. The heuristic can be
tuned in that one file if you notice it flagging things wrong in practice.

## 7. Per-customer pricing & discounts

- **Per-item price override per customer**: on an order's fulfillment screen,
  enter a unit price and tap 💾 next to it to save it as that customer's
  standing price for that item — it auto-fills next time, but you can always
  type a different number for a one-off order (the saved price never
  overwrites a price you've already typed in).
- **Overall discount**: the billing panel on the same screen has a discount
  field (in ₹) applied to the whole bill total before finalizing.

## 8. Payments module (Razorpay, subscription-gated) — Phase 2

Deliberately not built in this MVP per the spec — it's meant to be unlocked
later. When ready: create a Razorpay account, add a `src/lib/razorpay.ts` for
generating payment links, extend the bill-finalize route
(`src/app/api/bills/route.ts`) to attach a payment link when
`store.paymentsModuleEnabled` is true, and add a webhook to mark
`Bill.paymentStatus = PAID` when Razorpay confirms payment.

## 9. Deploy (Vercel, free tier)

```bash
npm install -g vercel
vercel
```
Set the same env vars (`DATABASE_URL`, `JWT_SECRET`, `PUBLIC_BASE_URL`) in the
Vercel project settings. Re-run the webhook registration script with the
deployed URL.

## 10. Roles & permissions

- **Owner**: full access — billing, ledger, contact details, can finalize bills.
- **Helper**: sees the order/fulfillment checklist only. Pricing and contact
  details are hidden unless you set `canViewPricing` / `canViewContactDetails`
  to `true` on their `User` row (via Prisma Studio).

## 11. What to sanity-check before relying on this for real orders

- This is a working MVP, not a security-audited production system yet. Before
  real customer data flows through it: rotate the seeded password, put the app
  behind HTTPS (Vercel does this by default), and review the DPDP Act
  consent/erasure requirements mentioned in the spec doc.
- Item parsing is intentionally dumb (one line = one item) — no AI guessing of
  quantities, so nothing gets silently misread. Helper/owner confirm real
  quantities during fulfillment.
