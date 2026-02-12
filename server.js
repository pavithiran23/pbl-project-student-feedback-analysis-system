const express = require('express');
const db = require('./db');
const bcrypt = require('bcryptjs');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// --- Auth Routes ---

// Register
app.post('/api/register', (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: "All fields required" });

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
        [name, email, hash, role],
        function(err) {
            if (err) return res.status(500).json({ error: "Email likely already exists" });
            res.json({ message: "User registered successfully", userId: this.lastID });
        }
    );
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: "Invalid credentials" });

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

        // Return user info (excluding password) to store in frontend session
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        });
    });
});

// --- Student Routes ---

// Submit Feedback
app.post('/api/feedback', (req, res) => {
    const { user_id, category, rating, comments } = req.body;
    db.run(`INSERT INTO feedback (user_id, category, rating, comments) VALUES (?, ?, ?, ?)`,
        [user_id, category, rating, comments],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Feedback submitted", id: this.lastID });
        }
    );
});

// Get My Feedback History
app.get('/api/feedback/history/:userId', (req, res) => {
    db.all(`SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC`, [req.params.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// --- Admin Routes ---

// Get All Feedback
app.get('/api/admin/feedback', (req, res) => {
    db.all(`SELECT f.*, u.name as student_name FROM feedback f JOIN users u ON f.user_id = u.id ORDER BY f.created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Archive/Delete Feedback
app.delete('/api/admin/feedback/:id', (req, res) => {
    db.run(`DELETE FROM feedback WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Feedback deleted" });
    });
});

// Get All Users
app.get('/api/admin/users', (req, res) => {
    db.all(`SELECT id, name, email, role FROM users`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Delete User (Safety Constraint: Prevent deleting last admin)
app.delete('/api/admin/users/:id', (req, res) => {
    const targetId = req.params.id;
    
    // Check if user is admin
    db.get(`SELECT role FROM users WHERE id = ?`, [targetId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: "User not found" });

        if (user.role === 'admin') {
            db.get(`SELECT count(*) as count FROM users WHERE role = 'admin'`, [], (err, row) => {
                if (row.count <= 1) {
                    return res.status(403).json({ error: "Cannot delete the last remaining admin" });
                }
                performDelete();
            });
        } else {
            performDelete();
        }

        function performDelete() {
            db.run(`DELETE FROM users WHERE id = ?`, [targetId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                // Cascade delete feedback
                db.run(`DELETE FROM feedback WHERE user_id = ?`, [targetId]);
                res.json({ message: "User deleted" });
            });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});