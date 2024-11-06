const monzoAPI = require('../modules/monzoAPI');

async function testListPots() {
    try {
        console.log('Listing Pots...');
        const pots = await monzoAPI.listPots();
        console.log('Pots:', pots);
    } catch (error) {
        console.error('Error during listing pots:', error.message);
    }
}

testListPots();
