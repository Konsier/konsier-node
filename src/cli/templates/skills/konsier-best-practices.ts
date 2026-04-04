import type { SkillTemplate } from "../../types";

export const konsierBestPracticesSkill: SkillTemplate = {
  name: "konsier-best-practices",
  description: "Golden rules for building reliable Konsier agents and tools.",
  body: `# Konsier Best Practices

## Rules

1. Make every tool clearly distinct.
2. Avoid one-off tools for rare behavior.
3. Use descriptive tool names.
4. Avoid hidden tool sequencing.
5. Put durable policy in the system prompt.
6. Prefer capability-complete tools or action links.
7. Put dynamic guidance in tool outputs.
8. Keep tools under 20 per agent.
9. Add \`.describe()\` to Zod fields.
10. Return plain objects or \`ctx.end()\`.
11. Throw errors instead of returning \`{ error: ... }\`.
12. Use \`ctx.end()\` when the tool owns the final response.`,
};
