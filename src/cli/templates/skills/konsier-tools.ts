import type { SkillTemplate } from "../../types";

export const konsierToolsSkill: SkillTemplate = {
  name: "konsier-tools",
  description: "Tool creation rules, input schemas, and handler output requirements.",
  body: `# Konsier Tools

Create tools with \`Konsier.tool({ ... })\`.

## Input

- \`input\` must be a Zod schema
- add \`.describe()\` on every meaningful field

## Handler

- signature: \`async (input, ctx)\`
- return a plain JSON object or \`ctx.end()\`
- do not return arrays, primitives, or \`null\`

## Context

Useful fields on \`ctx\`:

- \`ctx.channel\`
- \`ctx.agent\`
- \`ctx.user\`
- \`ctx.account\`
- \`ctx.conversation\`
- \`ctx.messages\`

## Errors

Throw normal \`Error\` instances for failure cases. The SDK converts them into proper cloud errors.`,
};
