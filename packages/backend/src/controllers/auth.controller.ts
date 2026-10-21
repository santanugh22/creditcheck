import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { query } from "../db/pool";
import {
  AuthenticatedRequest,
  JwtUserPayload,
  SupportedLanguage,
  UserDTO,
} from "../types";
import {
  requestOtpSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from "../validators/schemas";

interface UserRow {
  id: string;
  phone: string;
  display_name: string;
  preferred_language: SupportedLanguage;
  created_at: Date;
}

function mapUserRowToDTO(row: UserRow): UserDTO {
  return {
    id: row.id,
    phone: row.phone,
    displayName: row.display_name,
    preferredLanguage: row.preferred_language,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Generates a 6-digit OTP and prints a high-visibility box in the server console.
 */
function printOtpToServerLog(
  phone: string,
  otpCode: string,
  expiresAt: Date,
): void {
  const banner = [
    "",
    "╔══════════════════════════════════════════════════════════════╗",
    "║           🔐 MINILEDGER (BHARAT) - MOCK OTP DISPATCH         ║",
    "╠══════════════════════════════════════════════════════════════╣",
    `║  📱 Phone Number : ${phone.padEnd(40, " ")}║`,
    `║  🔑 6-Digit OTP  : ${otpCode.padEnd(40, " ")}║`,
    `║  ⏳ Expires At   : ${expiresAt.toISOString().padEnd(40, " ")}║`,
    "╚══════════════════════════════════════════════════════════════╝",
    "",
  ].join("\n");

  console.log(banner);
}

export async function requestOtp(req: Request, res: Response): Promise<void> {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message || "Invalid phone number",
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const { phone } = parsed.data;
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO otp_requests (phone, otp_code, expires_at, verified)
     VALUES ($1, $2, $3, FALSE)`,
    [phone, otpCode, expiresAt],
  );

  // Print prominently in server terminal as required by specification
  printOtpToServerLog(phone, otpCode, expiresAt);

  res.status(200).json({
    success: true,
    data: {
      phone,
      expiresAt: expiresAt.toISOString(),
      message: "OTP generated and printed in the server console.",
      ...(env.EXPOSE_MOCK_OTP_IN_RESPONSE ? { debugOtp: otpCode } : {}),
    },
  });
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message || "Invalid OTP verification payload",
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const { phone, otp, displayName, preferredLanguage } = parsed.data;

  const otpResult = await query<{
    id: string;
    otp_code: string;
    expires_at: Date;
    verified: boolean;
  }>(
    `SELECT id, otp_code, expires_at, verified
     FROM otp_requests
     WHERE phone = $1 AND verified = FALSE
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone],
  );

  const latestOtp = otpResult.rows[0];

  if (!latestOtp) {
    res.status(400).json({
      success: false,
      error: {
        code: "OTP_NOT_FOUND",
        message:
          "No active OTP found for this phone number. Please request a new OTP.",
      },
    });
    return;
  }

  if (new Date(latestOtp.expires_at).getTime() < Date.now()) {
    res.status(400).json({
      success: false,
      error: {
        code: "OTP_EXPIRED",
        message: "This OTP has expired. Please request a fresh OTP.",
      },
    });
    return;
  }

  if (latestOtp.otp_code !== otp) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_OTP",
        message:
          "Incorrect 6-digit OTP code. Please check the server log and try again.",
      },
    });
    return;
  }

  // Mark OTP as consumed
  await query(`UPDATE otp_requests SET verified = TRUE WHERE id = $1`, [
    latestOtp.id,
  ]);

  // Upsert User account
  const fallbackName = displayName || `User ${phone.slice(-4)}`;
  const lang = preferredLanguage || "en";

  const userResult = await query<UserRow>(
    `INSERT INTO users (phone, display_name, preferred_language)
     VALUES ($1, $2, $3)
     ON CONFLICT (phone) DO UPDATE
       SET display_name = CASE
             WHEN $4::boolean THEN EXCLUDED.display_name
             ELSE users.display_name
           END,
           preferred_language = CASE
             WHEN $5::boolean THEN EXCLUDED.preferred_language
             ELSE users.preferred_language
           END,
           updated_at = NOW()
     RETURNING id, phone, display_name, preferred_language, created_at`,
    [
      phone,
      fallbackName,
      lang,
      Boolean(displayName),
      Boolean(preferredLanguage),
    ],
  );

  const user = mapUserRowToDTO(userResult.rows[0]);

  const payload: JwtUserPayload = {
    userId: user.id,
    phone: user.phone,
  };

  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

  res.status(200).json({
    success: true,
    data: {
      token,
      user,
    },
  });
}

export async function getMe(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.userId;
  const result = await query<UserRow>(
    `SELECT id, phone, display_name, preferred_language, created_at
     FROM users
     WHERE id = $1`,
    [userId],
  );

  if (result.rows.length === 0) {
    res.status(404).json({
      success: false,
      error: {
        code: "USER_NOT_FOUND",
        message: "User profile not found.",
      },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: mapUserRowToDTO(result.rows[0]),
  });
}

export async function updateProfile(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.userId;
  const parsed = updateProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message || "Invalid profile update payload",
      },
    });
    return;
  }

  const { displayName, preferredLanguage } = parsed.data;

  const result = await query<UserRow>(
    `UPDATE users
     SET display_name = COALESCE($1, display_name),
         preferred_language = COALESCE($2, preferred_language),
         updated_at = NOW()
     WHERE id = $3
     RETURNING id, phone, display_name, preferred_language, created_at`,
    [displayName ?? null, preferredLanguage ?? null, userId],
  );

  if (result.rows.length === 0) {
    res.status(404).json({
      success: false,
      error: {
        code: "USER_NOT_FOUND",
        message: "User profile not found.",
      },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: mapUserRowToDTO(result.rows[0]),
  });
}
