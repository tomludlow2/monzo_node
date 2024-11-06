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
```


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

