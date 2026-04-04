import { log } from "@clack/prompts";
import {
  resolveProjectSyncEntry,
  resolveTsxBinary,
  runProjectSync,
} from "../lib/project-sync";

export function runSyncCommand(): never {
  const entry = resolveProjectSyncEntry();
  if (!entry) {
    log.error("Could not find src/konsier.ts or app/konsier.ts in the current project.");
    process.exit(1);
  }

  const tsxBinary = resolveTsxBinary();
  if (!tsxBinary) {
    log.error("Could not find a local tsx binary. Run npm install in this project first.");
    process.exit(1);
  }

  process.exit(runProjectSync({ entry, tsxBinary }));
}
