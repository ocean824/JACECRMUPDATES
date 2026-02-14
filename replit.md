# JACE CRM - Enterprise Accounting & Investor Relations Platform

## Overview
JACE CRM is an enterprise-grade, multi-tenant CRM and real-time financial management platform for accounting, bond settlement, and investor relations companies. It offers investor pipeline management, a double-entry accounting ledger, task management, and KYC tracking with user-scoped data isolation. The platform aims to streamline financial operations and investor interactions for enterprises.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 (TypeScript) with Vite
- **Routing**: Wouter
- **State Management**: TanStack React Query (server state), local React state (UI)
- **UI Components**: shadcn/ui (New York style) with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables (light/dark mode)
- **Forms**: React Hook Form with Zod validation

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API**: RESTful JSON API with user-scoped endpoints
- **Authentication**: Local username/password (bcrypt hashing)
- **Session Management**: PostgreSQL-backed sessions via connect-pg-simple

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema**: Shared in `shared/schema.ts` for full-stack type safety
- **Migrations**: Drizzle Kit

### Authentication & Authorization
- **Method**: Local username/password with bcrypt
- **Session**: Express sessions with PostgreSQL store
- **Multi-tenancy**: All business data is scoped to the authenticated user ID
- **Security**: `isAuthenticated` middleware for API routes
- **Invite-Only Registration**: New users must be approved by admin before account creation
  - Admin clicks "Confirm & Send Invite" to generate a 9-character PIN (lowercase + numbers + 1 special char)
  - PIN expires after 2 hours
  - Tracks: `pinConfirmedAt` (admin confirmation), `pinEnteredAt` (user completion)
  - User cannot complete registration without valid, unexpired PIN

### Core Features
- **Investor Management**: CRUD, pipeline stages, investment tracking.
- **Accounting**: Chart of Accounts, Double-entry Journal Entries.
- **Task Management**: CRUD, priorities, due dates, investor association.
- **Vendor Management**: Complete accounts payable vendor management with account numbers, organization details, payment terms, tax groups, e-invoicing settings, recurring billing configuration, and invoice/remit-to addresses.
- **Compliance**: KYC workflow tracking, GLBA Model Privacy Form, electronic signature capture for legal documents.
- **Legal Document Signing**: Scroll-to-end gating, typed signature capture, PDF generation with audit metadata, compliance audit trail.
  - AML Certification (USA PATRIOT Act / Bank Secrecy Act)
  - CIP/KYC Privacy Consent (Gramm-Leach-Bliley Act)
  - Privacy Short Form (GLBA Model Privacy Notice)
