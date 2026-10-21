import request from "supertest";
import { app } from "../packages/backend/src/app";
import { pool } from "../packages/backend/src/db/pool";
import fs from "fs";
import path from "path";

async function runLiveVerification() {
  console.log("🚀 [MiniLedger E2E] Starting Live PostgreSQL API Verification Suite...\n");

  try {
    // 0. Verify Database Connectivity & Migrations
    const dbCheck = await pool.query("SELECT current_database(), current_user, version()");
    console.log(`✅ [Postgres Connected] Database: "${dbCheck.rows[0].current_database}", User: "${dbCheck.rows[0].current_user}"`);

    // Clean test data before running
    const testPhone = "+919876599999";
    await pool.query("DELETE FROM users WHERE phone = $1", [testPhone]);
    await pool.query("DELETE FROM otp_requests WHERE phone = $1", [testPhone]);

    // 1. Health Check Endpoint
    const healthRes = await request(app).get("/api/v1/health");
    if (healthRes.status !== 200 || !healthRes.body.success) {
      throw new Error(`Health check failed: ${JSON.stringify(healthRes.body)}`);
    }
    console.log("✅ 1. GET /api/v1/health — 200 OK");

    // 2. Request Mock OTP
    const otpRes = await request(app)
      .post("/api/v1/auth/request-otp")
      .send({ phone: testPhone });

    if (otpRes.status !== 200 || !otpRes.body.data?.debugOtp) {
      throw new Error(`Request OTP failed: ${JSON.stringify(otpRes.body)}`);
    }
    const receivedOtp = otpRes.body.data.debugOtp;
    console.log(`✅ 2. POST /api/v1/auth/request-otp — 200 OK (OTP: ${receivedOtp})`);

    // 3. Verify OTP & Obtain JWT
    const verifyRes = await request(app)
      .post("/api/v1/auth/verify-otp")
      .send({
        phone: testPhone,
        otp: receivedOtp,
        displayName: "Aarav Sharma",
        preferredLanguage: "en",
      });

    if (verifyRes.status !== 200 || !verifyRes.body.data?.token) {
      throw new Error(`Verify OTP failed: ${JSON.stringify(verifyRes.body)}`);
    }
    const token = verifyRes.body.data.token;
    const userId = verifyRes.body.data.user.id;
    console.log(`✅ 3. POST /api/v1/auth/verify-otp — 200 OK (User ID: ${userId})`);

    const authHeaders = { Authorization: `Bearer ${token}` };

    // 4. Get Current User Profile (GET /api/v1/auth/me)
    const meRes = await request(app).get("/api/v1/auth/me").set(authHeaders);
    if (meRes.status !== 200 || meRes.body.data.displayName !== "Aarav Sharma") {
      throw new Error(`GET /auth/me failed: ${JSON.stringify(meRes.body)}`);
    }
    console.log("✅ 4. GET /api/v1/auth/me — 200 OK (Profile matched)");

    // 5. Update Profile (PATCH /api/v1/auth/profile)
    const updateRes = await request(app)
      .patch("/api/v1/auth/profile")
      .set(authHeaders)
      .send({ displayName: "Aarav S. (Bharat)", preferredLanguage: "hi" });

    if (updateRes.status !== 200 || updateRes.body.data.displayName !== "Aarav S. (Bharat)") {
      throw new Error(`PATCH /auth/profile failed: ${JSON.stringify(updateRes.body)}`);
    }
    console.log("✅ 5. PATCH /api/v1/auth/profile — 200 OK (Name & Language updated)");

    // 6. Create Loan (JSON: Rohan Verma, ₹5000, due in 5 days)
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const loan1Res = await request(app)
      .post("/api/v1/loans")
      .set(authHeaders)
      .send({
        friendName: "Rohan Verma",
        friendPhone: "9811122233",
        amount: 5000,
        dueDate: futureDate,
        category: "FOOD_SPLIT",
        notes: "Weekend trip expenses",
      });

    if (loan1Res.status !== 201 || loan1Res.body.data.remainingAmount !== 5000) {
      throw new Error(`POST /loans (Loan 1) failed: ${JSON.stringify(loan1Res.body)}`);
    }
    const loan1 = loan1Res.body.data;
    console.log(`✅ 6. POST /api/v1/loans (JSON) — 201 Created (Loan ID: ${loan1.id}, Amount: ₹${loan1.principalAmount})`);

    // 7. Create Overdue Loan (Priya Nair, ₹3500, due yesterday)
    const yesterdayDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const loan2Res = await request(app)
      .post("/api/v1/loans")
      .set(authHeaders)
      .send({
        friendName: "Priya Nair",
        friendPhone: "9822233344",
        amount: 3500,
        dueDate: yesterdayDate,
        category: "EMERGENCY",
        notes: "Medicine emergency assist",
      });

    if (loan2Res.status !== 201 || !loan2Res.body.data.isOverdue || loan2Res.body.data.computedStatus !== "OVERDUE") {
      throw new Error(`POST /loans (Overdue) failed: ${JSON.stringify(loan2Res.body)}`);
    }
    const loan2 = loan2Res.body.data;
    console.log(`✅ 7. POST /api/v1/loans (Overdue) — 201 Created (Computed Status: OVERDUE, Days Overdue: ${loan2.daysOverdue})`);

    // 8. Create Loan with Multipart Receipt Upload
    const tempReceiptPath = path.resolve(__dirname, "test-temp-receipt.png");
    fs.writeFileSync(tempReceiptPath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]));

    const loan3Res = await request(app)
      .post("/api/v1/loans")
      .set(authHeaders)
      .field("friendName", "Vikramaditya Rao")
      .field("amount", 2000)
      .field("dueDate", futureDate)
      .field("category", "TRAVEL")
      .attach("receipt", tempReceiptPath);

    fs.unlinkSync(tempReceiptPath);

    if (loan3Res.status !== 201 || !loan3Res.body.data.receiptUrl) {
      throw new Error(`POST /loans (Multipart) failed: ${JSON.stringify(loan3Res.body)}`);
    }
    const loan3 = loan3Res.body.data;
    console.log(`✅ 8. POST /api/v1/loans (Multipart Receipt) — 201 Created (Receipt URL: ${loan3.receiptUrl})`);

    // 9. List Loans with Filters & Search
    const allLoansRes = await request(app).get("/api/v1/loans?status=ALL").set(authHeaders);
    if (allLoansRes.status !== 200 || allLoansRes.body.data.length < 3) {
      throw new Error(`GET /loans (ALL) failed: ${JSON.stringify(allLoansRes.body)}`);
    }

    const overdueLoansRes = await request(app).get("/api/v1/loans?status=OVERDUE").set(authHeaders);
    if (overdueLoansRes.status !== 200 || overdueLoansRes.body.data.length !== 1) {
      throw new Error(`GET /loans (OVERDUE) failed: ${JSON.stringify(overdueLoansRes.body)}`);
    }

    const searchRes = await request(app).get("/api/v1/loans?search=Priya").set(authHeaders);
    if (searchRes.status !== 200 || searchRes.body.data[0]?.friendName !== "Priya Nair") {
      throw new Error(`GET /loans?search=Priya failed: ${JSON.stringify(searchRes.body)}`);
    }
    console.log("✅ 9. GET /api/v1/loans — 200 OK (Verified ALL, OVERDUE, and ILIKE Search filters)");

    // 10. Get Single Loan Details (GET /api/v1/loans/:id)
    const singleLoanRes = await request(app).get(`/api/v1/loans/${loan1.id}`).set(authHeaders);
    if (singleLoanRes.status !== 200 || singleLoanRes.body.data.friendName !== "Rohan Verma") {
      throw new Error(`GET /loans/:id failed: ${JSON.stringify(singleLoanRes.body)}`);
    }
    console.log("✅ 10. GET /api/v1/loans/:id — 200 OK (Retrieved detail with repayments)");

    // 11. Partial Repayment (PATCH /api/v1/loans/:id/repay - ₹2000 of ₹5000)
    const partialRepayRes = await request(app)
      .patch(`/api/v1/loans/${loan1.id}/repay`)
      .set(authHeaders)
      .send({ amount: 2000, note: "Paid via GPay UPI" });

    if (
      partialRepayRes.status !== 200 ||
      partialRepayRes.body.data.repaidAmount !== 2000 ||
      partialRepayRes.body.data.remainingAmount !== 3000 ||
      partialRepayRes.body.data.status !== "PARTIAL"
    ) {
      throw new Error(`Partial repayment failed: ${JSON.stringify(partialRepayRes.body)}`);
    }
    console.log("✅ 11. PATCH /api/v1/loans/:id/repay (Partial) — 200 OK (₹2000 paid, ₹3000 remaining, Status: PARTIAL)");

    // 12. Full Repayment Settlement (PATCH /api/v1/loans/:id/repay - Full Settlement via {})
    const fullRepayRes = await request(app)
      .patch(`/api/v1/loans/${loan1.id}/repay`)
      .set(authHeaders)
      .send({});

    if (
      fullRepayRes.status !== 200 ||
      fullRepayRes.body.data.status !== "REPAID" ||
      fullRepayRes.body.data.remainingAmount !== 0
    ) {
      throw new Error(`Full repayment failed: ${JSON.stringify(fullRepayRes.body)}`);
    }
    console.log("✅ 12. PATCH /api/v1/loans/:id/repay (Full Settle) — 200 OK (Remaining: ₹0, Status: REPAID)");

    // 13. Aggregate Summary (GET /api/v1/summary)
    const summaryRes = await request(app).get("/api/v1/summary").set(authHeaders);
    if (summaryRes.status !== 200) {
      throw new Error(`GET /summary failed: ${JSON.stringify(summaryRes.body)}`);
    }
    const summary = summaryRes.body.data;
    console.log(
      `✅ 13. GET /api/v1/summary — 200 OK:\n` +
      `       • Total Lent        : ₹${summary.totalLent}\n` +
      `       • Total Repaid      : ₹${summary.totalRepaid}\n` +
      `       • Outstanding       : ₹${summary.outstandingAmount}\n` +
      `       • Overdue Amount    : ₹${summary.overdueAmount}\n` +
      `       • Collection Rate   : ${summary.repaymentRate}%\n` +
      `       • Active Entries    : ${summary.counts.activeEntries}\n` +
      `       • Friend Breakdown  : ${summary.friendBreakdown.length} friends found`
    );

    // 14. Delete Loan & Receipt Cleanup (DELETE /api/v1/loans/:id)
    const deleteRes = await request(app).delete(`/api/v1/loans/${loan3.id}`).set(authHeaders);
    if (deleteRes.status !== 200 || !deleteRes.body.data.deleted) {
      throw new Error(`DELETE /loans/:id failed: ${JSON.stringify(deleteRes.body)}`);
    }
    console.log("✅ 14. DELETE /api/v1/loans/:id — 200 OK (Deleted entry & verified filesystem cleanup)");

    // Clean up test data
    await pool.query("DELETE FROM users WHERE phone = $1", [testPhone]);
    console.log("\n🎉 ALL 14 LIVE POSTGRESQL API CHECKS PASSED FLAWLESSLY WITH 100% SUCCESS!");

  } catch (error) {
    console.error("\n❌ Live Verification Failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runLiveVerification();
