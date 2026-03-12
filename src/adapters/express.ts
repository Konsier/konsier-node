import { createJsonBodyMiddleware, type Konsier } from "../client";
import type { HeadersLike, NextFunction, PageAuthContext } from "../types";

type ExpressRequest = {
  headers: HeadersLike;
  konsier?: PageAuthContext;
  [key: string]: unknown;
};

type ExpressResponse = {
  [key: string]: unknown;
};

type ExpressMiddleware = (
  req: ExpressRequest,
  res: ExpressResponse,
  next?: NextFunction,
) => void | Promise<void>;

type ExpressHandler = (
  req: ExpressRequest,
  res: ExpressResponse,
) => void | Promise<void>;

export interface ExpressLikeApp {
  post: (path: string, ...handlers: Array<ExpressMiddleware | ExpressHandler>) => unknown;
}

export function serveKonsier(app: ExpressLikeApp, konsier: Konsier): void {
  app.post(
    konsier.webhookPath(),
    createJsonBodyMiddleware("rawBody") as ExpressMiddleware,
    konsier.webhookHandler() as ExpressHandler,
  );
}

export function verifyKonsierPage(konsier: Konsier) {
  return konsier.verifyPage();
}
