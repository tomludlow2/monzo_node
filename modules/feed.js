const axios = require('axios');
const express = require('express');
const { Pool } = require('pg');
const refreshToken = require('./refreshToken');
require('dotenv').config();

const router = express.Router();
const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: 'localhost',
    database: 'monzo_db',
    password: process.env.POSTGRES_PASSWORD,
    port: 5432
});

async function getAccessToken() {
    const { rows } = await pool.query(
        'SELECT monzo_val FROM monzo_auth WHERE monzo_key = $1',
        ['access_token']
    );
    return rows.length > 0 ? rows[0].monzo_val : null;
}

async function ensureValidAccessToken() {
    let accessToken = await getAccessToken();
    const { rows } = await pool.query(
        'SELECT monzo_val FROM monzo_auth WHERE monzo_key = $1',
        ['expires_at']
    );

    if (rows.length === 0) {
        throw new Error('Access token expiry not found in database.');
    }

    const expiresAt = new Date(rows[0].monzo_val);
    if (new Date() >= expiresAt) {
        accessToken = await refreshToken();
    }

    return accessToken;
}

function buildFeedPayload({
    accountId,
    title,
    imageUrl,
    body,
    url,
    type = 'basic',
    params = {}
}) {
    const payload = {
        account_id: accountId || process.env.MONZO_ACCOUNT_ID,
        type
    };

    const resolvedParams = {
        title,
        image_url: imageUrl,
        body,
        url,
        ...params
    };

    payload.params = Object.fromEntries(
        Object.entries(resolvedParams).filter(([, value]) => value !== undefined)
    );

    return payload;
}

async function createFeedItem(options) {
    const payload = buildFeedPayload(options);

    if (!payload.account_id) {
        throw new Error('Account ID is required to create a feed item.');
    }

    const accessToken = await ensureValidAccessToken();
    const response = await axios.post('https://api.monzo.com/feed', payload, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

router.post('/item', async (req, res) => {
    try {
        const feedItem = await createFeedItem(req.body);
        res.json(feedItem);
    } catch (error) {
        console.error('Error creating feed item:', error.response ? error.response.data : error.message);
        res.status(500).json({
            message: 'Failed to create feed item',
            error: error.response ? error.response.data : error.message
        });
    }
});

module.exports = {
    createFeedItem,
    router
};
