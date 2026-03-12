import type { PageAuthContext } from "../types";
import type { Konsier } from "../client";
import { handleFetchWebhook, verifyPageRequest } from "./shared";

export function createKonsierRoute(konsier: Konsier) {
  return async function POST(request: Request): Promise<Response> {
    return handleFetchWebhook(konsier, request);
  };
}

export function verifyKonsierPageRequest(
  konsier: Konsier,
  request: Request,
): PageAuthContext {
  return verifyPageRequest(konsier, request);
}
