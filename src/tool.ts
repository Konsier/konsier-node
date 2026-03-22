import { toJSONSchema } from "zod";

import { KonsierError, toErrorMessage } from "./errors";
import type { EndSignal, JsonObject, ToolContext } from "./types";

const TOOL_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: unknown };

export interface ToolInputSchema<TInput> {
  parse?: (input: unknown) => TInput;
  safeParse?: (input: unknown) => SafeParseResult<TInput>;
  toJSONSchema?: () => Record<string, unknown>;
  toJsonSchema?: () => Record<string, unknown>;
}

export interface ToolDefinition<
  TInput = unknown,
  TOutput extends JsonObject = JsonObject,
> {
  name: string;
  description: string;
  input: ToolInputSchema<TInput>;
  handler: (
    input: TInput,
    context: ToolContext,
  ) => Promise<TOutput | EndSignal> | TOutput | EndSignal;
}

export interface Tool<
  TInput = any,
  TOutput extends JsonObject = JsonObject,
> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  parseInput: (input: unknown) => TInput;
  handler: (
    input: TInput,
    context: ToolContext,
  ) => Promise<TOutput | EndSignal> | TOutput | EndSignal;
}

export function createTool<
  TInput,
  TOutput extends JsonObject = JsonObject,
>(definition: ToolDefinition<TInput, TOutput>): Tool<TInput, TOutput> {
  const name = definition.name?.trim();
  if (!name) {
    throw new KonsierError({
      code: "INVALID_TOOL_NAME",
      message: "Tool name is required.",
      statusCode: 400,
    });
  }

  if (!TOOL_NAME_REGEX.test(name)) {
    throw new KonsierError({
      code: "INVALID_TOOL_NAME",
      message: `Tool name \"${name}\" contains invalid characters.`,
      statusCode: 400,
    });
  }

  const description = definition.description?.trim();
  if (!description) {
    throw new KonsierError({
      code: "INVALID_TOOL_DESCRIPTION",
      message: `Tool \"${name}\" must include a description.`,
      statusCode: 400,
    });
  }

  if (typeof definition.handler !== "function") {
    throw new KonsierError({
      code: "INVALID_TOOL_HANDLER",
      message: `Tool \"${name}\" handler must be a function.`,
      statusCode: 400,
    });
  }

  const inputSchema = deriveInputSchema(name, definition.input);

  return {
    name,
    description,
    inputSchema,
    parseInput(input: unknown): TInput {
      return parseToolInput(name, definition.input, input);
    },
    handler: definition.handler,
  };
}

function parseToolInput<TInput>(
  toolName: string,
  schema: ToolInputSchema<TInput>,
  input: unknown,
): TInput {
  if (schema && typeof schema.safeParse === "function") {
    const parsed = schema.safeParse(input);
    if (parsed.success) {
      return parsed.data;
    }

    throw new KonsierError({
      code: "INVALID_TOOL_INPUT",
      message: `Tool \"${toolName}\" received invalid input: ${formatParseError(
        parsed.error,
      )}`,
      statusCode: 400,
      details: parsed.error,
    });
  }

  if (schema && typeof schema.parse === "function") {
    try {
      return schema.parse(input);
    } catch (error) {
      throw new KonsierError({
        code: "INVALID_TOOL_INPUT",
        message: `Tool \"${toolName}\" received invalid input: ${toErrorMessage(
          error,
        )}`,
        statusCode: 400,
        details: error,
      });
    }
  }

  return input as TInput;
}

function deriveInputSchema<TInput>(
  toolName: string,
  schema: ToolInputSchema<TInput>,
): Record<string, unknown> {
  if (schema && typeof schema.toJSONSchema === "function") {
    return schema.toJSONSchema();
  }

  if (schema && typeof schema.toJsonSchema === "function") {
    return schema.toJsonSchema();
  }

  if (isZodSchema(schema)) {
    try {
      const converted = toJSONSchema(schema as never);

      if (converted && typeof converted === "object" && !Array.isArray(converted)) {
        return converted as Record<string, unknown>;
      }
    } catch {
      // Keep fallback below when conversion fails.
    }
  }

  return {
    type: "object",
    additionalProperties: true,
  };
}

function isZodSchema<TInput>(schema: ToolInputSchema<TInput>): boolean {
  if (!schema || typeof schema !== "object") {
    return false;
  }

  const maybe = schema as Record<string, unknown>;
  return typeof maybe.safeParse === "function" && "_zod" in maybe;
}

function formatParseError(error: unknown): string {
  if (!error) {
    return "validation failed";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown[] }).issues)
  ) {
    return (error as { issues: unknown[] }).issues
      .map((issue) => {
        if (
          issue &&
          typeof issue === "object" &&
          "message" in issue &&
          typeof (issue as { message: unknown }).message === "string"
        ) {
          return (issue as { message: string }).message;
        }
        return "validation issue";
      })
      .join(", ");
  }

  return "validation failed";
}
