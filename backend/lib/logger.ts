/**
 * Structured JSON logger for Lambda / CloudWatch.
 *
 * Each call emits a single-line JSON object to stdout.
 * CloudWatch Logs Insights can filter and aggregate on any field.
 *
 * Usage:
 *   log.info("inbound_message", { from, twilioSid, bodyLength });
 *   log.warn("signature_invalid", { webhookUrl });
 *   log.error("ai_parser_failed", { error: err.message });
 */

type LogLevel = "INFO" | "WARN" | "ERROR";

interface BaseEntry {
  level: LogLevel;
  event: string;
  timestamp: string;
  requestId?: string;   // Lambda request ID — set via log.setRequestId()
}

// Module-level request ID, reset at the start of each Lambda invocation.
let _requestId: string | undefined;

function emit(level: LogLevel, event: string, fields: Record<string, unknown>): void {
  const entry: BaseEntry & Record<string, unknown> = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...((_requestId != null) && { requestId: _requestId }),
    ...fields,
  };

  // Route to the matching console method so CloudWatch assigns the right severity.
  if (level === "ERROR") {
    console.error(JSON.stringify(entry));
  } else if (level === "WARN") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const log = {
  /** Call once at the top of each Lambda handler with context.awsRequestId. */
  setRequestId(id: string): void {
    _requestId = id;
  },

  info(event: string, fields: Record<string, unknown> = {}): void {
    emit("INFO", event, fields);
  },

  warn(event: string, fields: Record<string, unknown> = {}): void {
    emit("WARN", event, fields);
  },

  error(event: string, fields: Record<string, unknown> = {}): void {
    emit("ERROR", event, fields);
  },
};
