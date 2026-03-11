import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const templateCache = new Map<string, string>();

export function renderTemplate(
  templateName: string,
  values: Record<string, string>,
): string {
  const source = loadTemplate(templateName);

  return source.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return values[key] ?? "";
  });
}

export function renderTemplates(
  templateName: string,
  items: Array<Record<string, string>>,
): string {
  return items.map((values) => renderTemplate(templateName, values)).join("");
}

function loadTemplate(templateName: string): string {
  const cached = templateCache.get(templateName);
  if (cached) {
    return cached;
  }

  const templatePath = resolve(
    process.cwd(),
    "src",
    "views",
    "templates",
    templateName,
  );
  const template = readFileSync(templatePath, "utf8");
  templateCache.set(templateName, template);
  return template;
}
