import type { SkillTemplate } from "../../types";

export const konsierAttachmentsSkill: SkillTemplate = {
  name: "konsier-attachments",
  description: "Attachment input schemas and how to send attachments back to users.",
  body: `# Konsier Attachments

Use attachment schemas for tool inputs:

- \`Konsier.attachment.image()\`
- \`Konsier.attachment.video()\`
- \`Konsier.attachment.audio()\`
- \`Konsier.attachment.file()\`
- \`Konsier.attachment.location()\`

You can use unions, for example:

\`\`\`ts
z.union([Konsier.attachment.image(), Konsier.attachment.file()]).optional()
\`\`\`

Send attachments back with \`ctx.attach()\`:

- by URL
- by Buffer
- by \`attachmentId\`
- as a location payload
- as an array of attachments`,
};
