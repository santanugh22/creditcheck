import { NextFunction, Request, Response, Router } from "express";
import {
  getMe,
  requestOtp,
  updateProfile,
  verifyOtp,
} from "../controllers/auth.controller";
import {
  attachLoanReceipt,
  createLoan,
  deleteLoan,
  getLoanById,
  listLoans,
  markLoanRepaid,
} from "../controllers/loan.controller";
import { getLedgerSummary } from "../controllers/summary.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { receiptUpload } from "../middleware/upload.middleware";
import { AuthenticatedRequest } from "../types";

export const apiRouter = Router();

/**
 * Wraps async route handlers so unhandled promise rejections forward to Express error middleware.
 */
function asyncHandler(
  fn: (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthenticatedRequest, res, next)).catch(next);
  };
}

// Health check endpoint
apiRouter.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      service: "@miniledger/backend",
      edition: "Bharat Edition",
      status: "OK",
      timestamp: new Date().toISOString(),
    },
  });
});

// ============================================================================
// 1. Authentication Routes (Phone + Mock OTP)
// ============================================================================
apiRouter.post("/auth/request-otp", asyncHandler(requestOtp));
apiRouter.post("/auth/verify-otp", asyncHandler(verifyOtp));
apiRouter.get("/auth/me", requireAuth, asyncHandler(getMe));
apiRouter.patch("/auth/profile", requireAuth, asyncHandler(updateProfile));

// ============================================================================
// 2. Summary Route (Total Lent, Total Repaid, Overdue Amount & Breakdown)
// ============================================================================
apiRouter.get("/summary", requireAuth, asyncHandler(getLedgerSummary));
apiRouter.get("/loans/summary", requireAuth, asyncHandler(getLedgerSummary));

// ============================================================================
// 3. Loan (Udhaar / Khata) CRUD + Repayment + Receipt Upload Routes
// ============================================================================
apiRouter.get("/loans", requireAuth, asyncHandler(listLoans));

apiRouter.post(
  "/loans",
  requireAuth,
  receiptUpload.single("receipt"),
  asyncHandler(createLoan),
);

apiRouter.get("/loans/:id", requireAuth, asyncHandler(getLoanById));

// Support both PATCH and POST for marking a loan as repaid (full or partial)
apiRouter.patch("/loans/:id/repay", requireAuth, asyncHandler(markLoanRepaid));
apiRouter.post("/loans/:id/repay", requireAuth, asyncHandler(markLoanRepaid));

// Attach or replace a receipt photo on an existing loan entry
apiRouter.post(
  "/loans/:id/receipt",
  requireAuth,
  receiptUpload.single("receipt"),
  asyncHandler(attachLoanReceipt),
);

apiRouter.delete("/loans/:id", requireAuth, asyncHandler(deleteLoan));
