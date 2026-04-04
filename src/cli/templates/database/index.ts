import type { DatabaseOption, Framework } from "../../types";

export function databaseEnv(database: DatabaseOption): string[] {
  if (database === "supabase") {
    return ["SUPABASE_URL=", "SUPABASE_ANON_KEY="];
  }
  if (database === "sqlite_drizzle") {
    return ["DATABASE_URL=./data/local.db"];
  }
  return [];
}

export function databaseIgnoreEntries(database: DatabaseOption): string[] {
  if (database === "sqlite_drizzle") {
    return ["data/"];
  }
  return [];
}

export function runtimeDependencies(
  framework: Framework,
  database: DatabaseOption,
): string[] {
  const deps = new Set<string>(["dotenv", "konsier", "zod"]);
  if (framework === "express") deps.add("express");
  if (framework === "hono") {
    deps.add("hono");
    deps.add("@hono/node-server");
  }
  if (framework === "fastify") deps.add("fastify");
  if (framework === "next") {
    deps.add("next");
    deps.add("react");
    deps.add("react-dom");
  }
  if (database === "supabase") deps.add("@supabase/supabase-js");
  if (database === "sqlite_drizzle") {
    deps.add("better-sqlite3");
    deps.add("drizzle-orm");
  }
  return [...deps];
}

export function devDependencies(
  framework: Framework,
  database: DatabaseOption,
): string[] {
  const deps = new Set<string>(["tsx", "tsup", "typescript", "@types/node"]);
  if (framework === "express") deps.add("@types/express");
  if (database === "sqlite_drizzle") deps.add("drizzle-kit");
  return [...deps];
}

export function databaseFiles(database: DatabaseOption): Record<string, string> {
  if (database === "supabase") {
    return {
      "src/db.ts": `import { createClient } from "@supabase/supabase-js";

export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);
`,
    };
  }

  if (database === "sqlite_drizzle") {
    return {
      "src/db/index.ts": `import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const sqlite = new Database(process.env.DATABASE_URL!);

export const db = drizzle(sqlite);
`,
      "src/db/schema.ts": `export {};
`,
      "drizzle.config.ts": `import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`,
    };
  }

  return {};
}
