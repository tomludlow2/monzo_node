const monzoAPI = require('../modules/monzoAPI.js');
require('dotenv').config();

const accountId = process.env.MONZO_ACCOUNT_ID;
async function testStoreDailyBalance() {
    try {
        console.log('Running daily balance storage...');
        await monzoAPI.storeDailyBalance(accountId);
    } catch (error) {
        console.error('Error during daily balance storage:', error.message);
    }
}

testStoreDailyBalance();



