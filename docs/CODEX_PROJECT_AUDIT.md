# Viniverse – Finances: Project Audit

## Scope and context
This audit reviews the current workspace with focus on the runnable PWA in `artifacts/viniverse-finances`.

## Current project structure
- Monorepo/workspace managed with pnpm (`pnpm-workspace.yaml`) and TypeScript project references (`tsconfig.json`, `tsconfig.base.json`).
- Main app package:
  - `artifacts/viniverse-finances` (React 18 + TypeScript + Vite + Tailwind + Dexie).
- Other workspace packages that also participate in checks/builds:
  - `artifacts/mockup-sandbox`
  - `artifacts/api-server`
  - `scripts`
  - `lib/*` shared packages.

### Main app entry points
- HTML entry: `artifacts/viniverse-finances/index.html`
- React bootstrap: `artifacts/viniverse-finances/src/main.tsx`
- App shell and route registration: `artifacts/viniverse-finances/src/App.tsx`
- Global styles: `artifacts/viniverse-finances/src/index.css`

### Routes and pages
Routing is handled with `wouter` in `src/App.tsx`.

Registered pages in `src/pages`:
- Dashboard (`/`)
- Transactions (`/transactions`)
- Budgets (`/budgets`)
- Accounts (`/accounts`)
- More (`/more`)
- Recurring (`/recurring`)
- Goals (`/goals`)
- Net Worth (`/net-worth`)
- Weekly Cashflow (`/weekly-cashflow`)
- Reports (`/reports`)
- Setup (`/setup`)
- Calendar (`/calendar`)
- Quick Templates (`/quick-templates`)
- Transfers (`/transfers`)
- Subscriptions (`/subscriptions`)
- Budget Coach (`/coach`)
- Not Found fallback.

### Reusable components
- Domain/UI components: `src/components/*` (cards, forms, drawers, navigation, onboarding, lock screen).
- Design system components: `src/components/ui/*` (Radix/shadcn-style primitives).
- Shared hooks: `src/hooks/*` (`use-finance`, `use-mobile`, `use-toast`).

### Database layer, repositories, models, utilities
- Database layer:
  - Dexie schema and versions: `src/db/db.ts` (versions 1–8).
  - Optional seed helper: `src/db/seed.ts`.
- Repository/data-access pattern:
  - No separate `repositories/` directory.
  - CRUD/data functions are centralized in `src/hooks/use-finance.ts` (acts as combined live-query + repository/service layer).
- Models/types:
  - Domain model interfaces in `src/types/index.ts` (`Account`, `Transaction`, `Budget`, `RecurringRule`, `FinancialGoal`, `NetWorthSnapshot`, `WeeklyPlan`, `QuickTemplate`, `Transfer`).
- Utilities:
  - Formatting helpers in `src/utils/index.ts`.
  - Security helpers in `src/lib/pin-security.ts`.
  - Generic className helper in `src/lib/utils.ts`.

## What already works
- TypeScript typechecks pass at workspace level.
- App package typecheck passes.
- Routing map is coherent and all imported page modules exist.
- Local-first persistence architecture is present (Dexie + live queries + IndexedDB).
- Offline/PWA baseline is present:
  - Manifest + icons in `public/`
  - Service worker file `public/sw.js`
  - Production-only SW registration in `src/main.tsx` to avoid dev HMR interference.

## What appears incomplete or fragile
- `artifacts/mockup-sandbox` has stricter environment requirements (`PORT`/`BASE_PATH`) in Vite config and is better treated as a non-production artifact package.
- Data layer responsibilities are concentrated in one large file (`src/hooks/use-finance.ts`), which increases coupling and change risk as the app grows.
- No explicit test suite scripts were found in root or app package scripts.

## Build/typecheck status
Commands run after build-stabilization changes:
1. `pnpm run typecheck`
   - Status: PASS
2. `pnpm run build`
   - Status: PASS
   - Change applied: root build now excludes `artifacts/mockup-sandbox` and focuses on production-intended workspace builds.
3. `pnpm run build:app`
   - Status: PASS
   - Purpose: explicit production build command for `artifacts/viniverse-finances`.

## Main technical risks
1. **Build pipeline fragility across workspace packages**
   - A non-app package (`mockup-sandbox`) can block root CI/build even if the finance app itself is healthy.
2. **Service/repository concentration risk**
   - `use-finance.ts` combines live query hooks, mutation functions, recurring-generation logic, transfer math, and analytics helpers.
3. **Schema evolution risk**
   - Dexie schema has multiple versions (v1–v8). Future changes need careful migration notes/testing to avoid data corruption in existing local databases.
4. **Limited automated quality gates**
   - Typecheck is in place, but no automated unit/integration tests are currently visible for core finance logic.

## Recommended next steps (safe, controlled)
1. **Build contract is now separated**
   - Root `build` excludes `artifacts/mockup-sandbox` to avoid non-production environment coupling, and `build:app` is available for the Viniverse production app build path.
2. **Define lightweight architecture boundaries**
   - Keep behavior unchanged, but gradually split `use-finance.ts` into small modules (`queries`, `mutations`, `recurring`, `balances`) in future PRs.
3. **Document Dexie migration policy**
   - Add a short migration checklist for schema version bumps (backward compatibility, upgrade function, manual smoke checks).
4. **Add focused tests for finance logic**
   - Start with deterministic pure functions (budget spent, date recurrence helpers, balance calculations).
5. **Keep incremental PR cadence**
   - Continue with small, auditable changes + mandatory typecheck/build on each branch.
