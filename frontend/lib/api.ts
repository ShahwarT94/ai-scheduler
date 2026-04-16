import type { Booking, Exception, TimeSlot } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const COACH_ID = process.env.NEXT_PUBLIC_COACH_ID ?? "";

// ─── Base fetch ───────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Request failed: ${res.status}`
    );
  }

  const json = await res.json() as { success: boolean; data: T };
  return json.data;
}

// ─── Slots ────────────────────────────────────────────────────────────────────

export interface SlotsResponse {
  date: string;
  coachId: string;
  count: number;
  slots: TimeSlot[];
}

export async function getSlots(date: string): Promise<TimeSlot[]> {
  const data = await request<SlotsResponse>(
    `/coach/slots?coachId=${encodeURIComponent(COACH_ID)}&date=${date}`
  );
  return data.slots;
}

export async function createSlots(params: {
  date: string;
  startTime: string;
  endTime: string;
  duration?: number;
}): Promise<{ created: number; skipped: number; slots: TimeSlot[] }> {
  return request(`/coach/slots`, {
    method: "POST",
    body: JSON.stringify({ coachId: COACH_ID, ...params }),
  });
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export interface BookingsResponse {
  coachId: string;
  date: string;
  count: number;
  bookings: Booking[];
}

export async function getBookings(date?: string): Promise<Booking[]> {
  const dateParam = date ? `&date=${date}` : "";
  const data = await request<BookingsResponse>(
    `/coach/bookings?coachId=${encodeURIComponent(COACH_ID)}${dateParam}`
  );
  return data.bookings;
}

// ─── Exceptions ───────────────────────────────────────────────────────────────

export interface ExceptionsResponse {
  coachId: string;
  status: string;
  count: number;
  exceptions: Exception[];
}

export async function getExceptions(
  status?: "pending" | "resolved"
): Promise<Exception[]> {
  const statusParam = status ? `&status=${status}` : "";
  const data = await request<ExceptionsResponse>(
    `/coach/exceptions?coachId=${encodeURIComponent(COACH_ID)}${statusParam}`
  );
  return data.exceptions;
}

export async function resolveException(
  exceptionId: string,
  action: "book" | "dismiss",
  slotDate?: string,
  slotTime?: string
): Promise<{ exceptionId: string; action: string; resolvedAt: string; booking?: Booking }> {
  return request(`/coach/exceptions/${encodeURIComponent(exceptionId)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ action, slotDate, slotTime }),
  });
}
