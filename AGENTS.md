# Viniverse – Finances: Codex Development Rules

These rules apply to the entire repository unless a deeper-scoped `AGENTS.md` overrides them.

1. Use TypeScript strictly.
2. Preserve the current iOS/glassmorphism design language.
3. Keep data local-first using Dexie/IndexedDB.
4. Avoid unnecessary dependencies.
5. Prefer small, modular changes.
6. Never change database schema without documenting migration impact.
7. Always run build/typecheck after changes when available.
