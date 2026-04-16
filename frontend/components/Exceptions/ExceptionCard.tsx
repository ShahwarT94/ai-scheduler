"use client";

import { useState } from "react";
import { resolveException } from "@/lib/api";
import type { Exception } from "@/lib/types";
import { formatTimestamp, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

interface ExceptionCardProps {
  exception: Exception;
  onResolved: (id: string) => void;
}

interface BookForm {
  slotDate: string;
  slotTime: string;
}

export function ExceptionCard({ exception, onResolved }: ExceptionCardProps) {
  const [bookMode, setBookMode] = useState(false);
  const [form, setForm] = useState<BookForm>({ slotDate: "", slotTime: "" });
  const [loading, setLoading] = useState<"book" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isResolved = exception.status === "resolved";

  async function handleDismiss() {
    setLoading("dismiss");
    setError(null);
    try {
      await resolveException(exception.exceptionId, "dismiss");
      onResolved(exception.exceptionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss");
    } finally {
      setLoading(null);
    }
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!form.slotDate || !form.slotTime) return;
    setLoading("book");
    setError(null);
    try {
      await resolveException(
        exception.exceptionId,
        "book",
        form.slotDate,
        form.slotTime
      );
      onResolved(exception.exceptionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book slot");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {exception.parentPhone}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {formatTimestamp(exception.createdAt)} · {timeAgo(exception.createdAt)}
            </p>
          </div>
          <Badge variant={isResolved ? "gray" : "yellow"}>
            {isResolved ? `Resolved · ${exception.resolvedAction}` : "Pending"}
          </Badge>
        </div>

        {/* Parent message */}
        <div className="rounded-lg bg-gray-50 px-3 py-2.5">
          <p className="text-xs font-medium text-gray-400">Parent message</p>
          <p className="mt-1 text-sm text-gray-800">&ldquo;{exception.messageBody}&rdquo;</p>
        </div>

        {/* AI reason */}
        <div className="flex items-start gap-2">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs text-gray-500">{exception.reason}</p>
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200">
            {error}
          </p>
        )}

        {/* Actions — only for pending exceptions */}
        {!isResolved && (
          <>
            {bookMode ? (
              <form onSubmit={handleBook} className="space-y-2 border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-600">Book a slot for this parent</p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    required
                    value={form.slotDate}
                    onChange={(e) => setForm((f) => ({ ...f, slotDate: e.target.value }))}
                    className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="time"
                    required
                    value={form.slotTime}
                    onChange={(e) => setForm((f) => ({ ...f, slotTime: e.target.value }))}
                    className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" loading={loading === "book"} className="flex-1">
                    Confirm Booking
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setBookMode(false); setError(null); }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex gap-2 border-t border-gray-100 pt-3">
                <Button
                  size="sm"
                  onClick={() => setBookMode(true)}
                  className="flex-1"
                >
                  Book Slot
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={loading === "dismiss"}
                  onClick={handleDismiss}
                  className="flex-1"
                >
                  Dismiss
                </Button>
              </div>
            )}
          </>
        )}

        {/* Resolved info */}
        {isResolved && exception.resolvedAt && (
          <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
            Resolved {formatTimestamp(exception.resolvedAt)}
            {exception.resolvedBookingId && (
              <> · Booking <span className="font-mono">{exception.resolvedBookingId.slice(0, 8)}</span></>
            )}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
