'use strict';
const express = require('express');
const router = express.Router();
const { prisma } = require('../config/db');
const { requireAdmin } = require('../middleware/auth.middleware');
const AnomalyService = require('../services/anomaly.service');

router.use(requireAdmin);

// Create Event
router.post('/events', async (req, res) => {
    try {
        const { title, category, date, venue, capacity, fee, description, startTime, endTime } = req.body;

        if (!title || !category || !date || !venue || !capacity) {
            return res.status(400).json({ success: false, message: 'Missing required event fields.' });
        }

        // Venue conflict check
        const conflict = await AnomalyService.checkVenueConflict(venue, date, startTime, endTime);
        if (conflict.conflict) {
            return res.status(409).json({
                success: false,
                message: `Venue conflict detected. The selected venue is already occupied during this time by "${conflict.conflictingEvent.title}".`
            });
        }

        let creatorId = req.user ? req.user.id : null;
        if (creatorId) {
            const userExists = await prisma.user.findUnique({ where: { id: creatorId } });
            if (!userExists) {
                if (req.user.email) {
                    const u = await prisma.user.findUnique({ where: { email: req.user.email } });
                    creatorId = u ? u.id : null;
                } else {
                    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
                    creatorId = adminUser ? adminUser.id : null;
                }
            }
        }

        const event = await prisma.event.create({
            data: {
                title: title.trim(),
                category: category.trim(),
                eventDate: date.trim(),
                startTime: startTime || '09:00 AM',
                endTime: endTime || '05:00 PM',
                venue: venue.trim(),
                capacity: parseInt(capacity, 10),
                fee: parseInt(fee || 0, 10),
                description: description || 'Cosmic mission briefing forthcoming.',
                status: 'UPCOMING',
                createdBy: creatorId
            }
        });

        // Event History & Audit Log
        await prisma.eventHistory.create({
            data: {
                eventId: event.id,
                changedBy: creatorId,
                changeType: 'EVENT_CREATION',
                newValue: JSON.stringify({ title: event.title, venue: event.venue, date: event.eventDate, capacity: event.capacity })
            }
        });

        if (creatorId) {
            await prisma.auditLog.create({
                data: {
                    userId: creatorId,
                    action: 'CREATE_EVENT',
                    entity: 'Event',
                    entityId: event.id,
                    details: `Admin deployed event node "${event.title}" to Grid.`
                }
            });
        }

        res.status(201).json({
            success: true,
            message: 'Event node deployed successfully!',
            event_id: event.id,
            event
        });
    } catch (err) {
        console.error('Create Event Error:', err);
        res.status(500).json({ success: false, message: 'Failed to deploy event node.' });
    }
});

// Update Event
router.put('/events/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { title, category, date, venue, capacity, fee, description, startTime, endTime } = req.body;

        const event = await prisma.event.findUnique({ where: { id } });
        if (!event) return res.status(404).json({ success: false, message: 'Event node not found.' });

        // Check if capacity is changing
        if (capacity && parseInt(capacity, 10) !== event.capacity) {
            await AnomalyService.changeCapacity(id, capacity, req.user.id);
        }

        // Check if venue is changing
        if (venue && venue.trim().toLowerCase() !== event.venue.trim().toLowerCase()) {
            await AnomalyService.changeVenue(id, venue, req.user.id);
        }

        // Check if schedule is changing
        if ((date && date !== event.eventDate) || (startTime && startTime !== event.startTime) || (endTime && endTime !== event.endTime)) {
            await AnomalyService.changeSchedule(id, date || event.eventDate, startTime || event.startTime, endTime || event.endTime, req.user.id);
        }

        // Update remaining fields
        const updated = await prisma.event.update({
            where: { id },
            data: {
                ...(title ? { title: title.trim() } : {}),
                ...(category ? { category: category.trim() } : {}),
                ...(fee !== undefined ? { fee: parseInt(fee, 10) } : {}),
                ...(description !== undefined ? { description: description.trim() } : {})
            }
        });

        res.json({ success: true, message: 'Event node updated successfully.', event: updated });
    } catch (err) {
        console.warn('Update Event Error:', err.message);
        res.status(400).json({ success: false, message: err.message, error: err.message });
    }
});

