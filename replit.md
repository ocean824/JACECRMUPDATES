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
- **Compliance**: KYC workflow tracking, GLBA Model Privacy Form, electronic signature capture for legal documents.
- **Legal Document Signing**: Scroll-to-end gating, typed signature capture, PDF generation with audit metadata, compliance audit trail.
  - AML Certification (USA PATRIOT Act / Bank Secrecy Act)
  - CIP/KYC Privacy Consent (Gramm-Leach-Bliley Act)
  - Privacy Short Form (GLBA Model Privacy Notice)
- **External Onboarding**: Secure, external investor onboarding flow integrated with BondAI, including document uploads, banking info, legal document signing, and e-signatures.
- **Reporting**: KPI dashboards, analytics, CSV exports.

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