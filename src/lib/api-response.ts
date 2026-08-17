import { NextResponse } from "next/server";

type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

type ApiError = {
  success: false;
  message: string;
  code: string;
  errors?: Record<string, string[]>;
};

export function successResponse<T>(
  data: T,
  message = "Operation completed successfully",
  status = 200
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, message, data }, { status });
}

export function createdResponse<T>(
  data: T,
  message = "Resource created successfully"
): NextResponse<ApiSuccess<T>> {
  return successResponse(data, message, 201);
}

export function errorResponse(
  message: string,
  code: string,
  status: number,
  errors?: Record<string, string[]>
): NextResponse<ApiError> {
  return NextResponse.json(
    { success: false, message, code, ...(errors && { errors }) },
    { status }
  );
}

// Typed shortcuts
export const unauthorized = (message = "Authentication required") =>
  errorResponse(message, "UNAUTHORIZED", 401);

export const forbidden = (message = "You do not have permission to do this") =>
  errorResponse(message, "FORBIDDEN", 403);

export const notFound = (resource = "Resource") =>
  errorResponse(`${resource} not found`, "NOT_FOUND", 404);

export const validationError = (errors: Record<string, string[]>) =>
  errorResponse("Validation failed", "VALIDATION_ERROR", 400, errors);

export const serverError = (message = "Something went wrong") =>
  errorResponse(message, "INTERNAL_SERVER_ERROR", 500);

export const conflict = (message: string) =>
  errorResponse(message, "CONFLICT", 409);

export const tooManyRequests = (message = "Too many requests — please try again later") =>
  errorResponse(message, "RATE_LIMITED", 429);
