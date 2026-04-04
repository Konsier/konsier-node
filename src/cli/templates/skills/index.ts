import { konsierAccountsSkill } from "./konsier-accounts";
import { konsierAgentsSkill } from "./konsier-agents";
import { konsierAttachmentsSkill } from "./konsier-attachments";
import { konsierBestPracticesSkill } from "./konsier-best-practices";
import { konsierDeploySkill } from "./konsier-deploy";
import { konsierMessagingSkill } from "./konsier-messaging";
import { konsierPagesSkill } from "./konsier-pages";
import { konsierReviewSkill } from "./konsier-review";
import { konsierTestingSkill } from "./konsier-testing";
import { konsierToolsSkill } from "./konsier-tools";
import { konsierUsersSkill } from "./konsier-users";
import { konsierSkill } from "./konsier";

export { formatSkillForAgent } from "./format";

export const SKILLS = [
  konsierSkill,
  konsierAgentsSkill,
  konsierToolsSkill,
  konsierAttachmentsSkill,
  konsierMessagingSkill,
  konsierPagesSkill,
  konsierUsersSkill,
  konsierAccountsSkill,
  konsierBestPracticesSkill,
  konsierReviewSkill,
  konsierTestingSkill,
  konsierDeploySkill,
];
