# JACE CRM - Enterprise Accounting & Investor Relations Platform

## Overview

JACE CRM is an enterprise-grade, multi-tenant CRM and real-time financial management platform designed for accounting, bond settlement, and investor relations companies. The platform provides comprehensive investor pipeline management, double-entry accounting ledger, task management, and KYC tracking capabilities with user-scoped data isolation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state, with local React state for UI
- **UI Component Library**: shadcn/ui (New York style) with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful JSON API with user-scoped endpoints
- **Authentication**: Local username/password authentication with bcrypt hashing (12 rounds)
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: Shared schema in `shared/schema.ts` for full-stack type safety
- **Migrations**: Drizzle Kit with `db:push` command for schema synchronization

### Authentication & Authorization
- **Provider**: Local authentication with username/password (bcrypt hashing)
- **Session Management**: Express sessions with PostgreSQL store
- **User Scoping**: All business data (investors, accounts, journal entries, tasks) is scoped to authenticated user ID
- **Protected Routes**: `isAuthenticated` middleware guards all `/api/*` endpoints
- **Auth Endpoints**: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- **Auth Pages**: `/register`, `/login`, `/admin-login`

### Project Structure
```
├── client/src/          # React frontend application
│   ├── components/      # UI components (shadcn/ui + custom)
│   ├── pages/           # Route page components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and query client
├── server/              # Express backend
│   ├── replit_integrations/auth/  # Auth integration
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Database access layer
│   └── db.ts            # Database connection
├── shared/              # Shared types and schema
│   ├── schema.ts        # Drizzle schema definitions
│   └── models/          # Data models (auth)
└── migrations/          # Database migrations
```

### Key Design Patterns
- **Full-Stack Type Safety**: Shared Drizzle schema generates types used by both frontend and backend
- **Storage Abstraction**: `IStorage` interface in `server/storage.ts` abstracts database operations
- **User Data Isolation**: Every storage method accepts `userId` parameter for multi-tenant data access
- **Component Composition**: shadcn/ui components provide consistent, accessible UI primitives

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable

### Authentication
- **Local Auth**: Username/password authentication with bcrypt password hashing
- **Required Environment Variables**:
  - `DATABASE_URL`: PostgreSQL connection string
  - `SESSION_SECRET`: Express session encryption key

### Third-Party Libraries
- **bcrypt**: Password hashing with secure salt rounds
- **passport / passport-local**: Authentication middleware
- **drizzle-orm / drizzle-kit**: Database ORM and migration tooling
- **zod**: Runtime schema validation
- **TanStack React Query**: Server state management
- **Radix UI**: Accessible component primitives

### Build Tools
- **Vite**: Frontend bundler with HMR
- **esbuild**: Server-side bundling for production
- **TypeScript**: Type checking across the stack

## Recent Changes (January 2026)

### Security Improvements
- Added user-scoped data isolation: All core tables (investors, accounts, journal_entries, tasks) now include `user_id` column
- Storage methods and API routes enforce user scoping via authenticated user ID from JWT claims
- Journal entry lines now validate that referenced journal entries and accounts belong to the authenticated user (prevents cross-tenant data access)

### Core Features Implemented
1. **Landing Page**: Professional JACE CRM branding with "Get Started" authentication flow
2. **Dashboard**: KPI cards showing Total Investors, Pipeline Value, Pending Tasks, Active Accounts
3. **Investor Management**: Full CRUD with search, pipeline stage assignment, and investment tracking
4. **Visual Pipeline**: Kanban-style view with columns for each pipeline stage (Lead → Contacted → KYC Pending → Documents → Ready → Closed)
5. **Chart of Accounts**: Account management with types (Asset, Liability, Equity, Revenue, Expense)
6. **Journal Entries**: Double-entry accounting system with journal entry lines
7. **Task Management**: Task CRUD with priorities (Low, Medium, High), due dates, and investor association
8. **Settings**: Theme toggle for light/dark mode

### Phase 1 Features (January 2026)
1. **User Role Management**: Role-based access control with admin, accounting, investor_relations, and ops roles
   - Admin page at `/admin` for role assignment
   - Role checking middleware on sensitive endpoints
   - Admin-only access to user role management API
2. **Audit Logging**: Comprehensive activity tracking across all CRUD operations
   - Audit log viewer at `/audit-logs`
   - Tracks create/update/delete actions on investors, accounts, tasks, journal entries, documents
   - Stores user ID, action type, entity type, entity ID, and description
3. **Document Repository**: File upload and management system
   - Document upload with multer (10MB limit)
   - Category classification (KYC Documents, Contracts, Financial Statements, etc.)
   - Association with investors
   - Upload/download/delete functionality at `/documents`
4. **Investor Segmentation**: Type-based investor classification
   - Investor types: Individual, Institutional, Fund
   - Type selector in investor form
   - Type filter in investors list
   - Type badge display in investor table

### Phase 2 Features (January 2026)
1. **Reports & Analytics Dashboard**: Visual analytics at `/analytics`
   - Pipeline distribution bar chart
   - Investor types pie chart
   - Task status and priority charts
   - Bond portfolio by status
   - KPI summary cards (Pipeline Value, Investors, Tasks, Bonds)
   - Export buttons for investors, accounts, and bonds (CSV format)
2. **KYC Workflow Tracking**: Compliance management at `/kyc`
   - KYC checklist items per investor
   - Status tracking (Pending, Submitted, Approved, Rejected)
   - Due date management
   - Status summary cards
3. **Bond Settlement Tracking**: Bond management at `/bonds`
   - Full bond lifecycle tracking (Pending → Settled → Matured)
   - ISIN, face value, coupon rate, settlement/maturity dates
   - Investor association
   - Summary cards (Total Bonds, Face Value, Pending, Maturing Soon)
