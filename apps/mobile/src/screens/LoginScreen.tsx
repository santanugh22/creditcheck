import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { RupeeIcon } from "../components/icons/LedgerIcons";
import { SpringPressable } from "../components/ui/AnimatedComponents";
import { changeAppLanguage } from "../i18n";
import { useAuthStore } from "../store/useAuthStore";
import { useTheme } from "../theme/ThemeContext";
import { Radius, Spacing, Typography } from "../theme/tokens";
import { SupportedLanguage } from "../types/ledger";

export function LoginScreen() {
  const { colors, isDarkMode, setThemeMode } = useTheme();
  const { t, i18n } = useTranslation();

  const {
    requestOtp,
    verifyOtp,
    isLoading,
    error,
    clearError,
    lastDebugOtp,
  } = useAuthStore();

  const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const currentLang = (
    i18n.language === "hi" ? "hi" : "en"
  ) as SupportedLanguage;

  const toggleLanguage = async () => {
    const nextLang: SupportedLanguage = currentLang === "en" ? "hi" : "en";
    await changeAppLanguage(nextLang);
  };

  const handleRequestOtp = async () => {
    clearError();
    setLocalError(null);
    const cleaned = phone.replace(/[^\d]/g, "");
    if (cleaned.length < 10) {
      setLocalError(t("auth.phonePlaceholder"));
      return;
    }

    try {
      const result = await requestOtp(phone);
      setStep("OTP");
      if (result.debugOtp) {
        setOtp(result.debugOtp);
      }
    } catch (_e) {}
  };

  const handleVerifyOtp = async () => {
    clearError();
    setLocalError(null);
    if (otp.trim().length !== 6) {
      setLocalError("Please enter the 6-digit OTP code.");
      return;
    }

    try {
      await verifyOtp({
        phone,
        otp: otp.trim(),
        displayName: displayName.trim() || undefined,
        preferredLanguage: currentLang,
      });
    } catch (_e) {}
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Utility Bar: Language & Theme */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={styles.topUtilityBar}
          >
            <SpringPressable
              onPress={toggleLanguage}
              style={[
                styles.utilityPill,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text
                style={[styles.utilityPillText, { color: colors.primary }]}
              >
                {currentLang === "en" ? "🇮🇳 हिन्दी" : "🇮🇳 English"}
              </Text>
            </SpringPressable>

            <SpringPressable
              onPress={() => setThemeMode(isDarkMode ? "light" : "dark")}
              style={[
                styles.utilityPill,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ fontSize: 14 }}>{isDarkMode ? "☀️" : "🌙"}</Text>
            </SpringPressable>
          </Animated.View>

          {/* Brand Emblem Hero */}
          <Animated.View
            entering={FadeInUp.delay(80).springify()}
            style={styles.brandHero}
          >
            <LinearGradient
              colors={["#4F46E5", "#3730A3"]}
              style={styles.emblemBox}
            >
              <RupeeIcon size={38} color="#FBBF24" />
            </LinearGradient>
            <Text style={[styles.appName, { color: colors.textPrimary }]}>
              {t("common.appName")}
            </Text>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>
              {t("auth.welcomeSubtitle")}
            </Text>
          </Animated.View>

          {/* Main Auth Card */}
          <Animated.View
            entering={FadeInUp.delay(160).springify()}
            style={[
              styles.authCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {(localError || error) && (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: colors.dangerSurface,
                    borderColor: colors.danger,
                  },
                ]}
              >
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {localError || error}
                </Text>
              </View>
            )}

            {step === "PHONE" ? (
              <View style={styles.formSection}>
                <Text
                  style={[styles.inputLabel, { color: colors.textPrimary }]}
                >
                  {t("auth.phoneLabel")}
                </Text>
                <View
                  style={[
                    styles.phoneInputRow,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.borderStrong,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.countryCodeBox,
                      { borderRightColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countryCodeText,
                        { color: colors.textPrimary },
                      ]}
                    >
                      🇮🇳 +91
                    </Text>
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder={t("auth.phonePlaceholder")}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    maxLength={13}
                    style={[styles.phoneInput, { color: colors.textPrimary }]}
                  />
                </View>

                <Text
                  style={[
                    styles.inputLabel,
                    { color: colors.textPrimary, marginTop: Spacing.md },
                  ]}
                >
                  {t("auth.nameLabel")}
                </Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t("auth.namePlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.borderStrong,
                      color: colors.textPrimary,
                    },
                  ]}
                />

                <SpringPressable
                  hapticStyle="medium"
                  disabled={isLoading}
                  onPress={handleRequestOtp}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {t("auth.sendOtpButton")} →
                    </Text>
                  )}
                </SpringPressable>
              </View>
            ) : (
              <View style={styles.formSection}>
                <Text style={[styles.otpTitle, { color: colors.textPrimary }]}>
                  {t("auth.otpTitle")}
                </Text>
                <Text
                  style={[styles.otpSubtitle, { color: colors.textSecondary }]}
                >
                  {t("auth.otpSubtitle")}
                </Text>

                {lastDebugOtp && (
                  <SpringPressable
                    onPress={() => setOtp(lastDebugOtp)}
                    style={[
                      styles.devOtpBanner,
                      {
                        backgroundColor: colors.accentLight,
                        borderColor: colors.accent,
                      },
                    ]}
                  >
                    <Text style={[styles.devOtpText, { color: colors.accent }]}>
                      📟 Server Log Mock OTP: {lastDebugOtp} (Tap to fill)
                    </Text>
                  </SpringPressable>
                )}

                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  placeholder={t("auth.otpPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={[
                    styles.otpInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.primary,
                      color: colors.textPrimary,
                    },
                  ]}
                />

                <SpringPressable
                  hapticStyle="medium"
                  disabled={isLoading}
                  onPress={handleVerifyOtp}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {t("auth.verifyOtpButton")}
                    </Text>
                  )}
                </SpringPressable>

                <View style={styles.otpFooterRow}>
                  <SpringPressable onPress={() => setStep("PHONE")}>
                    <Text
                      style={[styles.linkText, { color: colors.textSecondary }]}
                    >
                      ← {t("common.back")}
                    </Text>
                  </SpringPressable>

                  <SpringPressable onPress={handleRequestOtp}>
                    <Text style={[styles.linkText, { color: colors.primary }]}>
                      {t("auth.resendOtp")}
                    </Text>
                  </SpringPressable>
                </View>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    justifyContent: "center",
  },
  topUtilityBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  utilityPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  utilityPillText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  brandHero: {
    alignItems: "center",
    marginVertical: Spacing.xl,
  },
  emblemBox: {
    width: 76,
    height: 76,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: "#F59E0B",
  },
  appName: {
    fontSize: Typography.fontSizes.xxl,
    fontWeight: Typography.fontWeights.bold,
  },
  tagline: {
    fontSize: Typography.fontSizes.sm,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  authCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  errorBanner: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
  },
  formSection: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    marginBottom: 8,
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: Radius.md,
    height: 52,
    overflow: "hidden",
  },
  countryCodeBox: {
    paddingHorizontal: Spacing.md,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1.5,
  },
  countryCodeText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  phoneInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.semibold,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    height: 52,
    fontSize: Typography.fontSizes.md,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  primaryButton: {
    marginTop: Spacing.lg,
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  otpTitle: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
  },
  otpSubtitle: {
    fontSize: Typography.fontSizes.xs,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  devOtpBanner: {
    padding: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    alignItems: "center",
  },
  devOtpText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  otpInput: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingVertical: 14,
    fontSize: Typography.fontSizes.xxl,
    fontWeight: Typography.fontWeights.bold,
    textAlign: "center",
    letterSpacing: 8,
    marginTop: Spacing.xs,
  },
  otpFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.lg,
  },
  linkText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
  },
});
