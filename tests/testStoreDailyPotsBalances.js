const monzoAPI = require('../modules/monzoAPI');

async function testStoreDailyPotsBalance() {
    try {
        console.log('Listing Pots...');
        const pots = await monzoAPI.listPots();  // Get pots from the Monzo API
        console.log('Pots:', pots);  // Log the pots for verification

        console.log('Storing daily pots balance...');
        await monzoAPI.storeDailyPotsBalance(pots);  // Pass pots to storeDailyPotsBalance
    } catch (error) {
        console.error('Error during storing daily pots balance:', error.message);
    }
}

testStoreDailyPotsBalance();
