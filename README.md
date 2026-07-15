# 🛒 Store Orders — WhatsApp/Telegram order management for small grocery stores

Turn the order-taking chaos in your grocery store's WhatsApp inbox into a real
workflow — without asking a single customer to change how they order.

> Built for kirana stores and small grocery shops in India, but the core
> workflow (chat-based ordering → fulfillment → billing → ledger) generalizes
> to any small business that takes orders over chat and settles accounts on
> credit with regulars.

---

## The problem

If you run a small grocery store, this is probably your day already:

1. A customer sends you their shopping list over WhatsApp.
2. You forward it to whoever's picking the order (or shout across the shop).
3. They collect the items while you work out the bill in your head or on paper.
4. You double-check everything matches before it goes out.
5. The order is delivered along with the bill.
6. You write the amount into a notebook against that customer's name — or
   you mean to, and forget.
7. Weeks later, nobody remembers who owes what.

None of this is written down anywhere searchable. There's no record of what a
regular customer usually orders, no running tally of who's on credit, and no
way for a helper to work an order without also seeing (or losing) the
customer's phone number.

## The product

**Store Orders** digitizes that exact workflow, one-to-one, without changing
how customers behave:

- Customers keep texting the store like they always have — WhatsApp or
  Telegram, whichever the store owner enables.
- Every incoming message becomes a trackable **Order**, automatically tagged
  to that customer's **Home** (a household/contact profile — you can have
  many phone numbers per home, or rename "Customer 98xxxxxxxx" into "Sharma —
  Flat 4B" once).
- A helper works the order on their own login — checking off items, marking
  what's unavailable — **without ever seeing prices or the customer's phone
  number**, unless the owner explicitly allows it.
- The owner bills it, can override the price per item per customer (regulars
  often get different rates), applies a discount, and sends the final bill
  back over the same channel the order came in on.
- Every finalized bill writes an entry into that Home's **Ledger** — a running
  balance, so "who owes how much" is always one tap away instead of a mental
  tally.
- Messages that don't look like an order (a "thanks!", a question about
  opening hours) are never silently thrown away — they land in a **Needs
  review** tab instead of your main Orders list, so nothing gets lost and
  nothing clutters your queue either.

It's designed mobile-first, as an installable PWA, because that's how a store
owner and their helper will actually use it — standing at the counter, not at
a desktop.

## Who this is for

- **Store owners** who want their WhatsApp orders to stop living only in chat
  history.
- **Store helpers/staff** who need a clean, focused view of what to pack —
  nothing more, nothing less.
- **Developers** who want to fork this for a different kind of small
  business (pharmacy, tiffin service, hardware store) — the
  Order → Fulfillment → Billing → Ledger core is intentionally generic.

---

## Features (Phase 1 — implemented)

- ✅ **Telegram bot** — fully automated, free, no business verification needed
- ✅ **WhatsApp Cloud API** — receiving works today with a free Meta test
  number; sending replies works within the 24h customer-service window
- ✅ **WhatsApp manual mode** — a zero-setup fallback: paste the customer's
  message into the dashboard
- ✅ **Order lifecycle**: Received → Assigned → Fulfilling → Billed →
  Verified → Delivered, with an audit trail of every change
- ✅ **"Needs review" tab** — messages that don't look like orders are
  flagged, never dropped
- ✅ **Per-customer price overrides** — save a regular's price for an item
  once, it auto-fills next time, always editable
- ✅ **Overall bill discount**
- ✅ **Ledger** — running credit balance per Home, updated automatically when
  a bill is finalized
- ✅ **Owner / Helper roles** — helpers can be restricted from seeing pricing
  and customer contact details
- ✅ **Mobile-first PWA** — installable on a phone home screen, no app store
- ✅ **Self-serve signup** — any store owner can create their store and
  first login at `/signup`, no SQL or CLI required
- ✅ **Invite helpers from the dashboard** — owner adds helper logins (and
  sets their permissions) from a Team page, no Prisma Studio needed
- ✅ Tested against a real Postgres/Supabase database (see
  [`docs/SETUP.md`](docs/SETUP.md) for what was verified)
- ✅ **MCP server** (`mcp-server/`) — lets anyone with a Claude subscription
  browse a store's catalog and place an order directly through Claude, no
  app install needed. See [`mcp-server/README.md`](mcp-server/README.md).
- ✅ **Editable Homes** — owner can rename, re-address, and correct the phone
  number on any Home (also how you link a second channel to the same
  customer, e.g. add their WhatsApp number to a Telegram-only Home)
- ✅ **Ledger detail per Home** — tap any balance to see that Home's full
  order and payment/credit history; accounts with a balance untouched for 30+
  days are flagged as overdue
- ✅ **Orders categorized**: All / Open / Needs Review / Delivered / Cancelled,
  plus a collapsible calendar to jump straight to any day's orders
- ✅ **Daily/weekly/monthly summary** — orders received/delivered/cancelled,
  money received, new receivables, and current total outstanding
- ✅ **Owner can cancel any order**, not just ones flagged for review
- ✅ **Automatic status updates to the customer** — Telegram always, WhatsApp
  when Cloud API is configured — sent back on the same chat the order came in on
