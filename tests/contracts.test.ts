import {
  DELIVERY_FAILURE_CODES,
  ERROR_CODES,
  ERROR_DEFAULTS,
  createApiErrorBody,
  type ErrorCode,
} from "../src/contracts";

describe("contracts", () => {
  it("keeps error codes unique", () => {
    const values = collectLeafValues(ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });

  it("keeps every error code on the 3-segment naming standard", () => {
    const values = collectLeafValues(ERROR_CODES);
    for (const code of values) {
      expect(code.split(".")).toHaveLength(3);
    }
  });

  it("provides defaults for every error code", () => {
    const values = collectLeafValues(ERROR_CODES);
    for (const code of values) {
      expect(ERROR_DEFAULTS[code]).toBeDefined();
      expect(ERROR_DEFAULTS[code].message).toBeTruthy();
      expect(ERROR_DEFAULTS[code].action).toBeTruthy();
    }
  });

  it("builds the canonical envelope from defaults and overrides", () => {
    expect(
      createApiErrorBody({
        code: ERROR_CODES.auth.request.unauthorized,
      }),
    ).toEqual({
      error: {
        code: ERROR_CODES.auth.request.unauthorized,
        message: "You are not authorized to perform this request.",
        action: "Check your credentials and try again.",
      },
    });

    expect(
      createApiErrorBody({
        code: ERROR_CODES.validation.request.invalid,
        message: "Custom validation message.",
      }),
    ).toEqual({
      error: {
        code: ERROR_CODES.validation.request.invalid,
        message: "Custom validation message.",
        action: "Check the request input and try again.",
      },
    });
  });

  it("maps delivery failures by supported channel", () => {
    expect(DELIVERY_FAILURE_CODES.telegram).toBe(
      ERROR_CODES.channel.telegram.delivery_failed,
    );
    expect(DELIVERY_FAILURE_CODES.slack).toBe(
      ERROR_CODES.channel.slack.delivery_failed,
    );
    expect(DELIVERY_FAILURE_CODES.sms).toBe(
      ERROR_CODES.channel.sms.delivery_failed,
    );
    expect(DELIVERY_FAILURE_CODES.whatsapp).toBe(
      ERROR_CODES.channel.whatsapp.delivery_failed,
    );
    expect(DELIVERY_FAILURE_CODES.email).toBe(
      ERROR_CODES.channel.email.delivery_failed,
    );
    expect(DELIVERY_FAILURE_CODES.discord).toBe(
      ERROR_CODES.channel.discord.delivery_failed,
    );
  });
});

function collectLeafValues(value: unknown): ErrorCode[] {
  if (typeof value === "string") {
    return [value as ErrorCode];
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.values(value).flatMap((entry) => collectLeafValues(entry));
}
