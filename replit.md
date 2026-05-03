# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Viniverse – Finances (`artifacts/viniverse-finances`)

Personal finance control app — local-first, mobile-first, PWA-ready.

**Tech**: React + Vite + TypeScript + Tailwind CSS + Dexie (IndexedDB) + Wouter + dexie-react-hooks

**Features**:
- Dashboard with total balance, monthly income/expenses, recent transactions, month selector
- Transactions page: filterable list (by month + type), add/edit/delete
- Accounts page: calculated balances from transactions, add/edit/delete
- More/Settings: export/import JSON backup, clear all data
- Seed data on first load (3 accounts, multiple transactions)
- Dark glassmorphism UI, mobile bottom nav, floating action button

**Structure**:
```
src/
  db/          # Dexie db.ts + seed.ts
  types/       # TypeScript interfaces (Account, Transaction)
  utils/       # formatMoney (USD/BRL), formatDate helpers
  hooks/       # use-finance.ts (useLiveAccounts, useLiveTransactions + mutations)
  pages/       # Dashboard, Transactions, Accounts, More
  components/  # BottomNav, FAB, Layout, TransactionCard/Form/Drawer, AccountCard/Form/Drawer
```

**Data**: All data stored in browser IndexedDB. No backend. No auth. No cloud.
