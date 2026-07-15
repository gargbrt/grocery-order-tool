#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { query } from "./db.js";

const server = new McpServer({
  name: "grocery-store-mcp-server",
  version: "1.0.0",
});

const CHARACTER_LIMIT = 8000;

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + `\n\n[truncated - response exceeded ${CHARACTER_LIMIT} characters]`;
}

// ---------------------------------------------------------------------------
// Tool: grocery_list_stores
// ---------------------------------------------------------------------------

const ListStoresInputSchema = z
  .object({
    search: z.string().max(200).optional().describe("Optional text to filter store names/addresses by"),
  })
  .strict();

server.registerTool(
  "grocery_list_stores",
  {
    title: "List Grocery Stores",
    description: `Lists grocery stores available to order from through this tool.

Use this first, before grocery_list_available_items or grocery_place_order, to find the storeId the customer wants to order from.

Args:
  - search (string, optional): filter by store name or address substring

Returns: JSON array of { id, name, address }

Examples:
  - Use when: "What stores can I order from?" -> no params
  - Use when: "Find the Sharma store" -> params with search="Sharma"`,
    inputSchema: ListStoresInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ search }) => {
    try {
      const rows = search
        ? await query(
            `select id, name, address from "Store" where name ilike $1 or address ilike $1 order by name limit 50`,
            [`%${search}%`]
          )
        : await query(`select id, name, address from "Store" order by name limit 50`);

      if (rows.length === 0) {
        return { content: [{ type: "text", text: "No stores found." }] };
      }

      const output = { stores: rows };
      return {
        content: [{ type: "text", text: truncate(JSON.stringify(output, null, 2)) }],
        structuredContent: output,
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error listing stores: ${(err as Error).message}` }], isError: true };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: grocery_list_available_items
// ---------------------------------------------------------------------------

const ListItemsInputSchema = z
  .object({
    storeId: z.string().min(1).describe("The store's id, from grocery_list_stores"),
    includeOutOfStock: z.boolean().default(false).describe("If true, also include items currently marked out of stock"),
  })
  .strict();

server.registerTool(
  "grocery_list_available_items",
  {
    title: "List Available Items",
    description: `Lists a store's catalog of items available to order, with current prices.

Note: not every store maintains a full catalog - some only take freeform orders. If this returns empty, tell the customer to describe what they want in plain text instead, and use grocery_place_order with freeform item names.

Args:
  - storeId (string, required): the store's id, from grocery_list_stores
  - includeOutOfStock (boolean, default false): include items currently out of stock

Returns: JSON array of { id, name, unit, price, inStock }

Examples:
  - Use when: "What does this store sell?" -> params with storeId
  - Use when: "Do they have rice?" -> call this, then check the returned list for "rice"`,
    inputSchema: ListItemsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ storeId, includeOutOfStock }) => {
    try {
      const store = await query(`select id from "Store" where id = $1`, [storeId]);
      if (store.length === 0) {
        return { content: [{ type: "text", text: `No store found with id '${storeId}'. Use grocery_list_stores first.` }], isError: true };
      }

      const rows = await query(
        `select id, name, unit, price, "inStock" from "CatalogItem" where "storeId" = $1 ${includeOutOfStock ? "" : `and "inStock" = true`} order by name`,
        [storeId]
      );

      if (rows.length === 0) {
        return {
          content: [{
            type: "text",
            text: "This store hasn't set up a catalog yet - it only takes freeform orders. Ask the customer what they'd like and use grocery_place_order with their item descriptions directly.",
          }],
        };
      }

      const output = { items: rows };
      return {
        content: [{ type: "text", text: truncate(JSON.stringify(output, null, 2)) }],
        structuredContent: output,
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error listing items: ${(err as Error).message}` }], isError: true };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: grocery_place_order
// ---------------------------------------------------------------------------

const OrderItemInputSchema = z.object({
  name: z.string().min(1).max(200).describe("Item name, e.g. 'rice' or '2 kg onions'"),
  quantity: z.string().max(50).optional().describe("Quantity/unit as free text, e.g. '2 kg', '1 packet' - optional if already included in name"),
});

const PlaceOrderInputSchema = z
  .object({
    storeId: z.string().min(1).describe("The store's id, from grocery_list_stores"),
    customerName: z.string().min(1).max(200).describe("Customer's name, used to label the order for the store owner"),
    customerPhone: z
      .string()
      .min(6)
      .max(20)
      .describe("Customer's phone number in E.164-ish format, e.g. +919812345678 - used to identify repeat customers and MUST be provided by the customer, never guessed"),
    items: z.array(OrderItemInputSchema).min(1).max(50).describe("List of items to order"),
    notes: z.string().max(500).optional().describe("Optional delivery notes, e.g. address or timing"),
  })
  .strict();

