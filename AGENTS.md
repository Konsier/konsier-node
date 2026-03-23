AGENTS Guidance for `konsier-node`

## Workflow Requirements

- Before making edits, read the relevant files, present a plan or clarifying questions, and get explicit approval before implementing.
- Do not assume scope beyond what the user approved.

## Type Safety

- `konsier-node` must stay free of TypeScript errors.
- After code changes in this package, run `npm run typecheck` from [`/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node`](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node).
- The `konsier-node` typecheck must cover the root package and the example projects under `examples/`.
- If `npm run typecheck` fails because of your changes, fix the failures before responding.
