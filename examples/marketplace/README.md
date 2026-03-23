# Marketplace Example

Public storefront rendered with Next.js and hosted by a Hono server.

## What it shows

- Hono + Next.js in one process
- One public agent ref: `shopping_assistant`
- Tool handlers using `ctx.messages`, `ctx.attach(...)`, and `return ctx.end(...)`
- Two protected owner pages launched from Konsier:
  - `/pages/catalog`
  - `/pages/orders`
- Internal owner tools for catalog management
- In-memory products, carts, and quotes
- `sdk.sync()` runs automatically when the server boots

## Run

```bash
npm install
cp .env.example .env
npm run dev
npm run sync
```

Open [http://localhost:3003](http://localhost:3003) for the public storefront.

## Konsier setup

1. Point the implementation endpoint to `http://localhost:3003/api/konsier`.
2. Link a project agent to the ref `shopping_assistant`.
3. Configure a channel in Konsier if you want to message the shopper agent.
4. Open the owner pages from Konsier to manage catalog state and inspect order quotes on the app's own origin.

## Useful test prompts

- `Show me the Oak Lantern`
  This exercises `ctx.messages` and `ctx.attach(...)`. The tool returns product data and queues a demo image for the assistant reply.
- `Show me photos of the Oak Lantern`
  This exercises `return ctx.end(...)`. The tool returns a terminal message with demo attachments so the model can stop after the tool response.
