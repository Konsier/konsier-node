type ErrorLeaf = {
  code: string;
  message: string;
  action: string;
};

type ErrorRegistry = {
  [key: string]: ErrorLeaf | ErrorRegistry;
};

type LeafValues<T> = T extends ErrorLeaf
  ? T["code"]
  : T extends ErrorRegistry
    ? LeafValues<T[keyof T]>
    : never;

type CodeTree<T> = T extends ErrorLeaf
  ? T["code"]
  : T extends ErrorRegistry
    ? { [K in keyof T]: CodeTree<T[K]> }
    : never;

function isErrorLeaf(value: unknown): value is ErrorLeaf {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as ErrorLeaf).code === "string" &&
    typeof (value as ErrorLeaf).message === "string" &&
    typeof (value as ErrorLeaf).action === "string"
  );
}

function collectCodes<T extends ErrorRegistry>(registry: T): CodeTree<T> {
  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(registry)) {
    next[key] = isErrorLeaf(value) ? value.code : collectCodes(value);
  }

  return next as CodeTree<T>;
}

function collectDefaults(
  registry: ErrorRegistry,
): Record<string, { message: string; action: string }> {
  const next: Record<string, { message: string; action: string }> = {};

  for (const value of Object.values(registry)) {
    if (isErrorLeaf(value)) {
      next[value.code] = {
        message: value.message,
        action: value.action,
      };
      continue;
    }

    Object.assign(next, collectDefaults(value));
  }

  return next;
}

function collectLookup(registry: ErrorRegistry): Record<string, ErrorLeaf> {
  const next: Record<string, ErrorLeaf> = {};

  for (const value of Object.values(registry)) {
    if (isErrorLeaf(value)) {
      next[value.code] = value;
      continue;
    }

    Object.assign(next, collectLookup(value));
  }

  return next;
}

