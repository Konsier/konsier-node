import type { PageAuthResult } from "../types";
import type { Konsier } from "../client";
import {
  handleFetchWebhook,
  pageResultToResponse,
  verifyPageRequest,
} from "./shared";

export function createKonsierRoute(konsier: Konsier) {
  return async function POST(request: Request): Promise<Response> {
    return handleFetchWebhook(konsier, request);
  };
}

export function verifyKonsierPageRequest(
  konsier: Konsier,
  request: Request,
): PageAuthResult | Response {
  const result = verifyPageRequest(konsier, request);
  if (result.type === "response") {
    return pageResultToResponse(result);
  }
  return result;
}
