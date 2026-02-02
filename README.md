# Monzo API Project

This project is a Node.js application that interfaces with the Monzo API to manage financial data, including accounts, transactions, and pots. It also implements scheduled tasks for regular data synchronization and balance storage.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Modules](#modules)
- [Scheduled Tasks](#scheduled-tasks)
- [Database Schema](#database-schema)
- [Contributing](#contributing)
- [License](#license)

## Features

- Authenticate with Monzo API using OAuth2.
- Fetch and store daily account balances.
- Fetch and store transactions.
- Manage pots, including daily balance storage.
- Export tables to CSV format.
- Scheduled tasks for regular operations.

## Installation

1. Clone the repository:

   ```bash
   git clone git://github.com/tomludlow2/monzo_api.git
   cd monzo_api
   ```
2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up your environment variables in a .env file:

```plaintext
   POSTGRES_USER=your_db_user
   POSTGRES_PASSWORD=your_db_password
   MONZO_CLIENT_ID=your_monzo_client_id
   MONZO_CLIENT_SECRET=your_monzo_client_secret
   MONZO_REDIRECT_URI=https://monzo.tomludlow.co.uk/callback
   MONZO_ACCOUNT_ID=your_monzo_account_id
   ```

## Usage
1. Start the application:

```bash
   node index.js
```

2. You can also manually test functions by running corresponding test scripts located in the tests directory:

```bash
   node tests/testStoreDailyBalance.js
   node tests/testStoreTransactions.js
   node tests/exportAllData.js
   node tests/testCreateFeedItem.js
```

## Local OAuth testing checklist
1. Ensure Postgres is running and the `monzo_db` database (with the `monzo_auth` table) is created, since both session storage and token persistence rely on it.
2. Create a `.env` file with:
   - `POSTGRES_USER` and `POSTGRES_PASSWORD`
   - `MONZO_CLIENT_ID`, `MONZO_CLIENT_SECRET`, and `MONZO_REDIRECT_URI`
3. Start the server:

```bash
   node index.js
```

4. Open the auth route in a browser to start OAuth:

```
   http://localhost:54000/auth/auth
```

5. Sign in to Monzo and approve access. You should be redirected to `/auth/callback` and see confirmation that tokens were saved.
6. (Optional) Hit `/auth/refreshToken` to verify token refresh works:

```
   http://localhost:54000/auth/refreshToken
```

## Viewing stored data (GUI)
This project does not ship with a built-in web UI/GUI for viewing stored Monzo data. Data is stored in PostgreSQL tables, and you can access it via SQL clients (e.g., `psql`, pgAdmin) or export tables to CSV using `exportTx.js`/`exportToCSV.js` and open the CSV files locally.

## Exporting transactions from Monzo
1. Fetch and store transactions from the Monzo API into the database using `fetchAndStoreAllTransactions(accountId)` in `modules/monzoAPI.js`. This function paginates through the Monzo transactions endpoint and inserts each transaction into the `monzo_transactions` table.
2. Export the stored transactions to CSV by invoking `exportToCSV('monzo_transactions')` (or updating `exportTx.js` to pass `monzo_transactions` as the table name). The CSV will be written to `exports/monzo_transactions_export.csv`.

## Exporting all data safely
Run `node tests/exportAllData.js` to export every PostgreSQL table to `exports/<table>_export.csv`. This script mirrors the `exportTx.js` CSV logic but redacts credential-like fields (for example, `monzo_auth.monzo_val` and any column containing `token`, `secret`, or `password`) so auth credentials are not written to disk.

## Creating feed items
Use `modules/feed.js` to create custom Monzo feed items for the account holder. The module exposes:

- `createFeedItem(options)` which posts to the Monzo feed API (supports `accountId`, `title`, `body`, `imageUrl`, `url`, and optional `type`/`params`).
- A REST endpoint at `POST /feed/item` that accepts a JSON body with the same fields so other local or external processes can push feed items after authenticating through this service.

You can test this with `node tests/testCreateFeedItem.js` or by sending a JSON payload to `http://localhost:54000/feed/item`.

## Receipts
The receipts module (`modules/receipts.js`) can create, retrieve, and delete transaction receipts via the Monzo API. Receipts use a JSON payload and are tied to a transaction ID plus an `external_id` idempotency key. The module persists this `external_id` in PostgreSQL so you can reuse it later for edits without generating duplicates.

### Receipt storage (idempotency)
The module stores receipts in a `monzo_receipts` table that maps each `transaction_id` to a stable `external_id` and keeps the last payload used. The table is created automatically if missing, but you can provision it manually with:

```sql
CREATE TABLE monzo_receipts (
    transaction_id TEXT PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    receipt_id TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Creating a receipt for the most recent transaction
Run the helper script below to fetch the most recent transaction from the local database, split the total into two items, print the payload for debugging, and create the receipt:

```bash
node tests/createReceiptForTransaction.js
```


## Modules
2. You can also manually test functions by running corresponding test scripts located in the tests directory:

```bash
   node tests/testStoreDailyBalance.js
   node tests/testStoreTransactions.js
   node tests/exportAllData.js
   node tests/testCreateFeedItem.js
```

## Local OAuth testing checklist
1. Ensure Postgres is running and the `monzo_db` database (with the `monzo_auth` table) is created, since both session storage and token persistence rely on it.
2. Create a `.env` file with:
   - `POSTGRES_USER` and `POSTGRES_PASSWORD`
   - `MONZO_CLIENT_ID`, `MONZO_CLIENT_SECRET`, and `MONZO_REDIRECT_URI`
3. Start the server:

```bash
   node index.js
```

4. Open the auth route in a browser to start OAuth:

```
   http://localhost:54000/auth/auth
```

5. Sign in to Monzo and approve access. You should be redirected to `/auth/callback` and see confirmation that tokens were saved.
6. (Optional) Hit `/auth/refreshToken` to verify token refresh works:

```
   http://localhost:54000/auth/refreshToken
```

## Viewing stored data (GUI)
This project does not ship with a built-in web UI/GUI for viewing stored Monzo data. Data is stored in PostgreSQL tables, and you can access it via SQL clients (e.g., `psql`, pgAdmin) or export tables to CSV using `exportTx.js`/`exportToCSV.js` and open the CSV files locally.

## Exporting transactions from Monzo
1. Fetch and store transactions from the Monzo API into the database using `fetchAndStoreAllTransactions(accountId)` in `modules/monzoAPI.js`. This function paginates through the Monzo transactions endpoint and inserts each transaction into the `monzo_transactions` table.
2. Export the stored transactions to CSV by invoking `exportToCSV('monzo_transactions')` (or updating `exportTx.js` to pass `monzo_transactions` as the table name). The CSV will be written to `exports/monzo_transactions_export.csv`.

## Exporting all data safely
Run `node tests/exportAllData.js` to export every PostgreSQL table to `exports/<table>_export.csv`. This script mirrors the `exportTx.js` CSV logic but redacts credential-like fields (for example, `monzo_auth.monzo_val` and any column containing `token`, `secret`, or `password`) so auth credentials are not written to disk.

## Creating feed items
Use `modules/feed.js` to create custom Monzo feed items for the account holder. The module exposes:

- `createFeedItem(options)` which posts to the Monzo feed API (supports `accountId`, `title`, `body`, `imageUrl`, `url`, and optional `type`/`params`).
- A REST endpoint at `POST /feed/item` that accepts a JSON body with the same fields so other local or external processes can push feed items after authenticating through this service.

You can test this with `node tests/testCreateFeedItem.js` or by sending a JSON payload to `http://localhost:54000/feed/item`.


## Modules
2. You can also manually test functions by running corresponding test scripts located in the tests directory:

```bash
   node tests/testStoreDailyBalance.js
   node tests/testStoreTransactions.js
   node tests/exportAllData.js
```

## Local OAuth testing checklist
1. Ensure Postgres is running and the `monzo_db` database (with the `monzo_auth` table) is created, since both session storage and token persistence rely on it.
2. Create a `.env` file with:
   - `POSTGRES_USER` and `POSTGRES_PASSWORD`
   - `MONZO_CLIENT_ID`, `MONZO_CLIENT_SECRET`, and `MONZO_REDIRECT_URI`
3. Start the server:

```bash
   node index.js
```

4. Open the auth route in a browser to start OAuth:

```
   http://localhost:54000/auth/auth
```

5. Sign in to Monzo and approve access. You should be redirected to `/auth/callback` and see confirmation that tokens were saved.
6. (Optional) Hit `/auth/refreshToken` to verify token refresh works:

```
   http://localhost:54000/auth/refreshToken
```

## Viewing stored data (GUI)
This project does not ship with a built-in web UI/GUI for viewing stored Monzo data. Data is stored in PostgreSQL tables, and you can access it via SQL clients (e.g., `psql`, pgAdmin) or export tables to CSV using `exportTx.js`/`exportToCSV.js` and open the CSV files locally.

## Exporting transactions from Monzo
1. Fetch and store transactions from the Monzo API into the database using `fetchAndStoreAllTransactions(accountId)` in `modules/monzoAPI.js`. This function paginates through the Monzo transactions endpoint and inserts each transaction into the `monzo_transactions` table.
2. Export the stored transactions to CSV by invoking `exportToCSV('monzo_transactions')` (or updating `exportTx.js` to pass `monzo_transactions` as the table name). The CSV will be written to `exports/monzo_transactions_export.csv`.

## Exporting all data safely
Run `node tests/exportAllData.js` to export every PostgreSQL table to `exports/<table>_export.csv`. This script mirrors the `exportTx.js` CSV logic but redacts credential-like fields (for example, `monzo_auth.monzo_val` and any column containing `token`, `secret`, or `password`) so auth credentials are not written to disk.


## Modules
2. You can also manually test functions by running corresponding test scripts located in the tests directory:

```bash
   node tests/testStoreDailyBalance.js
```

## Local OAuth testing checklist
1. Ensure Postgres is running and the `monzo_db` database (with the `monzo_auth` table) is created, since both session storage and token persistence rely on it.
2. Create a `.env` file with:
   - `POSTGRES_USER` and `POSTGRES_PASSWORD`
   - `MONZO_CLIENT_ID`, `MONZO_CLIENT_SECRET`, and `MONZO_REDIRECT_URI`
3. Start the server:

```bash
   node index.js
```

4. Open the auth route in a browser to start OAuth:

```
   http://localhost:54000/auth/auth
```

5. Sign in to Monzo and approve access. You should be redirected to `/auth/callback` and see confirmation that tokens were saved.
6. (Optional) Hit `/auth/refreshToken` to verify token refresh works:

```
   http://localhost:54000/auth/refreshToken
```

## Viewing stored data (GUI)
This project does not ship with a built-in web UI/GUI for viewing stored Monzo data. Data is stored in PostgreSQL tables, and you can access it via SQL clients (e.g., `psql`, pgAdmin) or export tables to CSV using `exportTx.js`/`exportToCSV.js` and open the CSV files locally.

## Exporting transactions from Monzo
1. Fetch and store transactions from the Monzo API into the database using `fetchAndStoreAllTransactions(accountId)` in `modules/monzoAPI.js`. This function paginates through the Monzo transactions endpoint and inserts each transaction into the `monzo_transactions` table.
2. Export the stored transactions to CSV by invoking `exportToCSV('monzo_transactions')` (or updating `exportTx.js` to pass `monzo_transactions` as the table name). The CSV will be written to `exports/monzo_transactions_export.csv`.


## Modules
- `index.js`: Main entry point for the application.
- `monzoAPI.js`: Contains functions for interacting with the Monzo API, including account and transaction management.
- `cronScheduler.js`: Schedules tasks for daily data synchronization and balance storage.
- `refreshToken.js`: Handles token refresh logic.
- `exportToCSV.js`: Exports data from specified tables to CSV format.


## Scheduled Tasks
The application uses node-cron to manage scheduled tasks:

- Token Refresh: Refreshes the access token every 55 minutes.
- Daily Data Sync: Placeholder for syncing Monzo data (transactions, balances) at 2 AM daily.
- Daily Pots Balance Storage: Stores daily balance of pots at 6:01 AM daily.

## Database Schema
The application utilizes PostgreSQL for data storage. The following tables are defined:

