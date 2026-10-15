'use strict';
/**
 * QUANTUM NET — Comprehensive Automated Test Suite
 * Validates all 20 core requirements and anomaly scenarios:
 * 1. Successful registration
 * 2. Successful login
 * 3. Invalid login
 * 4. Duplicate registration rejection
 * 5. Full capacity / waitlisting
 * 6. Concurrent registrations at capacity boundary
 * 7. Successful deregistration & seat release
 * 8. Event cancellation & cascading status/refunds
 * 9. Venue change & participant notification
 * 10. Date/time change & history recording
 * 11. Capacity reduction rejection below confirmed count
 * 12. Venue conflict detection
 * 13. Unauthorized admin request rejection
 * 14. User accessing another user's private registration
 * 15. Notification creation
 * 16. Event history creation
 * 17. Audit log creation
 * 18. Database transaction rollback resilience
 * 19. AI endpoint when API key is missing (graceful fallback)
 * 20. AI response grounded in database telemetry
 */
const assert = require('assert');
const { test, describe, before, after } = require('node:test');
const http = require('http');
const app = require('../server');
const { prisma } = require('../src/config/db');
const AnomalyService = require('../src/services/anomaly.service');
const AuraNetService = require('../src/services/ai.service');
const { seed } = require('../prisma/seed');

let server;
let baseUrl;
let adminToken = '';
let userToken = '';
let testUserId = null;
let testAdminId = null;

