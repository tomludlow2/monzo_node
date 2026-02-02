const feed = require('../modules/feed');
require('dotenv').config();

const accountId = process.env.MONZO_ACCOUNT_ID;

async function testCreateFeedItem() {
    try {
        if (!accountId) {
            throw new Error('MONZO_ACCOUNT_ID is not set in environment variables.');
        }

        const response = await feed.createFeedItem({
            accountId,
            title: 'Monzo API Test',
            body: 'This is a test feed item from the Monzo API project.',
            imageUrl: 'https://monzo.com/static/images/favicon/favicon-32x32.png',
            url: 'https://monzo.com'
        });

        console.log('Feed item created:', response);
    } catch (error) {
      console.error(
        "Error creating feed item:",
        error.response?.status,
        error.response?.data || error.message
      );
    }
}

testCreateFeedItem();
