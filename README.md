# JACE CRM - Accounting + Investor Relations + Bond Settlement Platform

**Version:** 2.0.0 (Phase 4 Enhanced)  
**Last Updated:** January 29, 2026  
**Platform:** Replit.com

A fully functional CRM platform integrating with **Judgement Bond AI** as the transaction agent and escrow agent. This system includes investor onboarding sync, KYC status tracking, bid payment acceptance, settlements, real-time ledger posting, and document generation.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Module Summary](#module-summary)
4. [Getting Started](#getting-started)
5. [Replit Secrets Configuration](#replit-secrets-configuration)
6. [BondAI Integration Setup](#bondai-integration-setup)
7. [Database Schema](#database-schema)
8. [API Reference](#api-reference)
9. [Navigation Structure](#navigation-structure)
10. [Troubleshooting](#troubleshooting)
11. [TL;DR Quick Start](#tldr-quick-start)

---

## Overview

JACE CRM is an enterprise-grade platform designed for:

- **Investor Relations**: Full pipeline management from lead to closed
- **Accounting**: Double-entry ledger with Chart of Accounts, Journal Entries, and Financial Statements
- **Bond Settlements**: Track and manage bond transactions with automated document generation
- **HR Management**: Employee records, departments, time tracking, leave requests, and payroll
- **Invoicing & Billing**: Create invoices, quotes, track payments, and manage expenses
- **BondAI Integration**: Real-time webhook processing for payment confirmations and investor onboarding

### Key Features

| Module | Capabilities |
| :--- | :--- |
| **Platform & Security** | Multi-tenant workspace, role-based permissions, audit logs, 2FA support |
| **Investor Pipeline** | Lead→Contacted→KYC→Documents→Ready→Closed workflow |
| **Accounting** | Chart of Accounts, Journal Entries, Trial Balance, Income Statement, Balance Sheet |
| **Financial** | Invoices, Quotes, Expenses, Escrow Accounts |
| **HR** | Employees, Departments, Time Tracking, Leave Requests, Payroll |
| **BondAI** | Webhook ingestion, investor sync, payment processing, health monitoring |
| **AI Assistant** | In-app chat assistant for reporting and workflow guidance |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        JACE CRM Frontend                        │
│                    (React + TypeScript + Vite)                  │
├─────────────────────────────────────────────────────────────────┤
│                        Express.js Backend                       │
│                    (API Routes + Middleware)                    │
├─────────────────────────────────────────────────────────────────┤
│                      PostgreSQL Database                        │
│                    (Drizzle ORM + Migrations)                   │
├─────────────────────────────────────────────────────────────────┤
│                    External Integrations                        │
│        BondAI Webhooks │ Gmail OAuth │ OpenAI Assistant         │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: React 18, TypeScript, TailwindCSS, Shadcn/UI, Wouter (routing)
- **Backend**: Express.js, Node.js 20+
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth + Local Auth (email/password)
- **AI**: OpenAI GPT for in-app assistant

---

## Module Summary

### 1. Platform & Security
- Multi-tenant workspace isolation
- User/role management (Admin, Accounting, Investor Relations, Ops)
- Protected routes with session management
- Audit logs for all critical actions
- Idempotency controls for webhooks

### 2. Dashboards & Analytics
- Role-based KPI dashboards
- Pipeline/settlement/payment status panels
- Exportable views (CSV, PDF)

### 3. CRM & Office Management
- Customer & contact management
- Tasks, notes, reminders
- Activity timeline by customer/investor
- Document repository

### 4. Investor Pipeline & KYC Tracking
- Investor profiles with segmentation
- Pipeline stages with automated transitions
- KYC/document status tracking
- Onboarding automation hooks

### 5. Gmail Investor Relations Hub
- Gmail OAuth connect
- Email/thread ingestion + logging
- Thread viewer and investor linking

### 6. BondAI Integration (Judgement Bond AI)
- Webhook ingestion for onboarding completion
- Investor record creation/update
- Status sync with health monitoring
- Manual re-sync trigger
- Audit trail of all inbound events

### 7. Payments & Escrow
- Escrow account registry (bank/credit union)
- Bid payment initiation + tracking
- Webhook confirmations (confirmed/failed/reversed)
- Reconciliation baseline

### 8. Settlements & Document Generation
- Settlement workflow (allocation/confirmation/closeout)
- Automated ledger postings
- PDF document generation

### 9. Accounting / Double-Entry Ledger
- Chart of Accounts
- Journal Entries with balanced debit/credit
- Trial Balance
- Income Statement
- Balance Sheet
- Cash Flow views

### 10. Invoices / Quotes / Expenses
- Invoice management with line items
- Quote to Invoice conversion
- Expense tracking with approval workflow
- Payment recording

### 11. HR Module
- Employee records with departments
- Time tracking
- Leave request management
- Payroll processing

### 12. AI Assistant
- Permission-aware in-app chat
- Reporting queries
- Workflow guidance

---

## Getting Started

### Prerequisites

- Node.js 20+ (LTS recommended)
- PostgreSQL 14+ database
- Replit account (for deployment)

### Local Development

```bash
# Clone the repository
git clone https://github.com/ocean824/JACECRMUPDATES.git
cd JACECRMUPDATES

# Install dependencies
npm install

# Set up environment variables (see Replit Secrets section)
cp .env.example .env

# Push database schema
npx drizzle-kit push

# Start development server
npm run dev
```

### Replit Deployment

1. Import the repository into Replit
2. Configure all required Secrets (see below)
3. Click "Run" to start the application
4. The database will be automatically provisioned

---

## Replit Secrets Configuration

**CRITICAL**: All secrets must be configured in Replit's Secrets tab for the application to function properly.

### Required Secrets

| Secret Name | Description | Example Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Express session encryption key | `your-random-32-char-string` |
| `REPLIT_DOMAINS` | Comma-separated allowed domains | `your-app.replit.app` |

### BondAI Integration Secrets

| Secret Name | Description | How to Obtain |
| :--- | :--- | :--- |
| `BONDAI_API_URL` | BondAI API base URL | Provided by BondAI team |
| `BONDAI_API_KEY` | API key for outbound calls | BondAI Dashboard → API Keys |
| `BONDAI_WEBHOOK_SECRET` | Shared secret for webhook verification | BondAI Dashboard → Webhooks |

### Gmail Integration Secrets

| Secret Name | Description | How to Obtain |
| :--- | :--- | :--- |
| `GMAIL_CLIENT_ID` | Google OAuth Client ID | Google Cloud Console → Credentials |
| `GMAIL_CLIENT_SECRET` | Google OAuth Client Secret | Google Cloud Console → Credentials |
| `GMAIL_REDIRECT_URI` | OAuth redirect URL | `https://your-app.replit.app/api/gmail/callback` |

### AI Assistant Secrets

| Secret Name | Description | How to Obtain |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | OpenAI API key for assistant | OpenAI Dashboard → API Keys |

### Optional Secrets

| Secret Name | Description | Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `5000` |
| `LOG_LEVEL` | Logging verbosity | `info` |

### Setting Secrets in Replit

1. Open your Replit project
2. Click on "Tools" in the left sidebar
3. Select "Secrets"
4. Click "New Secret" for each variable
5. Enter the key name and value
6. Click "Add Secret"

**Example:**
```
Key: BONDAI_WEBHOOK_SECRET
Value: whsec_your_secret_key_here
```

---

## BondAI Integration Setup

### Webhook Configuration

1. **Register your webhook URL in BondAI Dashboard:**
   ```
   https://your-app.replit.app/api/bondai/webhook
   ```

2. **Select events to receive:**
   - `investor_onboarding_submitted`
   - `investor_onboarding_completed`
   - `payment.pending`
   - `payment.confirmed`
   - `payment.failed`
   - `kyc.submitted`
   - `kyc.completed`
   - `kyc.rejected`
   - `trade.created`
   - `trade.completed`

3. **Copy the webhook secret** and add it to Replit Secrets as `BONDAI_WEBHOOK_SECRET`

### Webhook Payload Format

BondAI sends webhooks in the following format:

```json
{
  "eventId": "evt_unique_id",
  "eventType": "payment.confirmed",
  "correlationId": "corr_optional_id",
  "timestamp": "2026-01-29T12:00:00Z",
  "data": {
    "investorId": "inv_123",
    "tradeId": "trade_456",
    "amount": "10000.00",
    "currency": "USD"
  }
}
```

### Signature Verification

All webhooks are verified using HMAC-SHA256:

```
X-BondAI-Signature: sha256=<computed_signature>
```

The signature is computed as:
```
HMAC-SHA256(webhook_secret, raw_request_body)
```

### Integration Health Monitoring

Access the BondAI integration dashboard at:
```
/integrations/bondai
```

This dashboard shows:
- Connection status
- Recent webhook events
- Failed event count
- Last sync timestamp

---

## Database Schema

### Core Tables

| Table | Description |
| :--- | :--- |
| `investors` | Investor profiles and pipeline status |
| `accounts` | Chart of Accounts |
| `journal_entries` | Journal entry headers |
| `journal_entry_lines` | Journal entry line items |
| `bond_settlements` | Settlement records |
| `tasks` | Task management |
| `documents` | Document repository |

### Phase 4 Tables (New)

| Table | Description |
| :--- | :--- |
| `invoices` | Invoice headers |
| `invoice_line_items` | Invoice line items |
| `invoice_payments` | Payment records |
| `quotes` | Quote headers |
| `expenses` | Expense tracking |
| `employees` | Employee records |
| `departments` | Department structure |
| `time_entries` | Time tracking |
| `leave_requests` | Leave management |
| `payroll_records` | Payroll processing |
| `escrow_accounts` | Escrow account registry |
| `escrow_transactions` | Escrow transaction log |
| `bondai_webhook_events` | Webhook event log |
| `bondai_investor_sync` | Investor sync status |

### Running Migrations

```bash
# Generate migration files
npx drizzle-kit generate

# Push schema to database
npx drizzle-kit push

# View database in Drizzle Studio
npx drizzle-kit studio
```

---

## API Reference

### Authentication

All authenticated endpoints require a valid session cookie.

### Invoicing API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/invoices` | List all invoices |
| GET | `/api/invoices/:id` | Get single invoice |
| POST | `/api/invoices` | Create invoice |
| PATCH | `/api/invoices/:id` | Update invoice |
| DELETE | `/api/invoices/:id` | Delete invoice |
| POST | `/api/invoices/:id/payments` | Record payment |

### HR API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/employees` | List employees |
| POST | `/api/employees` | Create employee |
| GET | `/api/departments` | List departments |
| POST | `/api/time-entries` | Log time entry |
| POST | `/api/leave-requests` | Submit leave request |
| POST | `/api/payroll` | Process payroll |

### BondAI API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/bondai/webhook` | Webhook receiver (public) |
| GET | `/api/bondai/webhook-events` | List webhook events |
| GET | `/api/bondai/health` | Integration health check |
| POST | `/api/investors/:id/bondai-sync` | Trigger manual sync |

### Financial Reports API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/reports/trial-balance` | Trial Balance report |
| GET | `/api/reports/income-statement` | Income Statement |
| GET | `/api/reports/balance-sheet` | Balance Sheet |

---

## Navigation Structure

The application uses contextual back navigation. Each page has a back button that navigates to its logical parent:

```
Dashboard (/)
├── Investors (/investors)
│   ├── Investor Detail (/investors/:id) → Back to Investors
│   ├── Pipeline (/pipeline) → Back to Investors
│   ├── KYC (/kyc) → Back to Investors
│   └── Communications (/communications) → Back to Investors
│
├── Financial
│   ├── Invoices (/invoices) → Back to Dashboard
│   │   └── Quotes (/quotes) → Back to Invoices
│   ├── Expenses (/expenses) → Back to Dashboard
│   └── Escrow (/escrow) → Back to Dashboard
│
├── Accounting
│   ├── Accounts (/accounts) → Back to Dashboard
│   │   └── Journal (/journal) → Back to Accounts
│   └── Reports
│       ├── Trial Balance (/reports/trial-balance) → Back to Accounts
│       ├── Income Statement (/reports/income-statement) → Back to Accounts
│       └── Balance Sheet (/reports/balance-sheet) → Back to Accounts
│
├── HR
│   ├── Employees (/employees) → Back to Dashboard
│   │   ├── Departments (/departments) → Back to Employees
│   │   ├── Time Tracking (/time-tracking) → Back to Employees
│   │   ├── Leave Requests (/leave-requests) → Back to Employees
│   │   └── Payroll (/payroll) → Back to Employees
│
├── Settings (/settings) → Back to Dashboard
│   ├── Custom Fields (/custom-fields) → Back to Settings
│   └── BondAI Integration (/integrations/bondai) → Back to Settings
│
└── Admin (/admin) → Back to Dashboard
```

---

## Troubleshooting

### Common Issues

**1. Database Connection Failed**
```
Error: connect ECONNREFUSED
```
- Verify `DATABASE_URL` is correctly set in Secrets
- Check PostgreSQL service is running
- Ensure database user has correct permissions

**2. BondAI Webhook Signature Invalid**
```
Error: Invalid signature
```
- Verify `BONDAI_WEBHOOK_SECRET` matches the value in BondAI Dashboard
- Ensure the secret has no trailing whitespace
- Check that the webhook URL is exactly as registered

**3. Session Not Persisting**
```
Error: Unauthorized
```
- Verify `SESSION_SECRET` is set
- Check `REPLIT_DOMAINS` includes your app domain
- Clear browser cookies and try again

**4. OpenAI Assistant Not Responding**
```
Error: API key invalid
```
- Verify `OPENAI_API_KEY` is correctly set
- Check API key has not expired
- Ensure you have API credits available

### Logs

View application logs in Replit:
1. Click on "Console" tab
2. Filter by log level if needed
3. Search for specific error messages

---

## TL;DR Quick Start

### Step 1: Clone and Deploy
```bash
# In Replit, import from GitHub:
https://github.com/ocean824/JACECRMUPDATES.git
```

### Step 2: Configure Required Secrets
Add these in Replit Secrets tab:
```
DATABASE_URL=<your_postgres_url>
SESSION_SECRET=<random_32_char_string>
BONDAI_WEBHOOK_SECRET=<from_bondai_dashboard>
BONDAI_API_KEY=<from_bondai_dashboard>
BONDAI_API_URL=https://api.bond.ai
OPENAI_API_KEY=<from_openai>
```

### Step 3: Initialize Database
```bash
npx drizzle-kit push
```

### Step 4: Configure BondAI Webhook
1. Go to BondAI Dashboard → Webhooks
2. Add URL: `https://your-app.replit.app/api/bondai/webhook`
3. Select all events
4. Copy secret to Replit Secrets

### Step 5: Run the Application
Click "Run" in Replit or:
```bash
npm run dev
```

### Step 6: Access the Application
- Open `https://your-app.replit.app`
- Register an admin account
- Start managing investors!

---

## Support

For issues or questions:
- GitHub Issues: [JACECRMUPDATES Issues](https://github.com/ocean824/JACECRMUPDATES/issues)
- Documentation: This README
- BondAI Support: Contact BondAI team for integration issues

---

**Built with ❤️ for JACE, LLC**
