import {
  DEFAULT_CLOUD_BASE_URL,
  ENV_CLOUD_BASE_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_REQUEST_TIMEOUT_MS,
  HEADER_AUTHORIZATION,
  HEADER_CONTENT_TYPE,
} from "../constants";
import {
  ERROR_CODES,
  createPublicApiError,
  type ApiErrorBody,
  type ErrorCode,
} from "../contracts";
import { KonsierError } from "../errors";

export interface CloudApiClientOptions {
  apiKey: string;
  baseUrl: string;
  debug?: boolean;
}

type PublicErrorEnvelope = ApiErrorBody;

export class CloudApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly debug: boolean;

  constructor(options: CloudApiClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS;
    this.maxRetries = DEFAULT_MAX_RETRIES;
    this.debug = Boolean(options.debug);
  }

  async get(path: string): Promise<Record<string, unknown>> {
    return this.request("GET", path);
  }

  async post(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", path, body);
  }

  async delete(path: string): Promise<Record<string, unknown>> {
    return this.request("DELETE", path);
  }

  async request(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const normalizedBody = typeof body === "undefined" ? undefined : stripUndefined(body);
    const payload =
      typeof normalizedBody === "undefined"
        ? undefined
        : JSON.stringify(normalizedBody);

    if (shouldDebugLog(this.debug)) {
      console.log("[konsier] cloud request", {
        url,
        method,
        path,
        body: normalizedBody,
      });
    }

    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const requestInit: RequestInit = {
          method,
          headers: {
            [HEADER_AUTHORIZATION]: `Bearer ${this.apiKey}`,
            ...(payload ? { [HEADER_CONTENT_TYPE]: "application/json" } : {}),
          },
          signal: controller.signal,
        };
        if (payload) {
          requestInit.body = payload;
        }

        const response = await fetch(url, requestInit);

        const raw = await response.text();
        const parsed = parseJsonObject(raw);

        if (!response.ok) {
          if (response.status >= 500 && attempt < this.maxRetries) {
            continue;
          }

          const publicError = parsePublicErrorEnvelope(parsed);
          const fallback = fallbackCloudError(response.status, raw, parsed);
          throw new KonsierError({
            code: publicError?.code ?? fallback.code,
            message: publicError?.message ?? fallback.message,
            statusCode: response.status,
            action: publicError?.action ?? fallback.action,
            details: parsed,
          });
        }

        if (shouldDebugLog(this.debug)) {
          console.log("[konsier] cloud response", {
            url,
            status: response.status,
            body: parsed ?? {},
          });
        }

        return parsed ?? {};
      } catch (error) {
        lastError = error;
        const shouldRetry =
          attempt < this.maxRetries &&
          (error instanceof TypeError ||
            (error instanceof Error && error.name === "AbortError"));

        if (!shouldRetry) {
          if (shouldDebugLog(this.debug)) {
            console.warn("[konsier] cloud request failed", {
              url,
              attempt: attempt + 1,
              error:
                error instanceof Error ? error.message : "Unknown error",
            });
          }
          if (error instanceof TypeError) {
            const publicError = createPublicApiError({
              code: ERROR_CODES.client.network.unreachable,
            });
            throw new KonsierError({
              code: publicError.code,
              message: publicError.message,
              action: publicError.action,
              statusCode: 503,
              cause: error,
            });
          }
          if (error instanceof Error && error.name === "AbortError") {
            const publicError = createPublicApiError({
              code: ERROR_CODES.client.network.timeout,
            });
            throw new KonsierError({
              code: publicError.code,
              message: publicError.message,
              action: publicError.action,
              statusCode: 504,
              cause: error,
            });
          }
          throw error;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw (
      lastError ??
      (() => {
        const publicError = createPublicApiError({
          code: ERROR_CODES.internal.system.unexpected,
          message: "Konsier could not complete the request.",
        });
        return new KonsierError({
          code: publicError.code,
          message: publicError.message,
          action: publicError.action,
        });
      })()
    );
  }
}

export function resolveCloudBaseUrl(input?: { debug?: boolean }): string {
  const override = process.env[ENV_CLOUD_BASE_URL]?.trim();
  if (override) {
    const resolved = override.replace(/\/+$/, "");
    if (shouldDebugLog(Boolean(input?.debug))) {
      console.log("[konsier] resolved cloud base URL from env", {
        env: ENV_CLOUD_BASE_URL,
        value: resolved,
      });
    }
    return resolved;
  }
  if (shouldDebugLog(Boolean(input?.debug))) {
    console.log("[konsier] resolved cloud base URL from default", {
      value: DEFAULT_CLOUD_BASE_URL,
    });
  }
  return DEFAULT_CLOUD_BASE_URL;
}

function shouldDebugLog(debug: boolean): boolean {
  return debug && process.env.NODE_ENV === "development";
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { raw };
  }
}

function stripUndefined(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      out[key] = entry;
    }
  }
  return out;
}

function parsePublicErrorEnvelope(
  payload: Record<string, unknown> | null,
): { code: ErrorCode; message: string; action?: string } | null {
  if (!payload) {
    return null;
  }

  const envelope = payload as PublicErrorEnvelope;
  if (
    !envelope.error ||
    typeof envelope.error !== "object" ||
    Array.isArray(envelope.error)
  ) {
    return null;
  }

  const code =
    typeof envelope.error.code === "string" ? envelope.error.code.trim() : "";
  const message =
    typeof envelope.error.message === "string"
      ? envelope.error.message.trim()
      : "";
  const action =
    typeof envelope.error.action === "string"
      ? envelope.error.action.trim()
      : "";

  if (!code || !message) {
    return null;
  }

  return {
    code: code as ErrorCode,
    message,
    ...(action ? { action } : {}),
  };
}

function fallbackCloudError(
  status: number,
  raw: string,
  parsed: Record<string, unknown> | null,
): { code: ErrorCode; message: string; action: string } {
  const normalizedRaw = raw.trim();
  const legacyMessage =
    parsed && typeof parsed.error === "string" ? parsed.error.trim() : "";
  if (status === 401) {
    return createPublicApiError({
      code: ERROR_CODES.auth.request.unauthorized,
      message: legacyMessage || "You are not authorized to perform this request.",
      action: "Check the API key and try again.",
    });
  }

  if (status === 403) {
    return createPublicApiError({
      code: ERROR_CODES.auth.request.forbidden,
      message: legacyMessage || "You do not have permission to perform this request.",
      action: "Check your permissions and try again.",
    });
  }

  if (status === 400) {
    return createPublicApiError({
      code: ERROR_CODES.validation.request.invalid,
      message:
        legacyMessage ||
        normalizedRaw ||
        "The request was rejected because it is invalid.",
      action: "Check the request details and try again.",
    });
  }

  if (status >= 500) {
    return createPublicApiError({
      code: ERROR_CODES.internal.system.unexpected,
      message:
        legacyMessage ||
        normalizedRaw ||
        `Konsier could not complete the request because the server returned ${status}.`,
      action: "Try again. If the problem continues, contact support.",
    });
  }

  return createPublicApiError({
    code: ERROR_CODES.client.response.invalid,
    message:
      legacyMessage ||
      normalizedRaw || `Konsier could not complete the request (${status}).`,
    action: "Check the request and try again.",
  });
}
