import type { SkillTemplate } from "../../types";

export const konsierBestPracticesSkill: SkillTemplate = {
  name: "konsier-best-practices",
  description: "Golden rules for building reliable Konsier agents and operations.",
  body: `# Konsier Best Practices

## Rules

1. Make every operation clearly distinct.
2. Avoid one-off operations for rare behavior.
3. Use descriptive operation identities and titles.
4. Avoid hidden operation sequencing.
5. Put durable policy in the system prompt.
6. Prefer capability-complete operations or action links.
7. Put dynamic guidance in operation outputs.
8. Keep operations under 20 per agent.
9. Add \`.describe()\` to Zod fields.
10. Return plain objects matching the output schema.
11. Throw errors instead of returning \`{ error: ... }\`.
12. Let the agent's final text own the user-facing response.`,
};