server.registerTool(
  "grocery_place_order",
  {
    title: "Place a Grocery Order",
    description: `Places an order with a grocery store on behalf of a customer. The store owner will review, bill, and send a confirmation - this does NOT charge any payment; it only submits the order for the store to fulfill.

IMPORTANT: Always confirm the full item list and the phone number with the customer before calling this - it creates a real order the store will act on. Never invent a phone number; ask the customer for theirs.

Args:
  - storeId (string, required): from grocery_list_stores
  - customerName (string, required): customer's name
  - customerPhone (string, required): customer's real phone number, provided by them
  - items (array, required): [{ name: string, quantity?: string }] - up to 50 items
  - notes (string, optional): delivery notes

Returns: JSON with { orderId, status, itemsRecorded, estimatedTotal, note }
  estimatedTotal is only a rough estimate based on catalog prices where item
  names matched exactly - the store owner sets the real final price, which
  may differ (weight-based items, substitutions, etc).

Error Handling:
  - Returns an error if storeId doesn't exist - call grocery_list_stores first
  - Returns an error if items is empty`,
    inputSchema: PlaceOrderInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  async ({ storeId, customerName, customerPhone, items, notes }) => {
    try {
      const store = await query<{ id: string; name: string }>(`select id, name from "Store" where id = $1`, [storeId]);
      if (store.length === 0) {
        return { content: [{ type: "text", text: `No store found with id '${storeId}'. Use grocery_list_stores first.` }], isError: true };
      }

      // Find or create the customer's Home/Contact for this store
      let contact = await query<{ id: string }>(
        `select id from "Contact" where "storeId" = $1 and phone = $2`,
        [storeId, customerPhone]
      );
      let contactId: string;
      if (contact.length === 0) {
        const created = await query<{ id: string }>(
          `insert into "Contact" (id, "storeId", "homeLabel", phone) values (gen_random_uuid(), $1, $2, $3) returning id`,
          [storeId, customerName, customerPhone]
        );
        contactId = created[0].id;
      } else {
        contactId = contact[0].id;
      }

      // Build the raw message text (kept human-readable, same shape as a WhatsApp/Telegram order)
      const rawMessage = items.map((i) => (i.quantity ? `${i.quantity} ${i.name}` : i.name)).join("\n") + (notes ? `\n\nNotes: ${notes}` : "");

      const order = await query<{ id: string }>(
        `insert into "Order" (id, "storeId", "contactId", channel, "rawMessage", status, "isLikelyOrder")
         values (gen_random_uuid(), $1, $2, 'MCP', $3, 'RECEIVED', true) returning id`,
        [storeId, contactId, rawMessage]
      );
      const orderId = order[0].id;

      // Match against the catalog for a rough estimate + to prefill price for the owner
      let estimatedTotal = 0;
      let matchedCount = 0;
      for (const [idx, item] of items.entries()) {
        const catalogMatch = await query<{ price: number }>(
          `select price from "CatalogItem" where "storeId" = $1 and lower(name) = lower($2) and "inStock" = true`,
          [storeId, item.name]
        );
        const price = catalogMatch[0]?.price ?? null;
        if (price != null) {
          estimatedTotal += price;
          matchedCount++;
        }
        await query(
          `insert into "OrderItem" (id, "orderId", "itemName", "quantityRequested", "unitPrice", "sortOrder")
           values (gen_random_uuid(), $1, $2, $3, $4, $5)`,
          [orderId, item.name, item.quantity ?? "", price, idx]
        );
      }

      const output = {
        orderId,
        status: "RECEIVED",
        itemsRecorded: items.length,
        estimatedTotal: matchedCount > 0 ? estimatedTotal : null,
        note:
          matchedCount < items.length
            ? "Some items didn't match the store's catalog exactly - the store owner will confirm the final price for those."
            : "Estimated total based on catalog prices - the store owner will confirm the final bill.",
      };

      return {
        content: [{
          type: "text",
          text: `Order placed with ${store[0].name}! Order ID: ${orderId}. ${output.estimatedTotal ? `Estimated total: ₹${output.estimatedTotal}.` : ""} The store will review and send a final bill.`,
        }],
        structuredContent: output,
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error placing order: ${(err as Error).message}` }], isError: true };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: grocery_get_order_status
// ---------------------------------------------------------------------------

const GetOrderStatusInputSchema = z
  .object({
    orderId: z.string().min(1).describe("The order id returned by grocery_place_order"),
    customerPhone: z.string().min(6).max(20).describe("The phone number the order was placed with, used to verify the requester owns this order"),
  })
  .strict();

server.registerTool(
  "grocery_get_order_status",
  {
    title: "Get Grocery Order Status",
    description: `Checks the status of a previously placed order, including the bill if the store has finalized it.

Args:
  - orderId (string, required): from grocery_place_order
  - customerPhone (string, required): must match the phone number the order was placed with

Returns: JSON with { status, items: [{name, quantity, availability}], bill: {total, paymentStatus} | null }

Error Handling:
  - Returns an error if the orderId doesn't exist or the phone number doesn't match (prevents one customer from viewing another's order)`,
    inputSchema: GetOrderStatusInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ orderId, customerPhone }) => {
    try {
      const orders = await query<{ status: string; contactId: string; phone: string }>(
        `select o.status, o."contactId", c.phone from "Order" o join "Contact" c on c.id = o."contactId" where o.id = $1`,
        [orderId]
      );
      if (orders.length === 0) {
        return { content: [{ type: "text", text: `No order found with id '${orderId}'.` }], isError: true };
      }
      if (orders[0].phone !== customerPhone) {
        return { content: [{ type: "text", text: "Phone number doesn't match this order." }], isError: true };
      }

      const items = await query(
        `select "itemName" as name, "quantityFulfilled" as quantity, availability from "OrderItem" where "orderId" = $1 order by "sortOrder"`,
        [orderId]
      );
      const bills = await query(`select total, "paymentStatus" from "Bill" where "orderId" = $1`, [orderId]);

      const output = {
        status: orders[0].status,
        items,
        bill: bills[0] ?? null,
      };

      return {
        content: [{ type: "text", text: truncate(JSON.stringify(output, null, 2)) }],
        structuredContent: output,
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error checking order status: ${(err as Error).message}` }], isError: true };
    }
  }
);

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

async function runStdio() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("grocery-store-mcp-server running on stdio");
}

async function runHTTP() {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  app.listen(port, () => {
    console.error(`grocery-store-mcp-server running on http://localhost:${port}/mcp`);
  });
}

const transportMode = process.env.TRANSPORT || "stdio";
if (transportMode === "http") {
  runHTTP().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
} else {
  runStdio().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}
