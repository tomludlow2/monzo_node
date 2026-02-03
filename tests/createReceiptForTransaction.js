const { Pool } = require('pg');
const {
    createTransactionReceipt,
    getOrCreateReceiptExternalId,
    isReceiptEligible
} = require('../modules/receipts');
require('dotenv').config();

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: 'localhost',
    database: 'monzo_db',
    password: process.env.POSTGRES_PASSWORD,
    port: 5432
});

async function createReceiptForLatestTransaction() {
    try {
        const { rows } = await pool.query(
            `SELECT transaction_id, amount, merchant_id, category, description
             FROM monzo_transactions
             ORDER BY date_created DESC
             LIMIT 200`
        );

        if (rows.length === 0) {
            throw new Error('No transactions found in monzo_transactions.');
        }

        const eligibleTransactions = rows.filter(isReceiptEligible);

        if (eligibleTransactions.length === 0) {
            throw new Error('No receipt-eligible transactions found in monzo_transactions.');
        }

        const { transaction_id: transactionId, amount } = eligibleTransactions[0];
        const total = Math.abs(Number(amount));

        if (!Number.isInteger(total) || total <= 0) {
            throw new Error(`Latest transaction amount is invalid for receipt creation: ${amount}`);
        }

        const halfAmount = Math.floor(total / 2);
        const payload = {
            transaction_id: transactionId,
            external_id: await getOrCreateReceiptExternalId(transactionId),
            total,
            currency: 'GBP',
            items: [
                {
                    description: 'Item 1 on Receipt',
                    quantity: 1,
                    unit: '',
                    amount: halfAmount,
                    currency: 'GBP'
                },
                {
                    description: 'Item 2 on Receipt',
                    quantity: 1,
                    unit: '',
                    amount: total - halfAmount,
                    currency: 'GBP'
                }
            ]
        };

        console.log('Receipt payload to send to Monzo:');
        console.log(JSON.stringify(payload, null, 2));

        const response = await createTransactionReceipt({
            transactionId: payload.transaction_id,
            externalId: payload.external_id,
            total: payload.total,
            currency: payload.currency,
            items: payload.items
        });

        console.log('Monzo receipt response:', response || '(empty response)');
    } catch (error) {
        console.error('Error creating receipt for latest transaction:', error.message);
    } finally {
        await pool.end();
    }
}

createReceiptForLatestTransaction();
