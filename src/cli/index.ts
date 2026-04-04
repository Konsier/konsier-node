#!/usr/bin/env node
import { log } from "@clack/prompts";
import { runInitCommand } from "./commands/init";
import { runSyncCommand } from "./commands/sync";

function detectCommand(): string {
  return process.argv[2] ?? "init";
}

async function main(): Promise<void> {
  const command = detectCommand();
  if (command === "init") {
    try {
      await runInitCommand();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(message);
      process.exit(1);
    }
    return;
  }

  if (command === "sync") {
    runSyncCommand();
  }

  log.error(`Unknown command: ${command}`);
  process.exit(1);
}

void main();