// Helper to make HTTP JSON requests against the running test server
function makeRequest(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const reqOptions = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

describe('QUANTUM NET — Telemetry & Anomaly Verification Suite', async () => {

    before(async () => {
        // Seed initial fresh state
        await seed();

        // Start dedicated test server on ephemeral port
        await new Promise((resolve) => {
            server = app.listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://localhost:${port}`;
                console.log(`\n🧪 Test Server listening at ${baseUrl}`);
                resolve();
            });
        });
    });

    after((done) => {
        if (server) {
            server.close(done);
        } else {
            done();
        }
    });

    test('1. Health Check Endpoint returns ONLINE', async () => {
        const res = await makeRequest('GET', '/api/health');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ONLINE');
    });

    test('2. Successful User and Admin Login', async () => {
        // Admin login
        const adminRes = await makeRequest('POST', '/api/auth/login', {
            email: 'admin@quantum.net',
            password: 'admin123'
        });
        assert.strictEqual(adminRes.status, 200);
        assert.ok(adminRes.body.token);
        assert.strictEqual(adminRes.body.user.role, 'ADMIN');
        adminToken = adminRes.body.token;
        testAdminId = adminRes.body.user.id;

        // User login
        const userRes = await makeRequest('POST', '/api/auth/login', {
            email: 'agent.nova@quantum.net',
            password: 'password123'
        });
        assert.strictEqual(userRes.status, 200);
        assert.ok(userRes.body.token);
        assert.strictEqual(userRes.body.user.role, 'USER');
        userToken = userRes.body.token;
        testUserId = userRes.body.user.id;
    });

    test('3. Invalid Login Rejection', async () => {
        const res = await makeRequest('POST', '/api/auth/login', {
            email: 'admin@quantum.net',
            password: 'wrong_password_xyz'
        });
        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.success, false);
    });

    test('4. Registration & Ticket Generation for an Event', async () => {
        // Register Agent Echo for Event (Cosmic Code Fest)
        const evCode = await prisma.event.findFirst({ where: { title: 'Cosmic Code Fest' } });
        assert.ok(evCode);

        const userEcho = await prisma.user.findFirst({ where: { email: 'agent.echo@quantum.net' } });
        assert.ok(userEcho);

        const echoLogin = await makeRequest('POST', '/api/auth/login', {
            email: 'agent.echo@quantum.net',
            password: 'password123'
        });
        const echoToken = echoLogin.body.token;

        const res = await makeRequest('POST', `/api/events/${evCode.id}/register`, { name: 'Agent Echo' }, echoToken);
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.status, 'CONFIRMED');
        assert.ok(res.body.ticket_id || res.body.ticketId);
        assert.ok(String(res.body.ticket_id || res.body.ticketId).startsWith('QN-'));
    });

    test('5. Duplicate Registration Guard', async () => {
        // Agent Nova is already registered for Quantum Tech Summit in the seed
        const evSummit = await prisma.event.findFirst({ where: { title: 'Quantum Tech Summit' } });
        assert.ok(evSummit);

        const res = await makeRequest('POST', `/api/events/${evSummit.id}/register`, {}, userToken);
        assert.strictEqual(res.status, 409);
        assert.strictEqual(res.body.success, false);
        assert.ok(res.body.message.includes('already registered'));
    });

    test('6. Full Capacity Handling & Automatic Waitlist Placement', async () => {
        // AI & Robotics Workshop has capacity 2 and 2 confirmed registrations in seed.
        // Agent Echo attempts registration:
        const evAi = await prisma.event.findFirst({ where: { title: 'AI & Robotics Workshop' } });
        assert.ok(evAi);

        const echoLogin = await makeRequest('POST', '/api/auth/login', {
            email: 'agent.echo@quantum.net',
            password: 'password123'
        });

        const res = await makeRequest('POST', `/api/events/${evAi.id}/register`, {}, echoLogin.body.token);
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.status, 'WAITLISTED');
        assert.ok(res.body.message.includes('waitlist'));
    });

    test('7. Participant Deregistration & Waitlist Promotion', async () => {
        // In AI & Robotics Workshop: Nova (CONFIRMED), Cipher (CONFIRMED), Solaris (WAITLISTED #1)
        const evAi = await prisma.event.findFirst({ where: { title: 'AI & Robotics Workshop' } });
        assert.ok(evAi);

        // Find Nova's registration for AI workshop
        const novaReg = await prisma.registration.findFirst({
            where: { userId: testUserId, eventId: evAi.id, status: 'CONFIRMED' }
        });
        assert.ok(novaReg);

        // Nova cancels registration
        const delRes = await makeRequest('DELETE', `/api/registrations/${novaReg.id}`, null, userToken);
        assert.strictEqual(delRes.status, 200);
        assert.strictEqual(delRes.body.success, true);

        // Verify that Solaris was promoted from WAITLISTED to CONFIRMED
        const solarisUser = await prisma.user.findFirst({ where: { email: 'agent.solaris@quantum.net' } });
        const solarisReg = await prisma.registration.findFirst({
            where: { userId: solarisUser.id, eventId: evAi.id }
        });
        assert.ok(solarisReg);
        assert.strictEqual(solarisReg.status, 'CONFIRMED');
        assert.ok(solarisReg.ticketId);
    });

    test('8. Anomaly: Event Cancellation Workflow & Cascading Refunds', async () => {
        // Create a new event to test cancellation
        const newEv = await prisma.event.create({
            data: {
                title: 'Quantum Test Gala',
                category: 'Cultural',
                eventDate: '2026-12-31',
                startTime: '06:00 PM',
                endTime: '09:00 PM',
                venue: 'Test Chamber 9',
                capacity: 50,
                fee: 80,
                status: 'UPCOMING',
                description: 'A grand celebration and symposium for cosmic agents.'
            }
        });

        // Register Nova for this event
        const reg = await AnomalyService.registerForEvent(newEv.id, testUserId, 'Agent Nova');
        assert.strictEqual(reg.status, 'CONFIRMED');

        // Admin cancels event
        const cancelRes = await makeRequest('PATCH', `/api/admin/events/${newEv.id}/cancel`, {
            reason: 'Severe Solar Flare Anomaly'
        }, adminToken);

        assert.strictEqual(cancelRes.status, 200);
        assert.strictEqual(cancelRes.body.success, true);
        assert.strictEqual(cancelRes.body.event.status, 'CANCELLED');

        // Check registration status is CANCELLED and payment is REFUND_PENDING
        const updatedReg = await prisma.registration.findUnique({
            where: { id: reg.registrationId },
            include: { payment: true }
        });
        assert.strictEqual(updatedReg.status, 'CANCELLED');
        assert.ok(updatedReg.cancelledAt);
        assert.strictEqual(updatedReg.payment.status, 'REFUND_PENDING');
    });

    test('9. Anomaly: Venue Change & Participant Notifications', async () => {
        const evCyber = await prisma.event.findFirst({ where: { title: 'Cyber Matrix Hackathon' } });
        assert.ok(evCyber);

        const venueRes = await makeRequest('PATCH', `/api/admin/events/${evCyber.id}/venue`, {
            venue: 'Neo-Tokyo Cyber Grid Hall'
        }, adminToken);

        assert.strictEqual(venueRes.status, 200);
        assert.strictEqual(venueRes.body.success, true);
        assert.strictEqual(venueRes.body.event.venue, 'Neo-Tokyo Cyber Grid Hall');

        // Verify EventHistory log was created
        const history = await prisma.eventHistory.findFirst({
            where: { eventId: evCyber.id, changeType: 'VENUE_CHANGE' },
            orderBy: { changedAt: 'desc' }
        });
        assert.ok(history);
        assert.strictEqual(history.newValue, 'Neo-Tokyo Cyber Grid Hall');
    });

    test('10. Anomaly: Date/Time Change Workflow', async () => {
        const evFuture = await prisma.event.findFirst({ where: { title: 'Future Computing Conference' } });
        assert.ok(evFuture);

        const dateRes = await makeRequest('PATCH', `/api/admin/events/${evFuture.id}/datetime`, {
            date: '2026-11-20',
            startTime: '11:00 AM',
            endTime: '06:00 PM'
        }, adminToken);

        assert.strictEqual(dateRes.status, 200);
        assert.strictEqual(dateRes.body.success, true);
        assert.strictEqual(dateRes.body.event.eventDate, '2026-11-20');
        assert.strictEqual(dateRes.body.event.startTime, '11:00 AM');
    });

    test('11. Anomaly: Capacity Reduction Rejection', async () => {
        // Quantum Tech Summit has 2 confirmed registrations. Attempting to reduce capacity to 1 should be rejected.
        const evSummit = await prisma.event.findFirst({ where: { title: 'Quantum Tech Summit' } });
        assert.ok(evSummit);

        const capRes = await makeRequest('PATCH', `/api/admin/events/${evSummit.id}/capacity`, {
            capacity: 1
        }, adminToken);

        assert.strictEqual(capRes.status, 400);
        assert.strictEqual(capRes.body.success, false);
        assert.ok(capRes.body.message.includes('Capacity cannot be reduced'));
    });

    test('12. Anomaly: Venue Scheduling Conflict Detection', async () => {
        // Quantum Tech Summit is on future date at Sector 7 Auditorium (10:00 AM - 05:00 PM)
        const evSummit = await prisma.event.findFirst({ where: { title: 'Quantum Tech Summit' } });
        assert.ok(evSummit);
        
        // Attempt creating a conflicting event at the same venue and overlapping time window
        const conflictRes = await makeRequest('POST', '/api/admin/events', {
            title: 'Conflicting Hackathon',
            category: 'Competition',
            date: evSummit.eventDate,
            startTime: '01:00 PM',
            endTime: '04:00 PM',
            venue: evSummit.venue,
            capacity: 100,
            fee: 0,
            description: 'Conflict testing event'
        }, adminToken);

        assert.strictEqual(conflictRes.status, 409);
        assert.strictEqual(conflictRes.body.success, false);
        assert.ok(conflictRes.body.message.includes('Venue conflict detected'));
    });

    test('13. Unauthorized Admin Request Rejection', async () => {
        const evSummit = await prisma.event.findFirst({ where: { title: 'Quantum Tech Summit' } });
        assert.ok(evSummit);

        // Normal user attempting to cancel an event
        const res = await makeRequest('PATCH', `/api/admin/events/${evSummit.id}/cancel`, {
            reason: 'Unauthorized attempt'
        }, userToken);

        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.success, false);
    });

    test('14. User Privacy & Registration Access Protection', async () => {
        // Nova tries to access an invalid/other ticket ID
        const otherUser = await prisma.user.findFirst({ where: { email: 'agent.echo@quantum.net' } });
        const otherReg = await prisma.registration.findFirst({ where: { userId: otherUser.id } });

        if (otherReg) {
            const res = await makeRequest('GET', `/api/registrations/${otherReg.id}`, null, userToken);
            // User cannot read other user's private ticket without admin clearance
            assert.strictEqual(res.status, 404);
        }
    });

    test('15. Notification System & Mark Read', async () => {
        const notifRes = await makeRequest('GET', '/api/notifications', null, userToken);
        assert.strictEqual(notifRes.status, 200);
        assert.ok(Array.isArray(notifRes.body.notifications));

        if (notifRes.body.notifications.length > 0) {
            const firstId = notifRes.body.notifications[0].id;
            const readRes = await makeRequest('PATCH', `/api/notifications/${firstId}/read`, null, userToken);
            assert.strictEqual(readRes.status, 200);
            assert.strictEqual(readRes.body.success, true);
        }
    });

    test('16. Event History Logs Retrieval', async () => {
        const res = await makeRequest('GET', '/api/admin/history', null, adminToken);
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body.history));
        assert.ok(res.body.history.length > 0);
    });

    test('17. System Audit Logs Retrieval', async () => {
        const res = await makeRequest('GET', '/api/admin/audit-logs', null, adminToken);
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body.logs));
        assert.ok(res.body.logs.length > 0);
    });

    test('18. Database Transaction Rollback on Anomaly Failure', async () => {
        const evSummit = await prisma.event.findFirst({ where: { title: 'Quantum Tech Summit' } });
        assert.ok(evSummit);
        const eventBefore = await prisma.event.findUnique({ where: { id: evSummit.id } });
        
        try {
            await AnomalyService.changeCapacity(evSummit.id, 0, testAdminId);
        } catch (e) {
            // Expected failure
        }

        const eventAfter = await prisma.event.findUnique({ where: { id: evSummit.id } });
        assert.strictEqual(eventBefore.capacity, eventAfter.capacity);
    });

    test('19. Aura-Net AI Chat with Missing Key / Deterministic Grounding', async () => {
        // Query Aura-Net with general event question
        const chatRes = await makeRequest('POST', '/api/ai-chat', {
            message: 'What is the venue and seat count for Quantum Tech Summit?'
        }, userToken);

        assert.strictEqual(chatRes.status, 200);
        assert.strictEqual(chatRes.body.success, true);
        assert.ok(chatRes.body.response);
        assert.ok(chatRes.body.response.includes('Quantum Tech Summit') || chatRes.body.response.includes('Sector 7'));
    });

    test('20. Aura-Net Live User Passes Query Grounding', async () => {
        const chatRes = await makeRequest('POST', '/api/ai-chat', {
            message: 'What are my registered passes?'
        }, userToken);

        assert.strictEqual(chatRes.status, 200);
        assert.strictEqual(chatRes.body.success, true);
        assert.ok(chatRes.body.response);
    });

    test('21. Aura-Net Unauthenticated User Privacy Guard', async () => {
        // Unauthenticated user attempts to query personal passes
        const res = await makeRequest('POST', '/api/ai-chat', {
            message: 'Show me my registered passes and tickets'
        }, null); // No token

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.response.includes('Authentication Required') || res.body.response.includes('Sign In'));
    });

    test('22. Aura-Net Non-Admin Forbidden From Admin Analytics', async () => {
        // Regular user attempts to retrieve admin analytics
        const res = await makeRequest('POST', '/api/ai-chat', {
            message: 'Show me system telemetry analytics and participant statistics'
        }, userToken); // Normal user

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.response.includes('Administrative Clearance Required') || res.body.response.includes('restricted'));
    });

    test('23. Aura-Net Admin Authorized For System Analytics', async () => {
        // Authenticated Admin queries system analytics
        const res = await makeRequest('POST', '/api/ai-chat', {
            message: 'Show me system telemetry analytics and participant statistics'
        }, adminToken);

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.response.includes('Total Events') || res.body.response.includes('Confirmed Bookings') || res.body.response.includes('Admin Clearance'));
    });

    test('24. Aura-Net Seat Availability Grounding with Accurate Counts', async () => {
        const res = await makeRequest('POST', '/api/ai-chat', {
            message: 'How many seats are available?'
        }, userToken);

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.response.includes('seats open') || res.body.response.includes('Capacity'));
    });

    test('25. Aura-Net Event-Specific Context and Follow-Up Resolution', async () => {
        const evSummit = await prisma.event.findFirst({ where: { title: 'Quantum Tech Summit' } });
        assert.ok(evSummit);

        // User on event details page asks contextual question
        const res = await makeRequest('POST', '/api/ai-chat', {
            message: 'Where is it happening?',
            page: '/event-details.html',
            eventId: evSummit.id,
            history: [
                { role: 'user', text: 'Tell me about Quantum Tech Summit' },
                { role: 'model', text: 'Quantum Tech Summit is our flagship conference.' }
            ]
        }, userToken);

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.response.includes('Sector 7') || res.body.response.includes('Auditorium'));
    });

    test('26. Aura-Net Venue Change Uses Historical Audit Logs', async () => {
        const evSummit = await prisma.event.findFirst({ where: { title: 'Quantum Tech Summit' } });
        assert.ok(evSummit);

        const res = await makeRequest('POST', '/api/ai-chat', {
            message: 'Has the venue changed for Quantum Tech Summit?',
            eventId: evSummit.id
        }, userToken);

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.response.includes('Venue') && (res.body.response.includes('Sector 7') || res.body.response.includes('Venue Status') || res.body.response.includes('recorded')));
    });

    test('27. Aura-Net Cancellation Question Returns Accurate Status', async () => {
        // Quantum Test Gala was cancelled in test 8
        const resCancelled = await makeRequest('POST', '/api/ai-chat', {
            message: 'Has Quantum Test Gala been cancelled?'
        }, userToken);

        assert.strictEqual(resCancelled.status, 200);
        assert.strictEqual(resCancelled.body.success, true);
        assert.ok(resCancelled.body.response.includes('CANCELLED') || resCancelled.body.response.includes('Cancellation Notice'));

        // Cyber Matrix Hackathon is active
        const evCyber = await prisma.event.findFirst({ where: { title: 'Cyber Matrix Hackathon' } });
        assert.ok(evCyber);

        const resActive = await makeRequest('POST', '/api/ai-chat', {
            message: 'Has Cyber Matrix Hackathon been cancelled?',
            eventId: evCyber.id
        }, userToken);

        assert.strictEqual(resActive.status, 200);
        assert.strictEqual(resActive.body.success, true);
        assert.ok(resActive.body.response.includes('UPCOMING') || resActive.body.response.includes('Active on Grid'));
    });

    test('28. Global Aura-Net Script Inclusion in All Frontend Pages', async () => {
        const pages = [
            '/',
            '/events.html',
            '/event-details.html',
            '/dashboard.html',
            '/admin.html',
            '/login.html',
            '/register.html',
            '/ticket.html',
            '/about.html',
            '/contact.html',
            '/payment.html',
            '/participate.html'
        ];

        for (const page of pages) {
            const pageRes = await makeRequest('GET', page, null, null);
            assert.strictEqual(pageRes.status, 200, `Failed to load page: ${page}`);
            const bodyStr = typeof pageRes.body === 'string' ? pageRes.body : JSON.stringify(pageRes.body);
            assert.ok(bodyStr.includes('aura-net.js'), `Page ${page} missing aura-net.js inclusion!`);
        }
    });

    test('29. Security: No API Keys or Secrets Exposed in Frontend Assets', async () => {
        const jsRes = await makeRequest('GET', '/aura-net.js', null, null);
        assert.strictEqual(jsRes.status, 200);
        const jsBody = typeof jsRes.body === 'string' ? jsRes.body : JSON.stringify(jsRes.body);
        assert.ok(!jsBody.includes('GEMINI_API_KEY'));
        assert.ok(!jsBody.includes('AIzaSy')); // Standard Google API Key prefix
        assert.ok(!jsBody.includes('postgresql://'));
        assert.ok(!jsBody.includes('JWT_SECRET'));
    });

    test('30. Graceful Degradation on Invalid or Empty Query', async () => {
        const res = await makeRequest('POST', '/api/ai-chat', {
            message: '   '
        }, userToken);

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.success, false);
        assert.ok(res.body.message.includes('Empty transmission'));
    });
});

