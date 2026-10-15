'use strict';
/**
 * QUANTUM NET — Anomaly & Event Change Engine (anomaly.service.js)
 * Implements transactional handling for:
 * 1. Event Cancellation & Cascading Refund/Notification
 * 2. Participant Deregistration & Waitlist Promotion
 * 3. Venue Change & Participant Broadcaster
 * 4. Date/Time Change & Notification
 * 5. Capacity Reduction Enforcement & Inconsistency Prevention
 * 6. Venue Conflict Detection (Overlapping times/dates)
 * 7. Duplicate Registration Guard
 * 8. Event Lifecycle State Verification
 */
const { prisma } = require('../config/db');

class AnomalyService {
    /**
     * Generate standard ticket code format: QN-YYYY-XXXXX
     */
    generateTicketId(eventId, regId) {
        const year = new Date().getFullYear();
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `QN-${year}-${String(eventId).padStart(2, '0')}${String(regId).padStart(4, '0')}-${rand}`;
    }

    /**
     * Anomaly 6: Check for venue conflict on date & time window
     */
    async checkVenueConflict(venue, eventDate, startTime, endTime, excludeEventId = null) {
        if (!prisma) return false;
        const normalizedVenue = venue.trim().toLowerCase();

        const existingEvents = await prisma.event.findMany({
            where: {
                eventDate: eventDate,
                status: { in: ['UPCOMING', 'ONGOING'] },
                ...(excludeEventId ? { id: { not: Number(excludeEventId) } } : {})
            }
        });

        for (const ev of existingEvents) {
            if (ev.venue.trim().toLowerCase() === normalizedVenue) {
                // If same venue on same date: check overlapping times
                const t1Start = this.parseTimeToMinutes(startTime || '09:00 AM');
                const t1End = this.parseTimeToMinutes(endTime || '05:00 PM');
                const t2Start = this.parseTimeToMinutes(ev.startTime || '09:00 AM');
                const t2End = this.parseTimeToMinutes(ev.endTime || '05:00 PM');

                // Overlap condition: startA < endB && endA > startB
                if (t1Start < t2End && t1End > t2Start) {
                    return {
                        conflict: true,
                        conflictingEvent: ev
                    };
                }
            }
        }
        return { conflict: false };
    }

    parseTimeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (!match) return 0;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const meridian = (match[3] || '').toUpperCase();
        if (meridian === 'PM' && hours < 12) hours += 12;
        if (meridian === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    }

    /**
     * Anomaly 1: Event Cancellation Workflow
     */
    async cancelEvent(eventId, adminUserId, reason = 'Administrative cancellation') {
        if (!prisma) throw new Error('Database client unavailable');

        return await prisma.$transaction(async (tx) => {
            const event = await tx.event.findUnique({
                where: { id: Number(eventId) },
                include: {
                    registrations: {
                        where: { status: 'CONFIRMED' },
                        include: { user: true, payment: true }
                    }
                }
            });

            if (!event) {
                throw new Error('Event node not found.');
            }
            if (event.status === 'CANCELLED') {
                throw new Error('Event has already been cancelled.');
            }

            // 1. Update event status
            const updatedEvent = await tx.event.update({
                where: { id: Number(eventId) },
                data: { status: 'CANCELLED' }
            });

            // 2. Mark confirmed registrations as CANCELLED
            const now = new Date();
            const confirmedRegs = event.registrations;
            
            for (const reg of confirmedRegs) {
                await tx.registration.update({
                    where: { id: reg.id },
                    data: {
                        status: 'CANCELLED',
                        cancelledAt: now
                    }
                });

                // 3. Mark payments as REFUND_PENDING
                if (reg.payment) {
                    await tx.payment.update({
                        where: { registrationId: reg.id },
                        data: {
                            status: 'REFUND_PENDING',
                            refundDate: now
                        }
                    });
                }

                // 4. Create user notification
                await tx.notification.create({
                    data: {
                        userId: reg.userId,
                        eventId: event.id,
                        type: 'EVENT_CANCELLED',
                        message: `${event.title} has been cancelled. Your registration has been cancelled and your refund is being processed.`
                    }
                });
            }

            // Also notify any waitlisted participants
            const waitlistedRegs = await tx.registration.findMany({
                where: { eventId: Number(eventId), status: 'WAITLISTED' }
            });
            for (const wReg of waitlistedRegs) {
                await tx.registration.update({
                    where: { id: wReg.id },
                    data: { status: 'CANCELLED', cancelledAt: now }
                });
                await tx.notification.create({
                    data: {
                        userId: wReg.userId,
                        eventId: event.id,
                        type: 'EVENT_CANCELLED',
                        message: `${event.title} has been cancelled. The event and waitlist have been closed.`
                    }
                });
            }

            // 5. Create EventHistory log
            await tx.eventHistory.create({
                data: {
                    eventId: event.id,
                    changedBy: adminUserId,
                    changeType: 'EVENT_CANCELLATION',
                    oldValue: event.status,
                    newValue: 'CANCELLED'
                }
            });

            // 6. Create AuditLog
            await tx.auditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'CANCEL_EVENT',
                    entity: 'Event',
                    entityId: event.id,
                    details: `Cancelled event "${event.title}". Impacted ${confirmedRegs.length} confirmed registration(s). Reason: ${reason}`
                }
            });

