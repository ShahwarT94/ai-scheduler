"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSlots } from "@/lib/api";
import type { TimeSlot } from "@/lib/types";
import {
  formatShortDate,
  formatWeekday,
  shiftWeek,
  today,
  weekDays,
  weekStart,
} from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlotCell } from "./SlotCell";

// ─── Slot detail modal ────────────────────────────────────────────────────────

function SlotModal({ slot, onClose }: { slot: TimeSlot; onClose: () => void }) {
  const statusLabels = { free: "Available", booked: "Booked", blocked: "Blocked" };
  const statusColors = { free: "text-green-600", booked: "text-indigo-600", blocked: "text-gray-500" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl ring-1 ring-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900">Slot Details</h3>
        <dl className="mt-4 space-y-3 text-sm">
          {[
            ["Date", slot.date],
            ["Time", `${slot.startTime} – ${slot.endTime}`],
            ["Duration", `${slot.duration} min`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-gray-500">{label}</dt>
              <dd className="font-medium text-gray-900">{value}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Status</dt>
            <dd className={`font-semibold ${statusColors[slot.status]}`}>
              {statusLabels[slot.status]}
            </dd>
          </div>
        </dl>
        <Button variant="secondary" className="mt-6 w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

// ─── Skeleton table body ──────────────────────────────────────────────────────
// Shown on initial load. Mirrors the exact row/cell shape of real data so the
// layout doesn't reflow when content arrives.

const SKELETON_ROWS = 5;
const SKELETON_COLS = 7;

function CalendarSkeleton() {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }).map((_, row) => (
        <tr key={row} className="border-b border-gray-50 last:border-0">
          <td className="w-16 px-2 py-1.5">
            <Skeleton className="ml-auto h-3 w-10" />
          </td>
          {Array.from({ length: SKELETON_COLS }).map((_, col) => (
            <td key={col} className="px-1.5 py-1.5">
              <Skeleton className="h-14 w-full rounded-md" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Main calendar ────────────────────────────────────────────────────────────

interface CalendarViewProps {
  /** Increment this value from the parent to trigger a re-fetch of the current week. */
  refreshKey?: number;
}

export function CalendarView({ refreshKey = 0 }: CalendarViewProps) {
  const [monday, setMonday] = useState<Date>(() => weekStart(today()));
  const [slotsByDate, setSlotsByDate] = useState<Record<string, TimeSlot[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TimeSlot | null>(null);

  const days = useMemo(() => weekDays(monday), [monday]);
  const todayStr = today();

  const fetchWeek = useCallback(async (days: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(days.map((d) => getSlots(d)));
      const map: Record<string, TimeSlot[]> = {};
      days.forEach((d, i) => { map[d] = results[i]; });
      setSlotsByDate(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load slots");
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when the week changes OR when the parent signals new data (refreshKey)
  useEffect(() => { fetchWeek(days); }, [days, fetchWeek, refreshKey]);

  const timeRows = useMemo(() => {
    const times = new Set<string>();
    Object.values(slotsByDate).flat().forEach((s) => times.add(s.startTime));
    return [...times].sort();
  }, [slotsByDate]);

  const isEmpty = !loading && !error && timeRows.length === 0;

  return (
    <div className="flex flex-col gap-5">

      {/* Week navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => setMonday((m) => shiftWeek(m, -1))}
          >
            ← Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => setMonday((m) => shiftWeek(m, 1))}
          >
            Next →
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={() => setMonday(weekStart(today()))}
          >
            Today
          </Button>
        </div>
        <p className="text-sm font-medium text-gray-600">
          {formatShortDate(days[0])} – {formatShortDate(days[6])}
        </p>
      </div>

      {/* Error state */}
      {error && (
        <ErrorState
          message={error}
          onRetry={() => fetchWeek(days)}
        />
      )}

      {/* Calendar grid — always rendered (skeleton during load, real during data) */}
      {!error && (
        <div className={`overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200 transition-opacity duration-200 ${loading ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
          <table className="min-w-full table-fixed">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-16 px-2 py-3" />
                {days.map((d) => (
                  <th
                    key={d}
                    className={`px-2 py-3 text-center text-xs font-medium ${
                      d === todayStr ? "text-indigo-600" : "text-gray-500"
                    }`}
                  >
                    <span className="block">{formatWeekday(d)}</span>
                    <span
                      className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold ${
                        d === todayStr ? "bg-indigo-600 text-white" : "text-gray-800"
                      }`}
                    >
                      {new Date(`${d}T00:00:00`).getDate()}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <CalendarSkeleton />}

              {!loading && timeRows.map((time) => (
                <tr key={time} className="border-b border-gray-50 last:border-0">
                  <td className="w-16 px-2 py-1.5 text-right text-xs text-gray-400">
                    {time}
                  </td>
                  {days.map((d) => {
                    const slot = (slotsByDate[d] ?? []).find((s) => s.startTime === time);
                    return (
                      <td key={d} className="px-1.5 py-1.5">
                        <SlotCell slot={slot} onClick={setSelected} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state — outside the table so it has full layout width */}
      {isEmpty && (
        <EmptyState
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          }
          title="No slots this week"
          description="No availability has been set for this week. Use the API to create slots."
        />
      )}

      {/* Legend */}
      {!loading && !error && !isEmpty && (
        <div className="flex flex-wrap gap-5 text-xs text-gray-500">
          {[
            { color: "bg-green-400", label: "Free" },
            { color: "bg-indigo-500", label: "Booked" },
            { color: "bg-gray-300", label: "Blocked" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${color}`} />
              {label}
            </span>
          ))}
        </div>
      )}

      {selected && (
        <SlotModal slot={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
