# Marketplace Example

Public storefront in Next.js, owner operations in Konsier internal pages.

## What it shows

- Express adapter hosting a Next.js app
- One public agent ref: `shopping_assistant`
- Two protected internal pages:
  - `/pages/catalog`
  - `/pages/orders`
- Internal owner tools for catalog management
- In-memory products, carts, and quotes

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3003](http://localhost:3003) for the public storefront.

## Konsier setup

1. Point the implementation endpoint to `http://localhost:3003/konsier`.
2. Link a project agent to the ref `shopping_assistant`.
3. Configure a channel in Konsier if you want to message the shopper agent.
4. Open the internal pages from Konsier to manage catalog state and inspect order quotes.
