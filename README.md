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

