import {
  ERROR_CODES,
  createPublicApiError,
  type ErrorCode,
} from "./contracts";

export class KonsierError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly action?: string;
  readonly details?: unknown;

  constructor(input: {
    code: ErrorCode;
    message: string;
    statusCode?: number;
    action?: string;
    details?: unknown;
    cause?: unknown;
  }) {
    super(input.message, input.cause ? { cause: input.cause } : undefined);
    this.name = "KonsierError";
    this.code = input.code;
    this.statusCode = input.statusCode ?? 500;
    this.action = input.action;
    this.details = input.details;
  }
}

export function asKonsierError(error: unknown): KonsierError {
  if (error instanceof KonsierError) {
    return error;
  }

  if (error instanceof Error) {
    const fallback = createPublicApiError({
      code: ERROR_CODES.internal.system.unexpected,
      message: error.message,
    });
    return new KonsierError({
      code: fallback.code,
      message: fallback.message,
      statusCode: 500,
      action: fallback.action,
      cause: error,
    });
  }

  const fallback = createPublicApiError({
    code: ERROR_CODES.internal.system.unexpected,
    message: "Unknown error",
  });
  return new KonsierError({
    code: fallback.code,
    message: fallback.message,
    statusCode: 500,
    action: fallback.action,
    details: error,
  });
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}
