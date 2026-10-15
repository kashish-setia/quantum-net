'use strict';
const express = require('express');
const router = express.Router();
const { prisma } = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');
const AnomalyService = require('../services/anomaly.service');

// Register for an event
router.post(['/events/:id/register', '/:id/register', '/register'], requireAuth, async (req, res) => {
    try {
        const eventId = parseInt(req.params.id || req.body.event_id || req.body.eventId, 10);
        const name = (req.body.username || req.body.name || req.user.name || '').trim();

        if (isNaN(eventId)) {
            return res.status(400).json({ success: false, message: 'Invalid or missing event ID.' });
        }

        const result = await AnomalyService.registerForEvent(eventId, req.user.id, name);

        res.status(201).json({
            success: true,
            message: result.isWaitlisted
                ? 'Event is currently full. You have been placed on the waitlist.'
                : 'Registration successful! Pass issued.',
            ticket_id: result.ticketId || result.registrationId,
            ticketId: result.ticketId,
            status: result.status,
            availableSeats: result.availableSeats,
            free: true
        });
    } catch (err) {
        console.warn('Registration Attempt Rejected:', err.message);
        const status = err.message.includes('already registered') || err.message.includes('closed') ? 409 : 400;
        res.status(status).json({ success: false, message: err.message, error: err.message });
    }
});

// Get caller's own registrations / passes
router.get(['/my-registrations', '/user-passes'], requireAuth, async (req, res) => {
    try {
        const regs = await prisma.registration.findMany({
            where: { userId: req.user.id },
            include: {
                event: true,
                payment: true
            },
            orderBy: { id: 'desc' }
        });

        const mapped = regs.map(r => ({
            id: r.id,
            reg_id: r.id,
            ticket_id: r.ticketId || `REG-${r.id}`,
            ticketId: r.ticketId,
            pass_code: r.ticketId,
            status: r.status,
            payment: r.payment ? r.payment.status : 'PAID',
            created_at: r.registrationDate,
            cancelled_at: r.cancelledAt,
            event_id: r.event.id,
            event_name: r.event.title,
            title: r.event.title,
            category: r.event.category,
            venue: r.event.venue,
            date: r.event.eventDate,
            startTime: r.event.startTime,
            endTime: r.event.endTime,
            fee: r.event.fee,
            event_status: r.event.status
        }));

        res.json(mapped);
    } catch (err) {
        console.error('Fetch User Passes Error:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve registrations.' });
    }
});

// Get single registration
router.get('/registrations/:id', requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });

        const reg = await prisma.registration.findFirst({
            where: {
                id,
                ...(req.user.role !== 'ADMIN' ? { userId: req.user.id } : {})
            },
            include: { event: true, payment: true }
        });

        if (!reg) return res.status(404).json({ success: false, message: 'Ticket registration not found.' });

        res.json({
            id: reg.id,
            ticket_id: reg.ticketId || reg.id,
            ticketId: reg.ticketId,
            pass_code: reg.ticketId,
            status: reg.status,
            payment: reg.payment ? reg.payment.status : 'PAID',
            event_title: reg.event.title,
            fee: reg.event.fee,
            venue: reg.event.venue,
            date: reg.event.eventDate
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error retrieving ticket.' });
    }
});

// Deregister / Cancel Registration
router.delete('/registrations/:id', requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid registration ID.' });

        const isAdmin = req.user.role === 'ADMIN';
        const result = await AnomalyService.deregisterParticipant(id, req.user.id, isAdmin);

        res.json({
            success: true,
            message: 'Registration successfully cancelled. Seat released.',
            refunded: true,
            promotedWaitlist: result.promotedWaitlist ? true : false
        });
    } catch (err) {
        console.warn('Deregistration Error:', err.message);
        res.status(400).json({ success: false, message: err.message, error: err.message });
    }
});

// Payment simulation route
router.post('/pay', requireAuth, async (req, res) => {
    try {
        const ticketId = parseInt(req.body.ticket_id || req.body.ticketId, 10);
        const { card_number, expiry, cvv } = req.body;

        if (!ticketId) {
            return res.status(400).json({ success: false, message: 'Invalid ticket ID for payment.' });
        }

        const reg = await prisma.registration.findUnique({
            where: { id: ticketId },
            include: { event: true, payment: true }
        });

        if (!reg) return res.status(404).json({ success: false, message: 'Ticket not found.' });

        const passCode = reg.ticketId || AnomalyService.generateTicketId(reg.eventId, reg.id);

        await prisma.registration.update({
            where: { id: reg.id },
            data: { ticketId: passCode, status: 'CONFIRMED' }
        });

        await prisma.payment.upsert({
            where: { registrationId: reg.id },
            update: { status: 'PAID' },
            create: {
                registrationId: reg.id,
                amount: Number(reg.event.fee || 0),
                status: 'PAID',
                transactionId: `TX-PAID-${Date.now()}`
            }
        });

        res.json({
            success: true,
            message: 'Payment authorized successfully.',
            pass_code: passCode,
            ticketId: passCode
        });
    } catch (err) {
        console.error('Payment Error:', err);
        res.status(500).json({ success: false, message: 'Payment authorization failed.' });
    }
});

module.exports = router;
