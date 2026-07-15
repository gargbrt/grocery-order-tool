import Link from "next/link";
import { StatusChip } from "./StatusChip";

type OrderCardProps = {
  id: string;
  homeLabel: string;
  channel: string;
  status: string;
  itemCount: number;
  createdAt: string;
  prepaid?: boolean;
};

const CHANNEL_ICON: Record<string, string> = {
  TELEGRAM: "✈️",
  WHATSAPP: "💬",
  MANUAL: "✍️",
};

export function OrderCard({ id, homeLabel, channel, status, itemCount, createdAt, prepaid }: OrderCardProps) {
  return (
    <Link
      href={`/dashboard/orders/${id}`}
      className="tap-target block rounded-xl2 border border-gray-200 bg-white p-4 shadow-sm active:scale-[0.99]"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-gray-900">
            {CHANNEL_ICON[channel] ?? ""} {homeLabel} {prepaid && <span title="Already paid for">💰</span>}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {itemCount} item{itemCount === 1 ? "" : "s"} · {new Date(createdAt).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <StatusChip status={status} />
      </div>
    </Link>
  );
}
