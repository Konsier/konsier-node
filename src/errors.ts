export class KonsierError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(input: {
    code: string;
    message: string;
    statusCode?: number;
    details?: unknown;
    cause?: unknown;
  }) {
    super(input.message, input.cause ? { cause: input.cause } : undefined);
    this.name = "KonsierError";
    this.code = input.code;
    this.statusCode = input.statusCode ?? 500;
    this.details = input.details;
  }
}

export function asKonsierError(error: unknown): KonsierError {
  if (error instanceof KonsierError) {
    return error;
  }

  if (error instanceof Error) {
    return new KonsierError({
      code: "INTERNAL_ERROR",
      message: error.message,
      statusCode: 500,
      cause: error,
    });
  }

  return new KonsierError({
    code: "INTERNAL_ERROR",
    message: "Unknown error",
    statusCode: 500,
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