- **External Onboarding**: Secure, external investor onboarding flow integrated with BondAI, including document uploads, banking info, legal document signing, and e-signatures. On completion, calls POST /api/jace/webhook on BondAI with `X-Jace-Signature` header to set `isJaceLive: true` and `jaceOnboardedAt` before redirecting back to BondAI.
- **AI Onboarding Assistant**: GPT-4o-mini powered chat assistant with streaming SSE responses, contextual guidance based on user progress, and conversation memory.
- **Voice Assistant Widget**: Integrated voice assistant using OpenAI speech-to-text and text-to-speech (gpt-audio model), with microphone recording and audio playback. Available on all authenticated pages via floating "Voice Help" button.
- **Escrow Account Management**: Multi-account escrow management with AES-256-GCM encrypted checking/routing numbers (only last 4 digits visible). Full CRUD at `/escrow` page. Routes in `server/routes-phase4.ts`, data in `escrow_accounts` table. Decrypt endpoint available for admin view. Default account auto-selected during settlement confirmation.
- **Settlement Management**: Internal settlement inbox with manual escrow confirmation flow, escrow account selection per settlement, PDF receipt generation, BondAI webhook notifications on settlement events. Admin/internal roles can confirm or cancel submitted settlements via `/settlements` inbox page. Manual settlement creation via `POST /api/admin/settlements/manual`. On confirmation: auto-creates assignment, auto-creates double-entry journal entry (debit asset, credit revenue) with idempotency guard, auto-links matching bond catalog entry (status updated to "settled"), auto-recalculates affected account balances.
- **Webhook Outbox Pattern**: Reliable webhook delivery using a transactional outbox table (`webhook_outbox`). Settlement confirmations enqueue webhooks via the outbox instead of direct HTTP calls. Polling dispatcher (`server/jobs/webhookOutboxDispatcher.ts`) processes pending entries with exponential backoff, max 5 attempts. Webhook sender (`server/services/bondaiWebhook.ts`) uses HMAC-SHA256 signing (`X-Jace-Signature`, `X-Jace-Timestamp`) and p-retry for per-attempt retries. Admin endpoints: `GET /api/admin/webhooks/:sessionId` (preview), `POST /api/admin/webhooks/:sessionId/resend`, `GET /api/admin/webhooks/outbox` (list). UI shows webhook status (Delivered/Pending/Failed) per settlement with resend button.
- **Settlement Compliance Gate**: Investor compliance wizard that must be completed inside the iframe before settlement submission. Includes entity type selection (Individual/LLC/Trust), tax ID collection (SSN/EIN encrypted via AES-256-GCM), two forms of ID upload, accredited investor attestation, hold harmless agreement, credit report authorization and demo tri-merge pull, compliance packet PDF generation. Both investor submission and admin confirmation are blocked (409) until compliance is complete. Routes in `server/settlement-compliance-routes.ts`, data in `settlement_compliance` table.
- **Stripe Payment Processing**: B2B outgoing payments for invoices, expenses, and vendors via Stripe PaymentIntents. Uses `stripe-replit-sync` for webhook management and data synchronization. Payment history tracked at `/payments` page. "Pay with Stripe" buttons on invoices (sent/viewed/partial/overdue) and expenses (approved). Routes in `server/stripe-routes.ts`, client in `server/stripeClient.ts`, webhooks in `server/webhookHandlers.ts`. Stripe schema auto-created in separate `stripe` schema namespace. Webhook route registered before `express.json()` middleware in `server/index.ts`.
- **Assignments & Payouts**: Track bond/assignment unit purchases, investor ownership, and scheduled payouts (coupons, principal returns). Auto-created from confirmed settlements with `bondSettlementId` linking to bond catalog. Full CRUD at `/assignments` list and `/assignments/:id` detail pages. Payout management with scheduled/paid/cancelled/failed status tracking. Calendar integration shows maturity dates (orange) and scheduled payout dates (teal). Routes in `server/assignment-routes.ts`, data in `assignments` and `assignment_payouts` tables. All data user-scoped for multi-tenant isolation.
  - API: `GET/POST /api/assignments`, `GET/PATCH/DELETE /api/assignments/:id`, `GET/POST /api/assignments/:id/payouts`, `PATCH/DELETE /api/assignments/:id/payouts/:payoutId`, `GET /api/assignment-payouts/all`
- **Reporting**: KPI dashboards, analytics, CSV exports.
- **Multi-Agent Runtime**: 119 specialized AI agents with parallel execution, adaptive concurrency, rate limiting, and tool-gated access. Agents defined in `server/agent-pack/agent-pack.json` (runtime-configurable, no code changes needed). Orchestrator supports bounded parallelism via `POST /api/agent/run-many`. Tools: `dbRead`/`dbWrite` (safe storage allowlist), `sendEmail` (Resend), `webSearch`/`webFetch`. Routes in `server/routes/agentRoutes.ts`, orchestrator in `server/orchestrator/runMany.ts`, OpenAI client in `server/lib/openai.ts` (lazy init with semaphore + token bucket rate limiting). Agent runs logged to `agent_runs.jsonl`.
  - API: `GET /api/agent/list`, `POST /api/agent/run`, `POST /api/agent/run-many`, `POST /api/agent/reload`
  - Env vars: `AI_INTEGRATIONS_OPENAI_API_KEY` (required), `AI_INTEGRATIONS_OPENAI_BASE_URL` (optional), `AGENT_MAX_CONCURRENCY` (default 128), `AGENT_MAX_TASKS` (default 200)