- ✅ Near-real-time dashboard refresh, so multiple logged-in devices/sessions
  stay in sync without a manual reload

## Roadmap

**Phase 2**
- [ ] Razorpay/Cashfree payments module (subscription-gated — see
  [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) for the design) — UPI
  payment links attached to bills, auto-updating payment status
- [ ] WhatsApp Cloud API production number (post Meta business verification)
- [ ] PDF/image bill generation instead of plain text
- [ ] Payment status reminders for outstanding credit
- [ ] Per-order delivery address override — let the owner set/change a
  one-off delivery address for a specific order without editing the Home's
  saved address

**Phase 3**
- [ ] Basic inventory/stock awareness — flag out-of-stock items automatically
  instead of the helper discovering it mid-pack
- [ ] Sales analytics for the owner (top items, busiest hours, biggest
  credit accounts)
- [ ] Multi-store support for owners running more than one branch

**Ideas / open to contributions**
- [ ] Smarter order-parsing (currently a conservative rule-based heuristic in
  `src/lib/orderParsing.ts` — see the "known limitation" note in that file
  before touching it)
- [ ] Voice-note order support (common for older customers)
- [ ] Regional language support beyond English item names
- [ ] SMS fallback channel for customers without WhatsApp/Telegram

Have an idea that's not here? Open an issue — this roadmap isn't fixed.

---

## Tech stack

Chosen to be modern, reusable, and near-zero cost at small-store volume:

| Layer | Choice |
|---|---|
| Frontend | Next.js (React) + Tailwind, installable PWA |
| Backend | Next.js API routes / Node.js + TypeScript |
| Database | PostgreSQL via Supabase (free tier) |
| ORM | Prisma |
| Hosting | Vercel (frontend/API) + Supabase (DB) — both free at this scale |
| Telegram | Telegram Bot API (direct, free) |
| WhatsApp | Meta WhatsApp Cloud API (direct, skips third-party BSP fees) |
| Payments (Phase 2) | Razorpay or Cashfree — India-first, UPI-native |

See [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) for the full reasoning
behind these choices, including data model and privacy/security defaults.

## Quick start

```bash
git clone <this-repo>
cd grocery-order-tool
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET
npx prisma generate
npx prisma db push
npm run dev
```

Then open `/signup` — that's the whole onboarding flow: store name, your
name and phone, a password, done. No SQL, no CLI seed script, no Prisma
Studio. (`prisma/seed.ts` still exists for quickly spinning up disposable
test data during development, but it's not how a real store owner gets
started.)

Full setup, including connecting a real Telegram bot and WhatsApp, is in
**[`docs/SETUP.md`](docs/SETUP.md)** — start there for anything beyond running
it locally.

## Project structure

```
src/
  app/
    api/            REST endpoints (orders, bills, contacts, ledger, webhooks)
    dashboard/       Owner/helper web app (Orders, Contacts, Ledger)
    login/
  lib/               Shared logic: auth, db client, Telegram/WhatsApp senders,
                      order-likelihood parsing
  components/        Shared UI (status chips, nav, cards)
prisma/
  schema.prisma      Data model
  seed.ts            Sample data for first run
scripts/             One-off CLI helpers (webhook registration) + test scripts
mcp-server/          Standalone MCP server - browse catalog & order via Claude
                      (see mcp-server/README.md for deployment + connection)
docs/
  SETUP.md           Full setup/deploy guide, incl. Telegram & WhatsApp
  PRODUCT_SPEC.md     Original product spec: problem, data model, phasing
```

## Testing

This project includes real unit tests for the parts where a silent bug would
cost real money or lose real orders — the order-detection heuristic and the
billing/ledger math:

```bash
npx tsx scripts/test-order-parsing.ts
npx tsx scripts/test-billing-math.ts
npx tsx scripts/test-line-total.ts
```

These are plain scripts, not a test framework, kept deliberately simple so
they're easy to read and extend. Contributions that port these to a proper
test runner (Vitest/Jest) are welcome.

## Contributing

This is meant to be a genuinely useful open-source tool for small store
owners, not a portfolio piece — practical contributions welcome:

1. Fork the repo, create a branch for your change.
2. If you're touching billing math or the order-parsing heuristic, please
   add/update a test case in the relevant `scripts/test-*.ts` file — those
   two areas have already had real bugs caught this way.
3. Open a PR describing what changed and why.

Bug reports and feature requests are just as valuable as code — open an
issue either way.

## Security

- Passwords are hashed (bcrypt), sessions are signed JWTs in HTTP-only
  cookies.
- Helper access is scoped: pricing and customer contact details are hidden
  by default unless the owner grants access.
- No browser code ever talks to Supabase directly — all database access goes
  through authenticated server-side API routes, so Row Level Security being
  off by default is safe as built (see `docs/SETUP.md` for the full note and
  the SQL to enable it anyway as defense-in-depth).
- Found a security issue? Please open a private security advisory on GitHub
  rather than a public issue.

## License

MIT — see [`LICENSE`](LICENSE). Use it, fork it, sell it, adapt it for a
different kind of small business. Attribution appreciated, not required.
