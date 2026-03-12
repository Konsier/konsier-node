import type { PageAuthContext } from "../types";
import type { Konsier } from "../client";
import { handleFetchWebhook, verifyPageRequest } from "./shared";

type HonoContextLike = {
  req: Request | { raw: Request };
};

export interface HonoLikeApp {
  post: (
    path: string,
    handler: (context: HonoContextLike) => Promise<Response>,
  ) => unknown;
}

export function konsierWebhook(konsier: Konsier) {
  return async function handleKonsierWebhook(
    context: HonoContextLike,
  ): Promise<Response> {
    const request =
      context.req instanceof Request ? context.req : context.req.raw;
    return handleFetchWebhook(konsier, request);
  };
}

export function serveKonsier(app: HonoLikeApp, konsier: Konsier): void {
  app.post(konsier.webhookPath(), konsierWebhook(konsier));
}

export function verifyKonsierPageRequest(
  konsier: Konsier,
  request: Request,
): PageAuthContext {
  return verifyPageRequest(konsier, request);
}