            return {
                event: updatedEvent,
                affectedRegistrations: confirmedRegs.length
            };
        });
    }

    /**
     * Anomaly 2: Participant Deregistration & Waitlist Promotion
     */
    async deregisterParticipant(registrationId, requestedByUserId, isAdmin = false) {
        if (!prisma) throw new Error('Database client unavailable');

        return await prisma.$transaction(async (tx) => {
            const reg = await tx.registration.findUnique({
                where: { id: Number(registrationId) },
                include: { event: true, payment: true, user: true }
            });

            if (!reg) {
                throw new Error('Registration record not found.');
            }
            if (!isAdmin && reg.userId !== requestedByUserId) {
                throw new Error('Unauthorized. You can only cancel your own registrations.');
            }
            if (reg.status === 'CANCELLED') {
                throw new Error('Registration is already cancelled.');
            }

            const wasConfirmed = reg.status === 'CONFIRMED';
            const now = new Date();

            // 1. Mark registration as CANCELLED
            const updatedReg = await tx.registration.update({
                where: { id: reg.id },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: now
                }
            });

            // 2. Mark payment as REFUND_PENDING / REFUNDED
            if (reg.payment && reg.payment.status === 'PAID') {
                await tx.payment.update({
                    where: { registrationId: reg.id },
                    data: {
                        status: 'REFUND_PENDING',
                        refundDate: now
                    }
                });
            }

            // 3. User notification
            await tx.notification.create({
                data: {
                    userId: reg.userId,
                    eventId: reg.eventId,
                    type: 'REGISTRATION_CANCELLED',
                    message: `Your registration for "${reg.event.title}" has been cancelled. Seat freed and refund initiated.`
                }
            });

            // 4. Audit Log
            await tx.auditLog.create({
                data: {
                    userId: requestedByUserId,
                    action: 'CANCEL_REGISTRATION',
                    entity: 'Registration',
                    entityId: reg.id,
                    details: `User #${reg.userId} cancelled registration for event #${reg.eventId} (${reg.event.title})`
                }
            });

            // 5. Check Waitlist promotion if this was a confirmed seat
            let promotedUser = null;
            if (wasConfirmed) {
                const waitlisted = await tx.registration.findFirst({
                    where: {
                        eventId: reg.eventId,
                        status: 'WAITLISTED'
                    },
                    orderBy: { registrationDate: 'asc' },
                    include: { user: true }
                });

                if (waitlisted) {
                    const ticketId = this.generateTicketId(reg.eventId, waitlisted.id);
                    promotedUser = await tx.registration.update({
                        where: { id: waitlisted.id },
                        data: {
                            status: 'CONFIRMED',
                            ticketId: ticketId
                        }
                    });

                    // Create payment record for promoted user if not existing
                    await tx.payment.upsert({
                        where: { registrationId: waitlisted.id },
                        update: { status: 'PAID' },
                        create: {
                            registrationId: waitlisted.id,
                            amount: Number(reg.event.fee || 0),
                            status: 'PAID',
                            transactionId: `TX-PROMO-${Date.now()}`
                        }
                    });

                    // Notify the promoted participant
                    await tx.notification.create({
                        data: {
                            userId: waitlisted.userId,
                            eventId: reg.eventId,
                            type: 'WAITLIST_PROMOTED',
                            message: `Great news! You have been promoted from the waitlist for "${reg.event.title}". Your ticket ID is ${ticketId}.`
                        }
                    });

                    await tx.auditLog.create({
                        data: {
                            userId: null,
                            action: 'WAITLIST_PROMOTION',
                            entity: 'Registration',
                            entityId: waitlisted.id,
                            details: `Promoted waitlisted user #${waitlisted.userId} to CONFIRMED with ticket ${ticketId}`
                        }
                    });
                }
            }

            return {
                cancelledRegistration: updatedReg,
                promotedWaitlist: promotedUser
            };
        });
    }

    /**
     * Anomaly 3: Venue Change
     */
    async changeVenue(eventId, newVenue, adminUserId) {
        if (!prisma) throw new Error('Database client unavailable');
        const trimmedVenue = newVenue.trim();

        return await prisma.$transaction(async (tx) => {
            const event = await tx.event.findUnique({
                where: { id: Number(eventId) },
                include: {
                    registrations: {
                        where: { status: 'CONFIRMED' }
                    }
                }
            });

            if (!event) throw new Error('Event node not found.');
            if (event.status === 'CANCELLED') throw new Error('Cannot change venue of a cancelled event.');
            if (event.venue.toLowerCase() === trimmedVenue.toLowerCase()) {
                return { event, noChange: true };
            }

            // Check for venue conflict
            const conflictCheck = await this.checkVenueConflict(
                trimmedVenue,
                event.eventDate,
                event.startTime,
                event.endTime,
                event.id
            );
            if (conflictCheck.conflict) {
                throw new Error('Venue conflict detected. The selected venue is already occupied during this time.');
            }

            const oldVenue = event.venue;

            // 1. Update event venue
            const updated = await tx.event.update({
                where: { id: Number(eventId) },
                data: { venue: trimmedVenue }
            });

            // 2. Event History
            await tx.eventHistory.create({
                data: {
                    eventId: event.id,
                    changedBy: adminUserId,
                    changeType: 'VENUE_CHANGE',
                    oldValue: oldVenue,
                    newValue: trimmedVenue
                }
            });

            // 3. Notify all confirmed participants
            const confirmedRegs = event.registrations;
            for (const reg of confirmedRegs) {
                await tx.notification.create({
                    data: {
                        userId: reg.userId,
                        eventId: event.id,
                        type: 'VENUE_CHANGED',
                        message: `The venue for ${event.title} has changed from ${oldVenue} to ${trimmedVenue}.`
                    }
                });
            }

            // 4. Audit Log
            await tx.auditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'CHANGE_VENUE',
                    entity: 'Event',
                    entityId: event.id,
                    details: `Venue changed from "${oldVenue}" to "${trimmedVenue}". Notified ${confirmedRegs.length} participant(s).`
                }
            });

            return {
                event: updated,
                oldVenue,
                newVenue: trimmedVenue,
                notifiedCount: confirmedRegs.length
            };
        });
    }

    /**
     * Anomaly 4: Date & Time Change
     */
    async changeSchedule(eventId, newDate, newStartTime, newEndTime, adminUserId) {
        if (!prisma) throw new Error('Database client unavailable');

        return await prisma.$transaction(async (tx) => {
            const event = await tx.event.findUnique({
                where: { id: Number(eventId) },
                include: { registrations: { where: { status: 'CONFIRMED' } } }
            });

            if (!event) throw new Error('Event node not found.');
            if (event.status === 'CANCELLED') throw new Error('Cannot change date/time of a cancelled event.');

            // Conflict check
            const conflictCheck = await this.checkVenueConflict(
                event.venue,
                newDate,
                newStartTime || event.startTime,
                newEndTime || event.endTime,
                event.id
            );
            if (conflictCheck.conflict) {
                throw new Error('Venue conflict detected. The selected venue is already occupied during this time.');
            }

            const oldSchedule = `${event.eventDate} (${event.startTime} - ${event.endTime})`;
            const newSchedule = `${newDate} (${newStartTime || event.startTime} - ${newEndTime || event.endTime})`;

            // 1. Update event schedule
            const updated = await tx.event.update({
                where: { id: Number(eventId) },
                data: {
                    eventDate: newDate,
                    startTime: newStartTime || event.startTime,
                    endTime: newEndTime || event.endTime
                }
            });

            // 2. Event History
            await tx.eventHistory.create({
                data: {
                    eventId: event.id,
                    changedBy: adminUserId,
                    changeType: 'DATE_TIME_CHANGE',
                    oldValue: oldSchedule,
                    newValue: newSchedule
                }
            });

            // 3. Notify confirmed users
            for (const reg of event.registrations) {
                await tx.notification.create({
                    data: {
                        userId: reg.userId,
                        eventId: event.id,
                        type: 'SCHEDULE_CHANGED',
                        message: `The schedule for "${event.title}" has changed to ${newSchedule}. If this no longer suits you, you may cancel your registration on your dashboard.`
                    }
                });
            }

            // 4. Audit Log
            await tx.auditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'CHANGE_SCHEDULE',
                    entity: 'Event',
                    entityId: event.id,
                    details: `Schedule updated from "${oldSchedule}" to "${newSchedule}".`
                }
            });

            return { event: updated, oldSchedule, newSchedule };
        });
    }

    /**
     * Anomaly 5: Capacity Reduction Check & Update
     */
    async changeCapacity(eventId, newCapacity, adminUserId) {
        if (!prisma) throw new Error('Database client unavailable');
        const cap = Number(newCapacity);

        return await prisma.$transaction(async (tx) => {
            const event = await tx.event.findUnique({
                where: { id: Number(eventId) }
            });

            if (!event) throw new Error('Event node not found.');
            if (cap < 1) throw new Error('Capacity must be at least 1.');

            const confirmedCount = await tx.registration.count({
                where: { eventId: Number(eventId), status: 'CONFIRMED' }
            });

            if (cap < confirmedCount) {
                throw new Error('Capacity cannot be reduced below the current number of confirmed registrations.');
            }

            const oldCapacity = event.capacity;
            const updated = await tx.event.update({
                where: { id: Number(eventId) },
                data: { capacity: cap }
            });

            // If capacity increased, check if any waitlisted participants can be promoted
            let promotedCount = 0;
            if (cap > oldCapacity) {
                const slotsAvailable = cap - confirmedCount;
                if (slotsAvailable > 0) {
                    const waitlisted = await tx.registration.findMany({
                        where: { eventId: Number(eventId), status: 'WAITLISTED' },
                        orderBy: { registrationDate: 'asc' },
                        take: slotsAvailable
                    });

                    for (const wReg of waitlisted) {
                        const ticketId = this.generateTicketId(eventId, wReg.id);
                        await tx.registration.update({
                            where: { id: wReg.id },
                            data: { status: 'CONFIRMED', ticketId }
                        });
                        await tx.payment.upsert({
                            where: { registrationId: wReg.id },
                            update: { status: 'PAID' },
                            create: {
                                registrationId: wReg.id,
                                amount: Number(event.fee || 0),
                                status: 'PAID',
                                transactionId: `TX-CAP-PROMO-${Date.now()}`
                            }
                        });
                        await tx.notification.create({
                            data: {
                                userId: wReg.userId,
                                eventId: event.id,
                                type: 'WAITLIST_PROMOTED',
                                message: `Capacity has expanded! You are now confirmed for "${event.title}". Ticket: ${ticketId}`
                            }
                        });
                        promotedCount++;
                    }
                }
            }

            // Event History & Audit Log
            await tx.eventHistory.create({
                data: {
                    eventId: event.id,
                    changedBy: adminUserId,
                    changeType: 'CAPACITY_CHANGE',
                    oldValue: String(oldCapacity),
                    newValue: String(cap)
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'CHANGE_CAPACITY',
                    entity: 'Event',
                    entityId: event.id,
                    details: `Capacity altered from ${oldCapacity} to ${cap}. Promoted ${promotedCount} waitlisted participant(s).`
                }
            });

            return { event: updated, oldCapacity, newCapacity: cap, promotedCount };
        });
    }

    /**
     * Complete Registration Workflow with Transaction & Duplicate Guard
     */
    async registerForEvent(eventId, userId, participantName) {
        if (!prisma) throw new Error('Database client unavailable');

        return await prisma.$transaction(async (tx) => {
            const event = await tx.event.findUnique({
                where: { id: Number(eventId) }
            });

            if (!event) throw new Error('Event node not found.');
            if (event.status === 'CANCELLED') throw new Error('Registration is closed — this event has been cancelled.');
            
            // Check if past
            const today = new Date().toISOString().slice(0, 10);
            if (event.eventDate < today) {
                throw new Error('Registration is closed — this event has already taken place.');
            }

            // Duplicate registration check
            const existingReg = await tx.registration.findFirst({
                where: {
                    userId: Number(userId),
                    eventId: Number(eventId),
                    status: { in: ['CONFIRMED', 'WAITLISTED'] }
                }
            });

            if (existingReg) {
                throw new Error('You are already registered for this event.');
            }

            // Check capacity
            const confirmedCount = await tx.registration.count({
                where: { eventId: Number(eventId), status: 'CONFIRMED' }
            });

            const isFull = confirmedCount >= event.capacity;
            const status = isFull ? 'WAITLISTED' : 'CONFIRMED';

            // Create registration record
            const reg = await tx.registration.create({
                data: {
                    userId: Number(userId),
                    eventId: Number(eventId),
                    status: status,
                    registrationDate: new Date()
                }
            });

            let ticketId = null;
            if (status === 'CONFIRMED') {
                ticketId = this.generateTicketId(eventId, reg.id);
                await tx.registration.update({
                    where: { id: reg.id },
                    data: { ticketId }
                });

                // Create payment record
                await tx.payment.create({
                    data: {
                        registrationId: reg.id,
                        amount: Number(event.fee || 0),
                        status: 'PAID',
                        transactionId: `TX-QN-${Date.now()}-${reg.id}`
                    }
                });

                // In-app Notification
                await tx.notification.create({
                    data: {
                        userId: Number(userId),
                        eventId: event.id,
                        type: 'REGISTRATION_CONFIRMED',
                        message: `Registration confirmed for "${event.title}". Ticket ID: ${ticketId}`
                    }
                });
            } else {
                // Waitlist notification
                await tx.notification.create({
                    data: {
                        userId: Number(userId),
                        eventId: event.id,
                        type: 'WAITLISTED',
                        message: `"${event.title}" is currently full. You have been placed on the priority waitlist.`
                    }
                });
            }

            // Audit log
            await tx.auditLog.create({
                data: {
                    userId: Number(userId),
                    action: 'REGISTER_EVENT',
                    entity: 'Registration',
                    entityId: reg.id,
                    details: `User registered for "${event.title}" with status ${status} ${ticketId ? '(Ticket: ' + ticketId + ')' : ''}`
                }
            });

            return {
                registrationId: reg.id,
                status,
                ticketId,
                isWaitlisted: status === 'WAITLISTED',
                availableSeats: Math.max(0, event.capacity - (confirmedCount + (status === 'CONFIRMED' ? 1 : 0)))
            };
        });
    }
}

module.exports = new AnomalyService();
