import Anthropic from "@anthropic-ai/sdk";
import type { IntentType, BookingSlot } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedIntent {
  intent: IntentType;
  confidence: number;              // 0.0–1.0
  bookings: BookingSlot[];         // array — 1 item for single, N for multi-booking
  alternativeDate: string | null;  // for "alternative" intent
  alternativeTime: string | null;
  reasoning: string;
  raw: string;                     // full AI response for debugging
}

/** Intents with confidence below this threshold are forced to "unclear". */
const CONFIDENCE_THRESHOLD = 0.75;

// ─── Client ───────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI assistant for a children's coaching business.
Extract appointment booking intent from SMS messages sent by parents.

## Output format

Respond with a SINGLE raw JSON object. No markdown. No code fences. No explanation.
The entire response must be valid JSON parseable by JSON.parse() with zero preprocessing.

Required fields:

{
  "intent": "book" | "reject" | "alternative" | "unclear",
  "confidence": <0.0–1.0>,
  "bookings": [
    { "date": "<YYYY-MM-DD>" | null, "time": "<HH:MM>" | null, "kidName": "<string>" | null }
  ],
  "alternativeDate": "<YYYY-MM-DD>" | null,
  "alternativeTime": "<HH:MM>" | null,
  "reasoning": "<one sentence>"
}

## Intent rules

- "book"        → parent wants to book one or more specific appointment times
- "reject"      → parent declines, cancels, or cannot make it
- "alternative" → parent wants a DIFFERENT time than what was offered
- "unclear"     → ambiguous, off-topic, or missing key info

## bookings array rules

- For "book" intent: populate bookings with one entry per requested slot.
  "Book Friday at 3 PM" → bookings: [{"date":"2026-04-18","time":"15:00","kidName":null}]
  "Book 3 PM and 4 PM Friday for Emma and Jake" →
    bookings: [
      {"date":"2026-04-18","time":"15:00","kidName":"Emma"},
      {"date":"2026-04-18","time":"16:00","kidName":"Jake"}
    ]
- For all other intents: bookings must be an empty array [].
- Never omit the bookings field — it must always be present.

## Confidence rules

- 1.0  → Completely unambiguous. "Yes book me Tuesday 3pm"
- 0.9  → Very clear with trivial ambiguity
- 0.75–0.89 → Reasonably clear
- 0.5–0.74 → Uncertain — multiple interpretations plausible
- <0.5 → Very unclear

If confidence < 0.75, set intent to "unclear" and bookings to [].

## Date rules

- Convert relative dates to absolute YYYY-MM-DD using today's date.
  "tomorrow" → next calendar day. "next Monday" → the coming Monday.
  "Friday" → the next Friday on or after today (never a past date).
- If no date is mentioned, set date to null inside each booking object.

## Time rules

- Normalize to 24-hour HH:MM. "3pm"→"15:00", "9:30am"→"09:30", "noon"→"12:00", "10am"→"10:00".
- If no time mentioned, set time to null.

## Other rules

- kidName: extract child's first name if mentioned, otherwise null.
- For "alternative": put the requested time in alternativeDate / alternativeTime.
- Never output anything outside the JSON object.`;

// ─── Parsing helpers ──────────────────────────────────────────────────────────

/**
 * Converts a raw AI field value to a clean string or null.
 * Guards against the AI accidentally returning the string "null" instead of JSON null.
 */
function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "null") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return typeof value === "string" ? value.trim() : null;
}

function parseBookings(raw: unknown): BookingSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Record<string, unknown> => b !== null && typeof b === "object")
    .map((b) => ({
      date: toStringOrNull(b.date),
      time: toStringOrNull(b.time),
      kidName: toStringOrNull(b.kidName),
    }));
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export async function parseIntent(
  message: string,
  today: string  // YYYY-MM-DD
): Promise<ParsedIntent> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Today's date is ${today}.\n\nSMS message from parent: "${message}"`,
      },
    ],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // ── Validate confidence ──────────────────────────────────────────────
    const rawConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
    const confidence = Math.min(1, Math.max(0, rawConfidence));

    // ── Validate intent ──────────────────────────────────────────────────
    const validIntents: IntentType[] = ["book", "reject", "alternative", "unclear"];
    const rawIntent = validIntents.includes(parsed.intent as IntentType)
      ? (parsed.intent as IntentType)
      : "unclear";

    // ── Apply confidence threshold ───────────────────────────────────────
    const intent: IntentType = confidence >= CONFIDENCE_THRESHOLD ? rawIntent : "unclear";

    if (intent !== rawIntent) {
      console.info(
        `[ai] Downgraded intent "${rawIntent}" → "unclear" ` +
        `(confidence=${confidence.toFixed(2)} < threshold=${CONFIDENCE_THRESHOLD})`
      );
    }

    const bookings = intent === "book" ? parseBookings(parsed.bookings) : [];

    return {
      intent,
      confidence,
      bookings,
      alternativeDate: toStringOrNull(parsed.alternativeDate),
      alternativeTime: toStringOrNull(parsed.alternativeTime),
      reasoning: toStringOrNull(parsed.reasoning) ?? "",
      raw,
    };
  } catch (parseErr) {
    console.error("[ai] Failed to parse AI response:", raw, parseErr);
    return {
      intent: "unclear",
      confidence: 0,
      bookings: [],
      alternativeDate: null,
      alternativeTime: null,
      reasoning: "AI response could not be parsed",
      raw,
    };
  }
}
