/**
 * POST /webhook/sms
 *
 * Twilio webhook — receives inbound SMS from parents and:
 *   1. Validates the Twilio request signature
 *   2. Stores the inbound message in DynamoDB
 *   3. Calls the AI parser to extract intent (supports multi-booking)
 *   4. Routes by intent:
 *        book        → attempt each requested slot
 *                       • slot free   → create booking
 *                       • slot taken  → suggest alternatives (no exception)
 *        reject      → acknowledge
 *        alternative → create exception for coach review
 *        unclear     → create exception for coach review
 *   5. Returns TwiML <Message> so Twilio sends the reply atomically
 *   6. Stores the outbound message in DynamoDB
 *
 * The reply is embedded in the TwiML response — no separate REST API call needed.
 * This eliminates the failure mode where sendSms() fails and the user gets no reply.
 *
 * Always returns HTTP 200 — Twilio retries non-200 responses indefinitely.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { putItem, queryItems } from "../../lib/dynamo";
import { parseIntent } from "../../lib/ai";
import { findFreeSlot, createBooking, createException, SlotUnavailableError } from "../../lib/booking";
import { validateTwilioSignature, parseFormBody } from "../../lib/twilio";
import { log } from "../../lib/logger";
import type { Message, TimeSlot, BookingSlot } from "../../types";

// ─── Env ──────────────────────────────────────────────────────────────────────

const COACH_ID = process.env.COACH_ID!;

// ─── TwiML helpers ────────────────────────────────────────────────────────────

/**
 * Wraps a reply text in TwiML <Message> so Twilio sends it as an SMS reply.
 * Using TwiML means the message is sent atomically with the webhook response —
 * no separate REST API call, no second failure mode.
 */
/** Shared headers for every TwiML response. */
const TWIML_HEADERS = {
  "Content-Type": "text/xml; charset=utf-8",
};

/**
 * Returns a TwiML response that instructs Twilio to send an SMS reply.
 * The reply is delivered atomically — no separate REST API call required.
 *
 * Characters that are special in XML (&, <, >) are escaped.
 * Non-ASCII / emoji characters are stripped entirely because some XML parsers
 * (including Twilio's) silently reject XML 1.0 docs containing them.
 */
function twimlMessage(text: string): APIGatewayProxyResult {
  const safe = text
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")   // strip non-ASCII / emoji
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim();

  const body = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;

  log.info("twiml_reply", { bodyLength: body.length, preview: body.slice(0, 200) });

  return {
    statusCode: 200,
    headers: TWIML_HEADERS,
    isBase64Encoded: false,
    body,
  };
}

/** Fallback — returned only on fatal errors where no user-specific context is available. */
const FATAL_TWIML: APIGatewayProxyResult = {
  statusCode: 200,
  headers: TWIML_HEADERS,
  isBase64Encoded: false,
  body: '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Something went wrong on our end. Please try again in a moment.</Message></Response>',
};

// ─── Message storage ──────────────────────────────────────────────────────────

async function storeMessage(msg: Record<string, unknown>): Promise<void> {
  await putItem({
    PK: `PARENT#${String(msg.parentPhone)}`,
    SK: `MSG#${String(msg.timestamp)}`,
    ...msg,
  });
}

// ─── Date / time formatting ───────────────────────────────────────────────────

/** "2026-04-17" → "Friday, April 17" */
function friendlyDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "14:00" → "2:00 PM"  |  "09:30" → "9:30 AM" */
function friendlyTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

// ─── Slot helpers ─────────────────────────────────────────────────────────────

/** Returns up to `limit` friendly time strings for free slots on a given date. */
async function getFreeSlotTimes(
  coachId: string,
  date: string,
  limit = 5
): Promise<string[]> {
  type RawSlot = TimeSlot & { PK: string; SK: string };
  const items = await queryItems<RawSlot>(`COACH#${coachId}`, `SLOT#${date}#`);
  return items
    .filter((s) => s.status === "free")
    .slice(0, limit)
    .map((s) => friendlyTime(s.startTime));
}

// ─── Booking one slot ─────────────────────────────────────────────────────────

type SlotOutcome =
  | { status: "booked";      label: string; bookingId: string }
  | { status: "unavailable"; label: string; alternatives: string[] }
  | { status: "incomplete";  label: string };

// ─── Reply builders ───────────────────────────────────────────────────────────