export const ERRORS = {
  project: {
    endpoint: {
      not_found: {
        code: "project.endpoint.not_found",
        message: "The project endpoint could not be found.",
        action: "Check the endpoint URL in your project settings and try again."
      },
      signature_invalid: {
        code: "project.endpoint.signature_invalid",
        message: "Konsier reached your app, but your app rejected the verification request.",
        action: "Check that your app's KONSIER_API_KEY matches this project's API key, then try again."
      },
      timestamp_invalid: {
        code: "project.endpoint.timestamp_invalid",
        message: "Konsier reached your app, but the request timestamp was rejected.",
        action: "Check your server clock and request-signature validation settings, then try again."
      },
      request_invalid: {
        code: "project.endpoint.request_invalid",
        message: "Konsier reached your app, but your app rejected the request format.",
        action: "Check your SDK handler implementation and try again."
      },
      timeout: {
        code: "project.endpoint.timeout",
        message: "Konsier reached your app, but the request timed out.",
        action: "Check your app's availability and response time, then try again."
      },
      unreachable: {
        code: "project.endpoint.unreachable",
        message: "Konsier could not reach your app's configured endpoint.",
        action: "Check that the endpoint URL is publicly reachable and try again."
      },
      server_error: {
        code: "project.endpoint.server_error",
        message: "Your app returned a server error while Konsier was contacting it.",
        action: "Check your app logs, fix the server error, and try again."
      },
      access_denied: {
        code: "project.endpoint.access_denied",
        message: "Your app denied the request from Konsier.",
        action: "Check the endpoint access rules and try again."
      }
    },
    configuration: {
      endpoint_missing: {
        code: "project.configuration.endpoint_missing",
        message: "This project does not have an endpoint configured.",
        action: "Add an endpoint URL in project settings and try again."
      },
      api_key_missing: {
        code: "project.configuration.api_key_missing",
        message: "This project does not have an API key configured.",
        action: "Add a project API key and try again."
      },
      endpoint_and_api_key_missing: {
        code: "project.configuration.endpoint_and_api_key_missing",
        message: "This project is missing both its endpoint URL and API key.",
        action: "Add the endpoint URL and API key, then try again."
      },
      endpoint_invalid: {
        code: "project.configuration.endpoint_invalid",
        message: "This project's configured endpoint is invalid or unusable.",
        action: "Update the project endpoint configuration and try again."
      }
    },
    resource: {
      not_found: {
        code: "project.resource.not_found",
        message: "The requested project could not be found.",
        action: "Check the project identifier and try again."
      }
    },
    key: {
      not_found: {
        code: "project.key.not_found",
        message: "The requested project key could not be found.",
        action: "Check the project key identifier and try again."
      },
      name_conflict: {
        code: "project.key.name_conflict",
        message: "A project key with that name already exists.",
        action: "Choose a different project key name and try again."
      }
    }
  },
  agent: {
    resource: {
      not_found: {
        code: "agent.resource.not_found",
        message: "The requested agent could not be found.",
        action: "Check the agent identifier and try again."
      }
    },
    configuration: {
      invalid: {
        code: "agent.configuration.invalid",
        message: "The agent configuration is invalid.",
        action: "Fix the agent configuration and try again."
      }
    }
  },
  channel: {
    resource: {
      not_found: {
        code: "channel.resource.not_found",
        message: "The requested channel could not be found.",
        action: "Check the channel identifier and try again."
      }
    },
    configuration: {
      agent_not_linked: {
        code: "channel.configuration.agent_not_linked",
        message: "This channel is not linked to an agent.",
        action: "Link an agent to the channel and try again."
      },
      agent_source_missing: {
        code: "channel.configuration.agent_source_missing",
        message: "This channel is linked to an agent source that is no longer available.",
        action: "Reconnect the source agent and try again."
      },
      linked_ref_missing: {
        code: "channel.configuration.linked_ref_missing",
        message: "This channel references an agent implementation that is missing.",
        action: "Update the linked agent reference and try again."
      },
      misconfigured: {
        code: "channel.configuration.misconfigured",
        message: "This channel is misconfigured.",
        action: "Review the channel settings and try again."
      },
      agent_assignment_unsupported: {
        code: "channel.configuration.agent_assignment_unsupported",
        message: "Direct agent assignment for this channel is no longer supported.",
        action: "Manage the active agent from the channel deployment instead."
      }
    },
    telegram: {
      not_connected: {
        code: "channel.telegram.not_connected",
        message: "Telegram is not connected for this project.",
        action: "Add a Telegram bot token and reconnect the Telegram channel."
      },
      bot_token_invalid: {
        code: "channel.telegram.bot_token_invalid",
        message: "The Telegram bot token is invalid.",
        action: "Get a valid bot token from @BotFather and try again."
      },
      bot_token_missing: {
        code: "channel.telegram.bot_token_missing",
        message: "Telegram is not connected for this project.",
        action: "Add a Telegram bot token and reconnect the Telegram channel."
      },
      api_unreachable: {
        code: "channel.telegram.api_unreachable",
        message: "Telegram could not be reached.",
        action: "Check Telegram connectivity and try again."
      },
      webhook_registration_failed: {
        code: "channel.telegram.webhook_registration_failed",
        message: "Telegram accepted the bot token, but webhook registration failed.",
        action: "Check that your app is publicly reachable and that Telegram can reach the webhook URL, then try again."
      },
      command_sync_failed: {
        code: "channel.telegram.command_sync_failed",
        message: "Telegram commands could not be synced.",
        action: "Check the Telegram bot connection and try again."
      },
      delivery_failed: {
        code: "channel.telegram.delivery_failed",
        message: "Message delivery failed on the Telegram channel.",
        action: "Check the Telegram bot connection and try again."
      }
    },
    slack: {
      not_connected: {
        code: "channel.slack.not_connected",
        message: "Slack is not connected for this project.",
        action: "Connect Slack for this project and try again."
      },
      bot_token_invalid: {
        code: "channel.slack.bot_token_invalid",
        message: "The Slack bot token is invalid.",
        action: "Check the Slack bot token and try again."
      },
      signing_secret_invalid: {
        code: "channel.slack.signing_secret_invalid",
        message: "The Slack signing secret is invalid.",
        action: "Check the Slack signing secret and try again."
      },
      delivery_failed: {
        code: "channel.slack.delivery_failed",
        message: "Message delivery failed on the Slack channel.",
        action: "Check the Slack connection and try again."
      }
    },
    sms: {
      not_connected: {
        code: "channel.sms.not_connected",
        message: "SMS is not connected for this project.",
        action: "Configure the SMS channel and try again."
      },
      credentials_invalid: {
        code: "channel.sms.credentials_invalid",
        message: "The SMS channel credentials are invalid.",
        action: "Check the SMS provider credentials and try again."
      },
      webhook_registration_failed: {
        code: "channel.sms.webhook_registration_failed",
        message: "SMS webhook registration failed.",
        action: "Check the SMS webhook configuration and try again."
      },
      delivery_failed: {
        code: "channel.sms.delivery_failed",
        message: "Message delivery failed on the SMS channel.",
        action: "Check the SMS channel configuration and try again."
      }
    },
    whatsapp: {
      not_connected: {
        code: "channel.whatsapp.not_connected",
        message: "WhatsApp is not connected for this project.",
        action: "Connect WhatsApp for this project and try again."
      },
      session_unavailable: {
        code: "channel.whatsapp.session_unavailable",
        message: "The WhatsApp session is unavailable.",
        action: "Reconnect the WhatsApp session and try again."
      },
      delivery_failed: {
        code: "channel.whatsapp.delivery_failed",
        message: "Message delivery failed on the WhatsApp channel.",
        action: "Check the WhatsApp connection and try again."
      }
    },
    email: {
      not_connected: {
        code: "channel.email.not_connected",
        message: "Email is not connected for this project.",
        action: "Configure the email channel and try again."
      },
      configuration_invalid: {
        code: "channel.email.configuration_invalid",
        message: "The email channel configuration is invalid.",
        action: "Check the email channel settings and try again."
      },
      delivery_failed: {
        code: "channel.email.delivery_failed",
        message: "Message delivery failed on the email channel.",
        action: "Check the email channel settings and try again."
      }
    },
    discord: {
      not_connected: {
        code: "channel.discord.not_connected",
        message: "Discord is not connected for this project.",
        action: "Configure the Discord channel and try again."
      },
      configuration_invalid: {
        code: "channel.discord.configuration_invalid",
        message: "The Discord channel configuration is invalid.",
        action: "Check the Discord channel settings and try again."
      },
      delivery_failed: {
        code: "channel.discord.delivery_failed",
        message: "Message delivery failed on the Discord channel.",
        action: "Check the Discord connection and try again."
      }
    }
  },
  billing: {
    balance: {
      exhausted: {
        code: "billing.balance.exhausted",
        message: "This project has run out of balance.",
        action: "Add funds or enable overflow billing, then try again."
      }
    },
    overflow: {
      unavailable: {
        code: "billing.overflow.unavailable",
        message: "This project cannot continue because balance is exhausted and overflow billing is unavailable.",
        action: "Add funds or enable overflow billing, then try again."
      }
    },
    configuration: {
      missing: {
        code: "billing.configuration.missing",
        message: "Billing is not configured for this project.",
        action: "Configure billing and try again."
      }
    },
    usage: {
      rejected: {
        code: "billing.usage.rejected",
        message: "This request was rejected by billing rules.",
        action: "Review the billing limits and try again."
      }
    }
  },
  model: {
    configuration: {
      missing: {
        code: "model.configuration.missing",
        message: "No model is configured for this request.",
        action: "Configure a model and try again."
      }
    },
    pricing: {
      missing: {
        code: "model.pricing.missing",
        message: "Model pricing is missing.",
        action: "Configure pricing for the model and try again."
      }
    },
    execution: {
      failed: {
        code: "model.execution.failed",
        message: "Model execution failed.",
        action: "Try again. If the problem continues, contact support."
      },
      unavailable: {
        code: "model.execution.unavailable",
        message: "The model is currently unavailable.",
        action: "Try again later or choose another model."
      }
    }
  },
  auth: {
    request: {
      unauthorized: {
        code: "auth.request.unauthorized",
        message: "You are not authorized to perform this request.",
        action: "Check your credentials and try again."
      },
      forbidden: {
        code: "auth.request.forbidden",
        message: "You do not have permission to perform this request.",
        action: "Use an account with the required permissions and try again."
      }
    },
    token: {
      invalid: {
        code: "auth.token.invalid",
        message: "The token is invalid.",
        action: "Check the token and try again."
      },
      expired: {
        code: "auth.token.expired",
        message: "The token has expired.",
        action: "Start the flow again to get a new token."
      },
      cancelled: {
        code: "auth.token.cancelled",
        message: "The token has been cancelled.",
        action: "Start the flow again if you still want to proceed."
      }
    }
  },
  validation: {
    request: {
      invalid: {
        code: "validation.request.invalid",
        message: "The request is invalid.",
        action: "Check the request input and try again."
      },
      invalid_body: {
        code: "validation.request.invalid_body",
        message: "The request body is invalid.",
        action: "Fix the request body and try again."
      },
      invalid_query: {
        code: "validation.request.invalid_query",
        message: "The request query is invalid.",
        action: "Fix the query parameters and try again."
      },
      missing_field: {
        code: "validation.request.missing_field",
        message: "A required request field is missing.",
        action: "Provide the missing field and try again."
      }
    },
    project: {
      invalid_id: {
        code: "validation.project.invalid_id",
        message: "The project id is invalid.",
        action: "Use a valid project id and try again."
      },
      invalid_endpoint_url: {
        code: "validation.project.invalid_endpoint_url",
        message: "The endpoint URL is invalid.",
        action: "Use a valid http(s) URL and try again."
      }
    },
    agent: {
      missing_key: {
        code: "validation.agent.missing_key",
        message: "An agent key is required.",
        action: "Provide an agent key and try again."
      }
    },
    telegram: {
      missing_bot_token: {
        code: "validation.telegram.missing_bot_token",
        message: "A Telegram bot token is required.",
        action: "Provide a Telegram bot token and try again."
      },
      invalid_commands: {
        code: "validation.telegram.invalid_commands",
        message: "The Telegram commands are invalid.",
        action: "Fix the command list and try again."
      }
    },
    conversation: {
      invalid_id: {
        code: "validation.conversation.invalid_id",
        message: "The conversation id is invalid.",
        action: "Use a valid conversation id and try again."
      }
    }
  },
  client: {
    configuration: {
      invalid: {
        code: "client.configuration.invalid",
        message: "The SDK configuration is invalid.",
        action: "Check the SDK configuration and try again."
      },
      api_key_missing: {
        code: "client.configuration.api_key_missing",
        message: "Konsier requires a non-empty apiKey.",
        action: "Provide a valid apiKey and try again."
      },
      endpoint_invalid: {
        code: "client.configuration.endpoint_invalid",
        message: "The SDK endpointUrl is invalid.",
        action: "Use a valid http(s) endpointUrl and try again."
      },
      surface_missing: {
        code: "client.configuration.surface_missing",
        message: "Konsier requires at least one agent or internal surface definition.",
        action: "Add an agent or internal definition and try again."
      }
    },
    network: {
      unreachable: {
        code: "client.network.unreachable",
        message: "Konsier could not be reached from this client.",
        action: "Check network connectivity and try again."
      },
      timeout: {
        code: "client.network.timeout",
        message: "The request to Konsier timed out.",
        action: "Try again. If the problem continues, check network conditions."
      }
    },
    response: {
      invalid: {
        code: "client.response.invalid",
        message: "Konsier returned an invalid response.",
        action: "Try again. If the problem continues, contact support."
      },
      unparseable: {
        code: "client.response.unparseable",
        message: "Konsier returned a response that could not be parsed.",
        action: "Try again. If the problem continues, contact support."
      }
    }
  },
  connection: {
    resource: {
      not_found: {
        code: "connection.resource.not_found",
        message: "The requested connection could not be found.",
        action: "Check the connection request and try again."
      }
    },
    request: {
      invalid: {
        code: "connection.request.invalid",
        message: "The connection request is invalid.",
        action: "Start the connection flow again and try again."
      },
      expired: {
        code: "connection.request.expired",
        message: "The connection request has expired.",
        action: "Start the connection flow again and try again."
      },
      cancelled: {
        code: "connection.request.cancelled",
        message: "The connection request was cancelled.",
        action: "Start the connection flow again if you still want to connect."
      }
    }
  },
  conversation: {
    resource: {
      not_found: {
        code: "conversation.resource.not_found",
        message: "The requested conversation could not be found.",
        action: "Check the conversation or user identifier and try again."
      }
    }
  },
  invitation: {
    resource: {
      not_found: {
        code: "invitation.resource.not_found",
        message: "The requested invitation could not be found.",
        action: "Check the invitation identifier and try again."
      }
    },
    request: {
      forbidden: {
        code: "invitation.request.forbidden",
        message: "This invitation action is not allowed.",
        action: "Check your access and try again."
      }
    },
    partner: {
      conflict: {
        code: "invitation.partner.conflict",
        message: "This invitation conflicts with the current project partner state.",
        action: "Review the project partner assignment and try again."
      }
    }
  },
  membership: {
    resource: {
      not_found: {
        code: "membership.resource.not_found",
        message: "The requested membership could not be found.",
        action: "Check the member identifier and try again."
      }
    },
    request: {
      forbidden: {
        code: "membership.request.forbidden",
        message: "This membership action is not allowed.",
        action: "Check your access and try again."
      }
    },
    owner: {
      forbidden: {
        code: "membership.owner.forbidden",
        message: "This action cannot be performed on the project owner.",
        action: "Choose a different project member and try again."
      }
    }
  },
  claim: {
    token: {
      invalid: {
        code: "claim.token.invalid",
        message: "The claim token is invalid.",
        action: "Use a valid claim link and try again."
      },
      expired: {
        code: "claim.token.expired",
        message: "The claim token has expired.",
        action: "Generate a new claim link and try again."
      }
    },
    request: {
      completed: {
        code: "claim.request.completed",
        message: "This claim link has already been used.",
        action: "Generate a new claim link if you need to try again."
      },
      self_forbidden: {
        code: "claim.request.self_forbidden",
        message: "The owner cannot claim their own project link.",
        action: "Use the claim link from a different account and try again."
      }
    },
    checkout: {
      invalid: {
        code: "claim.checkout.invalid",
        message: "The checkout session is invalid.",
        action: "Start the claim flow again and try again."
      },
      incomplete: {
        code: "claim.checkout.incomplete",
        message: "The checkout session is not completed yet.",
        action: "Complete checkout and try again."
      }
    },
    transfer: {
      failed: {
        code: "claim.transfer.failed",
        message: "The project ownership transfer could not be completed.",
        action: "Review the claim state and try again."
      }
    },
    configuration: {
      signing_missing: {
        code: "claim.configuration.signing_missing",
        message: "Project claim signing is not configured.",
        action: "Configure claim signing on the server and try again."
      }
    }
  },
  storage: {
    configuration: {
      missing: {
        code: "storage.configuration.missing",
        message: "Storage is not configured for this project.",
        action: "Configure project storage and try again."
      }
    },
    path: {
      invalid: {
        code: "storage.path.invalid",
        message: "The storage path is invalid.",
        action: "Use a valid storage path and try again."
      }
    },
    resource: {
      not_found: {
        code: "storage.resource.not_found",
        message: "The requested storage resource could not be found.",
        action: "Check the storage path and try again."
      }
    },
    destination: {
      conflict: {
        code: "storage.destination.conflict",
        message: "The storage destination already exists.",
        action: "Choose a different destination and try again."
      }
    }
  },
  user: {
    resource: {
      not_found: {
        code: "user.resource.not_found",
        message: "The requested user could not be found.",
        action: "Check the user identifier and try again."
      }
    }
  },
  account: {
    resource: {
      not_found: {
        code: "account.resource.not_found",
        message: "The requested account could not be found.",
        action: "Check the account identifier and try again."
      }
    }
  },
  tool: {
    resource: {
      not_found: {
        code: "tool.resource.not_found",
        message: "The requested tool could not be found.",
        action: "Check the tool registration and try again."
      }
    },
    configuration: {
      invalid: {
        code: "tool.configuration.invalid",
        message: "The tool configuration is invalid.",
        action: "Check the tool definition and try again."
      }
    },
    execution: {
      invalid_output: {
        code: "tool.execution.invalid_output",
        message: "The tool returned an invalid output payload.",
        action: "Update the tool handler to return a valid JSON object."
      }
    }
  },
  internal: {
    system: {
      unexpected: {
        code: "internal.system.unexpected",
        message: "Something went wrong.",
        action: "Try again. If the problem continues, contact support."
      }
    }
  }
} as const satisfies ErrorRegistry;

