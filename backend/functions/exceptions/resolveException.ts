/**
 * POST /coach/exceptions/{id}/resolve
 *
 * Body:
 *   { action: "book",    slotDate: "YYYY-MM-DD", slotTime: "HH:MM" }
 *   { action: "dismiss" }
 *
 * "book"    → find the specified slot, create a booking for the parent who
 *             sent the original message, mark exception resolved.
 * "dismiss" → mark exception resolved with no booking created.
 *
 * Idempotent: resolving an already-resolved exception returns 409.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { getItem, updateItem } from "../../lib/dynamo";
import { findFreeSlot, createBooking, SlotUnavailableError } from "../../lib/booking";
import { ok, badRequest, notFound, serverError } from "../../lib/response";
import { log } from "../../lib/logger";
import * as v from "../../lib/validate";
import type { Exception } from "../../types";

type RawException = Exception & { PK: string; SK: string };

interface ResolveBody {
  action: "book" | "dismiss";
  slotDate?: string;
  slotTime?: string;
}

// ─── 409 helper (not in response.ts yet) ─────────────────────────────────────

function conflict(message: string): APIGatewayProxyResult {
  return {
    statusCode: 409,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: false, error: message }),
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  log.setRequestId(context.awsRequestId);

  try {
    // ── Validate path param ───────────────────────────────────────────────
    const exceptionId = event.pathParameters?.id;
    const idErr = v.requireId(exceptionId, "id");
    if (idErr) return badRequest(idErr);

    // ── Parse body ────────────────────────────────────────────────────────
    const parsed = v.parseJsonBody<Partial<ResolveBody>>(event.body);
    if (!parsed.ok) return badRequest(parsed.error);

    const { action, slotDate, slotTime } = parsed.value;

    // ── Validate fields ───────────────────────────────────────────────────
    const actionErr = v.requireEnum(action, "action", ["book", "dismiss"] as const);
    if (actionErr) return badRequest(actionErr);

    if (action === "book") {
      const bookFieldErrors = [
        v.requireDate(slotDate, "slotDate"),
        v.requireTime(slotTime, "slotTime"),
      ].filter(Boolean);
      if (bookFieldErrors.length > 0) return badRequest(bookFieldErrors[0] as string);
    }

    // ── Fetch exception ───────────────────────────────────────────────────
    const raw = await getItem<RawException>(
      `EXCEPTION#${exceptionId}`,
      "METADATA"
    );

    if (!raw) return notFound(`Exception ${exceptionId} not found`);

    const { PK: _pk, SK: _sk, ...exception } = raw;

    // ── Guard: already resolved ───────────────────────────────────────────
    if (exception.status === "resolved") {
      return conflict(
        `Exception ${exceptionId} is already resolved ` +
        `(action: ${exception.resolvedAction ?? "unknown"})`
      );
    }

    const resolvedAt = new Date().toISOString();

    // ── Route by action ───────────────────────────────────────────────────
    if (action === "book") {
      const slot = await findFreeSlot(exception.coachId, slotDate!, slotTime!);

      if (!slot) {
        log.warn("resolve_exception_slot_unavailable", {
          exceptionId,
          slotDate,
          slotTime,
          coachId: exception.coachId,
        });
        return badRequest(
          `Slot ${slotDate} ${slotTime} is not available. ` +
          `Pick a different slot or dismiss the exception.`
        );
      }

      let booking;
      try {
        booking = await createBooking(
          exception.coachId,
          exception.parentPhone,
          slot
        );
      } catch (err) {
        if (err instanceof SlotUnavailableError) {
          return badRequest(
            `Slot ${slotDate} ${slotTime} was just taken. ` +
            `Pick a different slot or dismiss the exception.`
          );
        }
        throw err;
      }

      // Mark exception resolved with booking reference
      await updateItem(
        `EXCEPTION#${exceptionId}`,
        "METADATA",
        {
          status: "resolved",
          resolvedAt,
          resolvedAction: "book",
          resolvedBookingId: booking.bookingId,
        }
      );

      log.info("resolve_exception", {
        exceptionId,
        action: "book",
        bookingId: booking.bookingId,
        slotDate,
        slotTime,
        parentPhone: exception.parentPhone,
      });

      return ok({
        exceptionId,
        action: "book",
        resolvedAt,
        booking,
      });
    } else {
      // action = "dismiss"
      await updateItem(
        `EXCEPTION#${exceptionId}`,
        "METADATA",
        {
          status: "resolved",
          resolvedAt,
          resolvedAction: "dismiss",
        }
      );

      log.info("resolve_exception", {
        exceptionId,
        action: "dismiss",
        parentPhone: exception.parentPhone,
      });

      return ok({ exceptionId, action: "dismiss", resolvedAt });
    }
  } catch (err) {
    log.error("resolve_exception_failed", {
      exceptionId: event.pathParameters?.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return serverError(err);
  }
}
