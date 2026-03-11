import {
  DEFAULT_ALLOWED_CLOCK_SKEW_MS,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
} from "../constants";
import { asKonsierError } from "../errors";
import { getHeaderValue, verifyKonsierSignature } from "../protocol/signatures";
import type {
  HttpRequestLike,
  HttpResponseLike,
  NextFunction,
} from "../types";
import type { ManifestResponse } from "../protocol/inbound";
import { asResolveAgentRequest, resolveAgentRequest } from "./resolve-agent";
import { asToolCallRequest, executeToolCallRequest } from "./tool-call";
import type { Account } from "../types";

export interface HandlerDependencies {
  apiKey: string;
  allowedClockSkewMs?: number;
  rawBodyProperty?: string;
  handleToolCall: Parameters<typeof executeToolCallRequest>[1];
  handleResolveAgent: Parameters<typeof resolveAgentRequest>[1];
  handleManifest: {
    listManifest: (account: Account | null) => Promise<ManifestResponse>;
  };
}

export function createHandler(dependencies: HandlerDependencies) {
  const rawBodyProperty = dependencies.rawBodyProperty ?? "rawBody";
  const allowedClockSkewMs =
    dependencies.allowedClockSkewMs ?? DEFAULT_ALLOWED_CLOCK_SKEW_MS;

  return async function konsierHandler(
    req: HttpRequestLike,
    res: HttpResponseLike,
    next?: NextFunction,
  ): Promise<void> {
    try {
      if ((req.method ?? "POST").toUpperCase() !== "POST") {
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      }

      const signature = getHeaderValue(req.headers, HEADER_SIGNATURE);
      const timestamp = getHeaderValue(req.headers, HEADER_TIMESTAMP);

      if (!signature || !timestamp) {
        sendJson(res, 401, { error: "Missing signature headers" });
        return;
      }

      const rawBody = extractRawBody(req, rawBodyProperty);
      const verified = verifyKonsierSignature({
        apiKey: dependencies.apiKey,
        timestamp,
        payload: rawBody,
        providedSignature: signature,
        allowedClockSkewMs,
      });

      if (!verified.ok) {
        sendJson(res, 401, { error: verified.reason });
        return;
      }

      const payload = parseBody(req.body, rawBody);
      if (!payload) {
        sendJson(res, 400, { error: "Invalid JSON request body" });
        return;
      }

      const toolCall = asToolCallRequest(payload);
      if (toolCall) {
        const response = await executeToolCallRequest(
          toolCall,
          dependencies.handleToolCall,
        );
        sendJson(res, 200, response);
        return;
      }

      const resolveAgent = asResolveAgentRequest(payload);
      if (resolveAgent) {
        const response = await resolveAgentRequest(
          resolveAgent,
          dependencies.handleResolveAgent,
        );
        sendJson(res, 200, response);
        return;
      }

      const manifest = asManifestRequest(payload);
      if (manifest) {
        const response = await dependencies.handleManifest.listManifest(
          normalizeManifestAccount(manifest.account),
        );
        sendJson(res, 200, response);
        return;
      }

      sendJson(res, 400, { error: "Unknown request type" });
    } catch (error) {
      const parsed = asKonsierError(error);
      sendJson(res, parsed.statusCode, {
        error: parsed.message,
        code: parsed.code,
      });
      if (next) {
        next(parsed);
      }
    }
  };
}

function asManifestRequest(
  payload: unknown,
): { type: "manifest"; account: { id: string | number; name: string; metadata: Record<string, unknown> } | null } | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const obj = payload as Record<string, unknown>;
  if (obj.type !== "manifest") {
    return null;
  }

  const account = parseManifestAccount(obj.account);
  if (obj.account !== null && obj.account !== undefined && account === null) {
    return null;
  }

  return {
    type: "manifest",
    account,
  };
}

function parseManifestAccount(
  value: unknown,
): { id: string | number; name: string; metadata: Record<string, unknown> } | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const obj = value as Record<string, unknown>;
  if (
    !(typeof obj.id === "string" || typeof obj.id === "number") ||
    typeof obj.name !== "string" ||
    !obj.metadata ||
    typeof obj.metadata !== "object" ||
    Array.isArray(obj.metadata)
  ) {
    return null;
  }

  return {
    id: obj.id,
    name: obj.name,
    metadata: obj.metadata as Record<string, unknown>,
  };
}

function normalizeManifestAccount(
  account: { id: string | number; name: string; metadata: Record<string, unknown> } | null,
): Account | null {
  if (!account) {
    return null;
  }

  return {
    id: String(account.id),
    name: account.name,
    metadata: account.metadata,
  };
}

function extractRawBody(req: HttpRequestLike, rawBodyProperty: string): string {
  const raw = req[rawBodyProperty] ?? req.body;

  if (Buffer.isBuffer(raw)) {
    return raw.toString("utf8");
  }

  if (typeof raw === "string") {
    return raw;
  }

  if (raw && typeof raw === "object") {
    return JSON.stringify(raw);
  }

  return "";
}

function parseBody(body: unknown, rawBody: string): Record<string, unknown> | null {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  if (typeof body === "string") {
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (!rawBody) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function sendJson(
  res: HttpResponseLike,
  statusCode: number,
  body: unknown,
): void {
  if (typeof res.status === "function") {
    res.status(statusCode);
  } else {
    res.statusCode = statusCode;
  }

  if (typeof res.json === "function") {
    res.json(body);
    return;
  }

  if (typeof res.setHeader === "function") {
    res.setHeader("content-type", "application/json");
  }

  const payload = JSON.stringify(body);
  if (typeof res.send === "function") {
    res.send(payload);
    return;
  }

  if (typeof res.end === "function") {
    res.end(payload);
  }
}
