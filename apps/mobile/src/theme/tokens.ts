/**
 * MiniLedger (Bharat Edition) - Design Tokens & Indian Rupee Formatters
 */

export const Colors = {
  light: {
    primary: "#4F46E5", // Royal Indigo
    primaryHover: "#4338CA",
    primaryLight: "#EEF2FF",
    accent: "#F59E0B", // Saffron Gold
    accentLight: "#FEF3C7",
    success: "#10B981", // Emerald Mint
    successSurface: "#ECFDF5",
    danger: "#EF4444", // Crimson Coral (Overdue highlight)
    dangerSurface: "#FEF2F2",
    warning: "#F97316", // Orange warning
    background: "#F8FAFC",
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    border: "#E2E8F0",
    borderStrong: "#CBD5E1",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#94A3B8",
    cardShadow: "rgba(15, 23, 42, 0.08)",
  },
  dark: {
    primary: "#6366F1", // Brighter Indigo for Dark Mode
    primaryHover: "#4F46E5",
    primaryLight: "#1E1B4B",
    accent: "#FBBF24", // Brighter Saffron Gold
    accentLight: "#451A03",
    success: "#34D399",
    successSurface: "#064E3B",
    danger: "#F87171", // Bright Crimson Coral
    dangerSurface: "#7F1D1D",
    warning: "#FB923C",
    background: "#090D16", // Deep Obsidian Slate
    surface: "#111827",
    surfaceElevated: "#1F2937",
    border: "#374151",
    borderStrong: "#4B5563",
    textPrimary: "#F9FAFB",
    textSecondary: "#9CA3AF",
    textMuted: "#6B7280",
    cardShadow: "rgba(0, 0, 0, 0.4)",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Typography = {
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    xxxl: 36,
  },
  fontWeights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
};

/**
 * Formats numbers into Indian Rupee currency (e.g. ₹1,50,000.00)
 */
export function formatINR(amount: number): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (_e) {
    return `₹${amount.toFixed(2)}`;
  }
}

/**
 * Formats standard numbers using Indian numbering grouping (Lakhs / Crores)
 */
export function formatIndianNumber(num: number): string {
  try {
    return new Intl.NumberFormat("en-IN").format(num);
  } catch (_e) {
    return num.toString();
  }
}
