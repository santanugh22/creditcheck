import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import {
  CreateLoanPayload,
  LedgerSummary,
  LoanEntry,
  RepayLoanPayload,
  SupportedLanguage,
  UserProfile,
} from "../types/ledger";

const STORAGE_API_URL_KEY = "@miniledger_api_base_url";

export function resolveDefaultBaseUrl(): string {
  // 1. In Expo Go or Dev Client on physical devices, extract the Metro bundler host IP
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.manifest?.debuggerHost ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri) {
    const hostIp = hostUri.split(":")[0];
    if (hostIp && hostIp !== "localhost" && hostIp !== "127.0.0.1") {
      return `http://${hostIp}:4000/api/v1`;
    }
  }

  // 2. Platform default fallback for emulators
  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000/api/v1";
  }
  return "http://localhost:4000/api/v1";
}

let activeBaseUrl = resolveDefaultBaseUrl();
let authToken: string | null = null;

export function setApiAuthToken(token: string | null): void {
  authToken = token;
}

export function getApiBaseUrl(): string {
  return activeBaseUrl;
}

export async function loadSavedApiBaseUrl(): Promise<string> {
  const defaultUrl = resolveDefaultBaseUrl();
  try {
    const saved = await AsyncStorage.getItem(STORAGE_API_URL_KEY);
    if (saved && saved.trim().length > 0) {
      const trimmed = saved.trim().replace(/\/+$/, "");
      // If the saved URL is a loopback/emulator alias but we now have a physical device LAN IP,
      // favor the auto-detected LAN IP so the device can connect.
      if (
        (trimmed.includes("localhost") || trimmed.includes("10.0.2.2")) &&
        defaultUrl.match(/\d+\.\d+\.\d+\.\d+/) &&
        !defaultUrl.includes("10.0.2.2")
      ) {
        activeBaseUrl = defaultUrl;
      } else {
        activeBaseUrl = trimmed;
      }
    } else {
      activeBaseUrl = defaultUrl;
    }
  } catch (_e) {
    activeBaseUrl = defaultUrl;
  }
  return activeBaseUrl;
}

export async function updateApiBaseUrl(newUrl: string): Promise<string> {
  const cleaned = newUrl.trim().replace(/\/+$/, "");
  const normalized = cleaned.endsWith("/api/v1")
    ? cleaned
    : cleaned.endsWith("/api")
      ? `${cleaned}/v1`
      : `${cleaned}/api/v1`;

  activeBaseUrl = normalized;
  try {
    await AsyncStorage.setItem(STORAGE_API_URL_KEY, normalized);
  } catch (_e) {}
  return activeBaseUrl;
}

/**
 * Resolves a relative receipt path (/uploads/receipt-xyz.jpg) to a full HTTP URL.
 */
export function resolveReceiptUrl(receiptUrl: string | null): string | null {
  if (!receiptUrl) return null;
  if (
    receiptUrl.startsWith("http://") ||
    receiptUrl.startsWith("https://") ||
    receiptUrl.startsWith("file://")
  ) {
    return receiptUrl;
  }
  const serverOrigin = activeBaseUrl.replace(/\/api(\/v1)?$/, "");
  return `${serverOrigin}${receiptUrl.startsWith("/") ? "" : "/"}${receiptUrl}`;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

function isFormData(body: unknown): boolean {
  if (!body) return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return true;
  }
  if (
    typeof body === "object" &&
    (body.constructor?.name === "FormData" ||
      "_parts" in (body as any) ||
      typeof (body as any).getParts === "function")
  ) {
    return true;
  }
  return false;
}

