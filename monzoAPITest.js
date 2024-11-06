const monzoAPI = require('./modules/monzoAPI');

async function main() {
    try {
        const accounts = await monzoAPI.getAccounts();
        if (accounts.length > 0) {
            console.log(accounts);
        } else {
            console.log('No accounts found.');
        }
    } catch (error) {
        console.error('Error fetching and storing transactions:', error.message);
    }
}

main();
