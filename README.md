# 🇮🇳 MiniLedger (Bharat Edition) — Peer-to-Peer Friend Loan & Khata Tracker

**MiniLedger** is a full-stack TypeScript monorepo application built to track money lent to friends (*Udhaar / Khata*). Engineered with a **Node.js + Express + PostgreSQL** backend and an **Expo Go (React Native) + Reanimated + Zustand** mobile app, it combines strict financial accuracy (`NUMERIC(12,2)`) with a Neo-Fintech Indian UX, bilingual **English + हिन्दी (Hindi)** localization, receipt photo uploads, and 1-tap WhatsApp payment reminders.

---

## ✨ Core & Expanded Features

### 🖥️ Backend (`@miniledger/backend`)
* **Phone + Mock OTP Login**: Normalizes Indian mobile numbers (`+91XXXXXXXXXX`), stores expiring 6-digit OTPs in PostgreSQL, and prints a formatted ASCII box directly in the server console.
* **Precision Ledger Engine**: Stores amounts as PostgreSQL `NUMERIC(12, 2)` to prevent floating-point rounding bugs.
* **Dynamic Overdue Computation**: Automatically flags unpaid loans where `due_date < CURRENT_DATE` as `OVERDUE` and calculates `daysOverdue` and `daysUntilDue`.
* **Full & Partial Repayments**: Supports both 1-tap 100% loan settlement and incremental partial repayments with a full audit trail (`loan_repayments` table).
* **Receipt Image Upload**: Multipart image upload (`multer`) supporting JPG, PNG, WEBP, and HEIC receipts up to 5 MB.
* **Comprehensive Summary Endpoint**: Returns `totalLent`, `totalRepaid`, `overdueAmount`, `outstandingAmount`, `dueSoonAmount`, `repaymentRate`, entry counts, and a **Friend-wise Khata Breakdown**.
* **Input Validation & Automated Tests**: Strict `zod` schemas on every route and a self-contained **Vitest + Supertest** test suite.

### 📱 Mobile App (`@miniledger/mobile` — 100% Expo Go Compatible)
* **Bharat Neo-Fintech Theme**: Full **Light & Dark Mode** support with Royal Indigo (`#4F46E5`), Saffron Gold (`#F59E0B`), Emerald Mint (`#10B981`), and Crimson Coral (`#EF4444`) overdue highlights.
* **Bilingual Localization (`en` / `hi`)**: Live, persisted switching between **English** and **हिन्दी (Hindi)** across all screens, badges, and WhatsApp reminder templates.
* **60fps Reanimated Micro-Interactions**: Tactile spring pressables (`expo-haptics`), animated collection-rate progress bar, pulsing overdue badges, and staggered entry animations.
* **Zero-Code LAN Server Switcher**: Built-in `⚙️ API` modal on the Login screen lets physical phones running **Expo Go** point to your computer's local Wi-Fi IP address in seconds.

---

## 🗂️ Monorepo Structure

```text
miniledger/
├── package.json                        # Root workspace scripts
├── tsconfig.base.json                  # Strict shared TypeScript configuration
├── scripts/
│   └── generate-assets.js              # Zero-dependency PNG generator for Expo icons & splash
├── packages/
│   └── backend/                        # Node.js + Express + PostgreSQL + TypeScript API
│       ├── .env.example
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── config/env.ts
│       │   ├── db/schema.sql
│       │   ├── db/pool.ts
│       │   ├── types/index.ts
│       │   ├── validators/schemas.ts
│       │   ├── middleware/
│       │   ├── controllers/
│       │   ├── routes/index.ts
│       │   ├── app.ts
│       │   └── server.ts
│       └── tests/api.test.ts
├── apps/
│   └── mobile/                         # Expo Go (React Native + TypeScript + Reanimated)
│       ├── app.json
│       ├── App.tsx
│       ├── babel.config.js
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── theme/
│           ├── i18n/
│           ├── components/
│           ├── services/api.ts
│           ├── store/
│           ├── screens/
│           └── types/ledger.ts
├── README.md
└── AGENTS.md
```

