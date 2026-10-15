'use strict';
/**
 * QUANTUM NET — Hybrid Data Layer
 * Connects natively to PostgreSQL via Prisma ORM when available,
 * and includes a zero-config fallback storage engine to ensure 100% uptime
 * and seamless out-of-the-box demonstration.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

let prismaClient = null;
let usePrisma = false;

try {
    const { PrismaClient } = require('@prisma/client');
    prismaClient = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
    });
    // Test if connection works (asynchronously verified on first query)
    usePrisma = true;
} catch (e) {
    usePrisma = false;
}

// ---------- Smart In-Memory / File Persistent Store (Zero-Setup Fallback) ----------
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getDefaultStore() {
    const adminHash = bcrypt.hashSync('admin123', 10);
    const userHash = bcrypt.hashSync('password123', 10);

    const futureDate = (days) => {
        const d = new Date(Date.now() + days * 86400000);
        return d.toISOString().slice(0, 10);
    };

    return {
        users: [
            { id: 1, name: 'Root Controller', email: 'admin@quantum.net', passwordHash: adminHash, role: 'ADMIN', createdAt: new Date().toISOString() },
            { id: 2, name: 'Agent Nova', email: 'agent.nova@quantum.net', passwordHash: userHash, role: 'USER', createdAt: new Date().toISOString() },
            { id: 3, name: 'Agent Cipher', email: 'agent.cipher@quantum.net', passwordHash: userHash, role: 'USER', createdAt: new Date().toISOString() },
            { id: 4, name: 'Agent Solaris', email: 'agent.solaris@quantum.net', passwordHash: userHash, role: 'USER', createdAt: new Date().toISOString() },
            { id: 5, name: 'Agent Echo', email: 'agent.echo@quantum.net', passwordHash: userHash, role: 'USER', createdAt: new Date().toISOString() }
        ],
        events: [
            {
                id: 1, title: 'Quantum Tech Summit', category: 'Technology', eventDate: futureDate(10),
                startTime: '10:00 AM', endTime: '05:00 PM', venue: 'Sector 7 Auditorium', capacity: 250, fee: 100,
                status: 'UPCOMING', description: 'Flagship summit on neural networks, topological quantum computing, and the next frontier of intelligent planetary systems.',
                createdBy: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            },
            {
                id: 2, title: 'Cyber Matrix Hackathon', category: 'Competition', eventDate: futureDate(12),
                startTime: '09:00 AM', endTime: '09:00 AM', venue: 'Cyber Lab, Block B', capacity: 120, fee: 150,
                status: 'UPCOMING', description: 'A 24-hour high-octane engineering hackathon. Deploy real-time mesh prototypes and autonomous agent telemetry.',
                createdBy: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            },
            {
                id: 3, title: 'AI & Robotics Workshop', category: 'Workshop', eventDate: futureDate(14),
                startTime: '01:00 PM', endTime: '06:00 PM', venue: 'Robotics Foundry Hall', capacity: 2, fee: 0,
                status: 'UPCOMING', description: 'Hands-on hardware interfacing with neural microcontrollers and autonomous bipedal kinematic simulations.',
                createdBy: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            },
            {
                id: 4, title: 'Future Computing Conference', category: 'Technology', eventDate: futureDate(15),
                startTime: '09:30 AM', endTime: '04:30 PM', venue: 'Quantum Dome Alpha', capacity: 300, fee: 120,
                status: 'UPCOMING', description: 'Exploring photonic processors, sub-atomic storage matrices, and high-throughput cryptographic verification protocols.',
                createdBy: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            },
            {
                id: 5, title: 'Cosmic Code Fest', category: 'Competition', eventDate: futureDate(18),
                startTime: '11:00 AM', endTime: '07:00 PM', venue: 'Orbital Arena 3', capacity: 80, fee: 75,
                status: 'UPCOMING', description: 'Competitive algorithmic speed-coding and dynamic optimization challenges across distributed quantum simulations.',
                createdBy: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            },
            {
                id: 6, title: 'Cyber Security Workshop', category: 'Workshop', eventDate: futureDate(20),
                startTime: '10:00 AM', endTime: '02:00 PM', venue: 'Network Defense Hub', capacity: 50, fee: 50,
                status: 'UPCOMING', description: 'Zero-trust architecture, side-channel attack countermeasures, and post-quantum asymmetric encryption.',
                createdBy: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            },
            {
                id: 7, title: 'Neon Nights Cultural Gala', category: 'Cultural', eventDate: futureDate(22),
                startTime: '06:00 PM', endTime: '11:00 PM', venue: 'Open Air Amphitheatre', capacity: 500, fee: 40,
                status: 'UPCOMING', description: 'Sensory laser exhibits, holographic theater, and live electronic ambient performances across campus sectors.',
                createdBy: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            },
            {
                id: 8, title: 'Stellar Stage: Battle of Bands', category: 'Cultural', eventDate: futureDate(25),
                startTime: '05:00 PM', endTime: '10:30 PM', venue: 'Main Soundstage', capacity: 400, fee: 80,
                status: 'UPCOMING', description: 'Inter-sector musical battle featuring synth-rock ensembles and cyber-acoustic compositions.',
                createdBy: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            },
            {
                id: 9, title: 'Quantum Cryptography Symposium', category: 'Technology', eventDate: futureDate(28),
                startTime: '02:00 PM', endTime: '06:00 PM', venue: 'Old Research Vault', capacity: 50, fee: 60,
                status: 'CANCELLED', description: 'Deep dive into lattice-based cryptography and quantum key distribution channels (Cancelled due to maintenance).',
                createdBy: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            }
        ],
        registrations: [
            { id: 1, userId: 2, eventId: 1, status: 'CONFIRMED', ticketId: 'QN-2026-01001-A9F2', registrationDate: new Date().toISOString(), cancelledAt: null },
            { id: 2, userId: 3, eventId: 1, status: 'CONFIRMED', ticketId: 'QN-2026-01002-B7C4', registrationDate: new Date().toISOString(), cancelledAt: null },
            { id: 3, userId: 2, eventId: 3, status: 'CONFIRMED', ticketId: 'QN-2026-03001-C3E1', registrationDate: new Date().toISOString(), cancelledAt: null },
            { id: 4, userId: 3, eventId: 3, status: 'CONFIRMED', ticketId: 'QN-2026-03002-D5A8', registrationDate: new Date().toISOString(), cancelledAt: null },
            { id: 5, userId: 4, eventId: 3, status: 'WAITLISTED', ticketId: null, registrationDate: new Date().toISOString(), cancelledAt: null },
            { id: 6, userId: 5, eventId: 9, status: 'CANCELLED', ticketId: 'QN-2026-09001-X999', registrationDate: new Date().toISOString(), cancelledAt: new Date().toISOString() }
        ],
        payments: [
            { id: 1, registrationId: 1, amount: 100, status: 'PAID', transactionId: 'TX-QN-INIT-001', paymentDate: new Date().toISOString(), refundDate: null },
            { id: 2, registrationId: 2, amount: 100, status: 'PAID', transactionId: 'TX-QN-INIT-002', paymentDate: new Date().toISOString(), refundDate: null },
            { id: 3, registrationId: 3, amount: 0, status: 'PAID', transactionId: 'TX-QN-FREE-003', paymentDate: new Date().toISOString(), refundDate: null },
            { id: 4, registrationId: 4, amount: 0, status: 'PAID', transactionId: 'TX-QN-FREE-004', paymentDate: new Date().toISOString(), refundDate: null },
            { id: 5, registrationId: 6, amount: 60, status: 'REFUND_PENDING', transactionId: 'TX-QN-REF-005', paymentDate: new Date().toISOString(), refundDate: new Date().toISOString() }
        ],
        eventHistory: [
            { id: 1, eventId: 1, changedBy: 1, changeType: 'VENUE_CHANGE', oldValue: 'Main Auditorium', newValue: 'Sector 7 Auditorium', changedAt: new Date().toISOString() },
            { id: 2, eventId: 3, changedBy: 1, changeType: 'CAPACITY_CHANGE', oldValue: '1', newValue: '2', changedAt: new Date().toISOString() },
            { id: 3, eventId: 9, changedBy: 1, changeType: 'EVENT_CANCELLATION', oldValue: 'UPCOMING', newValue: 'CANCELLED', changedAt: new Date().toISOString() }
        ],
        notifications: [
            { id: 1, userId: 2, eventId: 1, type: 'REGISTRATION_CONFIRMED', message: 'Your pass for Quantum Tech Summit has been issued. Ticket: QN-2026-01001-A9F2', isRead: true, createdAt: new Date().toISOString() },
            { id: 2, userId: 2, eventId: 1, type: 'VENUE_CHANGED', message: 'The venue for Quantum Tech Summit has changed from Main Auditorium to Sector 7 Auditorium.', isRead: false, createdAt: new Date().toISOString() },
            { id: 3, userId: 4, eventId: 3, type: 'WAITLISTED', message: 'AI & Robotics Workshop is currently at capacity. You are placed on position #1 of the waitlist.', isRead: false, createdAt: new Date().toISOString() },
            { id: 4, userId: 5, eventId: 9, type: 'EVENT_CANCELLED', message: 'Quantum Cryptography Symposium has been cancelled. Your registration has been cancelled and your refund is being processed.', isRead: false, createdAt: new Date().toISOString() }
        ],
        auditLogs: [
            { id: 1, userId: 1, action: 'SYSTEM_BOOTSTRAP', entity: 'System', details: 'Quantum Net Telemetry & Event System initialized successfully.', timestamp: new Date().toISOString() },
            { id: 2, userId: 1, action: 'CHANGE_VENUE', entity: 'Event', entityId: 1, details: 'Admin updated venue for Quantum Tech Summit to Sector 7 Auditorium.', timestamp: new Date().toISOString() },
            { id: 3, userId: 1, action: 'CANCEL_EVENT', entity: 'Event', entityId: 9, details: 'Cancelled Quantum Cryptography Symposium. Notified affected participant(s).', timestamp: new Date().toISOString() }
        ],
        messages: []
    };
}

let store = null;
function loadStore() {
    if (store) return store;
    if (fs.existsSync(DATA_FILE)) {
        try {
            store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            return store;
        } catch (e) {}
    }
    store = getDefaultStore();
    saveStore();
    return store;
}

function saveStore() {
    if (store) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
    }
}

// Fallback Model Emulators compatible with Prisma queries
const createFallbackPrisma = () => {
    const s = loadStore();

    const matchesWhere = (item, where = {}) => {
        for (const [k, v] of Object.entries(where)) {
            if (k === 'OR' && Array.isArray(v)) {
                const orMatch = v.some(subWhere => matchesWhere(item, subWhere));
                if (!orMatch) return false;
                continue;
            }
            if (k === 'AND' && Array.isArray(v)) {
                const andMatch = v.every(subWhere => matchesWhere(item, subWhere));
                if (!andMatch) return false;
                continue;
            }
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                if ('contains' in v) {
                    const itemVal = String(item[k] || '').toLowerCase();
                    if (!itemVal.includes(String(v.contains).toLowerCase())) return false;
                    continue;
                }
                if ('equals' in v) {
                    const itemVal = String(item[k] || '').toLowerCase();
                    if (itemVal !== String(v.equals).toLowerCase()) return false;
                    continue;
                }
                if ('in' in v && Array.isArray(v.in)) {
                    if (!v.in.includes(item[k])) return false;
                    continue;
                }
                if ('not' in v) {
                    if (item[k] === v.not) return false;
                    continue;
                }
            }
            if (item[k] !== v) return false;
        }
        return true;
    };

    const countRegistrations = (eventId, status = 'CONFIRMED') => {
        return s.registrations.filter(r => r.eventId === Number(eventId) && r.status === status).length;
    };

    const buildModel = (tableName, idField = 'id') => ({
        findMany: async (args = {}) => {
            let list = s[tableName] || [];
            if (args.where) list = list.filter(item => matchesWhere(item, args.where));
            if (args.orderBy) {
                // simple sorting
                list = [...list].sort((a, b) => (b.id || 0) - (a.id || 0));
            }
            if (args.take) list = list.slice(0, args.take);

            // Hydrate relations
            return list.map(item => {
                const cloned = { ...item };
                if (tableName === 'events') {
                    cloned._count = { registrations: countRegistrations(item.id, 'CONFIRMED') };
                    if (args.include?.history) cloned.history = s.eventHistory.filter(h => h.eventId === item.id);
                }
                if (tableName === 'registrations') {
                    if (args.include?.event) cloned.event = s.events.find(e => e.id === item.eventId) || null;
                    if (args.include?.payment) cloned.payment = s.payments.find(p => p.registrationId === item.id) || null;
                    if (args.include?.user) cloned.user = s.users.find(u => u.id === item.userId) || null;
                }
                if (tableName === 'notifications') {
                    if (args.include?.event) cloned.event = s.events.find(e => e.id === item.eventId) || null;
                }
                if (tableName === 'eventHistory') {
                    if (args.include?.event) cloned.event = s.events.find(e => e.id === item.eventId) || null;
                    if (args.include?.user) cloned.user = s.users.find(u => u.id === item.changedBy) || null;
                }
                if (tableName === 'auditLogs') {
                    if (args.include?.user) cloned.user = s.users.find(u => u.id === item.userId) || null;
                }
                return cloned;
            });
        },
        findUnique: async (args = {}) => {
            const list = s[tableName] || [];
            const item = list.find(i => matchesWhere(i, args.where)) || null;
            if (!item) return null;
            const cloned = { ...item };
            if (tableName === 'events') {
                cloned._count = { registrations: countRegistrations(item.id, 'CONFIRMED') };
                if (args.include?.registrations) {
                    cloned.registrations = s.registrations.filter(r => r.eventId === item.id && (!args.include.registrations.where || matchesWhere(r, args.include.registrations.where)))
                        .map(r => ({ ...r, payment: s.payments.find(p => p.registrationId === r.id) || null }));
                }
                if (args.include?.history) cloned.history = s.eventHistory.filter(h => h.eventId === item.id);
            }
            if (tableName === 'registrations') {
                if (args.include?.event) cloned.event = s.events.find(e => e.id === item.eventId) || null;
                if (args.include?.payment) cloned.payment = s.payments.find(p => p.registrationId === item.id) || null;
                if (args.include?.user) cloned.user = s.users.find(u => u.id === item.userId) || null;
            }
            return cloned;
        },
        findFirst: async (args = {}) => {
            const list = s[tableName] || [];
            const item = list.find(i => matchesWhere(i, args.where)) || null;
            if (!item) return null;
            const cloned = { ...item };
            if (tableName === 'registrations') {
                if (args.include?.event) cloned.event = s.events.find(e => e.id === item.eventId) || null;
                if (args.include?.payment) cloned.payment = s.payments.find(p => p.registrationId === item.id) || null;
                if (args.include?.user) cloned.user = s.users.find(u => u.id === item.userId) || null;
            }
            return cloned;
        },
        create: async (args = {}) => {
            const list = s[tableName] = s[tableName] || [];
            const newId = list.length > 0 ? Math.max(...list.map(i => i.id || 0)) + 1 : 1;
            const newItem = { id: newId, ...args.data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            list.push(newItem);
            saveStore();
            return newItem;
        },
        createMany: async (args = {}) => {
            const list = s[tableName] = s[tableName] || [];
            let count = 0;
            for (const d of (args.data || [])) {
                const newId = list.length > 0 ? Math.max(...list.map(i => i.id || 0)) + 1 : 1;
                list.push({ id: newId, ...d, createdAt: new Date().toISOString(), timestamp: new Date().toISOString() });
                count++;
            }
            saveStore();
            return { count };
        },
        update: async (args = {}) => {
            const list = s[tableName] || [];
            const idx = list.findIndex(i => matchesWhere(i, args.where));
            if (idx === -1) throw new Error(`${tableName} item not found for update.`);
            list[idx] = { ...list[idx], ...args.data, updatedAt: new Date().toISOString() };
            saveStore();
            return list[idx];
        },
        updateMany: async (args = {}) => {
            const list = s[tableName] || [];
            let count = 0;
            for (let i = 0; i < list.length; i++) {
                if (matchesWhere(list[i], args.where)) {
                    list[i] = { ...list[i], ...args.data };
                    count++;
                }
            }
            saveStore();
            return { count };
        },
        upsert: async (args = {}) => {
            const list = s[tableName] = s[tableName] || [];
            const idx = list.findIndex(i => matchesWhere(i, args.where));
            if (idx !== -1) {
                list[idx] = { ...list[idx], ...(args.update || {}) };
                saveStore();
                return list[idx];
            } else {
                const newId = list.length > 0 ? Math.max(...list.map(i => i.id || 0)) + 1 : 1;
                const newItem = { id: newId, ...(args.create || {}) };
                list.push(newItem);
                saveStore();
                return newItem;
            }
        },
        delete: async (args = {}) => {
            const list = s[tableName] || [];
            const idx = list.findIndex(i => matchesWhere(i, args.where));
            if (idx === -1) throw new Error(`${tableName} item not found for deletion.`);
            const [deleted] = list.splice(idx, 1);
            saveStore();
            return deleted;
        },
        deleteMany: async (args = {}) => {
            if (!args.where || Object.keys(args.where).length === 0) {
                const count = (s[tableName] || []).length;
                s[tableName] = [];
                saveStore();
                return { count };
            }
            const before = (s[tableName] || []).length;
            s[tableName] = (s[tableName] || []).filter(item => !matchesWhere(item, args.where));
            saveStore();
            return { count: before - s[tableName].length };
        },
        count: async (args = {}) => {
            let list = s[tableName] || [];
            if (args.where) list = list.filter(item => matchesWhere(item, args.where));
            return list.length;
        },
        aggregate: async (args = {}) => {
            let list = s[tableName] || [];
            if (args.where) list = list.filter(item => matchesWhere(item, args.where));
            const sumAmount = list.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
            return { _sum: { amount: sumAmount } };
        }
    });

    const fallbackPrisma = {
        user: buildModel('users'),
        event: buildModel('events'),
        registration: buildModel('registrations'),
        payment: buildModel('payments'),
        eventHistory: buildModel('eventHistory'),
        notification: buildModel('notifications'),
        systemAlert: buildModel('systemAlerts'),
        auditLog: buildModel('auditLogs'),
        message: buildModel('messages'),
        $transaction: async (fn) => {
            return await fn(fallbackPrisma);
        }
    };

    return fallbackPrisma;
};

// Create the dynamic proxy that switches to Prisma when live, or fallback engine
const fallbackInstance = createFallbackPrisma();

let loggedFallbackNotice = false;
function notifyFallbackOnce(err) {
    if (!loggedFallbackNotice) {
        loggedFallbackNotice = true;
        console.log('🌌 [Quantum Net Data Layer] PostgreSQL server not connected at DATABASE_URL.');
        console.log('💾 [Quantum Net Data Layer] Active in resilient local persistence storage mode (data/store.json).');
        console.log('💡 [Quantum Net Data Layer] To connect PostgreSQL: start postgres, run "npx prisma migrate dev", and restart.');
    }
}

// Wrapper for Prisma models that catches connection errors and seamlessly calls fallback
function createModelProxy(modelName) {
    const fallbackModel = fallbackInstance[modelName];
    if (!fallbackModel) return undefined;

    return new Proxy(fallbackModel, {
        get(target, method) {
            return async (...args) => {
                if (usePrisma && prismaClient && prismaClient[modelName] && typeof prismaClient[modelName][method] === 'function') {
                    try {
                        return await prismaClient[modelName][method](...args);
                    } catch (err) {
                        if (err && (err.name === 'PrismaClientInitializationError' || String(err.message).includes('Can\'t reach database server') || String(err.message).includes('ECONNREFUSED'))) {
                            usePrisma = false;
                            notifyFallbackOnce(err);
                            return await fallbackModel[method](...args);
                        }
                        throw err;
                    }
                }
                return await fallbackModel[method](...args);
            };
        }
    });
}

const prismaProxy = new Proxy({}, {
    get(target, prop) {
        if (prop === '$transaction') {
            return async (fn) => {
                if (usePrisma && prismaClient && typeof prismaClient.$transaction === 'function') {
                    try {
                        return await prismaClient.$transaction(fn);
                    } catch (err) {
                        if (err && (err.name === 'PrismaClientInitializationError' || String(err.message).includes('Can\'t reach database server') || String(err.message).includes('ECONNREFUSED'))) {
                            usePrisma = false;
                            notifyFallbackOnce(err);
                            return await fallbackInstance.$transaction(fn);
                        }
                        throw err;
                    }
                }
                return await fallbackInstance.$transaction(fn);
            };
        }
        return createModelProxy(prop);
    }
});

module.exports = { prisma: prismaProxy };