function uploadFormDataViaXhr<T>(
  url: string,
  formData: FormData,
  token?: string | null,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Accept", "application/json");
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    // CRITICAL: Do NOT manually set Content-Type for FormData in XMLHttpRequest.
    // The native networking engine must automatically append the multipart boundary delimiter.

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText) as ApiEnvelope<T>;
        if (xhr.status >= 200 && xhr.status < 300 && json && json.success) {
          resolve(json.data);
        } else {
          const msg =
            json?.error?.message ||
            `Upload request failed with status ${xhr.status}.`;
          reject(new Error(msg));
        }
      } catch (_parseErr) {
        if (xhr.status >= 200 && xhr.status < 300) {
          reject(new Error("Invalid server response format."));
        } else {
          reject(
            new Error(
              `Server error (${xhr.status}): ${xhr.statusText || "Request failed"}`,
            ),
          );
        }
      }
    };

    xhr.onerror = () => {
      reject(
        new Error(
          `Cannot connect to backend server at ${activeBaseUrl}. (Network request failed)`,
        ),
      );
    };

    xhr.ontimeout = () => {
      reject(new Error("Image upload request timed out. Please try again."));
    };

    xhr.send(formData);
  });
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${activeBaseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const hasFormData = isFormData(options.body);

  // In React Native 0.74+, fetch() adheres strictly to WHATWG standards and fails on
  // React Native's proprietary { uri, name, type } FormData object on iOS/Android.
  // Using native XMLHttpRequest completely bypasses this limitation with 100% reliability.
  if (hasFormData && typeof XMLHttpRequest !== "undefined") {
    return uploadFormDataViaXhr<T>(url, options.body as FormData, authToken);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    const errorDetails = netErr?.message || "Network request failed";
    throw new Error(
      `Cannot connect to backend server at ${activeBaseUrl}. (${errorDetails})`,
    );
  }

  const json = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !json || !json.success) {
    const errorMessage =
      json?.error?.message ||
      `Request failed with status ${response.status}. Verify backend server URL (${activeBaseUrl}).`;
    throw new Error(errorMessage);
  }

  return json.data;
}

function appendReceiptToFormData(formData: FormData, receiptUri: string): void {
  const cleanUri = receiptUri.trim();
  let baseName = cleanUri.split("/").pop() || `receipt-${Date.now()}.jpg`;
  baseName = baseName.split("?")[0].split("#")[0];

  const extMatch = /\.(jpe?g|png|webp|heic|heif)$/i.exec(baseName);
  let ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
  if (ext === "jpeg") ext = "jpg";

  // Sanitize filename to strict ASCII alphanumeric characters and ensure valid image extension
  let safeFilename = baseName.replace(/[^a-zA-Z0-9.-]/g, "_");
  if (!safeFilename.includes(".") || safeFilename.endsWith(".")) {
    safeFilename = `${safeFilename.replace(/\.+$/, "")}.${ext}`;
  }

  const mimeType =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : ext === "heic" || ext === "heif"
          ? "image/heic"
          : "image/jpeg";

  // Format URI correctly for Android & iOS
  const formattedUri =
    Platform.OS === "android" &&
    !cleanUri.startsWith("content://") &&
    !cleanUri.startsWith("file://")
      ? `file://${cleanUri}`
      : cleanUri;

  formData.append("receipt", {
    uri: formattedUri,
    name: safeFilename,
    type: mimeType,
  } as unknown as Blob);
}

