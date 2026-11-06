import { z, toJSONSchema } from "zod";

import { ERROR_CODES, createPublicApiError } from "./contracts";
import { KonsierError, toErrorMessage } from "./errors";
import type {
  AttachmentType,
  AudioAttachment,
  FileAttachment,
  ImageAttachment,
  JsonObject,
  LocationAttachment,
  OperationContext,
  VideoAttachment,
} from "./types";

const OPERATION_SEGMENT_REGEX = /^[a-z][a-z0-9_-]*$/;
const ATTACHMENT_REF_PATTERN = "^att:[^\\s]+$";
const KONSIER_SCHEMA_KEY = "x-konsier";

type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: unknown };

type AttachmentSchemaMetadata = {
  kind: "attachment";
  allowed_types: AttachmentType[];
};

export interface OperationSchema<TValue> {
  parse?: (input: unknown) => TValue;
  safeParse?: (input: unknown) => SafeParseResult<TValue>;
  toJSONSchema?: () => Record<string, unknown>;
  toJsonSchema?: () => Record<string, unknown>;
}

export interface OperationApproval {
  required: boolean;
  bypassable?: boolean;
}

export interface OperationDefinition<
  TInput = unknown,
  TOutput extends JsonObject = JsonObject,
> {
  service: string;
  resource: string;
  action: string;
  title: string;
  description: string;
  input: OperationSchema<TInput>;
  output: OperationSchema<TOutput>;
  approval?: OperationApproval;
  handler: (
    input: TInput,
    context: OperationContext,
  ) => Promise<TOutput> | TOutput;
}

export interface Operation<
  TInput = any,
  TOutput extends JsonObject = JsonObject,
> {
  service: string;
  resource: string;
  action: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  approval: Required<OperationApproval>;
  parseInput: (input: unknown) => TInput;
  parseOutput: (output: unknown) => TOutput;
  handler: (
    input: TInput,
    context: OperationContext,
  ) => Promise<TOutput> | TOutput;
}

export function createOperation<
  TInput,
  TOutput extends JsonObject = JsonObject,
>(definition: OperationDefinition<TInput, TOutput>): Operation<TInput, TOutput> {
  const service = validateOperationSegment("service", definition.service);
  const resource = validateOperationSegment("resource", definition.resource);
  const action = validateOperationSegment("action", definition.action);
  const operationRef = `${service}.${resource}.${action}`;
  const title = definition.title?.trim();
  if (!title) {
    const publicError = createPublicApiError({
      code: ERROR_CODES.operation.configuration.invalid,
      message: `Operation "${operationRef}" must include a title.`,
    });
    throw new KonsierError({
      code: publicError.code,
      message: publicError.message,
      action: publicError.action,
      statusCode: 400,
    });
  }

  const description = definition.description?.trim();
  if (!description) {
    const publicError = createPublicApiError({
      code: ERROR_CODES.operation.configuration.invalid,
      message: `Operation "${operationRef}" must include a description.`,
    });
    throw new KonsierError({
      code: publicError.code,
      message: publicError.message,
      action: publicError.action,
      statusCode: 400,
    });
  }

  if (typeof definition.handler !== "function") {
    const publicError = createPublicApiError({
      code: ERROR_CODES.operation.configuration.invalid,
      message: `Operation "${operationRef}" handler must be a function.`,
    });
    throw new KonsierError({
      code: publicError.code,
      message: publicError.message,
      action: publicError.action,
      statusCode: 400,
    });
  }

  const inputSchema = deriveSchema(definition.input);
  const outputSchema = deriveSchema(definition.output);
  const required = definition.approval?.required ?? false;
  const bypassable = definition.approval?.bypassable ?? false;
  if (bypassable && !required) {
    throw new KonsierError({
      ...createPublicApiError({
        code: ERROR_CODES.operation.configuration.invalid,
        message: `Operation "${operationRef}" cannot be bypassable unless approval is required.`,
      }),
      statusCode: 400,
    });
  }

  return {
    service,
    resource,
    action,
    title,
    description,
    inputSchema,
    outputSchema,
    approval: { required, bypassable },
    parseInput(input: unknown): TInput {
      return parseOperationValue(operationRef, "input", definition.input, input);
    },
    parseOutput(output: unknown): TOutput {
      return parseOperationValue(operationRef, "output", definition.output, output);
    },
    handler: definition.handler,
  };
}

function validateOperationSegment(label: string, value: string): string {
  const normalized = value?.trim();
  if (!normalized || !OPERATION_SEGMENT_REGEX.test(normalized)) {
    throw new KonsierError({
      ...createPublicApiError({
        code: ERROR_CODES.operation.configuration.invalid,
        message: `Operation ${label} must match ${OPERATION_SEGMENT_REGEX.source}.`,
      }),
      statusCode: 400,
    });
  }
  return normalized;
}

function attachmentSchemaMetadata(
  allowedTypes: AttachmentType[],
): Record<string, AttachmentSchemaMetadata> {
  return {
    [KONSIER_SCHEMA_KEY]: {
      kind: "attachment",
      allowed_types: allowedTypes,
    },
  };
}

function buildFileAttachmentSchema<TType extends "image" | "video" | "audio" | "file">(
  type: TType,
) {
  return z
    .object({
      id: z.string().min(1),
      type: z.literal(type),
      name: z.string().optional(),
      caption: z.string().optional(),
      mimeType: z.string().optional(),
      url: z.string().min(1),
      filename: z.string().optional(),
      originalName: z.string().optional(),
    })
    .meta(attachmentSchemaMetadata([type]));
}

