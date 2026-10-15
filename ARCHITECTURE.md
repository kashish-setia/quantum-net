# QUANTUM NET // SYSTEM ARCHITECTURE & TELEMETRY PROTOCOL

QUANTUM NET is a full-stack cosmic event management and AI telemetry platform engineered with **Node.js, Express.js, PostgreSQL (Prisma ORM), Tailwind CSS**, and **Google Gemini AI**.

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph Client_Layer ["Frontend Client Layer (Tailwind + Vanilla JS)"]
        UI_Home["index.html (Command & Aura-Net)"]
        UI_Events["events.html (Event Grid)"]
        UI_Detail["event-details.html (Mission Brief)"]
        UI_Dash["dashboard.html (Passes & Notifications)"]
        UI_Admin["admin.html (Admin HUD & Anomaly Controls)"]
        UI_Auth["login.html / register.html"]
    end

    subgraph API_Gateway ["Express.js REST API Gateway"]
        AuthMiddleware["JWT Authentication & RBAC Middleware"]
        AuthRouter["/api/auth (Register, Login, Me)"]
        EventsRouter["/api/events (Browsing, Capacity Inspection)"]
        RegRouter["/api/events/:id/register & /api/registrations"]
        AdminRouter["/api/admin (Events, Anomaly Engine, Analytics, CSV)"]
        NotifyRouter["/api/notifications (Telemetry Alerts)"]
        AIRouter["/api/ai-chat (Aura-Net AI Gateway)"]
    end

    subgraph Services_Layer ["Core Service & Anomaly Engine"]
        AnomalyService["Anomaly & Event Change Service\n(anomaly.service.js)"]
        AIService["Aura-Net AI Grounding Service\n(ai.service.js)"]
    end

    subgraph AI_Engine ["External AI Engine"]
        GeminiAPI["Google Gemini API\n(gemini-1.5-flash)"]
    end

    subgraph Persistence_Layer ["Relational Data Layer (PostgreSQL + Prisma)"]
        PrismaClient["Prisma ORM Client"]
        DB[(PostgreSQL Database)]
        
        subgraph Entities ["Prisma Relational Schema"]
            User["User (Admin & Agents)"]
            Event["Event (Status, Schedule, Venue, Seats)"]
            Registration["Registration (Confirmed, Waitlist, Cancelled)"]
            Payment["Payment (Paid, Refund Pending, Refunded)"]
            EventHistory["EventHistory (Anomaly Audit Trail)"]
            Notification["Notification (In-App User Telemetry)"]
            AuditLog["AuditLog (System Operations)"]
            SystemAlert["SystemAlert (Health Telemetry)"]
        end
    end

    %% Interactions
    Client_Layer -->|HTTPS / Bearer JWT| AuthMiddleware
    AuthMiddleware --> AuthRouter
    AuthMiddleware --> EventsRouter
    AuthMiddleware --> RegRouter
    AuthMiddleware --> AdminRouter
    AuthMiddleware --> NotifyRouter
    AuthMiddleware --> AIRouter

    RegRouter --> AnomalyService
    AdminRouter --> AnomalyService
    AIRouter --> AIService

    AIService -->|Real-Time Query| PrismaClient
    AIService -->|Grounded Prompting| GeminiAPI
    GeminiAPI -->|Natural Language Response| AIService

    AnomalyService -->|ACID Transactions| PrismaClient
    AuthRouter --> PrismaClient
    EventsRouter --> PrismaClient
    NotifyRouter --> PrismaClient

    PrismaClient --> DB
    DB --- User
    DB --- Event
    DB --- Registration
    DB --- Payment
    DB --- EventHistory
    DB --- Notification
    DB --- AuditLog
