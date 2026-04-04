import { accessSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function resolveProjectSyncEntry(): string | null {
  const candidates = [
    resolve(process.cwd(), "src", "konsier.ts"),
    resolve(process.cwd(), "app", "konsier.ts"),
    resolve(process.cwd(), "src", "konsier.js"),
    resolve(process.cwd(), "app", "konsier.js"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolveTsxBinary(): string | null {
  const candidates = [
    resolve(process.cwd(), "node_modules", ".bin", "tsx"),
    resolve(process.cwd(), "node_modules", ".bin", "tsx.cmd"),
  ];

  for (const candidate of candidates) {
    try {
      accessSync(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

export function runProjectSync(input: {
  entry: string;
  tsxBinary: string;
}): number {
  const script = `
    import "dotenv/config";
    const mod = await import(${JSON.stringify(pathToFileURL(input.entry).href)});
    const konsier = mod.konsier;
    if (!konsier || typeof konsier.sync !== "function") {
      throw new Error("The project sync entry must export a named 'konsier' instance.");
    }
    await konsier.sync();
    console.log("Konsier sync completed.");
  `;

  const result = spawnSync(input.tsxBinary, ["--eval", script], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}