export const apiClient = {
  requestOtp: (phone: string) =>
    request<{
      phone: string;
      expiresAt: string;
      message: string;
      debugOtp?: string;
    }>("/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),

  verifyOtp: (payload: {
    phone: string;
    otp: string;
    displayName?: string;
    preferredLanguage?: SupportedLanguage;
  }) =>
    request<{
      token: string;
      user: UserProfile;
    }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMe: () => request<UserProfile>("/auth/me", { method: "GET" }),

  updateProfile: (payload: {
    displayName?: string;
    preferredLanguage?: SupportedLanguage;
  }) =>
    request<UserProfile>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  getSummary: () => request<LedgerSummary>("/summary", { method: "GET" }),

  listLoans: (params?: {
    status?: string;
    category?: string;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status && params.status !== "ALL") {
      searchParams.append("status", params.status);
    }
    if (params?.category && params.category !== "ALL") {
      searchParams.append("category", params.category);
    }
    if (params?.search && params.search.trim().length > 0) {
      searchParams.append("search", params.search.trim());
    }
    const queryString = searchParams.toString();
    return request<LoanEntry[]>(
      `/loans${queryString ? `?${queryString}` : ""}`,
      {
        method: "GET",
      },
    );
  },

  getLoanById: (id: string) =>
    request<LoanEntry>(`/loans/${id}`, { method: "GET" }),

  createLoan: async (payload: CreateLoanPayload) => {
    if (payload.receiptUri && payload.receiptUri.trim().length > 0) {
      if (Platform.OS !== "web") {
        try {
          const url = `${activeBaseUrl}/loans`;
          const rawUri = payload.receiptUri.trim();
          const nativeFileUri =
            !rawUri.startsWith("file://") && !rawUri.startsWith("content://")
              ? `file://${rawUri}`
              : rawUri;

          const uploadResult = await FileSystem.uploadAsync(
            url,
            nativeFileUri,
            {
              httpMethod: "POST",
              uploadType: FileSystem.FileSystemUploadType.MULTIPART,
              sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
              fieldName: "receipt",
              parameters: {
                friendName: payload.friendName.trim(),
                amount: String(payload.amount),
                dueDate: payload.dueDate.trim(),
                category: payload.category,
                ...(payload.friendPhone && payload.friendPhone.trim().length > 0
                  ? { friendPhone: payload.friendPhone.trim() }
                  : {}),
                ...(payload.notes && payload.notes.trim().length > 0
                  ? { notes: payload.notes.trim() }
                  : {}),
              },
              headers: {
                Accept: "application/json",
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              },
            },
          );

          const json = JSON.parse(uploadResult.body) as ApiEnvelope<LoanEntry>;
          if (uploadResult.status >= 400 || !json.success) {
            throw new Error(
              json?.error?.message ||
                `Loan creation failed with status ${uploadResult.status}.`,
            );
          }
          return json.data;
        } catch (uploadErr) {
          if (
            uploadErr instanceof Error &&
            !uploadErr.message.includes("status") &&
            !uploadErr.message.includes("Cannot connect")
          ) {
            console.warn(
              "Native uploadAsync failed, falling back to FormData via XHR:",
              uploadErr,
            );
          } else {
            throw uploadErr;
          }
        }
      }

      const formData = new FormData();
      formData.append("friendName", payload.friendName.trim());
      if (payload.friendPhone && payload.friendPhone.trim().length > 0) {
        formData.append("friendPhone", payload.friendPhone.trim());
      }
      formData.append("amount", String(payload.amount));
      formData.append("dueDate", payload.dueDate.trim());
      formData.append("category", payload.category);
      if (payload.notes && payload.notes.trim().length > 0) {
        formData.append("notes", payload.notes.trim());
      }
      appendReceiptToFormData(formData, payload.receiptUri);

      return request<LoanEntry>("/loans", {
        method: "POST",
        body: formData,
      });
    }

    return request<LoanEntry>("/loans", {
      method: "POST",
      body: JSON.stringify({
        friendName: payload.friendName.trim(),
        friendPhone: payload.friendPhone?.trim() || null,
        amount: payload.amount,
        dueDate: payload.dueDate.trim(),
        category: payload.category,
        notes: payload.notes?.trim() || null,
      }),
    });
  },

  repayLoan: (id: string, payload?: RepayLoanPayload) =>
    request<LoanEntry>(`/loans/${id}/repay`, {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
    }),

  attachReceipt: async (id: string, receiptUri: string) => {
    if (Platform.OS !== "web") {
      try {
        const url = `${activeBaseUrl}/loans/${id}/receipt`;
        const rawUri = receiptUri.trim();
        const nativeFileUri =
          !rawUri.startsWith("file://") && !rawUri.startsWith("content://")
            ? `file://${rawUri}`
            : rawUri;

        const uploadResult = await FileSystem.uploadAsync(
          url,
          nativeFileUri,
          {
            httpMethod: "POST",
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
            fieldName: "receipt",
            headers: {
              Accept: "application/json",
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
          },
        );

        const json = JSON.parse(uploadResult.body) as ApiEnvelope<LoanEntry>;
        if (uploadResult.status >= 400 || !json.success) {
          throw new Error(
            json?.error?.message ||
              `Receipt upload failed with status ${uploadResult.status}.`,
          );
        }
        return json.data;
      } catch (uploadErr) {
        if (
          uploadErr instanceof Error &&
          !uploadErr.message.includes("status") &&
          !uploadErr.message.includes("Cannot connect")
        ) {
          console.warn(
            "Native uploadAsync failed, falling back to FormData via XHR:",
            uploadErr,
          );
        } else {
          throw uploadErr;
        }
      }
    }

    const formData = new FormData();
    appendReceiptToFormData(formData, receiptUri);
    return request<LoanEntry>(`/loans/${id}/receipt`, {
      method: "POST",
      body: formData,
    });
  },

  deleteLoan: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/loans/${id}`, {
      method: "DELETE",
    }),
};
