import type { APIGatewayProxyResult } from "aws-lambda";
import type { ApiResponse } from "../types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_ORIGIN ?? "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Content-Type": "application/json",
};

export function ok<T>(data: T, statusCode = 200): APIGatewayProxyResult {
  const body: ApiResponse<T> = { success: true, data };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function created<T>(data: T): APIGatewayProxyResult {
  return ok(data, 201);
}

export function badRequest(message: string): APIGatewayProxyResult {
  const body: ApiResponse = { success: false, error: message };
  return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

export function notFound(message = "Not found"): APIGatewayProxyResult {
  const body: ApiResponse = { success: false, error: message };
  return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

export function serverError(err: unknown): APIGatewayProxyResult {
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[serverError]", err);
  const body: ApiResponse = { success: false, error: message };
  return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify(body) };
}
