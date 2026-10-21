import { create } from "zustand";
import { apiClient } from "../services/api";
import {
  CreateLoanPayload,
  LedgerSummary,
  LoanCategory,
  LoanEntry,
  LoanFilterStatus,
  RepayLoanPayload,
} from "../types/ledger";

const EMPTY_SUMMARY: LedgerSummary = {
  totalLent: 0,
  totalRepaid: 0,
  overdueAmount: 0,
  outstandingAmount: 0,
  dueSoonAmount: 0,
  repaymentRate: 0,
  counts: {
    totalEntries: 0,
    activeEntries: 0,
    overdueEntries: 0,
    repaidEntries: 0,
    dueSoonEntries: 0,
  },
  friendBreakdown: [],
};

interface LedgerState {
  loans: LoanEntry[];
  summary: LedgerSummary;
  selectedLoan: LoanEntry | null;
  statusFilter: LoanFilterStatus;
  categoryFilter: LoanCategory | "ALL";
  searchQuery: string;
  isLoading: boolean;
  isRefreshing: boolean;
  isSubmitting: boolean;
  error: string | null;

  fetchDashboard: (silent?: boolean) => Promise<void>;
  fetchLoanDetail: (id: string) => Promise<LoanEntry>;
  createLoanEntry: (payload: CreateLoanPayload) => Promise<LoanEntry>;
  repayLoanEntry: (
    id: string,
    payload?: RepayLoanPayload,
  ) => Promise<LoanEntry>;
  attachReceiptToLoan: (id: string, receiptUri: string) => Promise<LoanEntry>;
  deleteLoanEntry: (id: string) => Promise<void>;
  setStatusFilter: (status: LoanFilterStatus) => void;
  setCategoryFilter: (category: LoanCategory | "ALL") => void;
  setSearchQuery: (query: string) => void;
  setSelectedLoan: (loan: LoanEntry | null) => void;
  resetLedger: () => void;
}

export const useLedgerStore = create<LedgerState>((set, get) => ({
  loans: [],
  summary: EMPTY_SUMMARY,
  selectedLoan: null,
  statusFilter: "ALL",
  categoryFilter: "ALL",
  searchQuery: "",
  isLoading: false,
  isRefreshing: false,
  isSubmitting: false,
  error: null,

  fetchDashboard: async (silent = false) => {
    if (silent) {
      set({ isRefreshing: true, error: null });
    } else {
      set({ isLoading: true, error: null });
    }

    try {
      const [loans, summary] = await Promise.all([
        apiClient.listLoans(),
        apiClient.getSummary(),
      ]);

      const currentSelected = get().selectedLoan;
      const updatedSelected = currentSelected
        ? loans.find((item) => item.id === currentSelected.id) ||
          currentSelected
        : null;

      set({
        loans,
        summary,
        selectedLoan: updatedSelected,
        isLoading: false,
        isRefreshing: false,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load ledger entries";
      set({
        isLoading: false,
        isRefreshing: false,
        error: message,
      });
    }
  },

  fetchLoanDetail: async (id: string) => {
    const detailed = await apiClient.getLoanById(id);
    set({ selectedLoan: detailed });
    return detailed;
  },

  createLoanEntry: async (payload: CreateLoanPayload) => {
    set({ isSubmitting: true, error: null });
    try {
      const created = await apiClient.createLoan(payload);
      await get().fetchDashboard(true);
      set({ isSubmitting: false });
      return created;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save loan entry";
      set({ isSubmitting: false, error: message });
      throw err;
    }
  },

  repayLoanEntry: async (id: string, payload?: RepayLoanPayload) => {
    set({ isSubmitting: true, error: null });
    try {
      const updated = await apiClient.repayLoan(id, payload);
      await get().fetchDashboard(true);
      set({ selectedLoan: updated, isSubmitting: false });
      return updated;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to record repayment";
      set({ isSubmitting: false, error: message });
      throw err;
    }
  },

  attachReceiptToLoan: async (id: string, receiptUri: string) => {
    set({ isSubmitting: true, error: null });
    try {
      const updated = await apiClient.attachReceipt(id, receiptUri);
      const refreshedDetail = await apiClient.getLoanById(id);
      await get().fetchDashboard(true);
      set({ selectedLoan: refreshedDetail || updated, isSubmitting: false });
      return refreshedDetail || updated;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload receipt";
      set({ isSubmitting: false, error: message });
      throw err;
    }
  },

  deleteLoanEntry: async (id: string) => {
    set({ isSubmitting: true, error: null });
    try {
      await apiClient.deleteLoan(id);
      set({ selectedLoan: null, isSubmitting: false });
      await get().fetchDashboard(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete entry";
      set({ isSubmitting: false, error: message });
      throw err;
    }
  },

  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedLoan: (selectedLoan) => set({ selectedLoan }),
  resetLedger: () =>
    set({
      loans: [],
      summary: EMPTY_SUMMARY,
      selectedLoan: null,
      statusFilter: "ALL",
      categoryFilter: "ALL",
      searchQuery: "",
      error: null,
    }),
}));

/**
 * Pure selector helper that filters loans by status tab, category, and search query.
 */
export function selectFilteredLoans(
  loans: LoanEntry[],
  statusFilter: LoanFilterStatus,
  categoryFilter: LoanCategory | "ALL",
  searchQuery: string,
): LoanEntry[] {
  const q = searchQuery.trim().toLowerCase();

  return loans.filter((loan) => {
    if (statusFilter === "OVERDUE" && !loan.isOverdue) return false;
    if (statusFilter === "REPAID" && loan.status !== "REPAID") return false;
    if (statusFilter === "PENDING" && loan.status === "REPAID") return false;

    if (categoryFilter !== "ALL" && loan.category !== categoryFilter) {
      return false;
    }

    if (q.length > 0) {
      const matchName = loan.friendName.toLowerCase().includes(q);
      const matchNotes = (loan.notes || "").toLowerCase().includes(q);
      const matchPhone = (loan.friendPhone || "").toLowerCase().includes(q);
      if (!matchName && !matchNotes && !matchPhone) return false;
    }

    return true;
  });
}
