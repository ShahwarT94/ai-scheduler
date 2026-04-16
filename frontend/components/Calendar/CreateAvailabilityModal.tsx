"use client";

import { useMemo, useState } from "react";
import { createSlots } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { today } from "@/lib/utils";

// ─── Slot preview ─────────────────────────────────────────────────────────────

function timeToMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function previewSlots(startTime: string, endTime: string, duration: number): string[] {
  if (!startTime || !endTime || duration <= 0) return [];
  const start = timeToMins(startTime);
  const end = timeToMins(endTime);
  const slots: string[] = [];
  for (let t = start; t + duration <= end; t += duration) {
    const h = String(Math.floor(t / 60)).padStart(2, "0");
    const m = String(t % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
  }
  return slots;
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
}

const DURATION_OPTIONS = [
  { label: "30 minutes", value: 30 },
  { label: "45 minutes", value: 45 },
  { label: "60 minutes (1 hr)", value: 60 },
  { label: "90 minutes (1.5 hr)", value: 90 },
];

// ─── Modal ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateAvailabilityModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>({
    date: today(),
    startTime: "09:00",
    endTime: "17:00",
    duration: 60,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  // Live preview of slots that would be created
  const preview = useMemo(
    () => previewSlots(form.startTime, form.endTime, form.duration),
    [form.startTime, form.endTime, form.duration]
  );

  // Client-side validation
  function validate(): string | null {
    if (!form.date) return "Date is required";
    if (!form.startTime) return "Start time is required";
    if (!form.endTime) return "End time is required";
    if (timeToMins(form.startTime) >= timeToMins(form.endTime))
      return "End time must be after start time";
    if (preview.length === 0) return "No slots fit in the selected time range";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError(null);
    try {
      const result = await createSlots({
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        duration: form.duration,
      });
      setSuccessCount(result.created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create slots");
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    onCreated(); // triggers calendar refresh
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl ring-1 ring-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Create Availability</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Success state */}
        {successCount !== null ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-900">
              {successCount} slot{successCount !== 1 ? "s" : ""} created
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {form.date} &middot; {form.startTime}–{form.endTime}
            </p>
            <Button className="mt-6 w-full" onClick={handleDone}>
              Done
            </Button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Date
              </label>
              <input
                type="date"
                required
                value={form.date}
                min={today()}
                onChange={(e) => set("date", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Time range */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Time Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  required
                  value={form.startTime}
                  onChange={(e) => set("startTime", e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-400">to</span>
                <input
                  type="time"
                  required
                  value={form.endTime}
                  onChange={(e) => set("endTime", e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Slot Duration
              </label>
              <select
                value={form.duration}
                onChange={(e) => set("duration", Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Slot preview */}
            {preview.length > 0 && (
              <div className="rounded-lg bg-indigo-50 px-4 py-3 ring-1 ring-indigo-100">
                <p className="text-xs font-semibold text-indigo-700">
                  {preview.length} slot{preview.length !== 1 ? "s" : ""} will be created
                </p>
                <p className="mt-1 text-xs text-indigo-500 leading-relaxed">
                  {preview.slice(0, 8).join(", ")}
                  {preview.length > 8 && ` … +${preview.length - 8} more`}
                </p>
              </div>
            )}

            {/* Validation / API error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 ring-1 ring-red-100">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                loading={loading}
                disabled={preview.length === 0}
              >
                Create {preview.length > 0 ? `${preview.length} Slot${preview.length !== 1 ? "s" : ""}` : "Slots"}
              </Button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}
