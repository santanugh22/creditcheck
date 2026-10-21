-- ============================================================================
-- MiniLedger (Bharat Edition) - PostgreSQL Database Schema
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table (Phone-first identity for India)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL DEFAULT 'MiniLedger User',
  preferred_language VARCHAR(5) NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Mock OTP Requests Table
CREATE TABLE IF NOT EXISTS otp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_requests_phone_created
  ON otp_requests (phone, created_at DESC);

-- 3. Loans (Udhaar / Khata Entries) Table
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_name VARCHAR(120) NOT NULL,
  friend_phone VARCHAR(20),
  principal_amount NUMERIC(12, 2) NOT NULL CHECK (principal_amount > 0),
  repaid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (
    repaid_amount >= 0 AND repaid_amount <= principal_amount
  ),
  category VARCHAR(32) NOT NULL DEFAULT 'PERSONAL' CHECK (
    category IN ('PERSONAL', 'FOOD_SPLIT', 'EMERGENCY', 'TRAVEL', 'RENT', 'OTHER')
  ),
  notes TEXT,
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'PARTIAL', 'REPAID')
  ),
  receipt_url TEXT,
  repaid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_user_status_due
  ON loans (user_id, status, due_date ASC);

CREATE INDEX IF NOT EXISTS idx_loans_user_friend
  ON loans (user_id, friend_name);

-- 4. Loan Repayments History Table (Supports both Partial & Full repayments)
CREATE TABLE IF NOT EXISTS loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  note VARCHAR(255),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan_id
  ON loan_repayments (loan_id, paid_at DESC);