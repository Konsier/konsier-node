export type Framework = "express" | "hono" | "next" | "fastify";
export type DatabaseOption = "none" | "supabase" | "sqlite_drizzle";
export type CodingAgent =
  | "opencode"
  | "codex"
  | "claude"
  | "cursor"
  | "windsurf"
  | "cline";

export type SkillTemplate = {
  name: string;
  description: string;
  body: string;
};
