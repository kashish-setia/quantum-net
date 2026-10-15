'use strict';
const express = require('express');
const router = express.Router();
const { prisma } = require('../config/db');
const { optionalAuth } = require('../middleware/auth.middleware');

// GET all events with search, category filtering and live capacity calculations
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { q, category, status } = req.query;
        const where = {};

        if (status) {
            where.status = status.toUpperCase();
        }
        if (category) {
            where.category = { equals: category, mode: 'insensitive' };
        }
        if (q) {
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { venue: { contains: q, mode: 'insensitive' } },
                { category: { contains: q, mode: 'insensitive' } }
            ];
        }

        const events = await prisma.event.findMany({
            where,
            include: {
                _count: {
                    select: {
                        registrations: {
                            where: { status: 'CONFIRMED' }
                        }
                    }
                }
            },
            orderBy: [{ eventDate: 'asc' }, { id: 'asc' }]
        });

        const today = new Date().toISOString().slice(0, 10);
        const mapped = events.map(e => {
            const seatsTaken = e._count.registrations;
            const seatsLeft = Math.max(0, e.capacity - seatsTaken);
            const isFull = seatsTaken >= e.capacity;
            const isPast = e.eventDate < today;

            return {
                id: e.id,
                event_id: e.id,
                title: e.title,
                category: e.category,
                date: e.eventDate,
                eventDate: e.eventDate,
                startTime: e.startTime,
                endTime: e.endTime,
                venue: e.venue,
                capacity: e.capacity,
                fee: e.fee,
                status: e.status,
                description: e.description,
                seats_taken: seatsTaken,
                seats_left: seatsLeft,
                is_full: isFull,
                is_past: isPast
            };
        });

        res.json(mapped);
    } catch (err) {
        console.error('Fetch Events Error:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve event nodes from grid.' });
    }
});

// GET single event details with user registration status
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid event identifier.' });

        const event = await prisma.event.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        registrations: {
                            where: { status: 'CONFIRMED' }
                        }
                    }
                },
                history: {
                    orderBy: { changedAt: 'desc' },
                    take: 10
                }
            }
        });

        if (!event) return res.status(404).json({ success: false, message: 'Event node not found.' });

        const today = new Date().toISOString().slice(0, 10);
        const seatsTaken = event._count.registrations;
        const seatsLeft = Math.max(0, event.capacity - seatsTaken);

        const out = {
            id: event.id,
            event_id: event.id,
            title: event.title,
            category: event.category,
            date: event.eventDate,
            eventDate: event.eventDate,
            startTime: event.startTime,
            endTime: event.endTime,
            venue: event.venue,
            capacity: event.capacity,
            fee: event.fee,
            status: event.status,
            description: event.description,
            seats_taken: seatsTaken,
            seats_left: seatsLeft,
            is_full: seatsTaken >= event.capacity,
            is_past: event.eventDate < today,
            history: event.history
        };

        if (req.user) {
            const userReg = await prisma.registration.findFirst({
                where: {
                    eventId: id,
                    userId: req.user.id,
                    status: { in: ['CONFIRMED', 'WAITLISTED'] }
                },
                include: { payment: true }
            });

            if (userReg) {
                out.my_registration = {
                    id: userReg.id,
                    ticket_id: userReg.ticketId || userReg.id,
                    ticketId: userReg.ticketId,
                    status: userReg.status,
                    payment: userReg.payment ? userReg.payment.status : 'PAID'
                };
            }
        }

        res.json(out);
    } catch (err) {
        console.error('Event Detail Error:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve event brief.' });
    }
});

// POST /api/events/:id/register
const { requireAuth } = require('../middleware/auth.middleware');
const AnomalyService = require('../services/anomaly.service');

router.post(['/:id/register', '/register'], requireAuth, async (req, res) => {
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

module.exports = router;

