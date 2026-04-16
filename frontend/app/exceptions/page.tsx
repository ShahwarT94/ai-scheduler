"use client";

import { useCallback, useEffect, useState } from "react";
import { getExceptions } from "@/lib/api";
import type { Exception } from "@/lib/types";
import { ExceptionCard } from "@/components/Exceptions/ExceptionCard";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

type Tab = "pending" | "resolved";

// ─── Skeleton card ────────────────────────────────────────────────────────────

function ExceptionCardSkeleton() {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 flex-1 rounded-lg" />
        <Skeleton className="h-8 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExceptionsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: Tab) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExceptions(status);
      setExceptions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exceptions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  function handleResolved(id: string) {
    setExceptions((prev) => prev.filter((e) => e.exceptionId !== id));
  }

  const isEmpty = !loading && !error && exceptions.length === 0;

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Exceptions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Messages the AI couldn&apos;t resolve automatically — review and act on each one.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(["pending", "resolved"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Loading — skeleton cards */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ExceptionCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <ErrorState
          message={error}
          onRetry={() => load(tab)}
          className="max-w-md"
        />
      )}

      {/* Empty state */}
      {isEmpty && tab === "pending" && (
        <EmptyState
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="All caught up"
          description="No pending exceptions — every message has been handled."
        />
      )}

      {isEmpty && tab === "resolved" && (
        <EmptyState
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          }
          title="No resolved exceptions yet"
          description="Exceptions you book or dismiss will appear here."
        />
      )}

      {/* Exception cards */}
      {!loading && !error && exceptions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={tab === "pending" ? "yellow" : "gray"}>
              {exceptions.length}
            </Badge>
            <span className="text-sm text-gray-500">
              {tab} exception{exceptions.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exceptions.map((ex) => (
              <ExceptionCard
                key={ex.exceptionId}
                exception={ex}
                onResolved={handleResolved}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
