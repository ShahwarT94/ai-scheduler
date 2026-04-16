import type { TimeSlot } from "../types";

/**
 * Parses "HH:MM" into total minutes from midnight.
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Converts total minutes from midnight back to "HH:MM".
 */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Generates hourly (or custom-duration) TimeSlot objects for a given date
 * between startTime and endTime.
 *
 * Example: startTime="09:00", endTime="12:00", duration=60
 *   → slots at 09:00, 10:00, 11:00
 */
export function generateSlots(
  coachId: string,
  date: string,
  startTime: string,
  endTime: string,
  duration = 60
): TimeSlot[] {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (start >= end) {
    throw new Error(`startTime (${startTime}) must be before endTime (${endTime})`);
  }
  if (duration <= 0 || duration > 480) {
    throw new Error("duration must be between 1 and 480 minutes");
  }

  const slots: TimeSlot[] = [];
  let cursor = start;

  while (cursor + duration <= end) {
    slots.push({
      coachId,
      date,
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(cursor + duration),
      status: "free",
      duration,
    });
    cursor += duration;
  }

  return slots;
}

/**
 * Builds the DynamoDB PK / SK keys for a slot.
 * PK  = "COACH#<coachId>"
 * SK  = "SLOT#<date>#<startTime>"   e.g. "SLOT#2026-04-15#09:00"
 */
export function slotKeys(
  coachId: string,
  date: string,
  startTime: string
): { PK: string; SK: string } {
  return {
    PK: `COACH#${coachId}`,
    SK: `SLOT#${date}#${startTime}`,
  };
}

/**
 * Serializes a TimeSlot into the DynamoDB item shape.
 */
export function slotToItem(slot: TimeSlot): Record<string, unknown> {
  const keys = slotKeys(slot.coachId, slot.date, slot.startTime);
  return {
    ...keys,
    GSI1PK: `SLOT#${slot.date}`,
    GSI1SK: `COACH#${slot.coachId}`,
    ...slot,
  };
}
