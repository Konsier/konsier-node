export const DEFAULT_CLOUD_BASE_URL = "https://konsier.com/api";
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_RETRIES = 1;
export const DEFAULT_ALLOWED_CLOCK_SKEW_MS = 5 * 60 * 1000;
export const DEFAULT_PAGE_SESSION_TTL_MS = 15 * 60 * 1000;
export const ENV_CLOUD_BASE_URL = "KONSIER_API_BASE_URL";

export const HEADER_AUTHORIZATION = "authorization";
export const HEADER_CONTENT_TYPE = "content-type";
export const HEADER_SIGNATURE = "x-konsier-signature";
export const HEADER_TIMESTAMP = "x-konsier-timestamp";

export const SIGNATURE_PREFIX = "sha256=";
export const PAGE_LAUNCH_QUERY_PARAM = "__konsier";
export const PAGE_SESSION_COOKIE_NAME = "__konsier_page";
