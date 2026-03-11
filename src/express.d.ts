import type { PageAuthContext } from "./types";

declare global {
  namespace Express {
    interface Request {
      konsier?: PageAuthContext;
      rawBody?: Buffer;
    }
  }
}

export {};
