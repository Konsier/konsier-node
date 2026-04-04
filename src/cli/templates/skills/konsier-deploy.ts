import type { SkillTemplate } from "../../types";

export const konsierDeploySkill: SkillTemplate = {
  name: "konsier-deploy",
  description: "Production deployment expectations for Konsier apps.",
  body: `# Konsier Deploy

In production:

- use a public HTTPS \`KONSIER_ENDPOINT_URL\`
- run \`konsier.sync()\` on startup
- configure \`KONSIER_API_KEY\`
- configure \`KONSIER_ENDPOINT_URL\`
- configure \`PORT\`
- configure \`NODE_ENV\`

Typical targets include Railway, Fly.io, Render, and Vercel for Next.js.`,
};