---

## 🚀 Quickstart Guide

### Prerequisites
* **Node.js**: `>= 18.0.0` and **npm** `>= 9.0.0`
* **PostgreSQL**: `>= 14` running locally or via Docker
* **Expo Go App**: Installed on your iOS or Android device (or Android Studio / Xcode simulator)

### Step 1: Install Monorepo Dependencies & Generate Assets
From the repository root (`miniledger/`):

```bash
# Install all root, backend, and mobile workspace dependencies
npm install

# Generate valid icon.png, adaptive-icon.png, splash.png, and favicon.png
npm run prepare:assets
```

### Step 2: Configure PostgreSQL Database
Create the `miniledger` database in PostgreSQL (or start a Postgres container):

```bash
# Option A: Using local psql CLI
psql -U postgres -c "CREATE DATABASE miniledger;"

# Option B: Using Docker
docker run --name miniledger-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=miniledger \
  -p 5432:5432 -d postgres:16-alpine
```

Copy the environment template for the backend:

```bash
cp packages/backend/.env.example packages/backend/.env
```

### Step 3: Run Backend Tests & Start the API Server

```bash
# Run the automated Vitest + Supertest validation & API suite
npm run test:backend

# Start the backend server (automatically runs schema.sql migrations on boot)
npm run dev:backend
```

When the backend starts, it prints both your `localhost` URL and your **Expo Go LAN URL** (e.g., `http://192.168.1.5:4000/api/v1`).

### Step 4: Start the Expo Go Mobile App
Open a second terminal at the repository root:

```bash
npm run dev:mobile
```

* **Android Emulator**: Automatically connects to `http://10.0.2.2:4000/api/v1`.
* **iOS Simulator**: Automatically connects to `http://localhost:4000/api/v1`.
* **Physical Phone via Expo Go**: Scan the QR code. On the MiniLedger Login screen, tap **`⚙️ API`** in the top-left corner and enter the **Expo Go LAN URL** printed in your backend terminal.

---

## 🔌 REST API Reference & cURL Playbook

Base URL: `http://localhost:4000/api/v1` (also aliased at `http://localhost:4000/api`)

### 1. Request Mock OTP
```bash
curl -X POST http://localhost:4000/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'
```
*Check your backend terminal for the ASCII OTP box (or read `debugOtp` in the JSON response).*

### 2. Verify OTP & Obtain JWT
```bash
curl -X POST http://localhost:4000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "otp": "123456",
    "displayName": "Aarav Sharma",
    "preferredLanguage": "en"
  }'
```

### 3. Add a Loan Entry (JSON or Multipart with Receipt Photo)
```bash
# JSON Request
curl -X POST http://localhost:4000/api/v1/loans \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "friendName": "Rohan Verma",
    "friendPhone": "9811122233",
    "amount": 2500,
    "dueDate": "2026-10-15",
    "category": "FOOD_SPLIT",
    "notes": "Dinner split at Indiranagar"
  }'

# Multipart Request with Receipt Photo
curl -X POST http://localhost:4000/api/v1/loans \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -F "friendName=Priya Nair" \
  -F "amount=5000" \
  -F "dueDate=2026-11-05" \
  -F "category=TRAVEL" \
  -F "receipt=@/path/to/receipt.jpg"
```

### 4. List Loan Entries (Supports Status, Category & Search Filters)
```bash
curl -X GET "http://localhost:4000/api/v1/loans?status=ALL" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### 5. Mark Loan as Repaid (1-Tap Full Settlement or Partial Repayment)
```bash
# Full Settlement (omit amount)
curl -X PATCH http://localhost:4000/api/v1/loans/<LOAN_ID>/repay \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'

# Partial Repayment
curl -X PATCH http://localhost:4000/api/v1/loans/<LOAN_ID>/repay \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "note": "Paid via GPay UPI"}'
```

### 6. Get Ledger Summary (Total Lent, Total Repaid, Overdue Amount)
```bash
curl -X GET http://localhost:4000/api/v1/summary \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```