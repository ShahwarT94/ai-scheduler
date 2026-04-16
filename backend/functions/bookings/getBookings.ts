/**
 * GET /coach/bookings?coachId=xxx
 * GET /coach/bookings?coachId=xxx&date=YYYY-MM-DD
 *
 * Returns all bookings for a coach, optionally filtered to a single date.
 * Results are sorted by slotDate + slotTime ascending.
 *
 * Access pattern: GSI1PK = "COACH#<coachId>", GSI1SK begins_with "BOOKING#<date>"
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { queryByGSI } from "../../lib/dynamo";
import { ok, badRequest, serverError } from "../../lib/response";
import { log } from "../../lib/logger";
import * as v from "../../lib/validate";
import type { Booking } from "../../types";

type RawBooking = Booking & { PK: string; SK: string; GSI1PK: string; GSI1SK: string };

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  log.setRequestId(context.awsRequestId);

  try {
    // ── Validate query params ─────────────────────────────────────────────
    const { coachId, date } = event.queryStringParameters ?? {};

    const paramErrors = [
      v.requireId(coachId, "coachId"),
      v.optionalDate(date, "date"),
    ].filter(Boolean);

    if (paramErrors.length > 0) return badRequest(paramErrors[0] as string);

    // ── Query GSI1 ────────────────────────────────────────────────────────
    // With date:    GSI1SK begins_with "BOOKING#2026-04-15"
    // Without date: GSI1SK begins_with "BOOKING#"  (all bookings)
    const skPrefix = date ? `BOOKING#${date}` : "BOOKING#";
    const rawItems = await queryByGSI<RawBooking>(`COACH#${coachId}`, skPrefix);

    // ── Strip DynamoDB keys, sort by date + time ──────────────────────────
    const bookings: Booking[] = rawItems
      .map(({ PK: _pk, SK: _sk, GSI1PK: _g1pk, GSI1SK: _g1sk, ...booking }) => booking)
      .sort((a, b) => {
        const aKey = `${a.slotDate}#${a.slotTime}`;
        const bKey = `${b.slotDate}#${b.slotTime}`;
        return aKey.localeCompare(bKey);
      });

    log.info("get_bookings", { coachId, date: date ?? "all", count: bookings.length });

    return ok({ coachId, date: date ?? "all", count: bookings.length, bookings });
  } catch (err) {
    log.error("get_bookings_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return serverError(err);
  }
}