// Anomaly 1: Cancel Event Endpoint
router.patch('/events/:id/cancel', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { reason } = req.body;
        const result = await AnomalyService.cancelEvent(id, req.user.id, reason);

        res.json({
            success: true,
            message: `Event successfully cancelled. Notified ${result.affectedRegistrations} confirmed participant(s).`,
            event: result.event
        });
    } catch (err) {
        console.error('Cancel Event Error:', err);
        res.status(400).json({ success: false, message: err.message, error: err.message });
    }
});

// Anomaly 3: Change Venue Endpoint
router.patch('/events/:id/venue', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { venue } = req.body;
        if (!venue) return res.status(400).json({ success: false, message: 'New venue name is required.' });

        const result = await AnomalyService.changeVenue(id, venue, req.user.id);
        res.json({
            success: true,
            message: `Venue updated from "${result.oldVenue}" to "${result.newVenue}". Notified ${result.notifiedCount} participant(s).`,
            event: result.event
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message, error: err.message });
    }
});

// Anomaly 4: Change Date & Time Endpoint
router.patch(['/events/:id/date', '/events/:id/datetime'], async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { date, startTime, endTime } = req.body;
        if (!date) return res.status(400).json({ success: false, message: 'New event date is required.' });

        const result = await AnomalyService.changeSchedule(id, date, startTime, endTime, req.user.id);
        res.json({
            success: true,
            message: `Schedule updated to ${result.newSchedule}. Notified all confirmed participants.`,
            event: result.event
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message, error: err.message });
    }
});

// Anomaly 5: Change Capacity Endpoint
router.patch('/events/:id/capacity', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { capacity } = req.body;
        if (capacity === undefined || capacity === null) return res.status(400).json({ success: false, message: 'New capacity value is required.' });

        const result = await AnomalyService.changeCapacity(id, capacity, req.user.id);
        res.json({
            success: true,
            message: `Capacity adjusted to ${result.newCapacity}. Promoted ${result.promotedCount} waitlisted participant(s).`,
            event: result.event,
            promotedCount: result.promotedCount
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message, error: err.message });
    }
});

// Safe Delete / Cancel event
router.delete('/events/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const result = await AnomalyService.cancelEvent(id, req.user.id, 'Administrative Deletion/Cancellation');
        res.json({
            success: true,
            message: 'Event safely marked as CANCELLED. All participants notified and refunds initiated.',
            event: result.event
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message, error: err.message });
    }
});

// Admin Registrations List
router.get('/registrations', async (req, res) => {
    try {
        const { event_id, q } = req.query;
        const where = {};

        if (event_id) where.eventId = parseInt(event_id, 10);
        if (q) {
            where.OR = [
                { user: { name: { contains: q, mode: 'insensitive' } } },
                { user: { email: { contains: q, mode: 'insensitive' } } },
                { event: { title: { contains: q, mode: 'insensitive' } } },
                { ticketId: { contains: q, mode: 'insensitive' } }
            ];
        }

        const regs = await prisma.registration.findMany({
            where,
            include: { user: true, event: true, payment: true },
            orderBy: { id: 'desc' }
        });

        const mapped = regs.map(r => ({
            ticket_id: r.ticketId || r.id,
            id: r.id,
            user_name: r.user.name,
            user_email: r.user.email,
            event_id: r.eventId,
            event_title: r.event.title,
            venue: r.event.venue,
            date: r.event.eventDate,
            status: r.status,
            payment: r.payment ? r.payment.status : 'PAID',
            pass_code: r.ticketId,
            created_at: r.registrationDate,
            cancelled_at: r.cancelledAt
        }));

        res.json(mapped);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to retrieve registrations.' });
    }
});

