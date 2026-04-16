// Mirrors backend types/index.ts — keep in sync

export type SlotStatus = "free" | "booked" | "blocked";
export type BookingStatus = "confirmed" | "cancelled";
export type ExceptionStatus = "pending" | "resolved";
export type IntentType = "book" | "reject" | "alternative" | "unclear";
export type MessageDirection = "inbound" | "outbound";

export interface TimeSlot {
  coachId: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM
  endTime: string;
  status: SlotStatus;
  duration: number;
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
  timestamp: string;
  direction: MessageDirection;
  body: string;
  twilioSid?: string;
  parsedIntent?: IntentType;
}

export interface Exception {
  exceptionId: string;
  coachId: string;
  parentPhone: string;
  messageBody: string;
  reason: string;
  status: ExceptionStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedAction?: "book" | "dismiss";
  resolvedBookingId?: string;
}

export interface Parent {
  phone: string;
  coachId: string;
  name: string;
  email?: string;
  createdAt: string;
}