### Design Patterns
- **Full-Stack Type Safety**: Shared Drizzle schema.
- **Storage Abstraction**: `IStorage` interface for database operations.
- **User Data Isolation**: `userId` parameter for multi-tenant data access.

### UI/UX
- **Theme**: Professional blue primary color, full dark mode support.
- **Accessibility**: Radix UI primitives via shadcn/ui.
- **Data Visualization**: Recharts library.
- **Icons**: Lucide icons.
- **Testing**: `data-testid` attributes on interactive elements.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.

### Authentication
- **bcrypt**: Password hashing.
- **passport / passport-local**: Authentication middleware.

### ORM / Validation
- **drizzle-orm / drizzle-kit**: ORM and migration tooling.
- **zod**: Runtime schema validation.

### Frontend Libraries
- **TanStack React Query**: Server state management.
- **Radix UI**: Accessible component primitives.

### Build Tools
- **Vite**: Frontend bundler.
- **esbuild**: Server-side bundling.
- **TypeScript**: Language and type checking.

### Integrations
- **BondAI**: External investor onboarding, utilizing JWTs, AES-256-GCM encryption, HMAC-SHA256 webhooks, and CORS restrictions.
- **Resend**: For sending confirmation emails post-onboarding.
- **Multer**: For document uploads.
- **Stripe**: B2B payment processing via `stripe` and `stripe-replit-sync` packages. Credentials auto-fetched from Replit connection API.

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string.
- `SESSION_SECRET`: Express session encryption key.
- `BONDAI_INTEGRATION_API_KEY`: API key for BondAI session creation.
- `JACE_ONBOARDING_JWT_SECRET`: JWT secret for onboarding.
- `JACE_ENCRYPTION_KEY_BASE64`: AES encryption key.
- `ONBOARDING_DEFAULT_OWNER_USER_ID`: User ID for new investors.
- `BONDAI_CORS_ORIGINS`: Allowed CORS origins for BondAI.
- `BONDAI_WEBHOOK_URL`: Webhook endpoint for BondAI.
- `BONDAI_WEBHOOK_SECRET`: Webhook signature secret for BondAI.
- `BONDAI_ALLOWED_FRAME_ANCESTORS`: CSP frame-ancestors for BondAI.
- `BONDAI_API_URL`: Base URL for BondAI API calls (e.g., investor KYC updates).

### Public Legal Pages (Fidelity-Style) - January 2026
Public legal pages with Fidelity-style footer for JACE Management, LLC (Colorado):

1. **FooterLegal Component** (`client/src/components/footer-legal.tsx`)
   - Two-row layout with internal and external links
   - "This is for persons in the US only." text
   - Dynamic copyright year

2. **Public Routes** (no authentication required):
   - `/terms-of-use` - Terms of Use (12 sections)
   - `/privacy` - Privacy Policy with Colorado Privacy Act
   - `/security` - Security information and user recommendations
   - `/site-map` - Site map with public/authenticated sections
   - `/accessibility` - WCAG 2.1 Level AA accessibility statement
   - `/contact-us` - Contact page (jacemgmt@gmail.com, 970-710-9193)
   - `/share-your-screen` - Co-browsing feature information
   - `/disclosures` - Legal disclosures and disclaimers
   - `/cookie-preferences` - Cookie preference toggles (localStorage)

3. **Company Details**:
   - Entity: JACE Management, LLC (Colorado)
   - Email: jacemgmt@gmail.com
   - Phone: 970-710-9193
   - Governing State: Colorado