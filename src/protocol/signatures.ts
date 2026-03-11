import { createHmac, timingSafeEqual } from "node:crypto";

import {
  DEFAULT_ALLOWED_CLOCK_SKEW_MS,
  SIGNATURE_PREFIX,
} from "../constants";
import type { HeadersLike } from "../types";

export function getHeaderValue(
  headers: HeadersLike,
  name: string,
): string | undefined {
  const targetName = name.toLowerCase();
  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (headerName.toLowerCase() !== targetName) {
      continue;
    }

    if (Array.isArray(headerValue)) {
      const firstValue = headerValue[0];
      return typeof firstValue === "string" ? firstValue : undefined;
    }

    return headerValue;
  }

  return undefined;
}

export function normalizeSignature(signature: string): string {
  const trimmed = signature.trim();
  if (trimmed.toLowerCase().startsWith(SIGNATURE_PREFIX)) {
    return trimmed.slice(SIGNATURE_PREFIX.length);
  }
  return trimmed;
}

export function createKonsierSignature(input: {
  apiKey: string;
  timestamp: string;
  payload: string;
}): string {
  return createHmac("sha256", input.apiKey)
    .update(`${input.timestamp}.${input.payload}`)
    .digest("hex");
}

export function verifyKonsierSignature(input: {
  apiKey: string;
  timestamp: string;
  payload: string;
  providedSignature: string;
  nowMs?: number;
  allowedClockSkewMs?: number;
}): { ok: true } | { ok: false; reason: string } {
  const timestampMs = Number.parseInt(input.timestamp, 10);
  if (!Number.isFinite(timestampMs)) {
    return { ok: false, reason: "INVALID_TIMESTAMP" };
  }

  const now = input.nowMs ?? Date.now();
  const skew = input.allowedClockSkewMs ?? DEFAULT_ALLOWED_CLOCK_SKEW_MS;
  if (Math.abs(now - timestampMs) > skew) {
    return { ok: false, reason: "TIMESTAMP_OUT_OF_RANGE" };
  }

  const expected = createKonsierSignature({
    apiKey: input.apiKey,
    timestamp: input.timestamp,
    payload: input.payload,
  });
  const provided = normalizeSignature(input.providedSignature);

  try {
    const expectedBuffer = Buffer.from(expected, "hex");
    const providedBuffer = Buffer.from(provided, "hex");

    if (expectedBuffer.length !== providedBuffer.length) {
      return { ok: false, reason: "SIGNATURE_MISMATCH" };
    }

    if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
      return { ok: false, reason: "SIGNATURE_MISMATCH" };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "SIGNATURE_PARSE_ERROR" };
  }
}

export function createPageContextPayload(input: {
  pagePath: string;
  projectId?: string | null;
  account?: {
    id?: string | null;
    name?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  user?: {
    id?: string | null;
    email?: string | null;
    name?: string | null;
  } | null;
}): string {
  return JSON.stringify({
    pagePath: input.pagePath,
    projectId: input.projectId ?? null,
    account: input.account
      ? {
          id: input.account.id ?? null,
          name: input.account.name ?? null,
          metadata: input.account.metadata ?? {},
        }
      : null,
    user: input.user
      ? {
          id: input.user.id ?? null,
          email: input.user.email ?? null,
          name: input.user.name ?? null,
        }
      : null,
  });
}
