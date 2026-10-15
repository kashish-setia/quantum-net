'use strict';
const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth.middleware');
const AuraNetService = require('../services/ai.service');

router.post('/ai-chat', optionalAuth, async (req, res) => {
    try {
        const body = req.body || {};
        const message = (body.message || body.prompt || body.query || '').trim().slice(0, 1000);
        if (!message) {
            return res.status(400).json({ success: false, message: 'Empty transmission. Please provide a query for Aura-Net.' });
        }

        const userId = req.user ? req.user.id : null;
        const userRole = req.user ? req.user.role : 'GUEST';

        const pageContext = {
            page: body.page || '',
            eventId: body.eventId || body.event_id || null,
            history: Array.isArray(body.history) ? body.history : []
        };

        const reply = await AuraNetService.processChat(message, userId, userRole, pageContext);

        res.json({
            success: true,
            response: reply,
            reply: reply
        });
    } catch (err) {
        console.error('Aura-Net Error:', err);
        res.status(500).json({
            success: false,
            message: 'Aura-Net AI telemetry channel encountered an anomaly.',
            response: 'Aura-Net core experiencing momentary signal interference. Please query again shortly.'
        });
    }
});

module.exports = router;
