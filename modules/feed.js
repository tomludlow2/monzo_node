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
    throw new Error("Account ID is required to create a feed item.");
  }

  // Monzo expects form params (params[title], params[image_url], etc.)
  const form = new URLSearchParams();
  form.set("account_id", payload.account_id);
  form.set("type", payload.type || "basic");
  if (payload.url) form.set("url", payload.url);

  // Flatten payload.params -> params[...]
  if (!payload.params?.title) throw new Error("Feed item requires params.title");
  if (!payload.params?.image_url) throw new Error("Feed item requires params.image_url");

  for (const [k, v] of Object.entries(payload.params || {})) {
    if (v !== undefined && v !== null) form.set(`params[${k}]`, String(v));
  }

  const accessToken = await ensureValidAccessToken();

  const response = await axios.post("https://api.monzo.com/feed", form, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    // Helpful for debugging: surface Monzo's error payload
    validateStatus: () => true,
  });

  if (response.status >= 400) {
    // Monzo usually returns a JSON body like { error: "...", error_description: "..." }
    throw new Error(
      `Monzo /feed failed (${response.status}): ${JSON.stringify(response.data)}`
    );
  }

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
