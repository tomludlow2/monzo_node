const monzoAPI = require('../modules/monzoAPI');
require('dotenv').config();

const accountId = process.env.MONZO_ACCOUNT_ID;

async function testStoreTransactions() {
    try {
        if (!accountId) {
            throw new Error('MONZO_ACCOUNT_ID is not set in environment variables.');
        }

        console.log('Fetching and storing all transactions...');
        await monzoAPI.fetchAndStoreAllTransactions(accountId);
        console.log('Transactions stored successfully.');
    } catch (error) {
        console.error('Error during transaction storage:', error.message);
    }
}

testStoreTransactions();