function buildBookingReply(outcomes: SlotOutcome[]): string {
  const booked = outcomes.filter((o): o is Extract<SlotOutcome, { status: "booked" }> =>
    o.status === "booked"
  );
  const unavailable = outcomes.filter((o): o is Extract<SlotOutcome, { status: "unavailable" }> =>
    o.status === "unavailable"
  );
  const incomplete = outcomes.filter((o): o is Extract<SlotOutcome, { status: "incomplete" }> =>
    o.status === "incomplete"
  );

  const parts: string[] = [];

  if (booked.length > 0) {
    const labels = booked.map((o) => o.label);
    if (labels.length === 1) {
      parts.push(`Confirmed! Your appointment is booked for ${labels[0]}. Reply CANCEL to cancel.`);
    } else {
      parts.push(`Confirmed! Appointments booked:\n${labels.map((l) => `- ${l}`).join("\n")}\nReply CANCEL to cancel.`);
    }
  }

  if (unavailable.length > 0) {
    for (const o of unavailable) {
      if (o.alternatives.length > 0) {
        parts.push(
          `Sorry, ${o.label} is not available. Open times on that day: ${o.alternatives.join(", ")}. Reply with one to book!`
        );
      } else {
        parts.push(`Sorry, ${o.label} is not available. A coach will reach out with open times.`);
      }
    }
  }

  if (incomplete.length > 0) {
    parts.push(`I could not understand the time for one of your requests. Please reply with a specific date and time.`);
  }

  return parts.join("\n\n");
}

const REPLY_REJECT =
  "Got it - no problem! Reach out anytime if you would like to reschedule.";

const REPLY_ALTERNATIVE =
  "Thanks! We will check availability for your preferred time and get back to you shortly.";

const REPLY_UNCLEAR =
  "Thanks for your message! A coach will review and follow up with you shortly.";

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  log.setRequestId(context.awsRequestId);

  try {
    return await handleInner(event, context);
  } catch (fatal) {
    log.error("handler_fatal", {
      error: fatal instanceof Error ? fatal.message : String(fatal),
      stack: fatal instanceof Error ? fatal.stack : undefined,
    });
    return FATAL_TWIML;
  }
}

