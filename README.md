# ⚡ QUANTUM NET
### Cosmic Event Management & AI Telemetry System

A full-stack, state-of-the-art event management, ticketing, and anomaly handling system with real database persistence, transactional integrity, and database-grounded AI telemetry assistance (Aura-Net).

---

## 🚀 Key Features

1. **User Authentication & Role-Based Access Control**:
   - `bcrypt` password hashing (salt rounds = 10)
   - Stateless JWT tokens (Bearer auth, 7-day expiry)
   - Distinct clearance levels: `USER` and `ADMIN`
2. **Cosmic Event Grid & Detailed Briefings**:
   - Search, category filter, live capacity badges, and real-time status indicators (`UPCOMING`, `ONGOING`, `COMPLETED`, `CANCELLED`).
3. **Transactional Registration & Cryptographic Ticketing**:
   - Atomic seat reservation preventing overbooking.
   - Unique generated pass codes: `QN-YYYY-XXXXX`.
   - Automatic priority waitlist queue when capacity is reached.
4. **Graceful Participant Deregistration**:
   - Soft cancellation storing `cancelledAt`.
   - Automated refund status update to `REFUND_PENDING`.
   - Automatic promotion and ticketing for the first eligible waitlisted participant.
5. **Anomaly & Event Change Engine (`anomaly.service.js`)**:
   - **Event Cancellation**: Cascading cancellation of confirmed tickets, refund initiation, participant broadcast, EventHistory & AuditLog records.
   - **Venue Changes**: Automated participant notification and venue conflict prevention.
   - **Schedule Changes**: Date/time modification with participant alerts.
   - **Capacity Inconsistency Guard**: Rejection of capacity reductions below confirmed bookings.
   - **Venue Conflict Prevention**: Blocking overlapping events in the same venue.
6. **In-App Telemetry Notifications**:
   - Dynamic user inbox for registration confirmations, venue changes, cancellations, waitlist promotions, and refund updates.
7. **Comprehensive Audit Logs & Event History**:
   - Complete audit trail of system operations and event modifications with old vs new values.
8. **Aura-Net AI Assistant (Google Gemini Grounded)**:
   - Queries live PostgreSQL telemetry before generating responses to eliminate AI hallucinations.
   - Responds to event availability, seat counts, venue updates, and participant pass inquiries.

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, Vanilla JavaScript, Tailwind CSS (Cosmic Cyberpunk UI) |
| **Backend** | Node.js, Express.js (Modular REST API) |
| **Database** | PostgreSQL, Prisma ORM |
| **Authentication** | bcryptjs, jsonwebtoken (JWT) |
| **AI Telemetry** | Google Gemini API (`@google/generative-ai`) |

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory (based on `.env.example`):

```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quantum_net?schema=public"
JWT_SECRET="quantum_net_super_secure_jwt_cosmic_secret_key_2026"
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

ADMIN_EMAIL=admin@quantum.net
ADMIN_PASSWORD=admin123
ADMIN_NAME=Root Admin
```

---

## 📦 Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Initialize Database with Prisma**:
   ```bash
   # Generate Prisma Client
   npx prisma generate

   # Push Schema to PostgreSQL
   npx prisma db push
   ```

3. **Seed Database with Cosmic Fest Data**:
   ```bash
   npm run seed
   ```
   *Seeds 1 Admin, 4 Agents, 9 Events (different categories, venues, full & cancelled events), registrations, waitlist queue, and audit logs.*

4. **Start Mainframe Server**:
   ```bash
   npm start
   # or development mode:
   npm run dev
   ```
   Server will be active at `http://localhost:3000`.

---

## 📡 REST API Reference

### Authentication
- `POST /api/auth/register` — Enroll new participant agent (JWT returned)
- `POST /api/auth/login` — Authenticate agent credentials
- `GET /api/auth/me` — Get current authenticated user profile
- `POST /api/auth/change-password` — Update user cipher key

### Event Nodes
- `GET /api/events` — List all events with search, category filtering, and live seat count
- `GET /api/events/:id` — Inspect event mission brief and user registration status

