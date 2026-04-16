import { v4 as uuidv4 } from "uuid";
import { getItem, putItem, transactBookSlot } from "./dynamo";
import { slotKeys } from "./slots";
import type { Booking, Exception, TimeSlot } from "../types";

// ─── Typed error ──────────────────────────────────────────────────────────────

/**
 * Thrown by createBooking when the slot is not free at write time.
 * Callers should treat this as "slot unavailable" and create an exception.
 */
export class SlotUnavailableError extends Error {
  constructor(date: string, time: string) {
    super(`Slot ${date} ${time} is not available`);
    this.name = "SlotUnavailableError";
  }
}

// ─── Slot lookup ──────────────────────────────────────────────────────────────

/**
 * Returns the slot if it exists and is free, otherwise null.
 * Used before creating a booking to verify availability.
 */
export async function findFreeSlot(
  coachId: string,
  date: string,
  time: string  // HH:MM — must match slot startTime exactly
): Promise<TimeSlot | null> {
  type RawSlot = TimeSlot & { PK: string; SK: string; GSI1PK: string; GSI1SK: string };

  const { PK, SK } = slotKeys(coachId, date, time);
  const item = await getItem<RawSlot>(PK, SK);

  if (!item) return null;
  if (item.status !== "free") return null;

  const { PK: _pk, SK: _sk, GSI1PK: _g1pk, GSI1SK: _g1sk, ...slot } = item;
  return slot as TimeSlot;
}

// ─── Booking creation ─────────────────────────────────────────────────────────

/**
 * Atomically creates a Booking record and marks the slot as "booked"
 * using a DynamoDB TransactWrite with a conditional check on the slot.
 *
 * The slot update only succeeds if status is currently "free" — this prevents
 * double-booking even under concurrent requests (the check-then-act is atomic).
 *
 * Throws SlotUnavailableError if the slot was already booked or blocked.
 */
export async function createBooking(
  coachId: string,
  parentPhone: string,
  slot: TimeSlot,
  kidId?: string
): Promise<Booking> {
  const bookingId = uuidv4();
  const now = new Date().toISOString();

  const booking: Booking = {
    bookingId,
    coachId,
    parentPhone,
    kidId,
    slotDate: slot.date,
    slotTime: slot.startTime,
    status: "confirmed",
    createdAt: now,
  };

  const bookingItem: Record<string, unknown> = {
    PK: `BOOKING#${bookingId}`,
    SK: "METADATA",
    GSI1PK: `COACH#${coachId}`,
    GSI1SK: `BOOKING#${slot.date}#${slot.startTime}`,
    ...booking,
  };

  const { PK: slotPK, SK: slotSK } = slotKeys(coachId, slot.date, slot.startTime);

  try {
    await transactBookSlot(bookingItem, slotPK, slotSK);
  } catch (err) {
    // DynamoDB throws TransactionCanceledException when any condition fails.
    // Both conditions (slot free + booking not exists) map to the same outcome
    // from the caller's perspective: the slot is no longer bookable.
    const name = (err as { name?: string }).name ?? "";
    if (name === "TransactionCanceledException") {
      throw new SlotUnavailableError(slot.date, slot.startTime);
    }
    throw err; // re-throw unexpected errors
  }

  return booking;
}

// ─── Exception creation ───────────────────────────────────────────────────────

/**
 * Creates an Exception record for coach review.
 * Used when intent is unclear, alternative, or the requested slot is unavailable.
 */
export async function createException(
  coachId: string,
  parentPhone: string,
  messageBody: string,
  reason: string
): Promise<Exception> {
  const exceptionId = uuidv4();
  const now = new Date().toISOString();

  const exception: Exception = {
    exceptionId,
    coachId,
    parentPhone,
    messageBody,
    reason,
    status: "pending",
    createdAt: now,
  };

  await putItem({
    PK: `EXCEPTION#${exceptionId}`,
    SK: "METADATA",
    GSI1PK: `COACH#${coachId}`,
    GSI1SK: `EXCEPTION#${now}`,
    ...exception,
  });

  return exception;
}
