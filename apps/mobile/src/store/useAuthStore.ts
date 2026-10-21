import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { changeAppLanguage } from "../i18n";
import {
  apiClient,
  getApiBaseUrl,
  loadSavedApiBaseUrl,
  setApiAuthToken,
  updateApiBaseUrl,
} from "../services/api";
import { SupportedLanguage, UserProfile } from "../types/ledger";

const AUTH_TOKEN_KEY = "@miniledger_auth_token";
const AUTH_USER_KEY = "@miniledger_auth_user";

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  pendingPhone: string | null;
  lastDebugOtp: string | null;
  apiBaseUrl: string;

  hydrateAuth: () => Promise<void>;
  requestOtp: (phone: string) => Promise<{ debugOtp?: string }>;
  verifyOtp: (params: {
    phone: string;
    otp: string;
    displayName?: string;
    preferredLanguage?: SupportedLanguage;
  }) => Promise<void>;
  updateUserProfile: (params: {
    displayName?: string;
    preferredLanguage?: SupportedLanguage;
  }) => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
  clearError: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isHydrated: false,
  isLoading: false,
  error: null,
  pendingPhone: null,
  lastDebugOtp: null,
  apiBaseUrl: getApiBaseUrl(),

  hydrateAuth: async () => {
    try {
      const baseUrl = await loadSavedApiBaseUrl();
      const [storedToken, storedUserJson] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(AUTH_USER_KEY),
      ]);

      if (storedToken && storedUserJson) {
        const parsedUser = JSON.parse(storedUserJson) as UserProfile;
        setApiAuthToken(storedToken);
        if (parsedUser.preferredLanguage) {
          await changeAppLanguage(parsedUser.preferredLanguage);
        }
        set({
          token: storedToken,
          user: parsedUser,
          apiBaseUrl: baseUrl,
          isHydrated: true,
        });

        // Refresh user profile quietly in the background
        apiClient
          .getMe()
          .then(async (freshUser) => {
            await AsyncStorage.setItem(
              AUTH_USER_KEY,
              JSON.stringify(freshUser),
            );
            set({ user: freshUser });
          })
          .catch(() => {});
      } else {
        set({ apiBaseUrl: baseUrl, isHydrated: true });
      }
    } catch (_e) {
      set({ isHydrated: true });
    }
  },

  requestOtp: async (phone: string) => {
    set({ isLoading: true, error: null, lastDebugOtp: null });
    try {
      const res = await apiClient.requestOtp(phone);
      set({
        isLoading: false,
        pendingPhone: res.phone,
        lastDebugOtp: res.debugOtp || null,
      });
      return { debugOtp: res.debugOtp };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to request OTP";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  verifyOtp: async ({ phone, otp, displayName, preferredLanguage }) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.verifyOtp({
        phone,
        otp,
        displayName,
        preferredLanguage,
      });

      setApiAuthToken(res.token);
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, res.token),
        AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user)),
      ]);

      if (res.user.preferredLanguage) {
        await changeAppLanguage(res.user.preferredLanguage);
      }

      set({
        token: res.token,
        user: res.user,
        isLoading: false,
        pendingPhone: null,
        lastDebugOtp: null,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "OTP verification failed";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  updateUserProfile: async (params) => {
    try {
      if (params.preferredLanguage) {
        await changeAppLanguage(params.preferredLanguage);
      }
      if (get().token) {
        const updatedUser = await apiClient.updateProfile(params);
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
        set({ user: updatedUser });
      }
    } catch (_err) {
      // Even if offline, local language switch succeeds immediately
    }
  },

  setServerUrl: async (url: string) => {
    const normalized = await updateApiBaseUrl(url);
    set({ apiBaseUrl: normalized, error: null });
  },

  clearError: () => set({ error: null }),

  logout: async () => {
    setApiAuthToken(null);
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_USER_KEY),
    ]);
    set({
      token: null,
      user: null,
      pendingPhone: null,
      lastDebugOtp: null,
      error: null,
    });
  },
}));
