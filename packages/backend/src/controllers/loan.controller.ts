import { Response } from "express";
import fs from "fs";
import path from "path";
import { env } from "../config/env";
import { pool, query } from "../db/pool";
import {
  AuthenticatedRequest,
  ComputedLoanStatus,
  LoanCategory,
  LoanEntryDTO,
  LoanRepaymentDTO,
  StoredLoanStatus,
} from "../types";
import {
  createLoanSchema,
  listLoansQuerySchema,
  repayLoanSchema,
} from "../validators/schemas";

interface LoanRow {
  id: string;
  user_id: string;
  friend_name: string;
  friend_phone: string | null;
  principal_amount: string;
  repaid_amount: string;
  category: LoanCategory;
  notes: string | null;
  due_date: Date | string;
  status: StoredLoanStatus;
  receipt_url: string | null;
  repaid_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface RepaymentRow {
  id: string;
  loan_id: string;
  amount: string;
  note: string | null;
  paid_at: Date;
}

/**
 * Formats a Date or SQL DATE string into YYYY-MM-DD in local time.
 */
function toDateString(value: Date | string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Computes overdue status, days overdue, and remaining balance for a loan row.
 */
export function mapLoanRowToDTO(
  row: LoanRow,
  repayments?: LoanRepaymentDTO[],
): LoanEntryDTO {
  const principalAmount = Number(parseFloat(row.principal_amount).toFixed(2));
  const repaidAmount = Number(parseFloat(row.repaid_amount).toFixed(2));
  const remainingAmount = Number(
    Math.max(0, principalAmount - repaidAmount).toFixed(2),
  );

  const dueDateStr = toDateString(row.due_date);
  const todayStr = toDateString(new Date());

  const dueMs = new Date(`${dueDateStr}T00:00:00Z`).getTime();
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  const diffDays = Math.round((todayMs - dueMs) / (1000 * 60 * 60 * 24));

  const isOverdue = row.status !== "REPAID" && diffDays > 0;
  const daysOverdue = isOverdue ? diffDays : 0;
  const daysUntilDue =
    row.status !== "REPAID" && diffDays <= 0 ? Math.abs(diffDays) : 0;

  const computedStatus: ComputedLoanStatus = isOverdue ? "OVERDUE" : row.status;

  return {
    id: row.id,
    userId: row.user_id,
    friendName: row.friend_name,
    friendPhone: row.friend_phone,
    principalAmount,
    repaidAmount,
    remainingAmount,
    category: row.category,
    notes: row.notes,
    dueDate: dueDateStr,
    status: row.status,
    computedStatus,
    isOverdue,
    daysOverdue,
    daysUntilDue,
    receiptUrl: row.receipt_url,
    repaidAt: row.repaid_at ? new Date(row.repaid_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    ...(repayments ? { repayments } : {}),
  };
}

export async function createLoan(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.userId;

  // Support both 'amount' and 'principalAmount' field names from clients
  const rawBody = {
    ...req.body,
    amount: req.body.amount ?? req.body.principalAmount,
  };

  const parsed = createLoanSchema.safeParse(rawBody);
  if (!parsed.success) {
    if (req.file) {
      cleanupReceiptFile(`/uploads/${req.file.filename}`);
    }
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message || "Invalid loan entry data",
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const { friendName, friendPhone, amount, dueDate, category, notes } =
    parsed.data;
  const uploadedFile = req.file;
  const receiptUrl = uploadedFile ? `/uploads/${uploadedFile.filename}` : null;

  const result = await query<LoanRow>(
    `INSERT INTO loans (
       user_id, friend_name, friend_phone, principal_amount, repaid_amount,
       category, notes, due_date, status, receipt_url
     )
     VALUES ($1, $2, $3, $4, 0.00, $5, $6, $7, 'PENDING', $8)
     RETURNING *`,
    [
      userId,
      friendName,
      friendPhone,
      amount,
      category,
      notes,
      dueDate,
      receiptUrl,
    ],
  );

  res.status(201).json({
    success: true,
    data: mapLoanRowToDTO(result.rows[0], []),
  });
}

export async function listLoans(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.userId;
  const parsedQuery = listLoansQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid query filter parameters",
      },
    });
    return;
  }

