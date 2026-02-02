const { getReceiptEligibleTransactions } = require('../../modules/receipts');
require('dotenv').config();

async function getLocalTransactions() {
    try {
        const transactions = await getReceiptEligibleTransactions(20);
        console.log('Receipt-eligible transactions (most recent 20):');
        console.log(transactions);
    } catch (error) {
        console.error('Error fetching receipt-eligible transactions:', error.message);
    }
}

getLocalTransactions();
