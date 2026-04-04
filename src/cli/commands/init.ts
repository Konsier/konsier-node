import {
  confirm,
  intro,
  isCancel,
  log,
  outro,
  select,
  spinner,
  text,
  cancel,
} from "@clack/prompts";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { DatabaseOption, Framework } from "../types";
import { databaseFiles } from "../templates/database";
import { frameworkFiles } from "../templates/frameworks";
import {
  envExampleTemplate,
  envTemplate,
  gitignoreTemplate,
  packageJsonTemplate,
  readmeTemplate,
  tsconfigTemplate,
} from "../templates/project";
import { formatSkillForAgent, SKILLS } from "../templates/skills";
import {
  connectTelegram,
  createCloudClient,
  ensureProjectAgent,
  validateProject,
  type ProjectContext,
} from "../lib/cloud";
import { ensureEmptyDirectory, writeTextFile } from "../lib/fs";

type InitAnswers = {
  projectName: string;
  framework: Framework;
  appBaseUrl: string;
  apiKey: string;
  telegramBotUsername: string | null;
  port: number;
  database: DatabaseOption;
};

function assertPromptValue<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  return value;
}

function sanitizeProjectName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function buildEndpointUrl(appBaseUrl: string): string {
  return `${appBaseUrl.replace(/\/+$/, "")}/konsier`;
}

async function promptApiKey(): Promise<string> {
  while (true) {
    const apiKey = assertPromptValue(
      await text({
        message: "Konsier API key",
        placeholder: "ks_live_...",
        validate(value) {
          return value.trim().startsWith("ks_")
            ? undefined
            : "Enter a valid Konsier API key.";
        },
      }),
    ).trim();

    const status = spinner();
    status.start("Validating API key");

    try {
      const client = createCloudClient(apiKey);
      const project = await validateProject(client);
      status.stop(`Connected to project "${project.name}"`);
      return apiKey;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.stop("API key rejected");
      log.error(message);
    }
  }
}

async function promptTelegramSetup(
  apiKey: string,
  projectId: number,
): Promise<string> {
  const client = createCloudClient(apiKey);
  const agent = await ensureProjectAgent(client, projectId);

  while (true) {
    const token = assertPromptValue(
      await text({
        message: "Telegram bot token",
        placeholder: "123456:ABC...",
        validate(value) {
          return value.trim() ? undefined : "Telegram bot token is required.";
        },
      }),
    ).trim();

    const status = spinner();
    status.start("Validating Telegram bot");

    try {
      const botUsername = await connectTelegram(client, {
        projectId,
        agentId: agent.id,
        token,
      });
      status.stop(`Telegram bot connected: ${botUsername}`);
      return botUsername;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.stop("Telegram bot rejected");
      log.error(message);
    }
  }
}

async function promptInitAnswers(): Promise<InitAnswers> {
  const projectName = sanitizeProjectName(
    assertPromptValue(
      await text({
        message: "Project name",
        placeholder: "my-bot",
        validate(value) {
          return value.trim() ? undefined : "Project name is required.";
        },
      }),
    ),
  );

  const framework = assertPromptValue(
    await select({
      message: "Framework",
      options: [
        { value: "express", label: "Express" },
        { value: "hono", label: "Hono" },
        { value: "next", label: "Next.js" },
        { value: "fastify", label: "Fastify" },
      ],
    }),
  ) as Framework;

  const appBaseUrl = assertPromptValue(
    await text({
      message: "Public app URL",
      placeholder: "https://your-public-url",
      validate(value) {
        const normalized = value.trim();
        if (!normalized) {
          return "Public app URL is required.";
        }
        try {
          const parsed = new URL(normalized);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return "Use an http(s) URL.";
          }
          if (parsed.pathname !== "/" && parsed.pathname !== "") {
            return "Enter the base app URL without /konsier.";
          }
          return undefined;
        } catch {
          return "Enter a valid public URL.";
        }
      },
    }),
  ).trim();

  const apiKey = await promptApiKey();

  const telegramEnabled = assertPromptValue(
    await confirm({
      message: "Set up Telegram now?",
      initialValue: true,
    }),
  );

  const project = await validateProject(createCloudClient(apiKey));
  const telegramBotUsername = telegramEnabled
    ? await promptTelegramSetup(apiKey, project.id)
    : null;

  const portRaw = assertPromptValue(
    await text({
      message: "Port",
      placeholder: "3000",
      initialValue: "3000",
      validate(value) {
        const port = Number(value);
        return Number.isInteger(port) && port > 0 && port < 65536
          ? undefined
          : "Enter a valid port.";
      },
    }),
  );

  const database = assertPromptValue(
    await select({
      message: "Database",
      options: [
        { value: "none", label: "None" },
        { value: "supabase", label: "Supabase" },
        { value: "sqlite_drizzle", label: "SQLite (Drizzle)" },
      ],
    }),
  ) as DatabaseOption;

  return {
    projectName,
    framework,
    appBaseUrl,
    apiKey,
    telegramBotUsername,
    port: Number(portRaw),
    database,
  };
}

async function scaffoldProject(input: {
  targetDir: string;
  answers: InitAnswers;
  project: ProjectContext;
}): Promise<void> {
  const endpointUrl = buildEndpointUrl(input.answers.appBaseUrl);
  const files: Record<string, string> = {
    ".env": envTemplate({
      apiKey: input.answers.apiKey,
      endpointUrl,
      port: input.answers.port,
      database: input.answers.database,
    }),
    ".env.example": envExampleTemplate({
      endpointUrl,
      port: input.answers.port,
      database: input.answers.database,
    }),
    ".gitignore": gitignoreTemplate(input.answers.database),
    "package.json": packageJsonTemplate({
      projectName: input.answers.projectName,
      framework: input.answers.framework,
      database: input.answers.database,
    }),
    "tsconfig.json": tsconfigTemplate(),
    "README.md": readmeTemplate({
      projectName: input.answers.projectName,
      framework: input.answers.framework,
      database: input.answers.database,
      endpointUrl,
      projectNameResolved: input.project.name,
      telegramBotUsername: input.answers.telegramBotUsername,
    }),
    ...frameworkFiles(input.answers.framework),
    ...databaseFiles(input.answers.database),
  };

  for (const [relativePath, content] of Object.entries(files)) {
    await writeTextFile(join(input.targetDir, relativePath), content);
  }

  for (const skill of SKILLS) {
    for (const agent of [
      "opencode",
      "codex",
      "claude",
      "cursor",
      "windsurf",
      "cline",
    ] as const) {
      const formatted = formatSkillForAgent(skill, agent);
      await writeTextFile(
        join(input.targetDir, formatted.relativePath),
        formatted.content,
      );
    }
  }
}

function installDependencies(targetDir: string): void {
  const result = spawnSync("npm", ["install"], {
    cwd: targetDir,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("npm install failed.");
  }
}

export async function runInitCommand(): Promise<void> {
  intro("Create a new Konsier project");

  const answers = await promptInitAnswers();
  const targetDir = resolve(process.cwd(), answers.projectName);
  await ensureEmptyDirectory(targetDir);

  const project = await validateProject(createCloudClient(answers.apiKey));
  const status = spinner();

  status.start("Writing project files");
  await scaffoldProject({
    targetDir,
    answers,
    project,
  });
  status.stop("Files written");

  status.start("Installing dependencies");
  installDependencies(targetDir);
  status.stop("Dependencies installed");

  outro(
    `Done!\n\ncd ${answers.projectName}\nnpm run dev\n\nBefore Konsier sync can succeed, make sure your public tunnel/domain is running and matches KONSIER_ENDPOINT_URL.`,
  );
}
