"use client";

import { useState } from "react";

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function MiniCalendar({
  selectedDate,
  onSelect,
}: {
  selectedDate: string | null;
  onSelect: (date: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = ymd(new Date());

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="tap-target flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600"
      >
        📅 Calendar {open ? "▲" : "▼"}
      </button>

      {open && (
        <div className="mt-2 rounded-xl2 border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="tap-target px-2 text-gray-500"
            >
              ‹
            </button>
            <p className="text-sm font-medium text-gray-900">
              {viewDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </p>
            <button
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="tap-target px-2 text-gray-500"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400">
            {WEEKDAY_LABELS.map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day == null) return <div key={i} />;
              const dateStr = ymd(new Date(year, month, day));
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              return (
                <button
                  key={i}
                  onClick={() => onSelect(dateStr)}
                  className={`tap-target rounded-full py-1 text-xs ${
                    isSelected
                      ? "bg-brand-600 text-white"
                      : isToday
                      ? "bg-brand-100 font-medium text-brand-700"
                      : "text-gray-700"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          {selectedDate && (
            <button
              onClick={() => onSelect(null)}
              className="tap-target mt-2 w-full text-center text-xs text-gray-500 underline"
            >
              Clear date filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
