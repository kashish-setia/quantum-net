'use strict';
const express = require('express');
const router = express.Router();
const { prisma } = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');

router.use(requireAuth);

// Get user notifications
router.get('/', async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.id },
            include: { event: { select: { title: true } } },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        const unreadCount = await prisma.notification.count({
            where: { userId: req.user.id, isRead: false }
        });

        res.json({
            success: true,
            unreadCount,
            notifications
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
    }
});

// Mark single notification as read
router.patch('/:id/read', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        await prisma.notification.updateMany({
            where: { id, userId: req.user.id },
            data: { isRead: true }
        });
        res.json({ success: true, message: 'Notification marked as read.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update notification.' });
    }
});

// Mark all as read
router.patch('/read-all', async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user.id, isRead: false },
            data: { isRead: true }
        });
        res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update notifications.' });
    }
});

module.exports = router;
