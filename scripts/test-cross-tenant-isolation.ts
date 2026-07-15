export {}; // force module scope

// Simulates the fixed validation logic from src/app/api/orders/[id]/route.ts:
// only OrderItem ids that actually belong to the store-scoped order should
// be allowed through. This is exactly the check that was MISSING before the
// fix - an attacker (or a buggy client) could previously pass an item id
// belonging to a totally different store's order and silently modify it.

type Item = { id: string };

function validateItemsBelongToOrder(requestedItems: { id: string }[], order: { items: Item[] }): { ok: boolean; invalidIds: string[] } {
  const validIds = new Set(order.items.map((i) => i.id));
  const invalidIds = requestedItems.filter((i) => !validIds.has(i.id)).map((i) => i.id);
  return { ok: invalidIds.length === 0, invalidIds };
}

// Two different stores' orders, as they'd come back from loadOrderScoped
const storeA_order = { items: [{ id: "item-A1" }, { id: "item-A2" }] };
const storeB_order = { items: [{ id: "item-B1" }] };

type Case = { label: string; order: { items: Item[] }; requestedItems: { id: string }[]; expectOk: boolean };

const cases: Case[] = [
  { label: "legit update - all items belong to this order", order: storeA_order, requestedItems: [{ id: "item-A1" }, { id: "item-A2" }], expectOk: true },
  { label: "legit partial update - one of the order's items", order: storeA_order, requestedItems: [{ id: "item-A1" }], expectOk: true },
  { label: "ATTACK: item id from a different store's order", order: storeA_order, requestedItems: [{ id: "item-B1" }], expectOk: false },
  { label: "ATTACK: mix of legit + foreign item id", order: storeA_order, requestedItems: [{ id: "item-A1" }, { id: "item-B1" }], expectOk: false },
  { label: "nonexistent item id entirely", order: storeA_order, requestedItems: [{ id: "item-does-not-exist" }], expectOk: false },
  { label: "empty request", order: storeA_order, requestedItems: [], expectOk: true },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const result = validateItemsBelongToOrder(c.requestedItems, c.order);
  const ok = result.ok === c.expectOk;
  console.log(`${ok ? "PASS" : "FAIL"} [${c.label}] -> allowed=${result.ok}${result.invalidIds.length ? ` (rejected: ${result.invalidIds.join(", ")})` : ""}`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed out of ${cases.length}`);
if (fail > 0) process.exit(1);