### Registrations & Ticketing
- `POST /api/events/:id/register` — Register for event (or join waitlist if full)
- `GET /api/my-registrations` — Fetch caller's authorized passes and tickets
- `GET /api/registrations/:id` — Inspect specific pass
- `DELETE /api/registrations/:id` — Cancel registration, trigger refund, promote waitlist
- `POST /api/pay` — Authorize pass fee settlement

### Anomaly & Administrative Management (Admin Clearance Required)
- `POST /api/admin/events` — Deploy new event node
- `PUT /api/admin/events/:id` — Update event details (enforces capacity rule)
- `PATCH /api/admin/events/:id/cancel` — **Anomaly 1**: Cancel event, notify users, start refunds
- `PATCH /api/admin/events/:id/venue` — **Anomaly 3**: Change venue, check conflicts, notify users
- `PATCH /api/admin/events/:id/date` — **Anomaly 4**: Change date/time, notify users
- `GET /api/admin/registrations` — Monitor and search all ticket registrations
- `GET /api/admin/users` — List registered agents
- `GET /api/admin/history` — Inspect event modification telemetry history
- `GET /api/admin/audit-logs` — Inspect system audit trail
- `GET /api/admin/analytics` — Live dashboard metrics and capacity stats
- `GET /api/admin/export.csv` — Download registrations as CSV

### Notifications & Telemetry
- `GET /api/notifications` — Retrieve user's in-app telemetry alerts
- `PATCH /api/notifications/:id/read` — Acknowledge specific notification
- `PATCH /api/notifications/read-all` — Mark all alerts as read

### Aura-Net AI Chat
- `POST /api/ai-chat` — Query database-grounded Aura-Net assistant

---

## 🧑‍🏫 Teacher Demonstration Guide

### Demonstration 1 — Registration & Capacity Workflow
1. **Login**: Go to `/login.html` and sign in as `agent.solaris@quantum.net` (`password123`).
2. **Inspect Event**: Open `/events.html` and select **"Future Computing Conference"** (`/event-details.html?id=4`).
3. **Verify Capacity**: Notice live capacity (e.g. `300 seats open`).
4. **Register**: Click **"Initialize Registration"**.
5. **Inspect Ticket**: Notice instantaneous ticket generation (`QN-2026-XXXXX`).
6. **Verify Dashboard**: Check `/dashboard.html` — ticket is visible with status `CONFIRMED`.
7. **Admin Inspection**: Open `/admin.html` (login as `admin@quantum.net` / `admin123`) $\rightarrow$ see updated registration row and capacity counter reduced by 1.

### Demonstration 2 — Anomaly Engine & Cascading Notifications
1. **Admin Venue Modification**:
   - Go to Admin HUD (`/admin.html`).
   - On **"Quantum Tech Summit"**, click **VENUE**.
   - Change venue from `Sector 7 Auditorium` to `Convention Hall Omega`.
   - Mainframe dispatches live notifications to all confirmed participants and logs to `EventHistory`.
2. **User Notification Check**:
   - Sign in as `agent.nova@quantum.net` (`password123`).
   - Open `/dashboard.html` $\rightarrow$ inspect Telemetry Notifications:
     > *"The venue for Quantum Tech Summit has changed from Sector 7 Auditorium to Convention Hall Omega."*
3. **Admin Event Cancellation**:
   - In `/admin.html`, click **CANCEL** on an active event.
   - Enter reason: *"Sector Maintenance"*.
   - Event status immediately becomes `CANCELLED`.
   - All confirmed tickets are set to `CANCELLED` and payments to `REFUND_PENDING`.
   - User sees cancellation alert on Dashboard and Aura-Net accurately states that the event is cancelled.

---

## 🤖 Aura-Net AI Grounding Architecture

Aura-Net does **not hallucinate**. Every query to `/api/ai-chat`:
1. Dynamically queries the PostgreSQL database for all active events, schedules, venues, seats, and the user's registered passes.
2. Passes this verified context directly to Google Gemini (`gemini-1.5-flash`).
3. Returns natural, accurate, cyberpunk-styled answers.
