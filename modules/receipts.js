const axios = require('axios');
const { Pool } = require('pg');
const refreshToken = require('./refreshToken');
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

async function ensureReceiptsTable() {
    await pool.query(
        `CREATE TABLE IF NOT EXISTS monzo_receipts (
            transaction_id TEXT PRIMARY KEY,
            external_id TEXT NOT NULL UNIQUE,
            receipt_id TEXT,
            payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`
    );
}

async function getAccessToken() {
    const { rows } = await pool.query(
        'SELECT monzo_val FROM monzo_auth WHERE monzo_key = $1',
        ['access_token']
    );
    return rows.length > 0 ? rows[0].monzo_val : null;
}

async function ensureValidAccessToken() {
    let accessToken = await getAccessToken();

    const { rows } = await pool.query(
        'SELECT monzo_val FROM monzo_auth WHERE monzo_key = $1',
        ['expires_at']
    );

    if (rows.length === 0) {
        throw new Error('Access token expiry not found in database.');
    }

    const expiresAt = new Date(rows[0].monzo_val);
    const now = new Date();

    if (!accessToken || now >= expiresAt) {
        console.log('Access token expired or missing. Refreshing...');
        accessToken = await refreshToken();
    }

    if (!accessToken) {
        throw new Error('Access token unavailable after refresh.');
    }

    return accessToken;
}

function formatMonzoErrorMessage(error, context) {
    if (error.response) {
        return `${context} failed: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(
            error.response.data
        )}`;
    }
    return `${context} failed: ${error.message}`;
}

async function getOrCreateReceiptExternalId(transactionId) {
    if (!transactionId) {
        throw new Error('transactionId is required to generate a receipt external_id.');
    }

    await ensureReceiptsTable();

    const { rows } = await pool.query(
        'SELECT external_id FROM monzo_receipts WHERE transaction_id = $1',
        [transactionId]
    );

    if (rows.length > 0) {
        return rows[0].external_id;
    }

    const externalId = `receipt-${transactionId}`;

    await pool.query(
        `INSERT INTO monzo_receipts (transaction_id, external_id)
         VALUES ($1, $2)
         ON CONFLICT (transaction_id) DO NOTHING`,
        [transactionId, externalId]
    );

    return externalId;
}

async function upsertReceiptRecord({ transactionId, externalId, receiptId = null, payload = null }) {
    await ensureReceiptsTable();

    await pool.query(
        `INSERT INTO monzo_receipts (transaction_id, external_id, receipt_id, payload, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (transaction_id) DO UPDATE
         SET external_id = EXCLUDED.external_id,
             receipt_id = EXCLUDED.receipt_id,
             payload = EXCLUDED.payload,
             updated_at = NOW()`,
        [transactionId, externalId, receiptId, payload]
    );
}

async function createTransactionReceipt({ transactionId, externalId, total, currency, items }) {
    if (!transactionId) {
        throw new Error('transactionId is required to create a receipt.');
    }
    if (!Number.isInteger(total) || total <= 0) {
        throw new Error('total must be a positive integer in minor currency units.');
    }
    if (!currency) {
        throw new Error('currency is required to create a receipt.');
    }
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('items must be a non-empty array.');
    }

    const resolvedExternalId = externalId || (await getOrCreateReceiptExternalId(transactionId));

    const payload = {
        transaction_id: transactionId,
        external_id: resolvedExternalId,
        total,
        currency,
        items
    };

    const accessToken = await ensureValidAccessToken();

    try {
        const response = await axios.put('https://api.monzo.com/transaction-receipts', payload, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const receiptId = response.data && response.data.receipt_id ? response.data.receipt_id : null;
        await upsertReceiptRecord({
            transactionId,
            externalId: resolvedExternalId,
            receiptId,
            payload
        });

        return response.data;
    } catch (error) {
        throw new Error(formatMonzoErrorMessage(error, 'Create receipt'));
    }
}

async function getReceiptByExternalId(externalId) {
    if (!externalId) {
        throw new Error('externalId is required to retrieve a receipt.');
    }

    const accessToken = await ensureValidAccessToken();

    try {
        const response = await axios.get('https://api.monzo.com/transaction-receipts', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            params: {
                external_id: externalId
            }
        });
        return response.data;
    } catch (error) {
        throw new Error(formatMonzoErrorMessage(error, 'Retrieve receipt'));
    }
}

async function deleteReceiptByExternalId(externalId) {
    if (!externalId) {
        throw new Error('externalId is required to delete a receipt.');
    }

    const accessToken = await ensureValidAccessToken();

    try {
        await axios.delete('https://api.monzo.com/transaction-receipts', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            params: {
                external_id: externalId
            }
        });
    } catch (error) {
        throw new Error(formatMonzoErrorMessage(error, 'Delete receipt'));
    }
}

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
    createTransactionReceipt,
    getReceiptEligibleTransactions,
    getReceiptByExternalId,
    deleteReceiptByExternalId,
    getOrCreateReceiptExternalId,
    isReceiptEligible
};
