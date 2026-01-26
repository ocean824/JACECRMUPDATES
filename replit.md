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
- **Authentication**: Replit Auth integration with OpenID Connect, Passport.js for session management
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: Shared schema in `shared/schema.ts` for full-stack type safety
- **Migrations**: Drizzle Kit with `db:push` command for schema synchronization

### Authentication & Authorization
- **Provider**: Replit Auth (OpenID Connect)
- **Session Management**: Express sessions with PostgreSQL store
- **User Scoping**: All business data (investors, accounts, journal entries, tasks) is scoped to authenticated user ID
- **Protected Routes**: `isAuthenticated` middleware guards all `/api/*` endpoints

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
- **Replit Auth**: OpenID Connect provider for user authentication
- **Required Environment Variables**:
  - `DATABASE_URL`: PostgreSQL connection string
  - `SESSION_SECRET`: Express session encryption key
  - `ISSUER_URL`: Replit OIDC issuer (defaults to https://replit.com/oidc)
  - `REPL_ID`: Replit environment identifier

### Third-Party Libraries
- **openid-client**: OIDC client for Replit Auth
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

### Design System
- Professional blue primary color theme
- Full dark mode support with proper contrast ratios
- Consistent spacing and typography using Tailwind CSS utilities
- Accessible components using Radix UI primitives via shadcn/ui