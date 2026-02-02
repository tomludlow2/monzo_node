const exportToCSV = require('./modules/exportToCSV');

async function exportTable() {
    try {
        const filePath = await exportToCSV('monzo_transactions');
        console.log(`File saved at: ${filePath}`);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

exportTable();
