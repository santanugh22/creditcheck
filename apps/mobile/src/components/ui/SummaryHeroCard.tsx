import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { formatINR, Radius, Spacing, Typography } from "../../theme/tokens";
import { LedgerSummary } from "../../types/ledger";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  WalletIcon,
} from "../icons/LedgerIcons";
import { TactilePressable } from "./AnimatedComponents";

interface SummaryHeroCardProps {
  summary: LedgerSummary;
  onPressOverdueFilter?: () => void;
}

export function SummaryHeroCard({
  summary,
  onPressOverdueFilter,
}: SummaryHeroCardProps) {
  const { t } = useTranslation();
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    const clampedRate = Math.min(100, Math.max(0, summary.repaymentRate || 0));
    progressWidth.value = withTiming(clampedRate, {
      duration: 650,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [summary.repaymentRate, progressWidth]);

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  return (
    <LinearGradient
      colors={["#1E1B4B", "#3730A3", "#4F46E5"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Top Row: Outstanding Balance & Collection Rate Pill */}
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <WalletIcon size={16} color="#A5B4FC" />
            <Text style={styles.heroLabel}>{t("dashboard.heroTitle")}</Text>
          </View>
          <Text style={styles.heroAmount}>
            {formatINR(summary.outstandingAmount)}
          </Text>
        </View>

        <View style={styles.rateBadge}>
          <CheckCircleIcon size={14} color="#34D399" />
          <Text style={styles.rateText}>
            {summary.repaymentRate}% {t("dashboard.collectionRate")}
          </Text>
        </View>
      </View>

      {/* Animated Collection Progress Bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressAnimatedStyle]} />
      </View>

      {/* 3-Column Core Summary Metrics: Total Lent, Total Repaid, Overdue Amount */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>{t("dashboard.totalLent")}</Text>
          <Text style={styles.metricValue}>{formatINR(summary.totalLent)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>{t("dashboard.totalRepaid")}</Text>
          <Text style={[styles.metricValue, { color: "#6EE7B7" }]}>
            {formatINR(summary.totalRepaid)}
          </Text>
        </View>

        <View style={styles.divider} />

        <TactilePressable
          onPress={onPressOverdueFilter}
          style={[
            styles.metricBox,
            summary.overdueAmount > 0 && styles.overdueHighlightBox,
          ]}
        >
          <View style={styles.overdueHeader}>
            <AlertCircleIcon
              size={13}
              color={summary.overdueAmount > 0 ? "#FCA5A5" : "#C7D2FE"}
            />
            <Text
              style={[
                styles.metricLabel,
                summary.overdueAmount > 0 && { color: "#FECACA" },
              ]}
              numberOfLines={1}
            >
              {t("dashboard.overdueAlert")}
            </Text>
          </View>
          <Text
            style={[
              styles.metricValue,
              {
                color: summary.overdueAmount > 0 ? "#F87171" : "#FFFFFF",
              },
            ]}
          >
            {formatINR(summary.overdueAmount)}
          </Text>
        </TactilePressable>
      </View>

      {/* Due Soon Alert Strip (if loans are due within next 3 days) */}
      {summary.dueSoonAmount > 0 && (
        <View style={styles.dueSoonBanner}>
          <Text style={styles.dueSoonText}>
            ⏳ {t("dashboard.dueSoonAlert")}: {formatINR(summary.dueSoonAmount)}{" "}
            ({summary.counts.dueSoonEntries})
          </Text>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  heroLabel: {
    color: "#C7D2FE",
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.medium,
  },
  heroAmount: {
    color: "#FFFFFF",
    fontSize: Typography.fontSizes.xxxl,
    fontWeight: Typography.fontWeights.bold,
    letterSpacing: -0.5,
  },
  rateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    borderColor: "rgba(52, 211, 153, 0.4)",
    borderWidth: 1,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  rateText: {
    color: "#A7F3D0",
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
  },
  progressTrack: {
    height: 7,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: Radius.full,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#F59E0B", // Saffron Gold progress bar
    borderRadius: Radius.full,
  },
  metricsGrid: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(9, 13, 22, 0.32)",
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  metricBox: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  overdueHighlightBox: {
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderRadius: Radius.md,
    paddingVertical: 4,
  },
  overdueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricLabel: {
    color: "#C7D2FE",
    fontSize: 11,
    fontWeight: Typography.fontWeights.medium,
    marginBottom: 4,
  },
  metricValue: {
    color: "#FFFFFF",
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  dueSoonBanner: {
    marginTop: Spacing.md,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderColor: "rgba(251, 191, 36, 0.45)",
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
  },
  dueSoonText: {
    color: "#FDE68A",
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
  },
});
