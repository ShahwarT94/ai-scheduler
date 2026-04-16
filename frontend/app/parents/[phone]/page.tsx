"use client";

import { useCallback, useEffect, useState } from "react";
import { getBookings } from "@/lib/api";
import type { Booking, Message } from "@/lib/types";
import { formatShortDate, formatTime, formatTimestamp } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

interface PageProps {
  params: { phone: string };
}

// ─── Skeleton layouts ─────────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    </div>
  );
}

function BookingListSkeleton() {
  return (
    <ul className="divide-y divide-gray-50">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex items-center justify-between px-5 py-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ParentDetailPage({ params }: PageProps) {
  const phone = decodeURIComponent(params.phone);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Placeholder messages — replace with real API call when endpoint is built
  const messages: Message[] = [];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getBookings();
      setBookings(all.filter((b) => b.parentPhone === phone));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-8">

      {/* Header — skeleton until loaded */}
      {loading ? (
        <HeaderSkeleton />
      ) : (
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            {phone.slice(-2)}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{phone}</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Parent &middot;{" "}
              {error ? "—" : `${bookings.length} booking${bookings.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <ErrorState
          message={error}
          onRetry={load}
          className="max-w-md"
        />
      )}

      {/* Content grid */}
      {!error && (
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Appointments */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Appointments</h2>
              {!loading && bookings.length > 0 && (
                <Badge variant="blue">{bookings.length}</Badge>
              )}
            </CardHeader>
            <CardBody className="p-0">
              {loading ? (
                <BookingListSkeleton />
              ) : bookings.length === 0 ? (
                <div className="px-5 py-10">
                  <EmptyState
                    icon={
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                    }
                    title="No appointments yet"
                    description="Bookings for this parent will appear here."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {bookings.map((b) => (
                    <li
                      key={b.bookingId}
                      className="flex items-center justify-between px-5 py-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatShortDate(b.slotDate)} at {formatTime(b.slotTime)}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          Booked {formatTimestamp(b.createdAt)}
                        </p>
                      </div>
                      <Badge variant={b.status === "confirmed" ? "green" : "gray"}>
                        {b.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Message thread */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Message Thread</h2>
            </CardHeader>
            <CardBody className={messages.length > 0 ? "max-h-96 overflow-y-auto" : ""}>
              {messages.length === 0 ? (
                <EmptyState
                  icon={
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  }
                  title="No messages yet"
                  description="SMS conversations with this parent will appear here."
                />
              ) : (
                <ul className="space-y-3">
                  {messages.map((m) => (
                    <li
                      key={`${m.parentPhone}-${m.timestamp}`}
                      className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                          m.direction === "outbound"
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <p>{m.body}</p>
                        <p className={`mt-1 text-xs ${
                          m.direction === "outbound" ? "text-indigo-200" : "text-gray-400"
                        }`}>
                          {formatTimestamp(m.timestamp)}
                          {m.parsedIntent && (
                            <span className="ml-2 rounded bg-white/20 px-1">
                              {m.parsedIntent}
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

        </div>
      )}

      {/* Back link */}
      <div className="pt-2">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          ← Back
        </Button>
      </div>

    </div>
  );
}