async function handleInner(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  log.info("handler_invoked", {
    isBase64Encoded: event.isBase64Encoded ?? false,
    bodyLength: (event.body ?? "").length,
  });

  // ── 1. Parse body ───────────────────────────────────────────────────────
  const rawBody = event.body ?? "";
  const params = parseFormBody(rawBody, event.isBase64Encoded);

  // ── 2. Validate Twilio signature ─────────────────────────────────────────
  const signature =
    event.headers["X-Twilio-Signature"] ??
    event.headers["x-twilio-signature"] ??
    "";
  const webhookUrl = process.env.WEBHOOK_URL ?? "";
  const skipValidation = process.env.SKIP_TWILIO_VALIDATION === "true";

  if (!skipValidation && !validateTwilioSignature(webhookUrl, params, signature)) {
    log.warn("signature_invalid", {
      webhookUrl,
      signaturePresent: signature.length > 0,
      isBase64Encoded: event.isBase64Encoded ?? false,
      parsedParamKeys: Object.keys(params).sort(),
    });
    return { statusCode: 403, headers: {}, body: "Forbidden" };
  }

  if (skipValidation) {
    log.warn("signature_validation_skipped", { webhookUrl });
  }

  // ── 3. Extract SMS fields ─────────────────────────────────────────────────
  const fromPhone = params["From"] ?? "";
  const messageBody = (params["Body"] ?? "").trim();
  const twilioSid = params["MessageSid"];

  if (!fromPhone || !messageBody) {
    log.warn("webhook_missing_fields", { hasFrom: !!fromPhone, hasBody: !!messageBody });
    return twimlMessage("We received your message but could not read it. Please try again.");
  }

  const now = new Date();
  const inboundTimestamp = now.toISOString();
  const today = inboundTimestamp.slice(0, 10); // YYYY-MM-DD

  // ── 4. Store inbound message ──────────────────────────────────────────────
  const inboundMsg: Message = {
    parentPhone: fromPhone,
    timestamp: inboundTimestamp,
    direction: "inbound",
    body: messageBody,
    twilioSid,
  };
  await storeMessage(inboundMsg as unknown as Record<string, unknown>);

  log.info("inbound_message", {
    from: fromPhone,
    twilioSid,
    bodyLength: messageBody.length,
    body: messageBody,
  });

  // ── 5. Parse intent via AI ────────────────────────────────────────────────
  let parsed;
  try {
    parsed = await parseIntent(messageBody, today);
  } catch (aiErr) {
    log.error("ai_parser_failed", {
      from: fromPhone,
      error: aiErr instanceof Error ? aiErr.message : String(aiErr),
    });
    await createException(COACH_ID, fromPhone, messageBody, "AI parser error — requires manual review");
    return twimlMessage(REPLY_UNCLEAR);
  }

  // Update message record with parsed intent
  await storeMessage({
    ...(inboundMsg as unknown as Record<string, unknown>),
    parsedIntent: parsed.intent,
    rawAI: parsed.raw,
  });

  log.info("parsed_intent", {
    from: fromPhone,
    intent: parsed.intent,
    confidence: parsed.confidence,
    bookingCount: parsed.bookings.length,
    bookings: parsed.bookings,
    reasoning: parsed.reasoning,
  });

  // ── 6. Route by intent ────────────────────────────────────────────────────
  let replyText: string;

  if (parsed.intent === "book") {
    if (parsed.bookings.length === 0) {
      // AI said "book" but couldn't extract any slot
      await createException(
        COACH_ID, fromPhone, messageBody,
        "Book intent detected but no date/time could be extracted"
      );
      replyText = "I'd like to help you book! Please reply with a specific date and time, e.g. 'Book Friday at 3 PM'.";

      log.info("booking_result", { outcome: "incomplete_book_intent", from: fromPhone });
    } else {
      // Attempt each requested slot — never throws
      const outcomes = await Promise.all(
        parsed.bookings.map((req) =>
          // Inject parentPhone here (not available in the standalone function signature)
          attemptBookingForParent(req, fromPhone)
        )
      );

      replyText = buildBookingReply(outcomes);

      log.info("booking_result", {
        from: fromPhone,
        outcomes: outcomes.map((o) => ({ status: o.status, label: o.label })),
      });
    }
  } else if (parsed.intent === "reject") {
    replyText = REPLY_REJECT;
    log.info("booking_result", { outcome: "rejected", from: fromPhone });
  } else if (parsed.intent === "alternative") {
    const altInfo = [parsed.alternativeDate, parsed.alternativeTime].filter(Boolean).join(" ") || "unspecified";
    await createException(COACH_ID, fromPhone, messageBody, `Parent requested alternative time: ${altInfo}`);
    replyText = REPLY_ALTERNATIVE;
    log.info("booking_result", { outcome: "alternative_requested", from: fromPhone });
  } else {
    // "unclear"
    await createException(COACH_ID, fromPhone, messageBody, `Unclear message: "${messageBody.slice(0, 120)}"`);
    replyText = REPLY_UNCLEAR;
    log.info("booking_result", { outcome: "unclear", from: fromPhone, confidence: parsed.confidence });
  }

  // ── 7. Reply via TwiML + store outbound ──────────────────────────────────
  const outboundMsg: Message = {
    parentPhone: fromPhone,
    timestamp: new Date().toISOString(),
    direction: "outbound",
    body: replyText,
  };
  // Best-effort store — don't let a DynamoDB write failure suppress the TwiML reply
  storeMessage(outboundMsg as unknown as Record<string, unknown>).catch((err) => {
    log.error("outbound_store_failed", {
      from: fromPhone,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return twimlMessage(replyText);
}

// ─── Booking with parentPhone (closured) ──────────────────────────────────────
// attemptBooking is a pure helper but createBooking needs parentPhone.
// This wrapper keeps the generic helper clean.

async function attemptBookingForParent(req: BookingSlot, parentPhone: string): Promise<SlotOutcome> {
  if (!req.date || !req.time) {
    log.warn("slot_lookup_skip", { reason: "missing date or time", date: req.date, time: req.time });
    return {
      status: "incomplete",
      label: [req.date, req.time].filter(Boolean).join(" ") || "requested time",
    };
  }

  const label = `${friendlyDate(req.date)} at ${friendlyTime(req.time)}`;

  log.info("slot_lookup", { coachId: COACH_ID, date: req.date, time: req.time });

  const slot = await findFreeSlot(COACH_ID, req.date, req.time);

  log.info("slot_lookup_result", {
    date: req.date,
    time: req.time,
    found: slot !== null,
    status: slot?.status ?? "not_found",
  });

  if (slot) {
    try {
      const booking = await createBooking(COACH_ID, parentPhone, slot);
      log.info("booking_created", { bookingId: booking.bookingId, slotDate: slot.date, slotTime: slot.startTime });
      return { status: "booked", label, bookingId: booking.bookingId };
    } catch (err) {
      if (!(err instanceof SlotUnavailableError)) throw err;
      log.warn("slot_race_condition", { date: req.date, time: req.time });
      // Race condition — slot was claimed between read and write, fall through
    }
  }

  const alternatives = await getFreeSlotTimes(COACH_ID, req.date).catch(() => []);
  log.info("slot_unavailable", { date: req.date, time: req.time, alternatives });
  return { status: "unavailable", label, alternatives };
}
