/**
 * POST /coach/slots
 *
 * Body: { coachId, date, startTime, endTime, duration? }
 *
 * Generates hourly slots for the given time window and writes them to
 * DynamoDB using a batch write. Skips slots that already exist (no overwrite).
 *
 * Returns the list of newly created slots.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { batchPutItems, queryItems } from "../../lib/dynamo";
import { generateSlots, slotToItem } from "../../lib/slots";
import { badRequest, created, serverError } from "../../lib/response";
import * as v from "../../lib/validate";
import type { CreateSlotsRequest, TimeSlot } from "../../types";

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // ── Parse body ────────────────────────────────────────────────────────
    const parsed = v.parseJsonBody<Partial<CreateSlotsRequest>>(event.body);
    if (!parsed.ok) return badRequest(parsed.error);

    const { coachId, date, startTime, endTime, duration = 60 } = parsed.value;

    // ── Validate fields ───────────────────────────────────────────────────
    const fieldErrors = [
      v.requireId(coachId, "coachId"),
      v.requireDate(date, "date"),
      v.requireTime(startTime, "startTime"),
      v.requireTime(endTime, "endTime"),
      duration !== 60
        ? v.requirePositiveInt(duration, "duration", 1, 480)
        : null,
    ].filter(Boolean);

    if (fieldErrors.length > 0) return badRequest(fieldErrors[0] as string);

    // ── Generate slots ────────────────────────────────────────────────────
    let newSlots: TimeSlot[];
    try {
      newSlots = generateSlots(coachId!, date!, startTime!, endTime!, duration);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : "Invalid slot range");
    }

    if (newSlots.length === 0) {
      return badRequest("No slots could be generated for the given time range");
    }

    // ── Avoid overwriting already-existing slots ───────────────────────────
    // Fetch existing slots for this coach + date and filter them out.
    type DynamoSlot = TimeSlot & { PK: string; SK: string };
    const existing = await queryItems<DynamoSlot>(
      `COACH#${coachId}`,
      `SLOT#${date}#`
    );
    const existingTimes = new Set(existing.map((s) => s.startTime));

    const slotsToWrite = newSlots.filter(
      (s) => !existingTimes.has(s.startTime)
    );

    if (slotsToWrite.length === 0) {
      return badRequest("All slots in this range already exist");
    }

    // ── Write to DynamoDB ─────────────────────────────────────────────────
    const items = slotsToWrite.map(slotToItem);
    await batchPutItems(items);

    return created({
      created: slotsToWrite.length,
      skipped: newSlots.length - slotsToWrite.length,
      slots: slotsToWrite,
    });
  } catch (err) {
    return serverError(err);
  }
}
