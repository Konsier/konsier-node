import {
  DEFAULT_PAGE_SESSION_TTL_MS,
  PAGE_LAUNCH_QUERY_PARAM,
  PAGE_SESSION_COOKIE_NAME,
} from "../constants";
import {
  createPageSessionToken,
  getHeaderValue,
  verifyPageToken,
  type PageLaunchTokenPayload,
  type PageSessionTokenPayload,
} from "../protocol/signatures";
import type {
  Account,
  PageAuthContext,
  PageAuthRequestInput,
  PageAuthResult,
  PageUser,
} from "../types";

interface PageContextOptions {
  apiKey: string;
  debug?: boolean;
  pageSessionTtlMs?: number;
}

export function resolvePageRequest(
  options: PageContextOptions,
  input: PageAuthRequestInput,
): PageAuthResult {
  const debug = Boolean(options.debug);
  const pageUrl = parseRequestUrl(input.url);
  if (!pageUrl) {
    debugLog(debug, "page auth failed", { reason: "INVALID_URL" });
    return unauthorizedResponse();
  }

  const launchToken =
    pageUrl.searchParams.get(PAGE_LAUNCH_QUERY_PARAM)?.trim() ?? "";
  if (launchToken) {
    const verifiedLaunch = verifyPageToken<PageLaunchTokenPayload>({
      apiKey: options.apiKey,
      token: launchToken,
    });
    if (!verifiedLaunch.ok || verifiedLaunch.payload.type !== "launch") {
      debugLog(debug, "page launch token rejected", {
        reason: verifiedLaunch.ok ? "INVALID_LAUNCH_TYPE" : verifiedLaunch.reason,
        pagePath: pageUrl.pathname,
      });
      return unauthorizedResponse();
    }
    if (verifiedLaunch.payload.pagePath !== pageUrl.pathname) {
      debugLog(debug, "page launch token path mismatch", {
        expectedPath: verifiedLaunch.payload.pagePath,
        requestPath: pageUrl.pathname,
      });
      return unauthorizedResponse();
    }

    const sessionToken = createPageSessionToken({
      apiKey: options.apiKey,
      projectId: verifiedLaunch.payload.projectId,
      account: verifiedLaunch.payload.account,
      user: verifiedLaunch.payload.user,
      theme: verifiedLaunch.payload.theme,
      exp: Date.now() + (options.pageSessionTtlMs ?? DEFAULT_PAGE_SESSION_TTL_MS),
    });

    const cleanUrl = new URL(pageUrl.toString());
    cleanUrl.searchParams.delete(PAGE_LAUNCH_QUERY_PARAM);

    debugLog(debug, "page launch token accepted", {
      pagePath: pageUrl.pathname,
      projectId: verifiedLaunch.payload.projectId,
      accountId: verifiedLaunch.payload.account?.id ?? null,
      userId: verifiedLaunch.payload.user.id ?? null,
    });

    return {
      type: "response",
      status: 302,
      headers: {
        "cache-control": "no-store",
        location: `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`,
        "set-cookie": serializePageSessionCookie(
          sessionToken,
          pageUrl.protocol === "https:",
          options.pageSessionTtlMs ?? DEFAULT_PAGE_SESSION_TTL_MS,
        ),
      },
    };
  }

  const sessionToken = readPageSessionCookie(input.headers);
  if (!sessionToken) {
    debugLog(debug, "page session cookie missing", { pagePath: pageUrl.pathname });
    return unauthorizedResponse();
  }

  const verifiedSession = verifyPageToken<PageSessionTokenPayload>({
    apiKey: options.apiKey,
    token: sessionToken,
  });
  if (!verifiedSession.ok || verifiedSession.payload.type !== "session") {
    debugLog(debug, "page session rejected", {
      reason: verifiedSession.ok ? "INVALID_SESSION_TYPE" : verifiedSession.reason,
      pagePath: pageUrl.pathname,
    });
    return unauthorizedResponse();
  }

  const context = createPageAuthContext(
    pageUrl.pathname,
    verifiedSession.payload.projectId,
    verifiedSession.payload.account,
    verifiedSession.payload.theme,
    verifiedSession.payload.user,
  );

  debugLog(debug, "page session resolved", {
    pagePath: context.pagePath,
    projectId: context.projectId,
    accountId: context.account?.id ?? null,
    userId: context.user.id ?? null,
  });

  return {
    type: "authorized",
    context,
  };
}

function unauthorizedResponse(): PageAuthResult {
  return {
    type: "response",
    status: 401,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    },
    body: "Unauthorized",
  };
}

function createPageAuthContext(
  pagePath: string,
  projectId: string | null,
  account: {
    id: string | null;
    name: string | null;
    metadata: Record<string, unknown>;
  } | null,
  theme: "light" | "dark",
  user: {
    id: string | null;
    email: string | null;
    name: string | null;
  },
): PageAuthContext {
  const contextUser: PageUser = {};
  if (user.id) {
    contextUser.id = user.id;
  }
  if (user.email) {
    contextUser.email = user.email;
  }
  if (user.name) {
    contextUser.name = user.name;
  }

  return {
    pagePath,
    projectId,
    account: normalizeAccount(account),
    theme,
    user: contextUser,
  };
}

function normalizeAccount(
  account: {
    id: string | null;
    name: string | null;
    metadata: Record<string, unknown>;
  } | null,
): Account | null {
  if (!account?.id || !account.name) {
    return null;
  }

  return {
    id: account.id,
    name: account.name,
    metadata: account.metadata ?? {},
  };
}

function parseRequestUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function readPageSessionCookie(
  headers: PageAuthRequestInput["headers"],
): string | null {
  const cookieHeader = getHeaderValue(headers, "cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === PAGE_SESSION_COOKIE_NAME) {
      const value = rawValue.join("=").trim();
      return value || null;
    }
  }

  return null;
}

function serializePageSessionCookie(
  value: string,
  secure: boolean,
  ttlMs: number,
): string {
  const parts = [
    `${PAGE_SESSION_COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(1, Math.floor(ttlMs / 1000))}`,
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function debugLog(
  debug: boolean,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (!debug || process.env.NODE_ENV !== "development") {
    return;
  }
  console.log("[konsier] pageAuth", meta ? { message, ...meta } : { message });
}
