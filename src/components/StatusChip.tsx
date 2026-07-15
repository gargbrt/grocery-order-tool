const STATUS_STYLES: Record<string, string> = {
  RECEIVED: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-purple-100 text-purple-700",
  FULFILLING: "bg-amber-100 text-amber-700",
  BILLED: "bg-teal-100 text-teal-700",
  VERIFIED: "bg-brand-100 text-brand-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export function StatusChip({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