export type ErrorCode = LeafValues<typeof ERRORS>;

export type PublicApiError = {
  code: ErrorCode;
  message: string;
  action: string;
};

export type ApiErrorBody = {
  error: PublicApiError;
};

export const DELIVERY_CHANNELS = [
  "telegram",
  "slack",
  "sms",
  "whatsapp",
  "email",
  "discord",
] as const;

export type DeliveryChannelName = (typeof DELIVERY_CHANNELS)[number];

export const ERROR_CODES = collectCodes(ERRORS);

export const ERROR_DEFAULTS = collectDefaults(ERRORS) as Record<
  ErrorCode,
  { message: string; action: string }
>;

const ERROR_LOOKUP = collectLookup(ERRORS) as Record<ErrorCode, ErrorLeaf>;

export const DELIVERY_FAILURE_CODES = {
  telegram: ERRORS.channel.telegram.delivery_failed.code,
  slack: ERRORS.channel.slack.delivery_failed.code,
  sms: ERRORS.channel.sms.delivery_failed.code,
  whatsapp: ERRORS.channel.whatsapp.delivery_failed.code,
  email: ERRORS.channel.email.delivery_failed.code,
  discord: ERRORS.channel.discord.delivery_failed.code,
} as const satisfies Record<DeliveryChannelName, ErrorCode>;

type ErrorInput =
  | ErrorCode
  | PublicApiError
  | {
      code: ErrorCode;
      message?: string;
      action?: string;
    };

function normalizeErrorInput(input: ErrorInput): {
  code: ErrorCode;
  message?: string;
  action?: string;
} {
  if (typeof input === "string") {
    return { code: input };
  }

  return input;
}

export function createPublicApiError(input: ErrorInput): PublicApiError {
  const normalized = normalizeErrorInput(input);
  const defaults = ERROR_LOOKUP[normalized.code];

  return {
    code: normalized.code,
    message: normalized.message?.trim() || defaults.message,
    action: normalized.action?.trim() || defaults.action,
  };
}

export function createApiErrorBody(input: ErrorInput): ApiErrorBody {
  return {
    error: createPublicApiError(input),
  };
}

export function isDeliveryChannelName(
  value: string,
): value is DeliveryChannelName {
  return (DELIVERY_CHANNELS as readonly string[]).includes(value);
}
