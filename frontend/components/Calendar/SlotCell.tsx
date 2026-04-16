import type { TimeSlot } from "@/lib/types";
import { formatTime } from "@/lib/utils";

interface SlotCellProps {
  slot?: TimeSlot;
  onClick?: (slot: TimeSlot) => void;
}

const statusConfig = {
  free: {
    bg: "bg-green-50 hover:bg-green-100 border-green-200 cursor-pointer",
    dot: "bg-green-400",
    label: "Free",
    text: "text-green-700",
  },
  booked: {
    bg: "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 cursor-pointer",
    dot: "bg-indigo-500",
    label: "Booked",
    text: "text-indigo-700",
  },
  blocked: {
    bg: "bg-gray-50 border-gray-200 cursor-default",
    dot: "bg-gray-300",
    label: "Blocked",
    text: "text-gray-400",
  },
};

export function SlotCell({ slot, onClick }: SlotCellProps) {
  if (!slot) {
    // No slot defined for this time on this day
    return (
      <div className="h-14 rounded-md border border-dashed border-gray-100 bg-gray-50/50" />
    );
  }

  const cfg = statusConfig[slot.status];

  return (
    <button
      onClick={() => onClick?.(slot)}
      disabled={slot.status === "blocked"}
      className={`
        h-14 w-full rounded-md border px-2 py-1.5 text-left transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1
        ${cfg.bg}
      `}
    >
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${cfg.dot}`} />
        <span className={`text-xs font-medium ${cfg.text}`}>
          {formatTime(slot.startTime)}
        </span>
      </div>
      <p className={`mt-0.5 text-xs ${cfg.text} opacity-75`}>{cfg.label}</p>
    </button>
  );
}
