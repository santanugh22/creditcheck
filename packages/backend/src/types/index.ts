import { Request } from "express";

export type SupportedLanguage = "en" | "hi";

export type LoanCategory =
  | "PERSONAL"
  | "FOOD_SPLIT"
  | "EMERGENCY"
  | "TRAVEL"
  | "RENT"
  | "OTHER";

export type StoredLoanStatus = "PENDING" | "PARTIAL" | "REPAID";

/**
 * Computed status includes OVERDUE when due_date < today and status !== 'REPAID'
 */
export type ComputedLoanStatus = "PENDING" | "PARTIAL" | "REPAID" | "OVERDUE";

export interface UserDTO {
  id: string;
  phone: string;
  displayName: string;
  preferredLanguage: SupportedLanguage;
  createdAt: string;
}

export interface LoanRepaymentDTO {
  id: string;
  loanId: string;
  amount: number;
  note: string | null;
  paidAt: string;
}

export interface LoanEntryDTO {
  id: string;
  userId: string;
  friendName: string;
  friendPhone: string | null;
  principalAmount: number;
  repaidAmount: number;
  remainingAmount: number;
  category: LoanCategory;
  notes: string | null;
  dueDate: string; // YYYY-MM-DD
  status: StoredLoanStatus;
  computedStatus: ComputedLoanStatus;
  isOverdue: boolean;
  daysOverdue: number;
  daysUntilDue: number;
  receiptUrl: string | null;
  repaidAt: string | null;
  createdAt: string;
  updatedAt: string;
  repayments?: LoanRepaymentDTO[];
}

export interface FriendSummaryBreakdownDTO {
  friendName: string;
  friendPhone: string | null;
  totalLent: number;
  totalRepaid: number;
  outstandingAmount: number;
  overdueAmount: number;
  activeCount: number;
}

export interface LedgerSummaryDTO {
  /** Base required fields */
  totalLent: number;
  totalRepaid: number;
  overdueAmount: number;
  /** Expanded Bharat Edition intelligence metrics */
  outstandingAmount: number;
  dueSoonAmount: number; // Due within next 3 days
  repaymentRate: number; // Percentage 0 - 100
  counts: {
    totalEntries: number;
    activeEntries: number;
    overdueEntries: number;
    repaidEntries: number;
    dueSoonEntries: number;
  };
  friendBreakdown: FriendSummaryBreakdownDTO[];
}

export interface JwtUserPayload {
  userId: string;
  phone: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}