function buildLocationAttachmentSchema() {
  return z
    .object({
      id: z.string().min(1),
      type: z.literal("location"),
      name: z.string().optional(),
      caption: z.string().optional(),
      mimeType: z.string().optional(),
      latitude: z.number().finite(),
      longitude: z.number().finite(),
      address: z.string().optional(),
    })
    .meta(attachmentSchemaMetadata(["location"]));
}

const imageAttachmentSchema = buildFileAttachmentSchema("image");
const videoAttachmentSchema = buildFileAttachmentSchema("video");
const audioAttachmentSchema = buildFileAttachmentSchema("audio");
const fileAttachmentSchema = buildFileAttachmentSchema("file");
const locationAttachmentSchema = buildLocationAttachmentSchema();

export const attachment = {
  image: () => imageAttachmentSchema as typeof imageAttachmentSchema,
  video: () => videoAttachmentSchema as typeof videoAttachmentSchema,
  audio: () => audioAttachmentSchema as typeof audioAttachmentSchema,
  file: () => fileAttachmentSchema as typeof fileAttachmentSchema,
  location: () => locationAttachmentSchema as typeof locationAttachmentSchema,
};

export type AttachmentSchema =
  | typeof imageAttachmentSchema
  | typeof videoAttachmentSchema
  | typeof audioAttachmentSchema
  | typeof fileAttachmentSchema
  | typeof locationAttachmentSchema;

export type AttachmentSchemaValue =
  | ImageAttachment
  | VideoAttachment
  | AudioAttachment
  | FileAttachment
  | LocationAttachment;

function parseOperationValue<TValue>(
  operationRef: string,
  direction: "input" | "output",
  schema: OperationSchema<TValue>,
  input: unknown,
): TValue {
  if (schema && typeof schema.safeParse === "function") {
    const parsed = schema.safeParse(input);
    if (parsed.success) {
      return parsed.data;
    }

    throw new KonsierError({
      ...createPublicApiError({
        code: ERROR_CODES.validation.request.invalid,
        message: `Operation "${operationRef}" produced invalid ${direction}: ${formatParseError(
          parsed.error,
        )}`,
      }),
      statusCode: 400,
      details: parsed.error,
    });
  }

  if (schema && typeof schema.parse === "function") {
    try {
      return schema.parse(input);
    } catch (error) {
      throw new KonsierError({
        ...createPublicApiError({
          code: ERROR_CODES.validation.request.invalid,
          message: `Operation "${operationRef}" produced invalid ${direction}: ${toErrorMessage(
            error,
          )}`,
        }),
        statusCode: 400,
        details: error,
      });
    }
  }

  return input as TValue;
}

function deriveSchema<TValue>(
  schema: OperationSchema<TValue>,
): Record<string, unknown> {
  if (schema && typeof schema.toJSONSchema === "function") {
    const converted = replaceAttachmentSchemaNodes(schema.toJSONSchema());
    if (converted && typeof converted === "object" && !Array.isArray(converted)) {
      return converted as Record<string, unknown>;
    }
  }

  if (schema && typeof schema.toJsonSchema === "function") {
    const converted = replaceAttachmentSchemaNodes(schema.toJsonSchema());
    if (converted && typeof converted === "object" && !Array.isArray(converted)) {
      return converted as Record<string, unknown>;
    }
  }

  if (isZodSchema(schema)) {
    try {
      const converted = replaceAttachmentSchemaNodes(
        toJSONSchema(schema as never),
      );

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

function replaceAttachmentSchemaNodes(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => replaceAttachmentSchemaNodes(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const meta = parseAttachmentSchemaMetadata(record[KONSIER_SCHEMA_KEY]);
  if (meta) {
    return buildAttachmentRefSchema(record, meta);
  }

  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    next[key] = replaceAttachmentSchemaNodes(child);
  }
  return next;
}

function parseAttachmentSchemaMetadata(
  value: unknown,
): AttachmentSchemaMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.kind !== "attachment" || !Array.isArray(record.allowed_types)) {
    return null;
  }

  const allowedTypes = record.allowed_types.filter(
    (entry): entry is AttachmentType =>
      entry === "image" ||
      entry === "video" ||
      entry === "audio" ||
      entry === "file" ||
      entry === "location",
  );

  if (allowedTypes.length === 0) {
    return null;
  }

  return {
    kind: "attachment",
    allowed_types: allowedTypes,
  };
}

function buildAttachmentRefSchema(
  schema: Record<string, unknown>,
  meta: AttachmentSchemaMetadata,
): Record<string, unknown> {
  const declaredDescription =
    typeof schema.description === "string" ? schema.description.trim() : "";
  const allowedTypesLabel =
    meta.allowed_types.length === 1
      ? meta.allowed_types[0]
      : meta.allowed_types.join(" or ");
  const helperDescription = `Pass an attachment reference in att:... format for a ${allowedTypesLabel} from the conversation.`;

  return {
    type: "string",
    pattern: ATTACHMENT_REF_PATTERN,
    description: declaredDescription
      ? `${declaredDescription} ${helperDescription}`
      : helperDescription,
    [KONSIER_SCHEMA_KEY]: meta,
  };
}

function isZodSchema<TValue>(schema: OperationSchema<TValue>): boolean {
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
