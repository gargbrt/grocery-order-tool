# Contributing

Thanks for considering contributing — this tool is meant to actually help
small store owners run their business, so practical, tested contributions are
especially welcome.

## Getting set up

Follow [`docs/SETUP.md`](docs/SETUP.md) to get a local copy running against
your own free Supabase project.

## Before you open a PR

- **If you're touching billing math or `src/lib/orderParsing.ts`**, please
  add or update a test case in the matching `scripts/test-*.ts` file. Both of
  those areas have already had real, silent bugs caught this way — a bill
  quietly overcharging someone, or a real order getting misclassified — so
  test coverage there matters more than most parts of the codebase.
- Run the existing tests and confirm they still pass:
  ```bash
  npx tsx scripts/test-order-parsing.ts
  npx tsx scripts/test-billing-math.ts
  npx tsx scripts/test-line-total.ts
  ```
- If you change `prisma/schema.prisma`, please also update
  `docs/SETUP.md`'s `supabase_test_migration.sql` reference so the two don't
  drift apart, and mention the migration in your PR description.
- Keep the helper-permission model in mind: any new data helpers can see by
  default should default to hidden, not visible, unless there's a good reason
  otherwise (see the Roles & permissions section of `docs/SETUP.md`).

## What's especially welcome right now

- Porting the `scripts/test-*.ts` scripts to a real test runner (Vitest/Jest)
- Improving the order-detection heuristic in `src/lib/orderParsing.ts` —
  there's a documented known limitation in that file (numbers in
  non-item sentences, like an address, can cause false positives)
- The WhatsApp Cloud API production-number flow (currently only the free
  test-number path has been exercised)
- The Razorpay/Cashfree payments module described in
  [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)

## Reporting bugs / requesting features

Open a GitHub issue. For anything involving customer data exposure or
similar security concerns, please use a private security advisory instead of
a public issue.

## Code style

Plain TypeScript, no linter is enforced yet — match the existing style in
whatever file you're editing (comments explaining *why*, not just *what*, are
appreciated, especially around business logic like billing and permissions).