```

---

## 2. Relational Database Schema Diagram

```mermaid
erDiagram
    USER ||--o{ REGISTRATION : places
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ AUDIT_LOG : triggers
    USER ||--o{ EVENT : creates
    USER ||--o{ EVENT_HISTORY : author

    EVENT ||--o{ REGISTRATION : contains
    EVENT ||--o{ EVENT_HISTORY : logs
    EVENT ||--o{ NOTIFICATION : relates

    REGISTRATION ||--|| PAYMENT : settles

    USER {
        int id PK
        string name
        string email UK
        string passwordHash
        enum role "USER | ADMIN"
        datetime createdAt
    }

    EVENT {
        int id PK
        string title
        string description
        string category
        string eventDate
        string startTime
        string endTime
        string venue
        int capacity
        int fee
        enum status "UPCOMING | ONGOING | COMPLETED | CANCELLED"
        int createdBy FK
        datetime createdAt
        datetime updatedAt
    }

    REGISTRATION {
        int id PK
        int userId FK
        int eventId FK
        datetime registrationDate
        enum status "CONFIRMED | CANCELLED | WAITLISTED"
        string ticketId UK
        int paymentId
        datetime cancelledAt
    }

    PAYMENT {
        int id PK
        int registrationId FK,UK
        float amount
        enum status "PAID | REFUND_PENDING | REFUNDED | FAILED"
        string transactionId
        datetime paymentDate
        datetime refundDate
    }

    EVENT_HISTORY {
        int id PK
        int eventId FK
        int changedBy FK
        string changeType
        string oldValue
        string newValue
        datetime changedAt
    }

    NOTIFICATION {
        int id PK
        int userId FK
        int eventId FK
        string type
        string message
        boolean isRead
        datetime createdAt
    }

    AUDIT_LOG {
        int id PK
        int userId FK
        string action
        string entity
        int entityId
        string details
        datetime timestamp
    }
```

---

## 3. Registration Workflow & Capacity Lock

```mermaid
sequenceDiagram
    autonumber
    actor Agent as User / Agent
    participant Web as Frontend UI
    participant API as Express API (/api/events/:id/register)
    participant Engine as Anomaly Engine (anomaly.service.js)
    participant DB as PostgreSQL (Prisma $transaction)

    Agent->>Web: Click "Initialize Registration"
    Web->>API: POST /api/events/:id/register (Bearer JWT)
    API->>Engine: registerForEvent(eventId, userId)
    
    rect rgb(20, 10, 40)
        Note over Engine,DB: BEGIN TRANSACTION (Atomic Capacity Guard)
        Engine->>DB: Check Event Exists & Status != CANCELLED
        Engine->>DB: Check Event Schedule != Past
        Engine->>DB: Check Duplicate Registration (Active Check)
        Engine->>DB: Count Confirmed Registrations
        
        alt Capacity Available (Confirmed < Capacity)
            Engine->>DB: INSERT Registration (status: CONFIRMED)
            Engine->>DB: Generate Ticket ID (e.g. QN-2026-00001)
            Engine->>DB: INSERT Payment (status: PAID)
            Engine->>DB: INSERT Notification ("Registration confirmed...")
            Engine->>DB: INSERT AuditLog ("REGISTER_EVENT")
            DB-->>Engine: Commit Transaction
            Engine-->>API: { success: true, ticketId: "QN-2026-00001", status: "CONFIRMED" }
        else Capacity Full
            Engine->>DB: INSERT Registration (status: WAITLISTED)
            Engine->>DB: INSERT Notification ("Placed on priority waitlist...")
            Engine->>DB: INSERT AuditLog ("WAITLIST_ENTRY")
            DB-->>Engine: Commit Transaction
            Engine-->>API: { success: true, status: "WAITLISTED", isWaitlisted: true }
        end
    end

    API-->>Web: 201 Created Response
    Web-->>Agent: Render Cosmic Ticket Badge / Waitlist Status
```

---

## 4. Anomaly Engine Workflows

### Anomaly 1: Event Cancellation & Cascading Rollback
1. Admin triggers `PATCH /api/admin/events/:id/cancel`
2. **Transaction starts**:
   - `Event.status` $\rightarrow$ `CANCELLED`
   - All `CONFIRMED` registrations $\rightarrow$ `CANCELLED` (`cancelledAt = now`)
   - All associated `PAYMENT` records $\rightarrow$ `REFUND_PENDING` (`refundDate = now`)
   - Broadcast notifications dispatched to all affected users: `"[Event] has been cancelled. Your registration has been cancelled and your refund is being processed."`
   - `EventHistory` recorded (`EVENT_CANCELLATION: UPCOMING -> CANCELLED`)
   - `AuditLog` recorded.

### Anomaly 2: Participant Deregistration & Waitlist Promotion
1. User clicks **WITHDRAW** on Dashboard $\rightarrow$ `DELETE /api/registrations/:id`
2. **Transaction starts**:
   - Registration status $\rightarrow$ `CANCELLED`
   - Payment status $\rightarrow$ `REFUND_PENDING`
   - User notification created.
   - **Waitlist Check**: Finds first `WAITLISTED` participant ordered by registration timestamp.
   - Promotes waitlisted user $\rightarrow$ `CONFIRMED`, generates unique ticket ID `QN-YYYY-XXXXX`, creates payment record, and sends promotion notification.

### Anomaly 3: Venue Change & Conflict Verification
1. Admin enters new venue $\rightarrow$ `PATCH /api/admin/events/:id/venue`
2. **Conflict Check**: Verifies if any other active event occupies the new venue on the same date/time. If conflict, **REJECTS** with `"Venue conflict detected. The selected venue is already occupied during this time."`
3. If valid:
   - Updates `Event.venue`
   - Creates `EventHistory` log (`VENUE_CHANGE: Old -> New`)
   - Dispatches in-app notification to all confirmed participants: `"The venue for [Event] has changed from [Old] to [New]."`
   - Creates `AuditLog`.

### Anomaly 4: Capacity Reduction Enforcement
1. Admin attempts to reduce capacity to $N$.
2. Anomaly Engine counts active confirmed participants $C$.
3. If $N < C$, transaction is immediately **REJECTED** with:
   `"Capacity cannot be reduced below the current number of confirmed registrations."`

---

## 5. Aura-Net AI Grounding Architecture

```mermaid
sequenceDiagram
    actor Agent as User / Participant
    participant Web as Aura-Net Widget (index.html)
    participant API as /api/ai-chat
    participant AIService as Aura-Net Service (ai.service.js)
    participant DB as PostgreSQL Telemetry
    participant Gemini as Google Gemini SDK

    Agent->>Web: "What events are happening tomorrow?"
    Web->>API: POST /api/ai-chat { message }
    API->>AIService: processChat(message, userId, role)
    
    AIService->>DB: Query Active Events, Venues, Seats, User Passes
    DB-->>AIService: Live Telemetry Dataset (Zero Hallucination Source)
    
    alt Gemini API Key Available
        AIService->>Gemini: System Prompt + Live Telemetry JSON + User Question
        Gemini-->>AIService: Grounded Natural Cyberpunk AI Response
    else Fallback Deterministic Engine
        AIService->>AIService: Extract DB records & build structured response
    end

    AIService-->>API: Grounded Response
    API-->>Web: JSON payload
    Web-->>Agent: Rendered in Aura-Net Terminal
```
