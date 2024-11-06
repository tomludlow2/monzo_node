const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const session = require('express-session');
const { Pool } = require('pg');
const qs = require('qs');
require('dotenv').config();
const refreshToken = require('./refreshToken');  // Import refreshToken function

const router = express.Router();
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

function generateState() {
    return crypto.randomBytes(16).toString('hex');
}

// Step 1: Redirect to Monzo for authorization
router.get('/auth', (req, res) => {
    const state = generateState();
    req.session.state = state;
    const authURL = `https://auth.monzo.com/?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&state=${state}`;
    res.redirect(authURL);
});

// Step 2: Handle the callback and exchange code for access token
router.get('/callback', async (req, res) => {
    const { code, state } = req.query;

    if (!req.session.state || state !== req.session.state) {
        return res.status(400).send('Invalid state parameter');
    }

    try {
        const payload = qs.stringify({
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            code
        });

        const response = await axios.post('https://api.monzo.com/oauth2/token', payload, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token, expires_in } = response.data;
        const expiresAt = new Date(Date.now() + expires_in * 1000);

        await pool.query(
            'INSERT INTO monzo_auth (monzo_key, monzo_val) VALUES ($1, $2) ON CONFLICT (monzo_key) DO UPDATE SET monzo_val = $2',
            ['access_token', access_token]
        );
        await pool.query(
            'INSERT INTO monzo_auth (monzo_key, monzo_val) VALUES ($1, $2) ON CONFLICT (monzo_key) DO UPDATE SET monzo_val = $2',
            ['refresh_token', refresh_token]
        );
        await pool.query(
            'INSERT INTO monzo_auth (monzo_key, monzo_val) VALUES ($1, $2) ON CONFLICT (monzo_key) DO UPDATE SET monzo_val = $2',
            ['expires_at', expiresAt.toISOString()]
        );

        res.send('Authentication successful. Tokens saved to the database.');
    } catch (error) {
        console.error("Error Response:", error.response ? error.response.data : error.message);
        res.status(500).send('Authentication failed');
    }
});

// Route to trigger token refresh manually
router.get('/refreshToken', async (req, res) => {
    try {
        const newAccessToken = await refreshToken();
        console.log('New Access Token:', newAccessToken); // Log to console for debugging
        res.json({ message: 'Token refreshed successfully' });
    } catch (error) {
        console.error('Error refreshing token:', error.message);
        res.status(500).json({ message: 'Error refreshing token', error: error.message });
    }
});


module.exports = router;
