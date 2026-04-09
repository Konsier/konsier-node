# Errors

SDK and API failures use a consistent public shape:

```json
{
  "error": {
    "code": "project.endpoint.signature_invalid",
    "message": "Konsier reached your app, but your app rejected the verification request.",
    "action": "Check that your app's KONSIER_API_KEY matches this project's API key, then try again."
  }
}
```

## Common Error Codes

- `project.endpoint.not_found`
- `project.endpoint.signature_invalid`
- `project.endpoint.timeout`
- `project.endpoint.unreachable`
- `channel.telegram.bot_token_invalid`
- `validation.request.invalid`
- `agent.configuration.invalid`
- `tool.configuration.invalid`

## Shared Contracts Export

`konsier/contracts` exports the shared public error contract registry used by the SDK and cloud APIs.

Typical use cases:

- mapping `error.code` values to UX copy
- writing integration tests against stable public error codes
- centralizing retry or remediation behavior by code

```ts
import { ERRORS, ERROR_CODES, createPublicApiError } from "konsier/contracts";

ERROR_CODES.project.endpoint.signature_invalid;
ERRORS.channel.telegram.bot_token_invalid.code;

const error = createPublicApiError({
  code: ERROR_CODES.validation.request.invalid,
  message: "The request payload was invalid.",
});
```
