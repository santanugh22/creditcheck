import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${activeBaseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  const hasFormData = isFormData(options.body);

  if (hasFormData) {
    // CRITICAL: For multipart/form-data requests in React Native and browsers,
    // NEVER supply a manual Content-Type header. The networking stack must
    // automatically generate the Content-Type header with the multipart boundary delimiter.
    delete headers["Content-Type"];
    delete headers["content-type"];
  } else if (!headers["Content-Type"]) {
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

  const safeFilename = extMatch ? baseName : `${baseName || `receipt-${Date.now()}`}.${ext}`;
  const mimeType =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : ext === "heic" || ext === "heif"
          ? "image/heic"
          : "image/jpeg";

  formData.append("receipt", {
    uri: cleanUri,
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

  createLoan: (payload: CreateLoanPayload) => {
    if (payload.receiptUri && payload.receiptUri.trim().length > 0) {
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

  attachReceipt: (id: string, receiptUri: string) => {
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
