// ─── Enums ───────────────────────────────────────────────────────────────────

export type SlotStatus = "free" | "booked" | "blocked";
export type BookingStatus = "confirmed" | "cancelled";
export type MessageDirection = "inbound" | "outbound";
export type ExceptionStatus = "pending" | "resolved";
export type IntentType = "book" | "reject" | "alternative" | "unclear";

// ─── Entities ────────────────────────────────────────────────────────────────

export interface Coach {
  coachId: string;
  name: string;
  email: string;
  phone: string;
  timezone: string;
  createdAt: string;
}

export interface Parent {
  phone: string;         // primary identifier — matches Twilio From
  coachId: string;
  name: string;
  email?: string;
  createdAt: string;
}

export interface Kid {
  kidId: string;
  parentPhone: string;
  name: string;
  age?: number;
  notes?: string;
}

export interface TimeSlot {
  coachId: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM  (24h)
  endTime: string;       // HH:MM
  status: SlotStatus;
  duration: number;      // minutes, default 60
}

export interface Booking {
  bookingId: string;
  coachId: string;
  parentPhone: string;
  kidId?: string;
  slotDate: string;
  slotTime: string;
  status: BookingStatus;
  createdAt: string;
}

export interface Message {
  parentPhone: string;
  timestamp: string;     // ISO string — used as SK
  direction: MessageDirection;
  body: string;
  twilioSid?: string;
  parsedIntent?: IntentType;
  rawAI?: string;        // raw AI response JSON for debugging
}

export interface Exception {
  exceptionId: string;
  coachId: string;
  parentPhone: string;
  messageBody: string;
  reason: string;
  status: ExceptionStatus;
  createdAt: string;
  resolvedAt?: string;                    // ISO string — set when status → resolved
  resolvedAction?: "book" | "dismiss";    // what the coach did
  resolvedBookingId?: string;             // set when resolvedAction = "book"
}

// ─── AI Parsing ──────────────────────────────────────────────────────────────

/** A single booking request extracted from an SMS message. */
export interface BookingSlot {
  date: string | null;     // YYYY-MM-DD (absolute, AI-resolved)
  time: string | null;     // HH:MM 24h
  kidName: string | null;  // child's first name if mentioned
}

// ─── API Request / Response shapes ───────────────────────────────────────────

export interface CreateSlotsRequest {
  coachId: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM  e.g. "09:00"
  endTime: string;       // HH:MM  e.g. "17:00"
  duration?: number;     // minutes, default 60
}

export interface GetSlotsRequest {
  coachId: string;
  date: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
