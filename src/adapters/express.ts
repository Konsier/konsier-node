import { createJsonBodyMiddleware, type Konsier } from "../client";
import type { HeadersLike, NextFunction } from "../types";

export interface ExpressLikeApp {
  post: (...args: any[]) => unknown;
}

export function serveKonsier(app: ExpressLikeApp, konsier: Konsier): void {
  app.post(
    konsier.webhookPath(),
    createJsonBodyMiddleware("rawBody") as never,
    konsier.webhookHandler() as never,
  );
}

export function verifyKonsierPage(
  konsier: Konsier,
): (req: any, res: any, next?: NextFunction) => void {
  return function pageAuth(
    req: any,
    res: any,
    next?: NextFunction,
  ): void {
    const result = konsier.pageRequest({
      url: resolveExpressRequestUrl(req),
      headers: req.headers as HeadersLike,
    });

    if (result.type === "authorized") {
      req.konsier = result.context;
      next?.();
      return;
    }

    if (typeof res.status === "function") {
      res.status(result.status);
    } else {
      res.statusCode = result.status;
    }

    for (const [name, value] of Object.entries(result.headers)) {
      if (typeof res.setHeader === "function") {
        res.setHeader(name, value);
      }
    }

    if (typeof res.send === "function") {
      res.send(result.body ?? "");
      return;
    }

    res.end?.(result.body ?? "");
  };
}

function resolveExpressRequestUrl(req: {
  originalUrl?: string;
  url?: string;
  protocol?: string;
  headers?: Record<string, string | string[] | undefined>;
}): string {
  const forwardedProto = readFirstHeaderValue(req.headers?.["x-forwarded-proto"]);
  const forwardedHost = readFirstHeaderValue(req.headers?.["x-forwarded-host"]);
  const protocol = forwardedProto || req.protocol || "http";
  const host =
    forwardedHost ||
    readFirstHeaderValue(req.headers?.host) ||
    "localhost";
  const path = req.originalUrl || req.url || "/";
  return `${protocol}://${host}${path}`;
}

function readFirstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