  const { status, category, search } = parsedQuery.data;

  const conditions: string[] = ["user_id = $1"];
  const params: unknown[] = [userId];

  if (category && category !== "ALL") {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  if (search && search.length > 0) {
    params.push(`%${search}%`);
    conditions.push(
      `(friend_name ILIKE $${params.length} OR COALESCE(notes, '') ILIKE $${params.length})`,
    );
  }

  if (status === "REPAID") {
    conditions.push(`status = 'REPAID'`);
  } else if (status === "OVERDUE") {
    conditions.push(`status != 'REPAID' AND due_date < CURRENT_DATE`);
  } else if (status === "PENDING" || status === "ACTIVE") {
    conditions.push(`status != 'REPAID' AND due_date >= CURRENT_DATE`);
  } else if (status === "PARTIAL") {
    conditions.push(`status = 'PARTIAL'`);
  }

  // Sort overdue and active entries first (by earliest due_date), then repaid entries
  const sql = `
    SELECT *
    FROM loans
    WHERE ${conditions.join(" AND ")}
    ORDER BY
      CASE WHEN status != 'REPAID' AND due_date < CURRENT_DATE THEN 0
           WHEN status != 'REPAID' THEN 1
           ELSE 2
      END ASC,
      due_date ASC,
      created_at DESC
  `;

  const result = await query<LoanRow>(sql, params);
  const loans = result.rows.map((row) => mapLoanRowToDTO(row));

  res.status(200).json({
    success: true,
    data: loans,
  });
}

export async function getLoanById(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.userId;
  const { id } = req.params;

  const loanResult = await query<LoanRow>(
    `SELECT * FROM loans WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );

  if (loanResult.rows.length === 0) {
    res.status(404).json({
      success: false,
      error: {
        code: "LOAN_NOT_FOUND",
        message: "Loan entry not found.",
      },
    });
    return;
  }

  const repaymentsResult = await query<RepaymentRow>(
    `SELECT id, loan_id, amount, note, paid_at
     FROM loan_repayments
     WHERE loan_id = $1
     ORDER BY paid_at DESC`,
    [id],
  );

  const repayments: LoanRepaymentDTO[] = repaymentsResult.rows.map((r) => ({
    id: r.id,
    loanId: r.loan_id,
    amount: Number(parseFloat(r.amount).toFixed(2)),
    note: r.note,
    paidAt: new Date(r.paid_at).toISOString(),
  }));

  res.status(200).json({
    success: true,
    data: mapLoanRowToDTO(loanResult.rows[0], repayments),
  });
}

/**
 * Marks a loan as repaid (if no amount is passed, settles 100% of remaining balance)
 * or records a partial repayment if a smaller amount is specified.
 */
export async function markLoanRepaid(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.userId;
  const { id } = req.params;

  const parsed = repayLoanSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message || "Invalid repayment data",
      },
    });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingResult = await client.query<LoanRow>(
      `SELECT * FROM loans WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [id, userId],
    );

    if (existingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({
        success: false,
        error: {
          code: "LOAN_NOT_FOUND",
          message: "Loan entry not found.",
        },
      });
      return;
    }

    const loan = existingResult.rows[0];
    const principal = Number(parseFloat(loan.principal_amount).toFixed(2));
    const currentRepaid = Number(parseFloat(loan.repaid_amount).toFixed(2));
    const remaining = Number(Math.max(0, principal - currentRepaid).toFixed(2));

    if (loan.status === "REPAID" || remaining <= 0) {
      await client.query("ROLLBACK");
      res.status(400).json({
        success: false,
        error: {
          code: "ALREADY_REPAID",
          message: "This loan entry is already marked as fully repaid.",
        },
      });
      return;
    }

    const paymentAmount = parsed.data.amount
      ? Number(parsed.data.amount.toFixed(2))
      : remaining;

    if (paymentAmount > remaining + 0.001) {
      await client.query("ROLLBACK");
      res.status(400).json({
        success: false,
        error: {
          code: "AMOUNT_EXCEEDS_REMAINING",
          message: `Repayment amount (₹${paymentAmount}) cannot exceed remaining balance (₹${remaining}).`,
        },
      });
      return;
    }

    const newRepaidAmount = Number(
      Math.min(principal, currentRepaid + paymentAmount).toFixed(2),
    );
    const isNowFullyRepaid = newRepaidAmount >= principal - 0.001;
    const newStatus: StoredLoanStatus = isNowFullyRepaid ? "REPAID" : "PARTIAL";

    // 1. Insert repayment history record
    await client.query(
      `INSERT INTO loan_repayments (loan_id, amount, note)
       VALUES ($1, $2, $3)`,
      [
        id,
        paymentAmount,
        parsed.data.note ||
          (isNowFullyRepaid ? "Full settlement" : "Partial repayment"),
      ],
    );

    // 2. Update parent loan row
    const updatedLoanResult = await client.query<LoanRow>(
      `UPDATE loans
       SET repaid_amount = $1,
           status = $2,
           repaid_at = CASE WHEN $4 THEN NOW() ELSE repaid_at END,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newRepaidAmount, newStatus, id, isNowFullyRepaid],
    );

    // 3. Fetch updated repayments list
    const repaymentsResult = await client.query<RepaymentRow>(
      `SELECT id, loan_id, amount, note, paid_at
       FROM loan_repayments
       WHERE loan_id = $1
       ORDER BY paid_at DESC`,
      [id],
    );

    await client.query("COMMIT");

    const repayments: LoanRepaymentDTO[] = repaymentsResult.rows.map((r) => ({
      id: r.id,
      loanId: r.loan_id,
      amount: Number(parseFloat(r.amount).toFixed(2)),
      note: r.note,
      paidAt: new Date(r.paid_at).toISOString(),
    }));

    res.status(200).json({
      success: true,
      data: mapLoanRowToDTO(updatedLoanResult.rows[0], repayments),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function cleanupReceiptFile(receiptUrl: string | null | undefined): void {
  if (receiptUrl && receiptUrl.startsWith("/uploads/")) {
    const filename = receiptUrl.replace("/uploads/", "");
    const fullPath = path.join(env.UPLOAD_ABSOLUTE_PATH, filename);
    fs.promises.unlink(fullPath).catch(() => {});
  }
}

export async function attachLoanReceipt(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.userId;
  const { id } = req.params;

  if (!req.file) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_FILE",
        message: "Please attach a valid receipt image file.",
      },
    });
    return;
  }

  const receiptUrl = `/uploads/${req.file.filename}`;

  // Fetch previous loan record to clean up old receipt if present
  const existingResult = await query<{ receipt_url: string | null }>(
    `SELECT receipt_url FROM loans WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );

  if (existingResult.rows.length === 0) {
    // Delete the newly uploaded file if loan doesn't exist
    cleanupReceiptFile(receiptUrl);
    res.status(404).json({
      success: false,
      error: {
        code: "LOAN_NOT_FOUND",
        message: "Loan entry not found.",
      },
    });
    return;
  }

  const oldReceiptUrl = existingResult.rows[0].receipt_url;

  const result = await query<LoanRow>(
    `UPDATE loans
     SET receipt_url = $1,
         updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [receiptUrl, id, userId],
  );

  // If old receipt existed on disk, remove it now
  if (oldReceiptUrl && oldReceiptUrl !== receiptUrl) {
    cleanupReceiptFile(oldReceiptUrl);
  }

  res.status(200).json({
    success: true,
    data: mapLoanRowToDTO(result.rows[0]),
  });
}

export async function deleteLoan(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.userId;
  const { id } = req.params;

  const result = await query<{ id: string; receipt_url: string | null }>(
    `DELETE FROM loans WHERE id = $1 AND user_id = $2 RETURNING id, receipt_url`,
    [id, userId],
  );

  if (result.rows.length === 0) {
    res.status(404).json({
      success: false,
      error: {
        code: "LOAN_NOT_FOUND",
        message: "Loan entry not found.",
      },
    });
    return;
  }

  // Remove receipt from disk if exists
  cleanupReceiptFile(result.rows[0].receipt_url);

  res.status(200).json({
    success: true,
    data: { id: result.rows[0].id, deleted: true },
  });
}
