import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load .env from packages/backend/.env if present
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/miniledger"),
  JWT_SECRET: z
    .string()
    .min(16)
    .default("miniledger-bharat-edition-super-secret-jwt-key-2026"),
  JWT_EXPIRES_IN: z.string().default("30d"),
  OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(5),
  EXPOSE_MOCK_OTP_IN_RESPONSE: z
    .string()
    .default("true")
    .transform((val) => val.toLowerCase() === "true"),
  UPLOAD_DIR: z.string().default("uploads"),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(5),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "❌ [MiniLedger Backend] Invalid environment variables:",
    parsedEnv.error.format(),
  );
  process.exit(1);
}

export const env = {
  ...parsedEnv.data,
  UPLOAD_ABSOLUTE_PATH: path.resolve(
    __dirname,
    "../../",
    parsedEnv.data.UPLOAD_DIR,
  ),
};
