'use strict';
/**
 * QUANTUM NET — Database Seeder (prisma/seed.js)
 * Populates PostgreSQL database with initial admin, users, events, registrations, waitlists,
 * event history logs, audit logs, and in-app notifications.
 */
const bcrypt = require('bcryptjs');
const { prisma } = require('../src/config/db');

async function seed() {
    console.log('⚡ Initializing Quantum Net Cosmic Seed Sequence...');

    // 1. Clean existing records (optional for fresh seed)
    try {
        await prisma.notification.deleteMany();
        await prisma.auditLog.deleteMany();
        await prisma.eventHistory.deleteMany();
        await prisma.payment.deleteMany();
        await prisma.registration.deleteMany();
        await prisma.event.deleteMany();
        await prisma.user.deleteMany();
        await prisma.message.deleteMany();
    } catch (e) {
        console.log('Tables ready for initialization.');
    }

    const adminHash = await bcrypt.hash('admin123', 10);
    const userHash = await bcrypt.hash('password123', 10);

    // 2. Seed Admin & Users
    const admin = await prisma.user.create({
        data: {
            name: 'Root Controller',
            email: 'admin@quantum.net',
            passwordHash: adminHash,
            role: 'ADMIN'
        }
    });

    const userNova = await prisma.user.create({
        data: {
            name: 'Agent Nova',
            email: 'agent.nova@quantum.net',
            passwordHash: userHash,
            role: 'USER'
        }
    });

    const userCipher = await prisma.user.create({
        data: {
            name: 'Agent Cipher',
            email: 'agent.cipher@quantum.net',
            passwordHash: userHash,
            role: 'USER'
        }
    });

    const userSolaris = await prisma.user.create({
        data: {
            name: 'Agent Solaris',
            email: 'agent.solaris@quantum.net',
            passwordHash: userHash,
            role: 'USER'
        }
    });

    const userEcho = await prisma.user.create({
        data: {
            name: 'Agent Echo',
            email: 'agent.echo@quantum.net',
            passwordHash: userHash,
            role: 'USER'
        }
    });

    console.log(`✓ Seeded Admin and ${4} Active Agents`);

    // Helper for date offsets
    const futureDate = (days) => {
        const d = new Date(Date.now() + days * 86400000);
        return d.toISOString().slice(0, 10);
    };

    // 3. Seed Realistic Cosmic Events (At least 8 + 1 cancelled)
    const eventsData = [
        {
            title: 'Quantum Tech Summit',
            category: 'Technology',
            eventDate: futureDate(10),
            startTime: '10:00 AM',
            endTime: '05:00 PM',
            venue: 'Sector 7 Auditorium',
            capacity: 250,
            fee: 100,
            status: 'UPCOMING',
            description: 'Flagship summit on neural networks, topological quantum computing, and the next frontier of intelligent planetary systems.',
            createdBy: admin.id
        },
        {
            title: 'Cyber Matrix Hackathon',
            category: 'Competition',
            eventDate: futureDate(12),
            startTime: '09:00 AM',
            endTime: '09:00 AM',
            venue: 'Cyber Lab, Block B',
            capacity: 120,
            fee: 150,
            status: 'UPCOMING',
            description: 'A 24-hour high-octane engineering hackathon. Deploy real-time mesh prototypes and autonomous agent telemetry.',
            createdBy: admin.id
        },
        {
            title: 'AI & Robotics Workshop',
            category: 'Workshop',
            eventDate: futureDate(14),
            startTime: '01:00 PM',
            endTime: '06:00 PM',
            venue: 'Robotics Foundry Hall',
            capacity: 2, // Intentionally small to demo capacity / waitlist
            fee: 0,
            status: 'UPCOMING',
            description: 'Hands-on hardware interfacing with neural microcontrollers and autonomous bipedal kinematic simulations.',
            createdBy: admin.id
        },
        {
            title: 'Future Computing Conference',
            category: 'Technology',
            eventDate: futureDate(15),
            startTime: '09:30 AM',
            endTime: '04:30 PM',
            venue: 'Quantum Dome Alpha',
            capacity: 300,
            fee: 120,
            status: 'UPCOMING',
            description: 'Exploring photonic processors, sub-atomic storage matrices, and high-throughput cryptographic verification protocols.',
            createdBy: admin.id
        },
        {
            title: 'Cosmic Code Fest',
            category: 'Competition',
            eventDate: futureDate(18),
            startTime: '11:00 AM',
            endTime: '07:00 PM',
            venue: 'Orbital Arena 3',
            capacity: 80,
            fee: 75,
            status: 'UPCOMING',
            description: 'Competitive algorithmic speed-coding and dynamic optimization challenges across distributed quantum simulations.',
            createdBy: admin.id
        },
        {
            title: 'Cyber Security Workshop',
            category: 'Workshop',
            eventDate: futureDate(20),
            startTime: '10:00 AM',
            endTime: '02:00 PM',
            venue: 'Network Defense Hub',
            capacity: 50,
            fee: 50,
            status: 'UPCOMING',
            description: 'Zero-trust architecture, side-channel attack countermeasures, and post-quantum asymmetric encryption.',
            createdBy: admin.id
        },
        {
            title: 'Neon Nights Cultural Gala',
            category: 'Cultural',
            eventDate: futureDate(22),
            startTime: '06:00 PM',
            endTime: '11:00 PM',
            venue: 'Open Air Amphitheatre',
            capacity: 500,
            fee: 40,
            status: 'UPCOMING',
            description: 'Sensory laser exhibits, holographic theater, and live electronic ambient performances across campus sectors.',
            createdBy: admin.id
        },
        {
            title: 'Stellar Stage: Battle of Bands',
            category: 'Cultural',
            eventDate: futureDate(25),
            startTime: '05:00 PM',
            endTime: '10:30 PM',
            venue: 'Main Soundstage',
            capacity: 400,
            fee: 80,
            status: 'UPCOMING',
            description: 'Inter-sector musical battle featuring synth-rock ensembles and cyber-acoustic compositions.',
            createdBy: admin.id
        },
        {
            title: 'Quantum Cryptography Symposium',
            category: 'Technology',
            eventDate: futureDate(28),
            startTime: '02:00 PM',
            endTime: '06:00 PM',
            venue: 'Old Research Vault',
            capacity: 50,
            fee: 60,
            status: 'CANCELLED',
            description: 'Deep dive into lattice-based cryptography and quantum key distribution channels (Cancelled due to scheduled sector maintenance).',
            createdBy: admin.id
        }
    ];

    const createdEvents = [];
    for (const evData of eventsData) {
        const ev = await prisma.event.create({ data: evData });
        createdEvents.push(ev);
    }
    console.log(`✓ Seeded ${createdEvents.length} Cosmic Event Nodes`);

    // 4. Seed Registrations & Tickets
    // Event 0 (Quantum Tech Summit): Nova and Cipher confirmed
    const reg1 = await prisma.registration.create({
        data: {
            userId: userNova.id,
            eventId: createdEvents[0].id,
            status: 'CONFIRMED',
            ticketId: 'QN-2026-01001-A9F2'
        }
    });
    await prisma.payment.create({
        data: {
            registrationId: reg1.id,
            amount: 100,
            status: 'PAID',
            transactionId: 'TX-QN-INIT-001'
        }
    });

    const reg2 = await prisma.registration.create({
        data: {
            userId: userCipher.id,
            eventId: createdEvents[0].id,
            status: 'CONFIRMED',
            ticketId: 'QN-2026-01002-B7C4'
        }
    });
    await prisma.payment.create({
        data: {
            registrationId: reg2.id,
            amount: 100,
            status: 'PAID',
            transactionId: 'TX-QN-INIT-002'
        }
    });

    // Event 2 (AI & Robotics Workshop - capacity 2):
    // Nova & Cipher take the 2 slots, Solaris is WAITLISTED
    const reg3 = await prisma.registration.create({
        data: {
            userId: userNova.id,
            eventId: createdEvents[2].id,
            status: 'CONFIRMED',
            ticketId: 'QN-2026-03001-C3E1'
        }
    });
    await prisma.payment.create({
        data: {
            registrationId: reg3.id,
            amount: 0,
            status: 'PAID',
            transactionId: 'TX-QN-FREE-003'
        }
    });

    const reg4 = await prisma.registration.create({
        data: {
            userId: userCipher.id,
            eventId: createdEvents[2].id,
            status: 'CONFIRMED',
            ticketId: 'QN-2026-03002-D5A8'
        }
    });
    await prisma.payment.create({
        data: {
            registrationId: reg4.id,
            amount: 0,
            status: 'PAID',
            transactionId: 'TX-QN-FREE-004'
        }
    });

    // Waitlisted participant: Agent Solaris
    const reg5Waitlist = await prisma.registration.create({
        data: {
            userId: userSolaris.id,
            eventId: createdEvents[2].id,
            status: 'WAITLISTED',
            ticketId: null
        }
    });

    // Cancelled Event (Event 8): Echo was registered, now CANCELLED with REFUND_PENDING
    const reg6Cancelled = await prisma.registration.create({
        data: {
            userId: userEcho.id,
            eventId: createdEvents[8].id,
            status: 'CANCELLED',
            ticketId: 'QN-2026-09001-X999',
            cancelledAt: new Date()
        }
    });
    await prisma.payment.create({
        data: {
            registrationId: reg6Cancelled.id,
            amount: 60,
            status: 'REFUND_PENDING',
            transactionId: 'TX-QN-REF-005',
            refundDate: new Date()
        }
    });

    console.log('✓ Seeded Registrations, Tickets, and Priority Waitlist');

    // 5. Seed Event History records (Anomaly audit trail)
    await prisma.eventHistory.createMany({
        data: [
            {
                eventId: createdEvents[0].id,
                changedBy: admin.id,
                changeType: 'VENUE_CHANGE',
                oldValue: 'Main Auditorium',
                newValue: 'Sector 7 Auditorium'
            },
            {
                eventId: createdEvents[2].id,
                changedBy: admin.id,
                changeType: 'CAPACITY_CHANGE',
                oldValue: '1',
                newValue: '2'
            },
            {
                eventId: createdEvents[8].id,
                changedBy: admin.id,
                changeType: 'EVENT_CANCELLATION',
                oldValue: 'UPCOMING',
                newValue: 'CANCELLED'
            }
        ]
    });

    // 6. Seed In-app Notifications
    await prisma.notification.createMany({
        data: [
            {
                userId: userNova.id,
                eventId: createdEvents[0].id,
                type: 'REGISTRATION_CONFIRMED',
                message: 'Your pass for Quantum Tech Summit has been issued. Ticket: QN-2026-01001-A9F2',
                isRead: true
            },
            {
                userId: userNova.id,
                eventId: createdEvents[0].id,
                type: 'VENUE_CHANGED',
                message: 'The venue for Quantum Tech Summit has changed from Main Auditorium to Sector 7 Auditorium.',
                isRead: false
            },
            {
                userId: userSolaris.id,
                eventId: createdEvents[2].id,
                type: 'WAITLISTED',
                message: 'AI & Robotics Workshop is currently at capacity. You are placed on position #1 of the waitlist.',
                isRead: false
            },
            {
                userId: userEcho.id,
                eventId: createdEvents[8].id,
                type: 'EVENT_CANCELLED',
                message: 'Quantum Cryptography Symposium has been cancelled. Your registration has been cancelled and your refund is being processed.',
                isRead: false
            }
        ]
    });

    // 7. Seed Audit Logs
    await prisma.auditLog.createMany({
        data: [
            {
                userId: admin.id,
                action: 'SYSTEM_BOOTSTRAP',
                entity: 'System',
                details: 'Quantum Net Telemetry & Event System initialized successfully.'
            },
            {
                userId: admin.id,
                action: 'CHANGE_VENUE',
                entity: 'Event',
                entityId: createdEvents[0].id,
                details: 'Admin updated venue for Quantum Tech Summit to Sector 7 Auditorium.'
            },
            {
                userId: admin.id,
                action: 'CANCEL_EVENT',
                entity: 'Event',
                entityId: createdEvents[8].id,
                details: 'Cancelled Quantum Cryptography Symposium. Notified affected participant(s).'
            }
        ]
    });

    console.log('⚡ Quantum Net Cosmic Seed Sequence Completed Successfully!');
}

if (require.main === module) {
    seed()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Seed Error:', err);
            process.exit(1);
        });
}

module.exports = { seed };
