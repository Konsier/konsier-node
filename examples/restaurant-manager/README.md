# Restaurant Manager Example

High-complexity platform sample for connected restaurant projects.

## What it shows

- Native Node `http` server with no Express
- Two public agent refs:
  - `restaurant_customer`
  - `restaurant_worker`
- Owner tooling exposed through `internal.tools`
- Protected owner internal page at `/pages/ops`
- Multi-tenant in-memory state partitioned by Konsier `account.id`

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3004](http://localhost:3004) to inspect the local platform dashboard.

## Konsier setup

1. Use this app as the implementation endpoint for a platform project.
2. Point Konsier at `http://localhost:3004/konsier`.
3. Expose the refs `restaurant_customer` and `restaurant_worker`.
4. Connect client restaurant projects to the platform project through Konsier connected apps.
5. Test tenant-aware behavior by opening the owner page from a connected restaurant project.
