# Viniverse Backup & Restore (Local JSON)

## Scope
This document describes the local JSON backup and restore flow for the production app in `artifacts/viniverse-finances`.

## Backup format
Exported files are JSON with these top-level fields:
- `accounts` (array)
- `transactions` (array)
- `budgets` (array)
- `recurringRules` (array)
- `financialGoals` (array)
- `netWorthSnapshots` (array)
- `weeklyPlans` (array)
- `quickTemplates` (array)
- `transfers` (array)
- `exportedAt` (ISO string)
- `version` (number)

Filename format:
- `viniverse-finances-backup-YYYY-MM-DD.json`

## Export behavior
- Export reads current local data from Dexie/IndexedDB tables and downloads one JSON file.
- PIN lock credentials/settings are intentionally excluded from exported finance data.

## Restore behavior (replace-all v1)
1. User selects a JSON file.
2. App validates:
   - valid JSON syntax
   - object shape
   - required top-level fields
   - expected metadata fields (`version`, `exportedAt`)
3. If validation passes, app shows a **replace-all warning**.
4. User must type `RESTORE` to confirm.
5. App clears existing local finance data and bulk-restores all backup arrays.

## Safety limitations
- Restore is destructive for current local finance data (replace-all).
- There is no merge mode in v1.
- Validation checks top-level structure/metadata, not full deep semantic validation of each row.
- Backups are local JSON files; users should store them securely.
