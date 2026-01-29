# Agent Structure Notes from Proposal

## Key Architecture Points

The proposal mentions that **Judgement Bond AI** acts as:
1. **Transaction Agent** - Handles payment processing
2. **Escrow Agent** - Manages escrow accounts and bid payments

## Build Method
- LLM-assisted development (ChatGPT prompts) + vetted open-source components
- Akaunting/Idurar/Frappe-CRM patterns + MANUS workflows
- Combined into one deployable repo

## BondAI Integration Requirements
1. BondAI onboarding completion webhook ingest
2. Investor record creation/update
3. Status sync
4. Integration health/status dashboard
5. Manual re-sync trigger
6. Audit trail of all inbound events

## Payments & Escrow (Bids) Requirements
1. Escrow account registry (bank/credit union)
2. Bid payment initiation + tracking
3. Webhook confirmations (confirmed/failed/reversed)
4. Idempotent processing and replay protection
5. Reconciliation job baseline (escrow vs ledger)

## AI Assistant (Permission-Aware)
- In-app AI chat assistant for reporting, accounting queries, workflow drafting
- Smart recommendations respecting roles/permissions
- This is the existing HelpChat component in the codebase
