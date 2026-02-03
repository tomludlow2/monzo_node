const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { createTransactionReceipt, getOrCreateReceiptExternalId } = require('../modules/receipts');
require('dotenv').config();

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: 'localhost',
    database: 'monzo_db',
    password: process.env.POSTGRES_PASSWORD,
    port: 5432
});

const EXPORT_DIR = path.join(__dirname, '../exports');
const EXPORT_FILE = path.join(EXPORT_DIR, 'monzo_test_receipt_types.csv');

function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

function formatTransactionLabel(transaction) {
    const amount = Number(transaction.amount);
    const description = transaction.description || 'No description';
    const date = transaction.date_created
        ? new Date(transaction.date_created).toISOString()
        : 'Unknown date';

    return `${description} | amount: ${amount} | category: ${transaction.category || 'n/a'} | date: ${date}`;
}

async function createReceiptForLatestTransactions() {
    try {
        const { rows } = await pool.query(
            `SELECT transaction_id, amount, category, description, date_created
             FROM monzo_transactions
             ORDER BY date_created DESC
             LIMIT 30`
        );

        if (rows.length === 0) {
            throw new Error('No transactions found in monzo_transactions.');
        }

        console.log('Testing receipt creation for the most recent 30 transactions...');

        if (!fs.existsSync(EXPORT_DIR)) {
            fs.mkdirSync(EXPORT_DIR, { recursive: true });
        }

        const csvRows = [
            [
                'transaction_id',
                'amount',
                'category',
                'description',
                'date_created',
                'status',
                'error'
            ]
        ];

        let successCount = 0;
        let failureCount = 0;

        for (const transaction of rows) {
            const { transaction_id: transactionId, amount } = transaction;
            const total = Math.abs(Number(amount));
            const label = formatTransactionLabel(transaction);

            if (!Number.isInteger(total) || total <= 0) {
                const errorMessage = `Invalid amount for receipt creation: ${amount}`;
                console.log(`❌ ${transactionId} | ${label} | ${errorMessage}`);
                csvRows.push([
                    transactionId,
                    amount,
                    transaction.category,
                    transaction.description,
                    transaction.date_created,
                    'invalid',
                    errorMessage
                ]);
                failureCount += 1;
                continue;
            }

            const payload = {
                transaction_id: transactionId,
                external_id: await getOrCreateReceiptExternalId(transactionId),
                total,
                currency: 'GBP',
                items: [
                    {
                        description: 'Single item receipt',
                        quantity: 1,
                        unit: '',
                        amount: total,
                        currency: 'GBP'
                    }
                ]
            };

            try {
                await createTransactionReceipt({
                    transactionId: payload.transaction_id,
                    externalId: payload.external_id,
                    total: payload.total,
                    currency: payload.currency,
                    items: payload.items
                });

                console.log(`✅ ${transactionId} | ${label} | receipt created`);
                csvRows.push([
                    transactionId,
                    amount,
                    transaction.category,
                    transaction.description,
                    transaction.date_created,
                    'success',
                    ''
                ]);
                successCount += 1;
            } catch (error) {
                const errorMessage = error.message || String(error);
                console.log(`❌ ${transactionId} | ${label} | ${errorMessage}`);
                csvRows.push([
                    transactionId,
                    amount,
                    transaction.category,
                    transaction.description,
                    transaction.date_created,
                    'failed',
                    errorMessage
                ]);
                failureCount += 1;
            }
        }

        const csvContent = csvRows
            .map(row => row.map(escapeCsvValue).join(','))
            .join('\n');

        fs.writeFileSync(EXPORT_FILE, csvContent, 'utf8');

        console.log(`Receipt test summary: ${successCount} succeeded, ${failureCount} failed.`);
        console.log(`Exported results to ${EXPORT_FILE}`);
    } catch (error) {
        console.error('Error creating receipts for latest transactions:', error.message);
    } finally {
        rl.close();
        await pool.end();
    }
}

createReceiptForLatestTransactions();
