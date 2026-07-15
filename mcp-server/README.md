# grocery-store-mcp-server

Lets anyone with a Claude subscription browse a connected grocery store's
catalog and place an order, directly through Claude — no app install for the
customer, just a conversation.

This talks to the **same Postgres database** as the main Store Orders app
(via `DATABASE_URL`), so an order placed through Claude shows up in the
store owner's dashboard exactly like a WhatsApp or Telegram order — tagged
with channel `MCP`.

## What it is NOT

This does not replace the owner-facing dashboard, and it doesn't handle
payment — placing an order through this MCP server just submits it to the
store, the same as texting them. The store owner still bills and confirms
it through the main app.

## Tools

| Tool | Purpose |
|---|---|
| `grocery_list_stores` | Find a store to order from, optionally by name search |
| `grocery_list_available_items` | See a store's catalog (name, unit, price, in-stock) |
| `grocery_place_order` | Submit an order — customer name, phone, items, optional notes |
| `grocery_get_order_status` | Check status/bill of a previously placed order (phone-verified) |

A store without a catalog set up still works — `grocery_place_order` accepts
freeform item names either way; the catalog just enables browsing and
auto-filled estimated pricing.

## Local setup

```bash
cd mcp-server
npm install
export DATABASE_URL="<same connection string as the main app's .env>"
npm run build
npm start          # stdio transport, for local/CLI testing
```

Test it with the MCP Inspector before connecting it to Claude:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Deploying so Claude can reach it

Claude connects to remote MCP servers over HTTP, so this needs to run
somewhere with a public URL. Any Node host works (Render, Fly.io, Railway,
a Vercel serverless function, etc.) — the free tiers of Render or Fly are
enough for this workload. Steps, using Render as an example:

1. Push this repo (or just the `mcp-server/` folder) to GitHub.
2. Create a new Render Web Service pointing at it.
3. Build command: `npm install && npm run build`
4. Start command: `npm run start:http`
5. Set env vars: `DATABASE_URL` (same as the main app), `TRANSPORT=http`.
6. Once deployed, your MCP endpoint is `https://<your-service>.onrender.com/mcp`.

## Connecting it in Claude

1. In Claude, go to **Settings → Connectors → Add custom connector**.
2. Paste your deployed `/mcp` URL.
3. Once connected, anyone with that connector enabled can ask Claude things
   like *"What grocery stores can I order from?"* or *"Order 2kg rice and a
   packet of atta from Demo Kirana Store, my number is +91..."* and Claude
   will call these tools directly.

## Managing a store's catalog

There's no UI for this yet (Phase 2 candidate — see the main README's
roadmap) — add/edit catalog items directly via SQL or Prisma Studio against
the `CatalogItem` table:

```sql
insert into "CatalogItem" (id, "storeId", name, unit, price, "inStock")
values (gen_random_uuid(), '<storeId>', 'rice', 'kg', 60, true);
```

## Security notes

- `grocery_place_order` never lets the model guess a phone number — the
  tool description explicitly instructs Claude to ask the customer, and the
  phone number is how `grocery_get_order_status` later verifies the
  requester owns that order. This isn't bulletproof auth (anyone who knows a
  customer's phone number could in principle check their order status) —
  it's parity with how the store owner already identifies customers by phone
  everywhere else in this app, not a stronger guarantee.
- This server uses a direct Postgres connection with full read/write access
  to the same tables the main app uses. Don't expose `DATABASE_URL` in
  client-side code or logs.
- Consider rate-limiting `grocery_place_order` in front of this (e.g. at the
  hosting platform level) before exposing it publicly, to prevent spam
  orders.