// Admin Users List
router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, createdAt: true, _count: { select: { registrations: true } } },
            orderBy: { id: 'desc' }
        });
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch users.' });
    }
});

// Admin Event History Logs
router.get('/history', async (req, res) => {
    try {
        const eventId = req.query.eventId ? parseInt(req.query.eventId, 10) : undefined;
        const history = await prisma.eventHistory.findMany({
            where: eventId ? { eventId } : {},
            include: { event: { select: { title: true } }, user: { select: { name: true, email: true } } },
            orderBy: { changedAt: 'desc' },
            take: 100
        });
        res.json({ success: true, history });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch event history.' });
    }
});

// Admin Audit Logs
router.get('/audit-logs', async (req, res) => {
    try {
        const logs = await prisma.auditLog.findMany({
            include: { user: { select: { name: true, email: true } } },
            orderBy: { timestamp: 'desc' },
            take: 150
        });
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
    }
});

// Admin Analytics / Stats
router.get(['/analytics', '/stats'], async (req, res) => {
    try {
        const [totalEvents, activeEvents, cancelledEvents, totalUsers, totalRegs, confirmedRegs, waitlistedRegs, revenueData, perEvent] = await Promise.all([
            prisma.event.count(),
            prisma.event.count({ where: { status: { in: ['UPCOMING', 'ONGOING'] } } }),
            prisma.event.count({ where: { status: 'CANCELLED' } }),
            prisma.user.count({ where: { role: 'USER' } }),
            prisma.registration.count(),
            prisma.registration.count({ where: { status: 'CONFIRMED' } }),
            prisma.registration.count({ where: { status: 'WAITLISTED' } }),
            prisma.payment.aggregate({
                where: { status: 'PAID' },
                _sum: { amount: true }
            }),
            prisma.event.findMany({
                include: {
                    _count: {
                        select: { registrations: { where: { status: 'CONFIRMED' } } }
                    }
                },
                orderBy: { eventDate: 'asc' }
            })
        ]);

        res.json({
            events: totalEvents,
            active_events: activeEvents,
            cancelled_events: cancelledEvents,
            participants: totalUsers,
            total_users: totalUsers,
            registrations: totalRegs,
            confirmed_registrations: confirmedRegs,
            waitlisted_registrations: waitlistedRegs,
            paid: confirmedRegs,
            pending: waitlistedRegs,
            revenue: revenueData._sum.amount || 0,
            unread_messages: await prisma.message.count({ where: { isRead: false } }),
            per_event: perEvent.map(e => ({
                event_id: e.id,
                title: e.title,
                capacity: e.capacity,
                seats_taken: e._count.registrations,
                seats_left: Math.max(0, e.capacity - e._count.registrations),
                status: e.status
            }))
        });
    } catch (err) {
        console.error('Analytics Error:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve analytics.' });
    }
});

// CSV Export
router.get('/export.csv', async (req, res) => {
    try {
        const regs = await prisma.registration.findMany({
            include: { user: true, event: true, payment: true },
            orderBy: { id: 'asc' }
        });

        const head = ['Ticket ID', 'Name', 'Email', 'Event', 'Venue', 'Event Date', 'Status', 'Payment', 'Registered At'];
        const csvCell = (v) => {
            let s = String(v ?? '');
            if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
            return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        };

        const rows = regs.map(r => [
            r.ticketId || r.id,
            r.user.name,
            r.user.email,
            r.event.title,
            r.event.venue,
            r.event.eventDate,
            r.status,
            r.payment ? r.payment.status : 'PAID',
            r.registrationDate.toISOString()
        ]);

        const csv = [head, ...rows].map(line => line.map(csvCell).join(',')).join('\r\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="quantum-net-registrations.csv"');
        res.send('\uFEFF' + csv);
    } catch (err) {
        res.status(500).send('Error generating CSV');
    }
});

module.exports = router;
