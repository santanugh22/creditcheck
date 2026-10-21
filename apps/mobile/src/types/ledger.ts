export type SupportedLanguage = "en" | "hi";

export type LoanCategory =
  | "PERSONAL"
  | "FOOD_SPLIT"
  | "EMERGENCY"
  | "TRAVEL"
  | "RENT"
  | "OTHER";

export type StoredLoanStatus = "PENDING" | "PARTIAL" | "REPAID";
export type ComputedLoanStatus = "PENDING" | "PARTIAL" | "REPAID" | "OVERDUE";
export type LoanFilterStatus = "ALL" | "OVERDUE" | "PENDING" | "REPAID";

export interface UserProfile {
  id: string;
  phone: string;
  displayName: string;
  preferredLanguage: SupportedLanguage;
  createdAt: string;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  amount: number;
  note: string | null;
  paidAt: string;
}

export interface LoanEntry {
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
  repayments?: LoanRepayment[];
}

export interface FriendSummaryBreakdown {
  friendName: string;
  friendPhone: string | null;
  totalLent: number;
  totalRepaid: number;
  outstandingAmount: number;
  overdueAmount: number;
  activeCount: number;
}

export interface LedgerSummary {
  totalLent: number;
  totalRepaid: number;
  overdueAmount: number;
  outstandingAmount: number;
  dueSoonAmount: number;
  repaymentRate: number;
  counts: {
    totalEntries: number;
    activeEntries: number;
    overdueEntries: number;
    repaidEntries: number;
    dueSoonEntries: number;
  };
  friendBreakdown: FriendSummaryBreakdown[];
}

export interface CreateLoanPayload {
  friendName: string;
  friendPhone?: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  category: LoanCategory;
  notes?: string;
  receiptUri?: string | null;
}

export interface RepayLoanPayload {
  amount?: number;
  note?: string;
}
