const STATUS_STYLES: Record<string, string> = {
  RECEIVED: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-purple-100 text-purple-700",
  FULFILLING: "bg-amber-100 text-amber-700",
  BILLED: "bg-teal-100 text-teal-700",
  VERIFIED: "bg-brand-100 text-brand-700",
  PAID: "bg-emerald-100 text-emerald-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

// Once a bill is finalized as PAID, the order's end state reads as "Paid"
// rather than "Verified" - same underlying OrderStatus (VERIFIED), just a
// clearer label for a bill that's fully settled vs. one still on credit.
export function StatusChip({ status, paymentStatus }: { status: string; paymentStatus?: string | null }) {
  const displayStatus = status === "VERIFIED" && paymentStatus === "PAID" ? "PAID" : status;
  const style = STATUS_STYLES[displayStatus] || "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {displayStatus.charAt(0) + displayStatus.slice(1).toLowerCase()}
    </span>
  );
}
