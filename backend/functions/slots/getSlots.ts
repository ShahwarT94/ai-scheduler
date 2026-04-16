/**
 * GET /coach/slots?coachId=xxx&date=YYYY-MM-DD
 *
 * Returns all time slots for a coach on a given date, sorted by startTime.
 * Each slot includes its current status: free | booked | blocked.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { queryItems } from "../../lib/dynamo";
import { badRequest, ok, serverError } from "../../lib/response";
import * as v from "../../lib/validate";
import type { TimeSlot } from "../../types";

type DynamoSlot = TimeSlot & { PK: string; SK: string; GSI1PK: string; GSI1SK: string };

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // ── Validate query params ─────────────────────────────────────────────
    const { coachId, date } = event.queryStringParameters ?? {};

    const paramErrors = [
      v.requireId(coachId, "coachId"),
      v.requireDate(date, "date"),
    ].filter(Boolean);

    if (paramErrors.length > 0) return badRequest(paramErrors[0] as string);

    // ── Query DynamoDB ────────────────────────────────────────────────────
    // PK = "COACH#<coachId>", SK begins_with "SLOT#<date>#"
    const rawItems = await queryItems<DynamoSlot>(
      `COACH#${coachId}`,
      `SLOT#${date}#`
    );

    // ── Strip DynamoDB keys, sort by startTime ────────────────────────────
    const slots: TimeSlot[] = rawItems
      .map(({ PK: _pk, SK: _sk, GSI1PK: _g1pk, GSI1SK: _g1sk, ...slot }) => slot)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return ok({
      date,
      coachId,
      count: slots.length,
      slots,
    });
  } catch (err) {
    return serverError(err);
  }
}
