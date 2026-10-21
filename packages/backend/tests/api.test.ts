import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env";
import * as dbPool from "../src/db/pool";
import { app } from "../src/app";
import { mapLoanRowToDTO } from "../src/controllers/loan.controller";
import {
  createLoanSchema,
  normalizePhoneNumber,
  verifyOtpSchema,
} from "../src/validators/schemas";

describe("MiniLedger Backend — Unit, Validation & API Integration Suite", () => {
  const mockQuery = vi.spyOn(dbPool, "query");

  beforeEach(() => {
    mockQuery.mockReset();
  });

  // ==========================================================================
  // 1. Phone Normalization & Zod Schema Validation Tests
  // ==========================================================================
  describe("Input Validation & Indian Phone Normalization", () => {
    it("normalizes 10-digit Indian mobile numbers to +91 format", () => {
      expect(normalizePhoneNumber("9876543210")).toBe("+919876543210");
      expect(normalizePhoneNumber("09876543210")).toBe("+919876543210");
      expect(normalizePhoneNumber("+91 98765-43210")).toBe("+919876543210");
    });

    it("validates loan creation payloads and rejects negative amounts", () => {
      const valid = createLoanSchema.safeParse({
        friendName: "Aarav Sharma",
        friendPhone: "9876543210",
        amount: "2500.50",
        dueDate: "2026-11-15",
        category: "FOOD_SPLIT",
        notes: "Dinner split at Connaught Place",
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.amount).toBe(2500.5);
        expect(valid.data.friendPhone).toBe("+919876543210");
      }

      const invalid = createLoanSchema.safeParse({
        friendName: "",
        amount: -500,
        dueDate: "15-11-2026", // Wrong format
      });
      expect(invalid.success).toBe(false);

      const pastDate = createLoanSchema.safeParse({
        friendName: "Past Date Friend",
        amount: 500,
        dueDate: "2020-01-01",
      });
      expect(pastDate.success).toBe(false);
      if (!pastDate.success) {
        expect(pastDate.error.issues[0]?.message).toBe(
          "Due date cannot be in the past",
        );
      }
    });

    it("rejects non-6-digit OTP codes", () => {
      const res = verifyOtpSchema.safeParse({
        phone: "9876543210",
        otp: "1234",
      });
      expect(res.success).toBe(false);
    });
  });

  // ==========================================================================
  // 2. Overdue Calculation Logic Tests
  // ==========================================================================
  describe("Overdue Highlighting & Computed Status Engine", () => {
    it("marks an unpaid loan with a past due date as OVERDUE with positive daysOverdue", () => {
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const dto = mapLoanRowToDTO({
        id: "11111111-1111-1111-1111-111111111111",
        user_id: "22222222-2222-2222-2222-222222222222",
        friend_name: "Rohan Verma",
        friend_phone: "+919811122233",
        principal_amount: "5000.00",
        repaid_amount: "1000.00",
        category: "EMERGENCY",
        notes: "Medical bill assist",
        due_date: pastDate,
        status: "PARTIAL",
        receipt_url: null,
        repaid_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      expect(dto.isOverdue).toBe(true);
      expect(dto.computedStatus).toBe("OVERDUE");
      expect(dto.daysOverdue).toBeGreaterThanOrEqual(4);
      expect(dto.remainingAmount).toBe(4000);
    });

    it("never marks a REPAID loan as overdue even if due_date is in the past", () => {
      const pastDate = "2025-01-10";
      const dto = mapLoanRowToDTO({
        id: "11111111-1111-1111-1111-111111111111",
        user_id: "22222222-2222-2222-2222-222222222222",
        friend_name: "Priya Nair",
        friend_phone: null,
        principal_amount: "1500.00",
        repaid_amount: "1500.00",
        category: "PERSONAL",
        notes: null,
        due_date: pastDate,
        status: "REPAID",
        receipt_url: "/uploads/receipt-demo.jpg",
        repaid_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });

      expect(dto.isOverdue).toBe(false);
      expect(dto.computedStatus).toBe("REPAID");
      expect(dto.remainingAmount).toBe(0);
    });
  });

  // ==========================================================================
  // 3. REST API Endpoint Tests (Supertest)
  // ==========================================================================
  describe("API Endpoints (/api/v1/*)", () => {
    const testUser = {
      userId: "aaaa1111-bbbb-2222-cccc-333333333333",
      phone: "+919876543210",
    };
    const validToken = jwt.sign(testUser, env.JWT_SECRET, { expiresIn: "1h" });

    it("GET /api/v1/health returns 200 OK", async () => {
      const res = await request(app).get("/api/v1/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("OK");
    });

    it("POST /api/v1/auth/request-otp generates and logs a 6-digit mock OTP", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        command: "INSERT",
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post("/api/v1/auth/request-otp")
        .send({ phone: "9876543210" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phone).toBe("+919876543210");
      expect(res.body.data.debugOtp).toMatch(/^\d{6}$/);
    });

    it("GET /api/v1/loans rejects unauthenticated requests with 401", async () => {
      const res = await request(app).get("/api/v1/loans");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("POST /api/v1/loans creates a new loan entry with valid JWT", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "99999999-8888-7777-6666-555555555555",
            user_id: testUser.userId,
            friend_name: "Vikramaditya Rao",
            friend_phone: "+919988776655",
            principal_amount: "3200.00",
            repaid_amount: "0.00",
            category: "TRAVEL",
            notes: "Goa flight ticket",
            due_date: "2026-12-31",
            status: "PENDING",
            receipt_url: null,
            repaid_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        command: "INSERT",
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post("/api/v1/loans")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          friendName: "Vikramaditya Rao",
          friendPhone: "9988776655",
          amount: 3200,
          dueDate: "2026-12-31",
          category: "TRAVEL",
          notes: "Goa flight ticket",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.friendName).toBe("Vikramaditya Rao");
      expect(res.body.data.principalAmount).toBe(3200);
      expect(res.body.data.computedStatus).toBe("PENDING");
    });

    it("POST /api/v1/loans creates a new loan with multipart/form-data receipt upload", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "33333333-3333-3333-3333-333333333333",
            user_id: "test-user-id-1234",
            friend_name: "Sneha Patel",
            friend_phone: "+919876543210",
            principal_amount: "1500.00",
            repaid_amount: "0.00",
            category: "FOOD_SPLIT",
            notes: "Cafe receipt attached",
            due_date: "2026-11-20",
            status: "PENDING",
            receipt_url: "/uploads/receipt-test-123.jpg",
            repaid_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        command: "INSERT",
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const fakeImageBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

      const res = await request(app)
        .post("/api/v1/loans")
        .set("Authorization", `Bearer ${validToken}`)
        .field("friendName", "Sneha Patel")
        .field("friendPhone", "9876543210")
        .field("amount", "1500")
        .field("dueDate", "2026-11-20")
        .field("category", "FOOD_SPLIT")
        .field("notes", "Cafe receipt attached")
        .attach("receipt", fakeImageBuffer, {
          filename: "receipt.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.friendName).toBe("Sneha Patel");
      expect(res.body.data.receiptUrl).toContain("/uploads/");
    });

    it("POST /api/v1/loans accepts receipt when mobile client sends application/octet-stream", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "44444444-4444-4444-4444-444444444444",
            user_id: "test-user-id-1234",
            friend_name: "Karan Johar",
            friend_phone: null,
            principal_amount: "800.00",
            repaid_amount: "0.00",
            category: "PERSONAL",
            notes: null,
            due_date: "2026-12-01",
            status: "PENDING",
            receipt_url: "/uploads/receipt-octet-stream.jpg",
            repaid_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        command: "INSERT",
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const fakeImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      const res = await request(app)
        .post("/api/v1/loans")
        .set("Authorization", `Bearer ${validToken}`)
        .field("friendName", "Karan Johar")
        .field("amount", "800")
        .field("dueDate", "2026-12-01")
        .attach("receipt", fakeImageBuffer, {
          filename: "1000000034.jpg",
          contentType: "application/octet-stream",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.friendName).toBe("Karan Johar");
    });

    it("POST /api/v1/loans/:id/receipt attaches receipt to existing loan", async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ receipt_url: null }],
          command: "SELECT",
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "55555555-5555-5555-5555-555555555555",
              user_id: "test-user-id-1234",
              friend_name: "Ananya Roy",
              friend_phone: null,
              principal_amount: "2000.00",
              repaid_amount: "0.00",
              category: "RENT",
              notes: "Rent receipt",
              due_date: "2026-12-05",
              status: "PENDING",
              receipt_url: "/uploads/receipt-updated.jpg",
              repaid_at: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          command: "UPDATE",
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      const fakeImageBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

      const res = await request(app)
        .post("/api/v1/loans/55555555-5555-5555-5555-555555555555/receipt")
        .set("Authorization", `Bearer ${validToken}`)
        .attach("receipt", fakeImageBuffer, {
          filename: "bill.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.receiptUrl).toBe("/uploads/receipt-updated.jpg");
    });

    it("POST /api/v1/loans rejects disallowed file types like PDF", async () => {
      const fakePdfBuffer = Buffer.from("%PDF-1.4");

      const res = await request(app)
        .post("/api/v1/loans")
        .set("Authorization", `Bearer ${validToken}`)
        .field("friendName", "Invalid File Friend")
        .field("amount", "100")
        .field("dueDate", "2026-12-01")
        .attach("receipt", fakePdfBuffer, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_FILE_TYPE");
    });

    it("GET /api/v1/summary returns totalLent, totalRepaid, overdueAmount, and friendBreakdown", async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              total_lent: "15000.00",
              total_repaid: "6000.00",
              overdue_amount: "4000.00",
              outstanding_amount: "9000.00",
              due_soon_amount: "5000.00",
              total_entries: "3",
              active_entries: "2",
              overdue_entries: "1",
              repaid_entries: "1",
              due_soon_entries: "1",
            },
          ],
          command: "SELECT",
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              friend_name: "Rohan Verma",
              friend_phone: "+919811122233",
              total_lent: "10000.00",
              total_repaid: "6000.00",
              outstanding_amount: "4000.00",
              overdue_amount: "4000.00",
              active_count: "1",
            },
          ],
          command: "SELECT",
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      const res = await request(app)
        .get("/api/v1/summary")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalLent).toBe(15000);
      expect(res.body.data.totalRepaid).toBe(6000);
      expect(res.body.data.overdueAmount).toBe(4000);
      expect(res.body.data.repaymentRate).toBe(40);
      expect(res.body.data.friendBreakdown).toHaveLength(1);
    });
  });
});
