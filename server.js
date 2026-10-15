'use strict';
/**
 * QUANTUM NET — Cosmic Event Management & AI Telemetry System
 * Express REST API Server with PostgreSQL + Prisma ORM + Google Gemini AI
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const authRoutes = require('./src/routes/auth.routes');
const eventRoutes = require('./src/routes/events.routes');
const adminRoutes = require('./src/routes/admin.routes');
const registrationRoutes = require('./src/routes/registrations.routes');
const notificationRoutes = require('./src/routes/notifications.routes');
const aiRoutes = require('./src/routes/ai.routes');
const contactRoutes = require('./src/routes/contact.routes');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Security & Middlewares
app.disable('x-powered-by');
app.use(cors());
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Static Frontend assets
app.use(express.static(path.join(__dirname, 'public'), {
    etag: true,
    lastModified: true
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes); // Backwards compatibility for /api/login, /api/signup, /api/me
app.use('/api/events', eventRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', registrationRoutes); // /api/my-registrations, /api/user-passes, /api/register, /api/pay
app.use('/api/notifications', notificationRoutes);
app.use('/api', aiRoutes); // /api/ai-chat
app.use('/api', contactRoutes); // /api/contact, /api/messages

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ONLINE',
        system: 'Quantum Net Mainframe',
        timestamp: new Date().toISOString(),
        version: '2.5.0'
    });
});

// 404 for unmatched API routes
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'Mainframe protocol frequency not found.' });
});

// Fallback error handler
app.use((err, req, res, next) => {
    console.error('[Mainframe Error]', err);
    if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: 'Malformed JSON payload.' });
    }
    res.status(500).json({ success: false, message: 'Internal Mainframe telemetry anomaly.' });
});

let server = null;
if (require.main === module) {
    server = app.listen(PORT, () => {
        console.log(`⚡ Quantum Net Mainframe online at http://localhost:${PORT}`);
        console.log(`🌌 Cosmic Event Management & AI Telemetry active.`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is already in use by another process.`);
        } else {
            console.error('❌ Server startup error:', err);
        }
    });

    function shutdown() {
        console.log('Initiating mainframe shutdown sequence...');
        if (server) {
            server.close(() => {
                console.log('Server offline.');
                process.exit(0);
            });
        }
        setTimeout(() => process.exit(0), 3000).unref();
    }

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

module.exports = app;

