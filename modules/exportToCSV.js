const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify');
require('dotenv').config();

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: 'localhost',
    database: 'monzo_db',
    password: process.env.POSTGRES_PASSWORD,
    port: 5432
});

async function exportToCSV(tableName) {
    try {
        // Query the table
        const queryResult = await pool.query(`SELECT * FROM ${tableName}`);

        // Format date fields (e.g., date_created and date_settled) to human-readable format
        const formattedRows = queryResult.rows.map(row => {
            return {
                ...row,
                date: row.date ? new Date(row.date).toISOString().split('T')[0] : null,
                date_created: row.date_created ? new Date(row.date_created).toISOString() : null,
                date_settled: row.date_settled ? new Date(row.date_settled).toISOString() : null
            };
        });

        // Define the CSV file path within the exports directory
        const filePath = path.join(__dirname, `../exports/${tableName}_export.csv`);

        // Ensure the exports directory exists
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        // Stream data to the CSV file
        const fileStream = fs.createWriteStream(filePath);
        const csvStream = stringify({ header: true });

        csvStream.pipe(fileStream);

        // Write each row to the CSV
        formattedRows.forEach(row => csvStream.write(row));
        csvStream.end();

        // Log success and return the file path
        console.log(`Table ${tableName} exported successfully to ${filePath}`);
        return filePath;
    } catch (error) {
        console.error(`Error exporting table ${tableName}:`, error.message);
        throw error;
    }
}

module.exports = exportToCSV;
