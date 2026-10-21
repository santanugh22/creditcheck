import { z } from "zod";

/**
 * Normalizes Indian mobile numbers to +91XXXXXXXXXX format.
 * Also accepts general E.164 numbers (8-15 digits) for testing flexibility.
 */
export function normalizePhoneNumber(raw: string): string {
  const digitsOnly = raw.replace(/[^\d+]/g, "");

  // Strip leading 0 if 11-digit Indian mobile (e.g. 09876543210)
  if (/^0[6-9]\d{9}$/.test(digitsOnly)) {
    return `+91${digitsOnly.slice(1)}`;
  }

  // Bare 10-digit Indian mobile number (starts with 6, 7, 8, or 9)
  if (/^[6-9]\d{9}$/.test(digitsOnly)) {
    return `+91${digitsOnly}`;
  }

  // 12-digit starting with 91 without '+'
  if (/^91[6-9]\d{9}$/.test(digitsOnly)) {
    return `+${digitsOnly}`;
  }

  // Already has '+' prefix
  if (/^\+\d{8,15}$/.test(digitsOnly)) {
    return digitsOnly;
  }

  // Fallback for generic 8-15 digit test numbers
  if (/^\d{8,15}$/.test(digitsOnly)) {
    return `+91${digitsOnly}`;
  }

  return digitsOnly;
}

export const phoneSchema = z
  .string({ required_error: "Phone number is required" })
  .trim()
  .min(10, "Enter a valid 10-digit mobile number")
  .transform(normalizePhoneNumber)
  .refine((val) => /^\+\d{10,15}$/.test(val), {
    message:
      "Invalid phone number format. Use a valid 10-digit Indian mobile number.",
  });

export const requestOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: z
    .string({ required_error: "OTP code is required" })
    .trim()
    .regex(/^\d{6}$/, "OTP must be a 6-digit number"),
  displayName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .optional(),
  preferredLanguage: z.enum(["en", "hi"]).optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(100).optional(),
  preferredLanguage: z.enum(["en", "hi"]).optional(),
});

export const loanCategorySchema = z
  .enum(["PERSONAL", "FOOD_SPLIT", "EMERGENCY", "TRAVEL", "RENT", "OTHER"])
  .default("PERSONAL");

export const createLoanSchema = z.object({
  friendName: z
    .string({ required_error: "Friend name is required" })
    .trim()
    .min(1, "Friend name cannot be empty")
    .max(120, "Friend name cannot exceed 120 characters"),
  friendPhone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === "null" || val === "undefined") return null;
      const normalized = normalizePhoneNumber(val);
      return /^\+\d{10,15}$/.test(normalized) ? normalized : null;
    }),
  amount: z.coerce
    .number({
      required_error: "Loan amount is required",
      invalid_type_error: "Loan amount must be a valid number",
    })
    .positive("Loan amount must be greater than ₹0")
    .max(100000000, "Amount cannot exceed ₹10,00,00,000"),
  dueDate: z
    .string({ required_error: "Due date is required" })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format"),
  category: loanCategorySchema.optional().default("PERSONAL"),
  notes: z
    .string()
    .trim()
    .max(500, "Notes cannot exceed 500 characters")
    .optional()
    .nullable()
    .transform((val) =>
      val && val.length > 0 && val !== "null" && val !== "undefined"
        ? val
        : null,
    ),
});

export const repayLoanSchema = z.object({
  amount: z
    .preprocess(
      (val) =>
        val === "" || val === null || val === undefined ? undefined : val,
      z.coerce
        .number({ invalid_type_error: "Repayment amount must be a number" })
        .positive("Repayment amount must be greater than ₹0")
        .optional(),
    )
    .optional(),
  note: z
    .string()
    .trim()
    .max(255, "Repayment note cannot exceed 255 characters")
    .optional()
    .nullable(),
});

export const listLoansQuerySchema = z.object({
  status: z
    .enum(["ALL", "OVERDUE", "PENDING", "ACTIVE", "PARTIAL", "REPAID"])
    .optional()
    .default("ALL"),
  category: z
    .enum([
      "ALL",
      "PERSONAL",
      "FOOD_SPLIT",
      "EMERGENCY",
      "TRAVEL",
      "RENT",
      "OTHER",
    ])
    .optional()
    .default("ALL"),
  search: z.string().trim().optional(),
});
