// Import necessary modules and set up environment variables
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

// Import custom modules
const auth = require('./modules/auth');  // Auth routes and functions
const cronScheduler = require('./modules/cronScheduler');  // Task scheduling
const feed = require('./modules/feed'); // Feed item routes

// Initialize Express app
const app = express();
const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: 'localhost',
    database: 'monzo_db',
    password: process.env.POSTGRES_PASSWORD,
    port: 5432
});

// Set up session middleware
app.use(session({
    store: new PgSession({
        pool: pool
    }),
    secret: 'your_secret_key',  // Replace with a secure, random string in production
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }  // Set secure: true if using HTTPS
}));

// Route setup
app.use('/auth', auth);  // Authentication route
app.use('/feed', feed.router); // Feed item endpoint
// Additional routes can be added as more modules are created (e.g., transactions, accounts)

// Start the server
const PORT = process.env.PORT || 54000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Initialize any scheduled tasks (e.g., token refreshing, data sync)
    cronScheduler.initializeTasks();
});
