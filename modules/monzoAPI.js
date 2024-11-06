const axios = require('axios');
const { Pool } = require('pg');
const refreshToken = require('./refreshToken'); // Import refreshToken function
require('dotenv').config();

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: 'localhost',
    database: 'monzo_db',
    password: process.env.POSTGRES_PASSWORD,
    port: 5432
});

// Helper function to get a valid access token from the database
async function getAccessToken() {
    const { rows } = await pool.query('SELECT monzo_val FROM monzo_auth WHERE monzo_key = $1', ['access_token']);
    return rows.length > 0 ? rows[0].monzo_val : null;
}

// Function to ensure access token is valid, refreshing it if needed
async function ensureValidAccessToken() {
    let accessToken = await getAccessToken();

    // Verify if the access token is valid or refresh if needed
    const { rows } = await pool.query('SELECT monzo_val FROM monzo_auth WHERE monzo_key = $1', ['expires_at']);
    const expiresAt = new Date(rows[0].monzo_val);
    const now = new Date();

    if (now >= expiresAt) {
        console.log('Access token expired. Refreshing...');
        accessToken = await refreshToken();
    }
    return accessToken;
}

// Function to get accounts
async function getAccounts() {
    const accessToken = await ensureValidAccessToken();

    try {
        const response = await axios.get('https://api.monzo.com/accounts', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        return response.data.accounts;
    } catch (error) {
        console.error('Error fetching accounts:', error.message);
        throw error;
    }
}

// Get balance for a specific account
async function getBalance(accountId) {
    const accessToken = await ensureValidAccessToken();
    try {
        const response = await axios.get(`https://api.monzo.com/balance?account_id=${accountId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching balance:', error.message);
        throw error;
    }
}

// Store daily balance for a given account
async function storeDailyBalance(accountId) {
    const balanceData = await getBalance(accountId);
    const date = new Date().toISOString().split('T')[0]; // Only the date part, e.g., "2024-11-06"

    try {
        await pool.query(
            `INSERT INTO monzo_daily_balances (account_id, date, balance, total_balance)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (account_id, date) DO UPDATE
             SET balance = $3, total_balance = $4`,
            [accountId, date, balanceData.balance, balanceData.total_balance]
        );
        console.log(`Daily balance for account ${accountId} on ${date} stored successfully.`);
    } catch (error) {
        console.error('Error storing daily balance:', error.message);
        throw error;
    }
}

// Function to get transactions for a specific account
async function getTransactions(accountId, since = null) {
    const accessToken = await ensureValidAccessToken();

    let url = `https://api.monzo.com/transactions?account_id=${accountId}&expand[]=merchant`;
    if (since) {
        url += `&since=${since}`;
    }

    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        return response.data.transactions;
    } catch (error) {
        console.error('Error fetching transactions:', error.message);
        throw error;
    }
}

// Fetch and store all transactions for a Monzo account
async function fetchAndStoreAllTransactions(accountId) {
    let accessToken = await ensureValidAccessToken();
    let url = `https://api.monzo.com/transactions?account_id=${accountId}&expand[]=merchant`;
    let allTransactions = [];
    let lastTransactionDate = null;

    try {
        while (true) {
            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            const transactions = response.data.transactions;

            if (transactions.length === 0) break;

            // Save transactions to the database
            for (let transaction of transactions) {
                await pool.query(
                    `INSERT INTO monzo_transactions (transaction_id, account_id, date_created, date_settled, amount, description, merchant_id, category, notes)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     ON CONFLICT (transaction_id) DO NOTHING`,
                    [
                        transaction.id,
                        accountId,
                        transaction.created,
                        transaction.settled || null,
                        transaction.amount,
                        transaction.description,
                        transaction.merchant ? transaction.merchant.id : null,
                        transaction.category,
                        transaction.notes || null
                    ]
                );
            }

            allTransactions = allTransactions.concat(transactions);

            // Update URL to fetch next batch of transactions
            lastTransactionDate = transactions[transactions.length - 1].created;
            url = `https://api.monzo.com/transactions?account_id=${accountId}&expand[]=merchant&before=${lastTransactionDate}`;
        }

        console.log('All transactions fetched and stored successfully.');
    } catch (error) {
        console.error('Error fetching and storing transactions:', error.message);
        throw error;
    }

    return allTransactions; // Optionally return transactions for further use
}

async function listPots() {
    const accessToken = await ensureValidAccessToken();
    const accountId = process.env.MONZO_ACCOUNT_ID;  // Get account ID from environment variable

    if (!accountId) {
        throw new Error('MONZO_ACCOUNT_ID is not set in environment variables.');
    }

    try {
        const response = await axios.get(`https://api.monzo.com/pots?current_account_id=${accountId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        return response.data.pots; // This will contain an array of pots
    } catch (error) {
        console.error('Error fetching pots:', error.response ? error.response.data : error.message);
        throw error;
    }
}

//Store daily pots balances:
async function storeDailyPotsBalance(pots) {
    const date = new Date().toISOString().split('T')[0]; // Get today's date

    // Filter out deleted pots
    const activePots = pots.filter(pot => !pot.deleted);

    try {
        for (const pot of activePots) {
            await pool.query(
                `INSERT INTO monzo_pots_daily_balances (account_id, pot_id, date, balance)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (account_id, pot_id, date) DO UPDATE
                 SET balance = $4`, // Update balance if a record exists
                [
                    pot.current_account_id, // account_id
                    pot.id,                 // pot_id
                    date,                   // date
                    pot.balance             // balance
                ]
            );
        }
        console.log(`Daily pots balance for date ${date} stored successfully.`);
    } catch (error) {
        console.error('Error storing daily pots balance:', error.message);
        throw error;
    }
}





module.exports = {
    getAccounts,
    getBalance,
    storeDailyBalance,
    getTransactions,
    fetchAndStoreAllTransactions,
    listPots,
    storeDailyPotsBalance
};
