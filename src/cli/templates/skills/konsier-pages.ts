import type { SkillTemplate } from "../../types";

export const konsierPagesSkill: SkillTemplate = {
  name: "konsier-pages",
  description: "Embedded page definitions and page-auth verification across frameworks.",
  body: `# Konsier Pages

Define pages in \`internal.pages\`.

Examples:

- Express: \`verifyKonsierPage(konsier)\`
- Next.js: \`verifyKonsierPageRequest(konsier, request)\`
- Hono: \`verifyKonsierPageRequest(konsier, c.req.raw)\`
- Fastify: \`verifyKonsierPageRequest(konsier, request)\`

Authorized page requests expose page context including:

- \`pagePath\`
- \`projectId\`
- \`account\`
- \`theme\`
- \`user\`

Use \`internal.tools\` for tools that should be available across agents.`,
};
