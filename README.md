# Monzo Node Utilities

## Summary
This repository contains a Node.js toolkit for working with the Monzo API and a local PostgreSQL database. It supports OAuth token management, transaction ingestion, receipt creation/replacement, feed items, pots, balance snapshots, and a set of scripts/tests for validating workflows and exporting data.

## Dependencies
- Node.js (CommonJS)
- PostgreSQL
- npm packages (installed via `npm install`):
  - `axios`
  - `dotenv`
  - `pg`
  - `csv-stringify`
  - `node-cron` (for scheduled tasks)

## Environment Variables
Create a `.env` file with the following values:

### Required for database access
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

### Required for OAuth setup
- `MONZO_CLIENT_ID`
- `MONZO_CLIENT_SECRET`
- `MONZO_REDIRECT_URI`

### Required for specific workflows
- `MONZO_ACCOUNT_ID` (needed by balance/pots jobs)

> **Note on `monzo_auth`:** The `monzo_auth` table is populated during the OAuth callback. When you complete the OAuth flow (see below), the callback route stores `access_token`, `refresh_token`, and `expires_at` in the database for subsequent API calls.

## OAuth Workflow
1. Ensure Postgres is running and the `monzo_db` database exists with the `monzo_auth` table.
2. Create a `.env` file (see variables above).
3. Start the server:
   ```bash
   node index.js
   ```
4. Visit the auth route in a browser:
   ```
   http://localhost:54000/auth/auth
   ```
5. Complete the Monzo OAuth flow. Tokens are stored in `monzo_auth`.
6. (Optional) Refresh tokens by visiting:
   ```
   http://localhost:54000/auth/refreshToken
   ```

## Module Overview
- `modules/auth.js`: Express routes for OAuth start/callback and token persistence.
- `modules/refreshToken.js`: Refreshes the access token and writes new values to `monzo_auth`.
- `modules/monzoAPI.js`: Core Monzo API calls (transactions, balances, pots) and database persistence.
- `modules/receipts.js`: Receipt creation/replacement logic and receipt table management.
- `modules/feed.js`: Sends Monzo feed items.
- `modules/exportToCSV.js`: Exports database tables to CSV (written to `exports/`).
- `modules/cronScheduler.js`: Scheduled jobs for token refresh and daily balance/pots snapshots.

## Scheduled Tasks
Scheduled tasks are defined in `modules/cronScheduler.js` and use `node-cron`:
- Token refresh every 55 minutes.
- Daily data sync placeholder at 2am (stubbed; add your own sync logic).
- Daily balance storage at 6am.
- Daily pots balance storage at 6:01am.

## Tests and Script Behavior
All scripts live under `tests/` and run with `node <script>`. They assume Postgres is running and `monzo_db` is populated as needed.

### `tests/createReceiptForTransaction.js`
- Fetches the 30 most recent transactions in `monzo_transactions`.
- Skips transactions that are ineligible for receipts:
  - `amount === 0`
  - credits/inbound transactions (`amount > 0`)
  - categories in `transfers`, `savings`, `bills`
  - descriptions starting with `pot_`
- For eligible transactions, sends a single-item receipt payload (including `tax: 0`) to Monzo.
- Logs success/failure/skipped status for each transaction.
- Exports a CSV summary to `exports/monzo_test_receipt_types.csv`.

### `tests/testDeleteReceipt.js`
- Lists receipts stored in `monzo_receipts` and prompts the user to select one.
- Uses the selected receipt’s transaction amount to send a replacement receipt via a PUT request (Monzo delete is unreliable).
- Logs the full REST request (method, URL, headers, payload) when debug is enabled.

### `tests/testStoreTransactions.js`
- Exercises fetching and storing transactions from Monzo into `monzo_transactions`.

### `tests/testStoreDailyBalance.js`
- Fetches the current account balance and stores a daily snapshot.

### `tests/testStoreDailyPotsBalances.js`
- Fetches pots and stores daily pot balance snapshots.

### `tests/testListPots.js`
- Fetches the list of pots for the configured account.

### `tests/testCreateFeedItem.js`
- Sends a sample feed item to Monzo.

### `tests/exportAllData.js`
- Exports all database tables to `exports/<table>_export.csv`.
- Redacts sensitive credential-like fields in the export.

## Additional Notes
- Receipts are stored in `monzo_receipts` with a stable `external_id` for idempotency.
- For receipt items, `tax: 0` is always included in payloads.
- Receipt deletion is implemented as a replacement PUT with a generic payload.
