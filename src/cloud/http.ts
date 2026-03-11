import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_REQUEST_TIMEOUT_MS,
  HEADER_AUTHORIZATION,
  HEADER_CONTENT_TYPE,
} from "../constants";
import { KonsierError } from "../errors";

export interface CloudApiClientOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

export class CloudApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CloudApiClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async post(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const payload = JSON.stringify(stripUndefined(body));

    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(url, {
          method: "POST",
          headers: {
            [HEADER_AUTHORIZATION]: `Bearer ${this.apiKey}`,
            [HEADER_CONTENT_TYPE]: "application/json",
          },
          body: payload,
          signal: controller.signal,
        });

        const raw = await response.text();
        const parsed = parseJsonObject(raw);

        if (!response.ok) {
          if (response.status >= 500 && attempt < this.maxRetries) {
            continue;
          }

          const message =
            typeof parsed?.error === "string"
              ? parsed.error
              : raw || `Cloud request failed (${response.status})`;

          throw new KonsierError({
            code: "CLOUD_REQUEST_FAILED",
            message,
            statusCode: response.status,
            details: parsed,
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
          throw error;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw (
      lastError ??
      new KonsierError({
        code: "CLOUD_REQUEST_FAILED",
        message: "Cloud request failed",
      })
    );
  }
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
