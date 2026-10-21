import { Response } from "express";
import { query } from "../db/pool";
import {
  AuthenticatedRequest,
  FriendSummaryBreakdownDTO,
  LedgerSummaryDTO,
} from "../types";

interface SummaryAggRow {
  total_lent: string;
  total_repaid: string;
  overdue_amount: string;
  outstanding_amount: string;
  due_soon_amount: string;
  total_entries: string;
  active_entries: string;
  overdue_entries: string;
  repaid_entries: string;
  due_soon_entries: string;
}

interface FriendAggRow {
  friend_name: string;
  friend_phone: string | null;
  total_lent: string;
  total_repaid: string;
  outstanding_amount: string;
  overdue_amount: string;
  active_count: string;
}

export async function getLedgerSummary(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.userId;

  const aggResult = await query<SummaryAggRow>(
    `SELECT
       COALESCE(SUM(principal_amount), 0)::NUMERIC(12,2) AS total_lent,
       COALESCE(SUM(repaid_amount), 0)::NUMERIC(12,2) AS total_repaid,
       COALESCE(
         SUM(
           CASE
             WHEN status != 'REPAID' AND due_date < CURRENT_DATE
             THEN (principal_amount - repaid_amount)
             ELSE 0
           END
         ),
         0
       )::NUMERIC(12,2) AS overdue_amount,
       COALESCE(
         SUM(
           CASE
             WHEN status != 'REPAID'
             THEN (principal_amount - repaid_amount)
             ELSE 0
           END
         ),
         0
       )::NUMERIC(12,2) AS outstanding_amount,
       COALESCE(
         SUM(
           CASE
             WHEN status != 'REPAID'
              AND due_date >= CURRENT_DATE
              AND due_date <= (CURRENT_DATE + INTERVAL '3 days')
             THEN (principal_amount - repaid_amount)
             ELSE 0
           END
         ),
         0
       )::NUMERIC(12,2) AS due_soon_amount,
       COUNT(*) AS total_entries,
       COUNT(*) FILTER (WHERE status != 'REPAID') AS active_entries,
       COUNT(*) FILTER (WHERE status != 'REPAID' AND due_date < CURRENT_DATE) AS overdue_entries,
       COUNT(*) FILTER (WHERE status = 'REPAID') AS repaid_entries,
       COUNT(*) FILTER (
         WHERE status != 'REPAID'
           AND due_date >= CURRENT_DATE
           AND due_date <= (CURRENT_DATE + INTERVAL '3 days')
       ) AS due_soon_entries
     FROM loans
     WHERE user_id = $1`,
    [userId],
  );

  const friendResult = await query<FriendAggRow>(
    `SELECT
       friend_name,
       MAX(friend_phone) AS friend_phone,
       COALESCE(SUM(principal_amount), 0)::NUMERIC(12,2) AS total_lent,
       COALESCE(SUM(repaid_amount), 0)::NUMERIC(12,2) AS total_repaid,
       COALESCE(
         SUM(CASE WHEN status != 'REPAID' THEN (principal_amount - repaid_amount) ELSE 0 END),
         0
       )::NUMERIC(12,2) AS outstanding_amount,
       COALESCE(
         SUM(
           CASE
             WHEN status != 'REPAID' AND due_date < CURRENT_DATE
             THEN (principal_amount - repaid_amount)
             ELSE 0
           END
         ),
         0
       )::NUMERIC(12,2) AS overdue_amount,
       COUNT(*) FILTER (WHERE status != 'REPAID') AS active_count
     FROM loans
     WHERE user_id = $1
     GROUP BY friend_name
     ORDER BY outstanding_amount DESC, total_lent DESC
     LIMIT 15`,
    [userId],
  );

  const row = aggResult.rows[0];
  const totalLent = Number(parseFloat(row.total_lent).toFixed(2));
  const totalRepaid = Number(parseFloat(row.total_repaid).toFixed(2));
  const overdueAmount = Number(parseFloat(row.overdue_amount).toFixed(2));
  const outstandingAmount = Number(
    parseFloat(row.outstanding_amount).toFixed(2),
  );
  const dueSoonAmount = Number(parseFloat(row.due_soon_amount).toFixed(2));

  const repaymentRate =
    totalLent > 0 ? Number(((totalRepaid / totalLent) * 100).toFixed(1)) : 0;

  const friendBreakdown: FriendSummaryBreakdownDTO[] = friendResult.rows.map(
    (f) => ({
      friendName: f.friend_name,
      friendPhone: f.friend_phone,
      totalLent: Number(parseFloat(f.total_lent).toFixed(2)),
      totalRepaid: Number(parseFloat(f.total_repaid).toFixed(2)),
      outstandingAmount: Number(parseFloat(f.outstanding_amount).toFixed(2)),
      overdueAmount: Number(parseFloat(f.overdue_amount).toFixed(2)),
      activeCount: parseInt(f.active_count, 10),
    }),
  );

  const summary: LedgerSummaryDTO = {
    totalLent,
    totalRepaid,
    overdueAmount,
    outstandingAmount,
    dueSoonAmount,
    repaymentRate,
    counts: {
      totalEntries: parseInt(row.total_entries, 10),
      activeEntries: parseInt(row.active_entries, 10),
      overdueEntries: parseInt(row.overdue_entries, 10),
      repaidEntries: parseInt(row.repaid_entries, 10),
      dueSoonEntries: parseInt(row.due_soon_entries, 10),
    },
    friendBreakdown,
  };

  res.status(200).json({
    success: true,
    data: summary,
  });
}
