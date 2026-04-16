/**
 * GET /coach/exceptions?coachId=xxx
 * GET /coach/exceptions?coachId=xxx&status=pending
 *
 * Returns exceptions for a coach, optionally filtered by status.
 * Results are sorted by createdAt descending (newest first) so the coach
 * sees the most recent items requiring attention at the top.
 *
 * Access pattern: GSI1PK = "COACH#<coachId>", GSI1SK begins_with "EXCEPTION#"
 * Status filter is applied client-side (not a key attribute on the GSI).
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { queryByGSI } from "../../lib/dynamo";
import { ok, badRequest, serverError } from "../../lib/response";
import { log } from "../../lib/logger";
import * as v from "../../lib/validate";
import type { Exception, ExceptionStatus } from "../../types";

type RawException = Exception & { PK: string; SK: string; GSI1PK: string; GSI1SK: string };

const VALID_STATUSES: readonly ExceptionStatus[] = ["pending", "resolved"];

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  log.setRequestId(context.awsRequestId);

  try {
    // ── Validate query params ─────────────────────────────────────────────
    const { coachId, status } = event.queryStringParameters ?? {};

    const paramErrors = [
      v.requireId(coachId, "coachId"),
      v.optionalEnum(status, "status", VALID_STATUSES),
    ].filter(Boolean);

    if (paramErrors.length > 0) return badRequest(paramErrors[0] as string);

    // ── Query GSI1 ────────────────────────────────────────────────────────
    const rawItems = await queryByGSI<RawException>(
      `COACH#${coachId}`,
      "EXCEPTION#"
    );

    // ── Strip DynamoDB keys ───────────────────────────────────────────────
    let exceptions: Exception[] = rawItems.map(
      ({ PK: _pk, SK: _sk, GSI1PK: _g1pk, GSI1SK: _g1sk, ...ex }) => ex
    );

    // ── Filter by status (client-side) ────────────────────────────────────
    if (status) {
      exceptions = exceptions.filter((ex) => ex.status === status);
    }

    // ── Sort newest first ─────────────────────────────────────────────────
    exceptions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    log.info("get_exceptions", {
      coachId,
      status: status ?? "all",
      count: exceptions.length,
    });

    return ok({ coachId, status: status ?? "all", count: exceptions.length, exceptions });
  } catch (err) {
    log.error("get_exceptions_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return serverError(err);
  }
}