4. **Communication Logging**: Activity tracking at `/communications`
   - Log notes, emails, calls, and meetings
   - Timeline view with type icons
   - Investor association
   - Summary counts by communication type
5. **Notification System**: Real-time alerts
   - Bell icon with unread count in header
   - Notification types: task_due, kyc_deadline, pipeline_change, document_uploaded, bond_settlement
   - Mark as read functionality
6. **Export Functionality**: CSV export for data
   - Export investors at /api/export/investors
   - Export accounts at /api/export/accounts
   - Export bonds at /api/export/bonds

### Phase 3 Features (January 2026)
1. **Email Integration**: Email management at `/email`
   - Email templates with variable placeholders ({{firstName}}, {{lastName}})
   - Send emails to investors with template selection
   - Sent emails log with status tracking
   - Activity timeline integration for sent emails
2. **Calendar & Scheduling**: Event management at `/calendar`
   - Monthly calendar grid with event dots
   - Event types: meeting, call, deadline, reminder, other
   - Investor association for events
   - Upcoming events sidebar
   - CRUD operations with confirmation dialogs
3. **Advanced Search**: Global search component (Ctrl+K)
   - Search across investors, tasks, bonds, documents
   - Debounced input (300ms)
   - Grouped results by entity type
   - Quick navigation to results
4. **Bulk Operations**: Multi-select on investors and tasks
   - Checkbox selection with select-all
   - Bulk update pipeline stage/type for investors
   - Bulk update status/priority for tasks
   - Bulk delete with confirmation
5. **Recurring Tasks**: Task automation at `/recurring-tasks`
   - Recurrence frequencies: daily, weekly, biweekly, monthly, quarterly, yearly
   - Template title and description
   - Start/end date configuration
   - Investor association
   - Active/inactive toggle
6. **Data Import**: CSV import wizard at `/import`
   - Multi-step wizard: Upload → Preview → Import
   - Sample template download
   - Column mapping with auto-detection
   - Validation and error reporting
7. **Multi-currency Support**: Currency handling on bonds
   - Default currencies seeded: USD, EUR, GBP, JPY, CHF, etc.
   - Currency selector in bond form
   - Formatted display with currency symbols
   - Currency breakdown in summary cards
8. **Investor Portal**: Read-only investor dashboard at `/investor-portal`
   - Investor selection dropdown
   - Profile, investment, bonds, documents, communications view
   - KYC checklist status
   - Portal access management (enable/disable per investor)
9. **Custom Fields**: Dynamic field management at `/custom-fields`
   - Field types: text, number, date, boolean, select, multiselect
   - Required/optional configuration
   - Active/inactive toggle
   - Investor detail integration
10. **Activity Timeline**: Comprehensive activity tracking
    - Timeline component in investor detail page
    - Activity types: investor_created, investor_updated, pipeline_changed, task_assigned, task_completed, document_uploaded, communication_logged, bond_added, kyc_updated, email_sent, meeting_scheduled
    - Relative timestamps
    - Entity type badges

### Phase 4 Features (January 2026)
1. **Compliance Onboarding System**: Full investor compliance workflow at `/compliance/:investorId`
   - Database schema: compliance_documents, electronic_signatures, beneficial_owners, investor_compliance, compliance_audit_events tables
   - 3-step wizard: AML/CTF Certification → Privacy/CIP/KYC Consent → Short-Form Privacy Notice
   - Individual vs Entity investor forms with different field requirements
   - Source of funds tracking with multi-select checkboxes
   - Seven certification acknowledgments with checkbox validation
   - Privacy sharing tier selection (REQUIRED_ONLY, PRODUCT_COMMS, MARKETING_PLUS)
   - Electronic delivery consent option
2. **Electronic Signature Component**: Reusable signature capture at `/components/electronic-signature.tsx`
   - Full legal name input with cursive-style preview
   - Optional signatory title (for entities)
   - Real-time date/time display with timezone
   - Captures IP address and user agent for audit trail
   - SignatureData interface for API integration
3. **Investor Compliance Status**: Compliance tab in investor detail page
   - Status badges: Pending Compliance, Ready to Activate, Activated
   - Document checklist showing AML, Privacy/CIP/KYC, Short-Form status
   - "Start Compliance" or "View Compliance" navigation button
   - Links directly to `/compliance/:investorId`
4. **Investor Activation Gate**: Controlled investor activation workflow
   - Requires AML certification + Privacy/CIP/KYC consent (short-form optional)
   - Updates investor pipeline stage to "ready" upon activation
   - Comprehensive audit logging for all compliance events
   - API endpoint: POST `/api/compliance/activate/:investorId`
5. **Compliance Audit Trail**: Full tracking of compliance activities
   - Event types: document_viewed, document_signed, preference_changed, investor_activated
   - Stores IP address, user agent, timestamps
   - API endpoint: GET `/api/compliance/audit/:investorId`
6. **GLBA Model Privacy Form**: Federal-compliant privacy notice at `/privacy-notice`
   - Two-page layout matching CFPB Model Form structure
   - FACTS header with Why/What/How sections
   - Disclosure table showing all sharing categories
   - "To limit our sharing" instructions with opt-out methods
   - Mail-in opt-out form with checkboxes
   - Page 2: Who we are, What we do FAQs, Definitions (Affiliates, Nonaffiliates, Joint marketing)
   - Print/PDF generation via browser print dialog
   - React component template at `/client/src/templates/privacy-model-form.tsx`

### Design System
- Professional blue primary color theme
- Full dark mode support with proper contrast ratios
- Consistent spacing and typography using Tailwind CSS utilities
- Accessible components using Radix UI primitives via shadcn/ui
- Recharts library for data visualization
- Lucide icons for all UI elements (no emojis)
- data-testid attributes on all interactive elements