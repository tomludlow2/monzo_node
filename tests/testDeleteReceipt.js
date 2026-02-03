const { Pool } = require('pg');
const readline = require('readline');
const { deleteReceiptByExternalId } = require('../modules/receipts');
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

function formatReceiptLabel(receipt, index) {
    const createdAt = receipt.created_at
        ? new Date(receipt.created_at).toISOString()
        : 'Unknown date';

    return `${index + 1}. transaction_id: ${receipt.transaction_id} | external_id: ${receipt.external_id} | receipt_id: ${
        receipt.receipt_id || 'n/a'
    } | created_at: ${createdAt}`;
}

async function selectReceipt(receipts, rl) {
    const selectionPrompt = `Select a receipt to delete (1-${receipts.length}): `;

    while (true) {
        const answer = await askQuestion(selectionPrompt, rl);
        const choice = Number.parseInt(answer, 10);

        if (Number.isInteger(choice) && choice >= 1 && choice <= receipts.length) {
            return receipts[choice - 1];
        }

        console.log(`Invalid selection "${answer}". Please enter a number between 1 and ${receipts.length}.`);
    }
}

async function deleteReceiptFromSelection() {
    const rl = createPrompt();

    try {
        const { rows } = await pool.query(
            `SELECT transaction_id, external_id, receipt_id, created_at
             FROM monzo_receipts
             ORDER BY created_at DESC`
        );

        if (rows.length === 0) {
            throw new Error('No receipts found in monzo_receipts.');
        }

        console.log('Stored receipts:');
        rows.forEach((receipt, index) => {
            console.log(formatReceiptLabel(receipt, index));
        });

        const selectedReceipt = await selectReceipt(rows, rl);

        if (!selectedReceipt.external_id) {
            throw new Error('Selected receipt does not have an external_id.');
        }

        const { rows: transactionRows } = await pool.query(
            'SELECT amount FROM monzo_transactions WHERE transaction_id = $1',
            [selectedReceipt.transaction_id]
        );
        const amount = transactionRows.length > 0 ? transactionRows[0].amount : null;
        const receiptTotal = Math.abs(Number(amount));

        if (!Number.isInteger(receiptTotal) || receiptTotal <= 0) {
            throw new Error(`Invalid transaction amount for receipt replacement: ${amount}`);
        }

        await deleteReceiptByExternalId(selectedReceipt.external_id, {
            debug: true,
            total: receiptTotal,
            currency: 'GBP'
        });

        console.log(`Receipt deleted for external_id ${selectedReceipt.external_id}.`);
    } catch (error) {
        console.error('Error deleting receipt:', error.message);
    } finally {
        rl.close();
        await pool.end();
    }
}

deleteReceiptFromSelection();
