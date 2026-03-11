import {
  DEFAULT_ALLOWED_CLOCK_SKEW_MS,
  HEADER_ACCOUNT_ID,
  HEADER_ACCOUNT_METADATA,
  HEADER_ACCOUNT_NAME,
  HEADER_PAGE_PATH,
  HEADER_PROJECT_ID,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  HEADER_USER_EMAIL,
  HEADER_USER_ID,
  HEADER_USER_NAME,
} from "../constants";
import { getHeaderValue, verifyKonsierSignature } from "../protocol/signatures";
import type {
  HttpRequestLike,
  HttpResponseLike,
  NextFunction,
  PageAuthContext,
} from "../types";

interface VerifyPageOptions {
  apiKey: string;
  allowedClockSkewMs?: number;
}

export function createVerifyPageMiddleware(options: VerifyPageOptions) {
  const allowedClockSkewMs =
    options.allowedClockSkewMs ?? DEFAULT_ALLOWED_CLOCK_SKEW_MS;

  return function verifyPage(
    req: HttpRequestLike,
    res: HttpResponseLike,
    next?: NextFunction,
  ): void {
    const signature = getHeaderValue(req.headers, HEADER_SIGNATURE);
    const timestamp = getHeaderValue(req.headers, HEADER_TIMESTAMP);
    const pagePath = getHeaderValue(req.headers, HEADER_PAGE_PATH);

    if (!signature || !timestamp || !pagePath) {
      deny(res);
      return;
    }

    const verified = verifyKonsierSignature({
      apiKey: options.apiKey,
      timestamp,
      payload: pagePath,
      providedSignature: signature,
      allowedClockSkewMs,
    });

    if (!verified.ok) {
      deny(res);
      return;
    }

    const accountMetadata = parseJsonObject(
      getHeaderValue(req.headers, HEADER_ACCOUNT_METADATA),
    );
    const user: PageAuthContext["user"] = {};
    const userId = getHeaderValue(req.headers, HEADER_USER_ID);
    const userEmail = getHeaderValue(req.headers, HEADER_USER_EMAIL);
    const userName = getHeaderValue(req.headers, HEADER_USER_NAME);
    if (userId !== undefined) {
      user.id = userId;
    }
    if (userEmail !== undefined) {
      user.email = userEmail;
    }
    if (userName !== undefined) {
      user.name = userName;
    }

    const context: PageAuthContext = {
      pagePath,
      projectId: getHeaderValue(req.headers, HEADER_PROJECT_ID) ?? null,
      account:
        getHeaderValue(req.headers, HEADER_ACCOUNT_ID) &&
        getHeaderValue(req.headers, HEADER_ACCOUNT_NAME)
          ? {
              id: getHeaderValue(req.headers, HEADER_ACCOUNT_ID) as string,
              name: getHeaderValue(req.headers, HEADER_ACCOUNT_NAME) as string,
              metadata: accountMetadata ?? {},
            }
          : null,
      user,
    };

    (req as HttpRequestLike & { konsier?: PageAuthContext }).konsier = context;
    if (next) {
      next();
    }
  };
}

function deny(res: HttpResponseLike): void {
  if (typeof res.status === "function") {
    res.status(401);
  } else {
    res.statusCode = 401;
  }

  if (typeof res.json === "function") {
    res.json({ error: "Unauthorized" });
    return;
  }

  if (typeof res.send === "function") {
    res.send("Unauthorized");
    return;
  }

  if (typeof res.end === "function") {
    res.end("Unauthorized");
  }
}

function parseJsonObject(
  value: string | undefined,
): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
