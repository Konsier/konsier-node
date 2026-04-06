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
              tools: [],
            },
          },
        }),
    ).toThrow("Konsier endpointUrl must use http or https.");
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
              tools: [],
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
              tools: [],
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
              tools: [],
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
              tools: [],
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
              tools: [],
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
          tools: [
            Konsier.tool({
              name: "ping",
              description: "Return pong",
              input: z.object({}),
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
