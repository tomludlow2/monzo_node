const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: 'localhost',
    database: 'monzo_db',
    password: process.env.POSTGRES_PASSWORD,
    port: 5432
});

const DISALLOWED_CATEGORIES = new Set([
    'cash_withdrawal',
    'cash_withdrawals',
    'transfer',
    'transfers',
    'bills',
    'salary',
    'interest',
    'fees',
    'savings',
    'loan',
    'loans'
]);

const DISALLOWED_DESCRIPTION_KEYWORDS = [
    'direct debit',
    'standing order',
    'faster payment',
    'bank transfer'
];

function isReceiptEligible(transaction) {
    if (!transaction) {
        return false;
    }

    if (!transaction.merchant_id) {
        return false;
    }

    if (typeof transaction.amount === 'number' && transaction.amount >= 0) {
        return false;
    }

    if (transaction.category && DISALLOWED_CATEGORIES.has(transaction.category)) {
        return false;
    }

    const description = (transaction.description || '').toLowerCase();
    if (DISALLOWED_DESCRIPTION_KEYWORDS.some(keyword => description.includes(keyword))) {
        return false;
    }

    return true;
}

async function getReceiptEligibleTransactions(limit = 20, lookback = 200) {
    const { rows } = await pool.query(
        `SELECT *
         FROM monzo_transactions
         ORDER BY date_created DESC
         LIMIT $1`,
        [lookback]
    );

    return rows.filter(isReceiptEligible).slice(0, limit);
}

module.exports = {
    getReceiptEligibleTransactions,
    isReceiptEligible
};
