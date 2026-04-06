import { createHmac, timingSafeEqual } from "node:crypto";

import {
  DEFAULT_ALLOWED_CLOCK_SKEW_MS,
  SIGNATURE_PREFIX,
} from "../constants";
import type { HeadersLike, PageTheme } from "../types";

type PageTokenAccount = {
  id: string | null;
  name: string | null;
  metadata: Record<string, unknown>;
} | null;

type PageTokenUser = {
  id: string | null;
  email: string | null;
  name: string | null;
};

export interface PageLaunchTokenPayload {
  type: "launch";
  pagePath: string;
  projectId: string | null;
  account: PageTokenAccount;
  user: PageTokenUser;
  theme: PageTheme;
  exp: number;
}

export interface PageSessionTokenPayload {
  type: "session";
  projectId: string | null;
  account: PageTokenAccount;
  user: PageTokenUser;
  theme: PageTheme;
  exp?: number;
}

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

export function createPageLaunchToken(input: {
  apiKey: string;
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
  theme?: PageTheme;
  exp: number;
}): string {
  return createSignedPageToken(input.apiKey, {
    type: "launch",
    pagePath: input.pagePath,
    projectId: input.projectId ?? null,
    account: normalizePageTokenAccount(input.account),
    user: normalizePageTokenUser(input.user),
    theme: normalizePageTheme(input.theme),
    exp: input.exp,
  });
}

export function createPageSessionToken(input: {
  apiKey: string;
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
  theme?: PageTheme;
  exp?: number;
}): string {
  return createSignedPageToken(input.apiKey, {
    type: "session",
    projectId: input.projectId ?? null,
    account: normalizePageTokenAccount(input.account),
    user: normalizePageTokenUser(input.user),
    theme: normalizePageTheme(input.theme),
    ...(typeof input.exp === "number" ? { exp: input.exp } : {}),
  });
}

export function verifyPageToken<T extends PageLaunchTokenPayload | PageSessionTokenPayload>(
  input: {
    apiKey: string;
    token: string;
    nowMs?: number;
  },
): { ok: true; payload: T } | { ok: false; reason: string } {
  const dotIndex = input.token.indexOf(".");
  if (dotIndex <= 0 || dotIndex === input.token.length - 1) {
    return { ok: false, reason: "INVALID_TOKEN_FORMAT" };
  }

  const encodedPayload = input.token.slice(0, dotIndex);
  const providedSignature = input.token.slice(dotIndex + 1);
  const expectedSignature = createHmac("sha256", input.apiKey)
    .update(encodedPayload)
    .digest("hex");

  try {
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const providedBuffer = Buffer.from(providedSignature, "hex");

    if (expectedBuffer.length !== providedBuffer.length) {
      return { ok: false, reason: "TOKEN_SIGNATURE_MISMATCH" };
    }

    if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
      return { ok: false, reason: "TOKEN_SIGNATURE_MISMATCH" };
    }
  } catch {
    return { ok: false, reason: "TOKEN_SIGNATURE_PARSE_ERROR" };
  }

  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as T;
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, reason: "INVALID_TOKEN_PAYLOAD" };
    }
    if (parsed.type === "launch") {
      if (
        typeof parsed.exp !== "number" ||
        !Number.isFinite(parsed.exp) ||
        parsed.exp <= (input.nowMs ?? Date.now())
      ) {
        return { ok: false, reason: "TOKEN_EXPIRED" };
      }
    } else if (
      typeof parsed.exp === "number" &&
      (!Number.isFinite(parsed.exp) || parsed.exp <= (input.nowMs ?? Date.now()))
    ) {
      return { ok: false, reason: "TOKEN_EXPIRED" };
    }
    return { ok: true, payload: parsed };
  } catch {
    return { ok: false, reason: "INVALID_TOKEN_PAYLOAD" };
  }
}

function createSignedPageToken(
  apiKey: string,
  payload: PageLaunchTokenPayload | PageSessionTokenPayload,
): string {
  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", apiKey)
    .update(encodedPayload)
    .digest("hex");
  return `${encodedPayload}.${signature}`;
}

function normalizePageTokenAccount(input: {
  id?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
} | null | undefined): PageTokenAccount {
  if (!input) {
    return null;
  }

  return {
    id: input.id ?? null,
    name: input.name ?? null,
    metadata: input.metadata ?? {},
  };
}

function normalizePageTokenUser(input: {
  id?: string | null;
  email?: string | null;
  name?: string | null;
} | null | undefined): PageTokenUser {
  return {
    id: input?.id ?? null,
    email: input?.email ?? null,
    name: input?.name ?? null,
  };
}

function normalizePageTheme(input: PageTheme | null | undefined): PageTheme {
  return input === "dark" ? "dark" : "light";
}
