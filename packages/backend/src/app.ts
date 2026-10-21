import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import { env } from "./config/env";
import { apiRouter } from "./routes";

export const app = express();

// Global Middlewares
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static Receipt File Serving
app.use("/uploads", express.static(env.UPLOAD_ABSOLUTE_PATH));

// Mount API Routes under both /api/v1 and /api for maximum convenience
app.use("/api/v1", apiRouter);
app.use("/api", apiRouter);

// Root Welcome Endpoint
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Welcome to MiniLedger (Bharat Edition) API",
    docs: {
      health: "/api/v1/health",
      requestOtp: "POST /api/v1/auth/request-otp",
      verifyOtp: "POST /api/v1/auth/verify-otp",
      loans: "GET / POST /api/v1/loans",
      repayLoan: "PATCH /api/v1/loans/:id/repay",
      summary: "GET /api/v1/summary",
    },
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} does not exist on MiniLedger API.`,
    },
  });
});

// Centralized Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError || (err as any)?.name === "MulterError") {
    const multerCode = (err as multer.MulterError).code;
    res.status(400).json({
      success: false,
      error: {
        code: "FILE_UPLOAD_ERROR",
        message:
          multerCode === "LIMIT_FILE_SIZE"
            ? `Receipt image exceeds maximum size of ${env.MAX_FILE_SIZE_MB}MB.`
            : err.message,
      },
    });
    return;
  }

  if (err.message && err.message.includes("receipt images are allowed")) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_FILE_TYPE",
        message: err.message,
      },
    });
    return;
  }

  console.error("❌ [MiniLedger API Error]:", err);

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "An unexpected server error occurred."
          : err.message || "Internal server error",
    },
  });
});
