# Marketplace Example

Public storefront in Next.js, with owner pages launched directly from Konsier.

## What it shows

- Standard Next.js App Router integration
- One public agent ref: `shopping_assistant`
- Two protected owner pages launched from Konsier:
  - `/pages/catalog`
  - `/pages/orders`
- Internal owner tools for catalog management
- In-memory products, carts, and quotes

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
