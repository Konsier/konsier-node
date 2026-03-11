export const DEFAULT_CLOUD_BASE_URL = "https://konsier.com/api";
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_RETRIES = 1;
export const DEFAULT_ALLOWED_CLOCK_SKEW_MS = 5 * 60 * 1000;
export const ENV_CLOUD_BASE_URL = "KONSIER_API_BASE_URL";

export const HEADER_AUTHORIZATION = "authorization";
export const HEADER_CONTENT_TYPE = "content-type";
export const HEADER_SIGNATURE = "x-konsier-signature";
export const HEADER_TIMESTAMP = "x-konsier-timestamp";

export const HEADER_PROJECT_ID = "x-konsier-project-id";
export const HEADER_PAGE_PATH = "x-konsier-page-path";

export const HEADER_ACCOUNT_ID = "x-konsier-account-id";
export const HEADER_ACCOUNT_NAME = "x-konsier-account-name";
export const HEADER_ACCOUNT_METADATA = "x-konsier-account-metadata";

export const HEADER_USER_ID = "x-konsier-user-id";
export const HEADER_USER_EMAIL = "x-konsier-user-email";
export const HEADER_USER_NAME = "x-konsier-user-name";
export const HEADER_EXECUTION_PROJECT_ID = "x-konsier-execution-project-id";

export const SIGNATURE_PREFIX = "sha256=";
