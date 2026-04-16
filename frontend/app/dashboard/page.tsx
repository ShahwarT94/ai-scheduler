"use client";

import { useState } from "react";
import { CalendarView } from "@/components/Calendar/CalendarView";
import { CreateAvailabilityModal } from "@/components/Calendar/CreateAvailabilityModal";
import { Button } from "@/components/ui/Button";

export default function DashboardPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleCreated() {
    // Increment key → CalendarView useEffect re-fires → re-fetches current week
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            View and manage your weekly appointment slots
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Availability
        </Button>
      </div>

      {/* Calendar */}
      <CalendarView refreshKey={refreshKey} />

      {/* Modal */}
      {modalOpen && (
        <CreateAvailabilityModal
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
