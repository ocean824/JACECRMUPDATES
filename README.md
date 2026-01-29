# JACE CRM - Enhanced Edition

JACE CRM is a comprehensive, enterprise-grade Customer Relationship Management platform designed for the modern financial institution. This enhanced version includes robust modules for accounting, HR, invoicing, and a seamless integration with BondAI for payment processing.

This project was updated by Manus AI to include significant new functionality on top of the existing, powerful CRM features.

See [FEATURES.md](./FEATURES.md) for a complete list of all capabilities.

## Table of Contents

- [Project Overview](#project-overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [Key Features](#key-features)
- [BondAI Integration](#bondai-integration)
- [TL;DR: Quick Start](#tldr-quick-start)

## Project Overview

The JACE CRM is built with a modern tech stack, featuring a React frontend with TypeScript and a Node.js backend. It is designed to be a one-stop solution for managing investor relationships, financial records, and internal company operations.

## Getting Started

Follow these instructions to get a local copy of the project up and running for development and testing purposes.

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- A running MySQL or compatible database instance

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ocean824/JACECRMUPDATES.git
    cd JACECRMUPDATES
    ```

2.  **Install server dependencies:**
    ```bash
    cd server
    npm install
    ```

3.  **Install client dependencies:**
    ```bash
    cd ../client
    npm install
    ```

4.  **Configure Environment Variables:**
    Create a `.env` file in the `server` directory and add the necessary environment variables. You will need to configure your database connection string and credentials for any external services (like BondAI).

    ```
    DATABASE_URL="mysql://user:password@host:port/database"
    BONDAI_API_URL="https://api.bond.ai"
    BONDAI_API_KEY="your_bondai_api_key"
    BONDAI_WEBHOOK_SECRET="your_bondai_webhook_secret"
    ```

### Running the Application

1.  **Start the server:**
    From the `server` directory, run:
    ```bash
    npm run dev
    ```
    The server will typically start on port 3000.

2.  **Start the client:**
    From the `client` directory, run:
    ```bash
    npm run dev
    ```
    The client development server will typically start on port 5173.

3.  **Access the application:**
    Open your browser and navigate to `http://localhost:5173`.

## Key Features

This version of JACE CRM includes several new, fully integrated modules:

-   **Financial Suite**: Go beyond basic bookkeeping with a full invoicing system, quote generation, expense tracking, and escrow account management.
-   **Human Resources**: Manage your team with modules for employee records, department structures, time tracking, leave requests, and payroll.
-   **Advanced Reporting**: Generate critical financial reports including a Trial Balance, Income Statement, and Balance Sheet on the fly.

## BondAI Integration

The integration with BondAI is designed for robust and secure payment processing. 

-   **Webhook Handling**: The CRM is equipped to receive and process webhooks from BondAI for events like `payment.confirmed` and `investor_onboarding_completed`.
-   **Monitoring Dashboard**: A new page under `Integrations > BondAI` provides a real-time health check of the connection and a log of all incoming webhook events.

To make the integration work, you must configure the webhook endpoint `/api/bondai/webhook` in your BondAI dashboard.

## TL;DR: Quick Start

1.  Clone the repo: `git clone https://github.com/ocean824/JACECRMUPDATES.git`
2.  `cd JACECRMUPDATES/server && npm install`
3.  `cd ../client && npm install`
4.  Create a `.env` file in the `server` directory with your `DATABASE_URL`.
5.  Run `npm run dev` in the `server` directory.
6.  Run `npm run dev` in the `client` directory.
7.  Open `http://localhost:5173` in your browser.
