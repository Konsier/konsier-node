import { z } from "zod";

import { Konsier } from "../src";

describe("client validation", () => {
  it("rejects invalid endpointUrl values", () => {
    expect(
      () =>
        new Konsier({
          apiKey: "k_test_123",
          endpointUrl: "ftp://example.com/konsier",
          agents: {
            customer: {
              systemPrompt: "Support",
              operations: [],
            },
          },
        }),
    ).toThrow("Konsier endpointUrl must use http or https.");
  });

  it("rejects publicUrl values that are not an origin", () => {
    expect(
      () =>
        new Konsier({
          apiKey: "k_test_123",
          publicUrl: "https://example.com/app",
          agents: {
            customer: {
              systemPrompt: "Support",
              operations: [],
            },
          },
        }),
    ).toThrow("Konsier publicUrl must be an origin without a path.");
  });

  it("rejects missing surfaces", () => {
    expect(
      () =>
        new Konsier({
          apiKey: "k_test_123",
        }),
    ).toThrow("Konsier requires at least one agent or internal surface definition.");
  });

  it("rejects duplicate telegram slash commands across agents", () => {
    expect(
      () =>
        new Konsier({
          apiKey: "k_test_123",
          agents: {
            a: {
              systemPrompt: "A",
              operations: [],
              telegram: {
                slashCommands: [
                  Konsier.telegram.slashCommand({
                    command: "start",
                    description: "Start",
                    handler: async () => ({ text: "a" }),
                  }),
                ],
              },
            },
            b: {
              systemPrompt: "B",
              operations: [],
              telegram: {
                slashCommands: [
                  Konsier.telegram.slashCommand({
                    command: "start",
                    description: "Start",
                    handler: async () => ({ text: "b" }),
                  }),
                ],
              },
            },
          },
        }),
    ).toThrow('telegram slash command "start" is registered more than once.');
  });

  it("rejects invalid project event handler shapes", () => {
    expect(
      () =>
        new Konsier({
          apiKey: "k_test_123",
          agents: {
            customer: {
              systemPrompt: "Support",
              operations: [],
            },
          },
          events: {
            beforeAccountConnect: "bad",
          } as never,
        }),
    ).toThrow("events.beforeAccountConnect must be a function.");
  });

  it("rejects invalid agent telegram event handler shapes", () => {
    expect(
      () =>
        new Konsier({
          apiKey: "k_test_123",
          agents: {
            customer: {
              systemPrompt: "Support",
              operations: [],
              telegram: {
                events: {
                  onCallbackQuery: "bad",
                } as never,
              },
            },
          },
        }),
    ).toThrow("agents.customer.telegram.events.onCallbackQuery must be a function.");
  });

  it("rejects malformed telegram slash command definitions", () => {
    expect(
      () =>
        new Konsier({
          apiKey: "k_test_123",
          agents: {
            customer: {
              systemPrompt: "Support",
              operations: [],
              telegram: {
                slashCommands: [
                  {
                    command: "start",
                    description: "",
                    handler: async () => ({ text: "a" }),
                  },
                ] as never,
              },
            },
          },
        }),
    ).toThrow(
      "agents.customer.telegram.slashCommands entries must include command, description, and handler.",
    );
  });

  it("rejects unknown event mappings at dispatch time", async () => {
    const sdk = new Konsier({
      apiKey: "k_test_123",
      agents: {
        customer: {
          systemPrompt: "Support",
          operations: [
            Konsier.operation({
              service: "app",
              resource: "operations",
              action: "ping",
              title: "ping",
              description: "Return pong",
              input: z.object({}),
              output: z.record(z.string(), z.any()),
              handler: async () => ({ ok: true }),
            }),
          ],
        },
      },
    });

    const eventHandler = (
      sdk as unknown as {
        resolveEventHandler: (
          target: { scope: "agent"; agent: string },
          name: string,
          phase: "before" | "on",
        ) => Promise<unknown>;
      }
    ).resolveEventHandler.bind(sdk);

    await expect(
      eventHandler({ scope: "agent", agent: "customer" }, "not.real", "on"),
    ).rejects.toMatchObject({
      message: 'SDK event "on:not.real" is not registered.',
      statusCode: 404,
    });
  });
});
