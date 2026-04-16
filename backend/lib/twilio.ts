import twilio, { validateRequest } from "twilio";

// ─── Client (singleton across warm invocations) ───────────────────────────────

let _client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!_client) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
    }
    _client = twilio(accountSid, authToken);
  }
  return _client;
}

// ─── Signature validation ─────────────────────────────────────────────────────

/**
 * Verifies the X-Twilio-Signature header to ensure the request came from Twilio.
 * MUST be called before processing any webhook payload.
 *
 * @param webhookUrl  The full public URL of the webhook endpoint (must match exactly).
 * @param params      The parsed form body as a key-value map.
 * @param signature   The value of the X-Twilio-Signature header.
 */
export function validateTwilioSignature(
  webhookUrl: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) throw new Error("TWILIO_AUTH_TOKEN must be set");
  return validateRequest(authToken, signature, webhookUrl, params);
}

// ─── SMS sending ──────────────────────────────────────────────────────────────

/**
 * Sends an outbound SMS via the Twilio REST API.
 *
 * @param to    E.164 phone number of the recipient (e.g. "+14155552671")
 * @param body  The SMS message text (max 1600 chars)
 */
export async function sendSms(to: string, body: string): Promise<string> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("TWILIO_PHONE_NUMBER must be set");

  const message = await getClient().messages.create({ from, to, body });
  return message.sid;
}

// ─── Body parsing ─────────────────────────────────────────────────────────────

/**
 * Parses a URL-encoded form body (as sent by Twilio webhooks) into a plain object.
 *
 * API Gateway HTTP API sets isBase64Encoded=true for application/x-www-form-urlencoded
 * bodies. If that flag is set the raw body must be decoded before parsing — otherwise
 * the params are gibberish and signature validation always fails.
 */
export function parseFormBody(rawBody: string, isBase64 = false) {
  const decoded = isBase64
    ? Buffer.from(rawBody, "base64").toString("utf-8")
    : rawBody;

  const result: Record<string, string> = {};
  const params = new URLSearchParams(decoded);

  for (const [key, value] of params.entries()) {
    result[key] = value;
  }

  return result;
}
