export class KonsierError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly action?: string;
  readonly details?: unknown;

  constructor(input: {
    code: string;
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
    return new KonsierError({
      code: "internal.system.unexpected",
      message: error.message,
      statusCode: 500,
      action: "Try again. If the problem continues, contact support.",
      cause: error,
    });
  }

  return new KonsierError({
    code: "internal.system.unexpected",
    message: "Unknown error",
    statusCode: 500,
    action: "Try again. If the problem continues, contact support.",
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
