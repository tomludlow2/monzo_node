const cron = require('node-cron');
const refreshToken = require('./refreshToken'); // Import the refreshToken function
require('dotenv').config();

const accountId = process.env.MONZO_ACCOUNT_ID;


// Function to initialize all cron jobs
function initializeTasks() {
    // Task 1: Refresh access token every 55 minutes (to stay within the 1-hour expiration window)
    cron.schedule('*/55 * * * *', async () => {
        try {
            console.log('Running scheduled token refresh...');
            await refreshToken();
            console.log('Token refreshed successfully.');
        } catch (error) {
            console.error('Error refreshing token:', error.message);
        }
    });

    // Task 2: Sync Monzo data daily (e.g., transactions, balance)
    cron.schedule('0 2 * * *', async () => {
        try {
            console.log('Running daily Monzo data sync...');
            // Add function to sync data, e.g., fetchTransactions(), fetchBalance()
            // Example: await fetchTransactions();
            console.log('Monzo data sync completed.');
        } catch (error) {
            console.error('Error syncing Monzo data:', error.message);
        }
    });

    // Task 3: Schedule daily balance storage at 6am
    cron.schedule('0 6 * * *', async () => {
        try {
            console.log('Running daily balance storage...');
            await monzoAPI.storeDailyBalance(accountId);
        } catch (error) {
            console.error('Error during daily balance storage:', error.message);
        }
    });

    // Task 3: Schedule daily pots balance storage at 6:01 AM
    cron.schedule('1 6 * * *', async () => {
        try {
            console.log('Running daily pots balance storage...');
            const pots = await monzoAPI.listPots(); // Get the pots list
            await monzoAPI.storeDailyPotsBalance(pots); // Store the pots balances
        } catch (error) {
            console.error('Error during daily pots balance storage:', error.message);
        }
    });
}

// Export the initializeTasks function
module.exports = {
    initializeTasks
};
