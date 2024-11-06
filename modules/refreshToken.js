const axios = require('axios');
const { Pool } = require('pg');
const qs = require('qs');
require('dotenv').config();

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: 'localhost',
    database: 'monzo_db',
    password: process.env.POSTGRES_PASSWORD,
    port: 5432
});

const CLIENT_ID = process.env.MONZO_CLIENT_ID;
const CLIENT_SECRET = process.env.MONZO_CLIENT_SECRET;
const REDIRECT_URI = process.env.MONZO_REDIRECT_URI;

// Function to refresh the access token
async function refreshToken() {
    try {
        // Step 1: Retrieve the refresh token from the database
        const { rows } = await pool.query(
            'SELECT monzo_val FROM monzo_auth WHERE monzo_key = $1',
            ['refresh_token']
        );

        if (rows.length === 0) {
            throw new Error('Refresh token not found in database');
        }

        const refresh_token = rows[0].monzo_val;

        // Step 2: Prepare the payload for refreshing the access token
        const payload = qs.stringify({
            grant_type: 'refresh_token',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token
        });

        // Step 3: Send a POST request to Monzo to get a new access token
        const response = await axios.post('https://api.monzo.com/oauth2/token', payload, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token: new_refresh_token, expires_in } = response.data;

        // Step 4: Calculate the new expiration time
        const expiresAt = new Date(Date.now() + expires_in * 1000);

        // Step 5: Update the access_token, refresh_token, and expires_at in the database
        await pool.query(
            'INSERT INTO monzo_auth (monzo_key, monzo_val) VALUES ($1, $2) ON CONFLICT (monzo_key) DO UPDATE SET monzo_val = $2',
            ['access_token', access_token]
        );
        await pool.query(
            'INSERT INTO monzo_auth (monzo_key, monzo_val) VALUES ($1, $2) ON CONFLICT (monzo_key) DO UPDATE SET monzo_val = $2',
            ['refresh_token', new_refresh_token]
        );
        await pool.query(
            'INSERT INTO monzo_auth (monzo_key, monzo_val) VALUES ($1, $2) ON CONFLICT (monzo_key) DO UPDATE SET monzo_val = $2',
            ['expires_at', expiresAt.toISOString()]
        );

        console.log('Access token successfully refreshed.');
        return access_token;
    } catch (error) {
        console.error('Error refreshing access token:', error.message);
        throw error;
    }
}

module.exports = refreshToken;
