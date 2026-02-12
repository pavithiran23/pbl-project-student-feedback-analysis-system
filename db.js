const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Store the DB file in the project folder, not just D:\
const dbPath = path.join(__dirname, 'feedback_system.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    // 1. Create Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'student'))
    )`, (err) => {
        if (err) console.error("Error creating users table:", err);
    });

    // 2. Create Feedback Table
    db.run(`CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active',
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`, (err) => {
        if (err) console.error("Error creating feedback table:", err);
    });

    // 3. Seed Default Admin
    // We wrap this in a slight delay to ensure tables are ready
    setTimeout(() => {
        db.get("SELECT count(*) as count FROM users", [], (err, row) => {
            if (err) {
                console.error("Error checking admin count:", err);
                return; // Stop if we can't read the table
            }

            // ADDED SAFETY CHECK: Ensure row exists
            if (row && row.count === 0) {
                const salt = bcrypt.genSaltSync(10);
                const hash = bcrypt.hashSync("admin123", salt);
                
                db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
                    ["System Admin", "admin@college.edu", hash, "admin"],
                    function(err) {
                        if (err) console.error("Error seeding admin:", err);
                        else console.log("Default Admin seeded (Email: admin@college.edu, Pass: admin123)");
                    }
                );
            } else if (row) {
                console.log("Database already initialized.");
            }
        });
    }, 100); // 100ms delay
}

module.exports = db;