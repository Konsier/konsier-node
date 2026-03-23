# Examples

These examples live in the repository only. They are not shipped in the published npm package.

## Included apps

### `todo`

- Architecture: Express + TypeScript
- Public agent ref: `task_assistant`
- Public local page: `/`
- Protected owner page launched from Konsier: `/pages/tasks`

### `marketplace`

- Architecture: Hono + Next.js
- Public agent ref: `shopping_assistant`
- Public storefront UI: `/`, `/products/[id]`, `/cart`
- Protected owner pages launched from Konsier:
  - `/pages/catalog`
  - `/pages/orders`

### `restaurant-manager`

- Architecture: Fastify + TypeScript
- Public agent refs:
  - `restaurant_customer`
  - `restaurant_worker`
- Public local pages:
  - `/`
  - `/tenants/:accountId`
  - `/workers/:accountId`
- Protected owner page launched from Konsier: `/pages/ops`

## Shared workflow

1. Open the example folder you want to run.
2. Install dependencies and create `.env` from `.env.example`.
3. Start the local server.
4. Sync the local SDK config to Konsier if the example does not do it automatically on boot.
5. In Konsier, point a project implementation endpoint at the example's configured `endpointUrl`.
6. Link the relevant agent ref(s).
7. Configure any channel you want in Konsier. Telegram is usually the fastest path for manual testing.
