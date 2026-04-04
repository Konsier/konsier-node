import {
  databaseEnv,
  databaseIgnoreEntries,
  devDependencies,
  runtimeDependencies,
} from "../database";
import type { DatabaseOption, Framework } from "../../types";

export function packageJsonTemplate(input: {
  projectName: string;
  framework: Framework;
  database: DatabaseOption;
}): string {
  const scripts =
    input.framework === "next"
      ? {
          dev: "next dev",
          build: "next build",
          start: "next start",
          sync: "konsier sync",
          typecheck: "tsc --noEmit",
        }
      : {
          dev: "tsx src/index.ts",
          "dev:watch": "tsx watch src/index.ts",
          build: "tsup src/index.ts --format esm --target node20 --out-dir dist",
          start: "node dist/index.js",
          sync: "konsier sync",
          typecheck: "tsc --noEmit",
        };

  return JSON.stringify(
    {
      name: input.projectName,
      private: true,
      type: "module",
      scripts,
      dependencies: Object.fromEntries(
        runtimeDependencies(input.framework, input.database).map((name) => [
          name,
          "latest",
        ]),
      ),
      devDependencies: Object.fromEntries(
        devDependencies(input.framework, input.database).map((name) => [
          name,
          "latest",
        ]),
      ),
    },
    null,
    2,
  );
}

export function tsconfigTemplate(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        types: ["node"],
      },
      include: ["src", "app", "drizzle.config.ts"],
      exclude: ["dist", "node_modules"],
    },
    null,
    2,
  );
}

export function envTemplate(input: {
  apiKey: string;
  endpointUrl: string;
  port: number;
  database: DatabaseOption;
}): string {
  return [
    `KONSIER_API_KEY=${input.apiKey}`,
    `KONSIER_ENDPOINT_URL=${input.endpointUrl}`,
    `PORT=${input.port}`,
    ...databaseEnv(input.database),
    "",
  ].join("\n");
}

export function envExampleTemplate(input: {
  endpointUrl: string;
  port: number;
  database: DatabaseOption;
}): string {
  return [
    "KONSIER_API_KEY=ks_live_xxxxx",
    `KONSIER_ENDPOINT_URL=${input.endpointUrl}`,
    `PORT=${input.port}`,
    ...databaseEnv(input.database),
    "",
  ].join("\n");
}

export function gitignoreTemplate(database: DatabaseOption): string {
  return [
    "node_modules/",
    ".env",
    "dist/",
    ".next/",
    ...databaseIgnoreEntries(database),
    "",
  ].join("\n");
}

export function readmeTemplate(input: {
  projectName: string;
  framework: Framework;
  database: DatabaseOption;
  endpointUrl: string;
  projectNameResolved: string;
  telegramBotUsername: string | null;
}): string {
  const telegramLine = input.telegramBotUsername
    ? `Telegram bot connected: \`${input.telegramBotUsername}\``
    : "Telegram bot not connected during init.";
  return `# ${input.projectName}

This project was scaffolded for Konsier project **${input.projectNameResolved}**.

## Run

1. Install dependencies if needed: \`npm install\`
2. Start the app: \`npm run dev\`
3. Make sure your public tunnel/domain is running before expecting Konsier sync to succeed
4. Confirm \`KONSIER_ENDPOINT_URL\` points at that public app URL plus \`/konsier\`
5. Run \`npm run sync\` when you want to register the current manifest explicitly

## Environment

- \`KONSIER_API_KEY\`
- \`KONSIER_ENDPOINT_URL\`
- \`PORT\`

## Stack

- Framework: \`${input.framework}\`
- Database: \`${input.database}\`
- Endpoint: \`${input.endpointUrl}\`

## Channel Setup

${telegramLine}

## Skills

This repo includes Konsier skill files for OpenCode, Codex, Claude Code, Cursor, Windsurf, and Cline.
`;
}
