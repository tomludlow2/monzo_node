const { Pool } = require('pg');
const {
    createTransactionReceipt,
    getOrCreateReceiptExternalId
} = require('../modules/receipts');
const readline = require('readline');
require('dotenv').config();

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: 'localhost',
    database: 'monzo_db',
    password: process.env.POSTGRES_PASSWORD,
    port: 5432
});

function createPrompt() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

function askQuestion(prompt, rl) {
    return new Promise(resolve => {
        rl.question(prompt, answer => resolve(answer));
    });
}

function formatTransactionLabel(transaction, index) {
    const amount = Number(transaction.amount);
    const description = transaction.description || 'No description';
    const date = transaction.date_created
        ? new Date(transaction.date_created).toISOString()
        : 'Unknown date';

    return `${index + 1}. ${description} | amount: ${amount} | category: ${transaction.category || 'n/a'} | date: ${date}`;
}

async function selectTransaction(transactions, rl) {
    const selectionPrompt = 'Select a transaction to create a receipt for (1-5): ';

    while (true) {
        const answer = await askQuestion(selectionPrompt, rl);
        const choice = Number.parseInt(answer, 10);

        if (Number.isInteger(choice) && choice >= 1 && choice <= transactions.length) {
            return transactions[choice - 1];
        }

        console.log(`Invalid selection "${answer}". Please enter a number between 1 and ${transactions.length}.`);
    }
}

async function createReceiptForLatestTransaction() {
    const rl = createPrompt();

    try {
        const { rows } = await pool.query(
            `SELECT transaction_id, amount, category, description, date_created
             FROM monzo_transactions
             ORDER BY date_created DESC
             LIMIT 5`
        );

        if (rows.length === 0) {
            throw new Error('No transactions found in monzo_transactions.');
        }

        console.log('Most recent transactions:');
        rows.forEach((transaction, index) => {
            console.log(formatTransactionLabel(transaction, index));
        });

        const selectedTransaction = await selectTransaction(rows, rl);
        const { transaction_id: transactionId, amount } = selectedTransaction;
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
            items: payload.items,
            debug: true
        });

        console.log('Monzo receipt response:', response || '(empty response)');
    } catch (error) {
        console.error('Error creating receipt for latest transaction:', error.message);
    } finally {
        rl.close();
        await pool.end();
    }
}

createReceiptForLatestTransaction();
