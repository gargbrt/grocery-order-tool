// Shared with GET /api/orders and its tests - the actual filter Prisma
// applies for each Orders-tab category, kept in one place so category
// semantics can't drift between the route and its regression test.
export type OrderCategory = "all" | "open" | "review" | "delivered" | "cancelled" | "received";

export function getCategoryFilter(category: OrderCategory): Record<string, unknown> {
  switch (category) {
    case "all":
      return {};
    case "open":
      return { isLikelyOrder: true, status: { notIn: ["DELIVERED", "CANCELLED"] } };
    case "review":
      // Exclude CANCELLED so a dismissed ("Not an order") flagged message
      // doesn't linger in Needs Review forever - it's been handled.
      return { isLikelyOrder: false, status: { not: "CANCELLED" } };
    case "delivered":
      return { status: "DELIVERED" };
    case "cancelled":
      return { status: "CANCELLED" };
    case "received":
      return { isLikelyOrder: true };
  }
}
