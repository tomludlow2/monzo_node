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

const EXPORT_DIR = path.join(__dirname, '../exports');
const REDACTED_VALUE = '[REDACTED]';
const REDACT_KEYS = ['token', 'secret', 'password'];

function shouldRedact(columnName) {
    const lower = columnName.toLowerCase();
    return REDACT_KEYS.some(key => lower.includes(key));
}

function sanitizeRow(tableName, row) {
    if (tableName === 'monzo_auth') {
        return {
            ...row,
            monzo_val: REDACTED_VALUE
        };
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(row)) {
        sanitized[key] = shouldRedact(key) ? REDACTED_VALUE : value;
    }
    return sanitized;
}

function formatDates(row) {
    return {
        ...row,
        date: row.date ? new Date(row.date).toISOString().split('T')[0] : row.date,
        date_created: row.date_created ? new Date(row.date_created).toISOString() : row.date_created,
        date_settled: row.date_settled ? new Date(row.date_settled).toISOString() : row.date_settled
    };
}

async function exportTable(tableName) {
    const { rows } = await pool.query(`SELECT * FROM ${tableName}`);
    const filePath = path.join(EXPORT_DIR, `${tableName}_export.csv`);

    if (!fs.existsSync(EXPORT_DIR)) {
        fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }

    const fileStream = fs.createWriteStream(filePath);
    const csvStream = stringify({ header: true });
    csvStream.pipe(fileStream);

    rows
        .map(row => formatDates(sanitizeRow(tableName, row)))
        .forEach(row => csvStream.write(row));

    csvStream.end();

    console.log(`Table ${tableName} exported successfully to ${filePath}`);
}

async function exportAllTables() {
    const { rows } = await pool.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type = 'BASE TABLE'
         ORDER BY table_name`
    );

    for (const { table_name: tableName } of rows) {
        await exportTable(tableName);
    }
}

exportAllTables().catch(error => {
    console.error('Error exporting tables:', error.message);
});
