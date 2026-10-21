import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";
import { env } from "../config/env";

// Ensure the upload directory exists on startup
if (!fs.existsSync(env.UPLOAD_ABSOLUTE_PATH)) {
  fs.mkdirSync(env.UPLOAD_ABSOLUTE_PATH, { recursive: true });
}

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/pjpeg": ".jpg",
  "image/png": ".png",
  "image/x-png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heic",
  "image/heic-sequence": ".heic",
  "image/heif-sequence": ".heic",
};

export const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, env.UPLOAD_ABSOLUTE_PATH);
  },
  filename: (_req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    const extFromName = path.extname(file.originalname || "").toLowerCase();

    let ext =
      ALLOWED_MIME_TYPES[mime] ||
      (ALLOWED_EXTENSIONS.has(extFromName) ? extFromName : ".jpg");

    if (ext === ".jpeg") ext = ".jpg";
    if (ext === ".heif") ext = ".heic";
    if (!ext.startsWith(".")) ext = `.${ext}`;

    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    cb(null, `receipt-${uniqueSuffix}${ext}`);
  },
});

export const receiptUpload = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    const ext = path.extname(file.originalname || "").toLowerCase();

    const isAllowedMime = Boolean(ALLOWED_MIME_TYPES[mime]);
    const isAllowedExt = ALLOWED_EXTENSIONS.has(ext);

    // Accept if MIME type is recognized image, OR if file extension is an allowed image
    // (especially common when mobile sends application/octet-stream or generic binary)
    if (
      isAllowedMime ||
      isAllowedExt ||
      mime === "application/octet-stream" ||
      mime === "binary/octet-stream" ||
      !mime
    ) {
      cb(null, true);
      return;
    }

    cb(new Error("Only JPG, PNG, WEBP, or HEIC receipt images are allowed."));
  },
});
