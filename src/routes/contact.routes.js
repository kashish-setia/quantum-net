'use strict';
const express = require('express');
const router = express.Router();
const { prisma } = require('../config/db');
const { requireAdmin } = require('../middleware/auth.middleware');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

router.post('/contact', async (req, res) => {
    try {
        const name = (req.body.name || '').trim();
        const email = (req.body.email || '').trim().toLowerCase();
        const message = (req.body.message || '').trim();

        if (!name || name.length > 60) return res.status(400).json({ success: false, message: 'Please enter your alias (max 60 characters).' });
        if (!EMAIL_RE.test(email)) return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        if (message.length < 5 || message.length > 2000) return res.status(400).json({ success: false, message: 'Transmission must be 5–2000 characters.' });

        const msg = await prisma.message.create({
            data: { name, email, message }
        });

        res.status(201).json({
            success: true,
            message: 'Transmission dispatched successfully to root administration.',
            message_id: msg.id
        });
    } catch (err) {
        console.error('Contact error:', err);
        res.status(500).json({ success: false, message: 'Failed to dispatch transmission.' });
    }
});

router.get('/messages', requireAdmin, async (req, res) => {
    try {
        const msgs = await prisma.message.findMany({
            orderBy: { id: 'desc' },
            take: 200
        });
        res.json(msgs.map(m => ({
            msg_id: m.id,
            id: m.id,
            name: m.name,
            email: m.email,
            message: m.message,
            is_read: m.isRead ? 1 : 0,
            isRead: m.isRead,
            created_at: m.createdAt
        })));
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to retrieve messages.' });
    }
});

router.patch('/messages/:id/read', requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        await prisma.message.update({
            where: { id },
            data: { isRead: true }
        });
        res.json({ success: true, message: 'Transmission marked as read.' });
    } catch (err) {
        res.status(404).json({ success: false, message: 'Message not found.' });
    }
});

router.delete('/messages/:id', requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        await prisma.message.delete({ where: { id } });
        res.json({ success: true, message: 'Transmission purged.' });
    } catch (err) {
        res.status(404).json({ success: false, message: 'Message not found.' });
    }
});

module.exports = router;
