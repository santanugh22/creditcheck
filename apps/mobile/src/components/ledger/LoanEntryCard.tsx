import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "../../theme/ThemeContext";
import { formatINR, Radius, Spacing, Typography } from "../../theme/tokens";
import { LoanEntry } from "../../types/ledger";
import {
  CameraIcon,
  CategoryIcon,
  CheckCircleIcon,
} from "../icons/LedgerIcons";
import { SpringPressable, StatusBadge } from "../ui/AnimatedComponents";

interface LoanEntryCardProps {
  loan: LoanEntry;
  index: number;
  onPress: (loan: LoanEntry) => void;
  onQuickRepay: (loan: LoanEntry) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function LoanEntryCard({
  loan,
  index,
  onPress,
  onQuickRepay,
}: LoanEntryCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const isOverdue = loan.isOverdue;
  const isRepaid = loan.status === "REPAID";
  const isPartial = loan.status === "PARTIAL";

  // Compute localized status badge text
  let statusLabel = t("dashboard.filterPending");
  if (isOverdue) {
    statusLabel = `${loan.daysOverdue} ${t("dashboard.daysOverdue")}`;
  } else if (isRepaid) {
    statusLabel = t("dashboard.settledBadge");
  } else if (isPartial) {
    statusLabel = t("dashboard.partialBadge");
  } else if (loan.daysUntilDue === 0) {
    statusLabel = t("dashboard.dueToday");
  } else {
    statusLabel = t("dashboard.dueInDays", { count: loan.daysUntilDue });
  }

  const cardBackgroundColor = isOverdue ? colors.dangerSurface : colors.surface;

  const cardBorderColor = isOverdue
    ? colors.danger
    : isRepaid
      ? colors.border
      : colors.borderStrong;

  const avatarBg = isOverdue
    ? colors.danger
    : isRepaid
      ? colors.success
      : colors.primary;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 55, 350))
        .springify()
        .damping(16)}
    >
      <SpringPressable
        onPress={() => onPress(loan)}
        scaleTo={0.98}
        style={[
          styles.card,
          {
            backgroundColor: cardBackgroundColor,
            borderColor: cardBorderColor,
            borderWidth: isOverdue ? 1.5 : 1,
          },
        ]}
      >
        {/* Left Accent Stripe for Overdue or Repaid */}
        <View
          style={[
            styles.leftStripe,
            {
              backgroundColor: isOverdue
                ? colors.danger
                : isRepaid
                  ? colors.success
                  : isPartial
                    ? colors.accent
                    : colors.primary,
            },
          ]}
        />

        <View style={styles.contentContainer}>
          {/* Top Row: Avatar, Friend Info & Amount */}
          <View style={styles.topRow}>
            <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
              <Text style={styles.avatarText}>
                {getInitials(loan.friendName)}
              </Text>
            </View>

            <View style={styles.friendColumn}>
              <View style={styles.nameRow}>
                <Text
                  style={[styles.friendName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {loan.friendName}
                </Text>
                {loan.receiptUrl ? (
                  <View
                    style={[
                      styles.receiptChip,
                      { backgroundColor: colors.primaryLight },
                    ]}
                  >
                    <CameraIcon size={12} color={colors.primary} />
                  </View>
                ) : null}
              </View>

              <View style={styles.metaRow}>
                <CategoryIcon
                  category={loan.category}
                  size={13}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.categoryText, { color: colors.textSecondary }]}
                >
                  {t(`categories.${loan.category}`)}
                </Text>
                <Text style={[styles.dot, { color: colors.textMuted }]}>•</Text>
                <Text style={[styles.dueText, { color: colors.textSecondary }]}>
                  {loan.dueDate}
                </Text>
              </View>
            </View>

            <View style={styles.amountColumn}>
              <Text
                style={[
                  styles.amountText,
                  {
                    color: isOverdue
                      ? colors.danger
                      : isRepaid
                        ? colors.success
                        : colors.textPrimary,
                    textDecorationLine: isRepaid ? "line-through" : "none",
                  },
                ]}
              >
                {formatINR(
                  isRepaid ? loan.principalAmount : loan.remainingAmount,
                )}
              </Text>
              {isPartial && !isRepaid && (
                <Text
                  style={[styles.subAmountText, { color: colors.textMuted }]}
                >
                  of {formatINR(loan.principalAmount)}
                </Text>
              )}
            </View>
          </View>

          {/* Optional Note Snippet */}
          {loan.notes ? (
            <Text
              style={[styles.notesText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              “{loan.notes}”
            </Text>
          ) : null}

          {/* Bottom Row: Computed Status Badge & Quick Settle CTA */}
          <View
            style={[
              styles.bottomRow,
              {
                borderTopColor: isOverdue
                  ? "rgba(239,68,68,0.2)"
                  : colors.border,
              },
            ]}
          >
            <StatusBadge status={loan.computedStatus} label={statusLabel} />

            {!isRepaid ? (
              <SpringPressable
                hapticStyle="medium"
                onPress={(e) => {
                  e.stopPropagation();
                  onQuickRepay(loan);
                }}
                style={[
                  styles.settleButton,
                  {
                    backgroundColor: isOverdue ? colors.danger : colors.primary,
                  },
                ]}
              >
                <CheckCircleIcon size={14} color="#FFFFFF" />
                <Text style={styles.settleButtonText}>
                  {t("dashboard.settledBadge")}
                </Text>
              </SpringPressable>
            ) : (
              <Text style={[styles.repaidDateText, { color: colors.success }]}>
                ✓ {t("dashboard.settledBadge")}
              </Text>
            )}
          </View>
        </View>
      </SpringPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  leftStripe: {
    width: 6,
  },
  contentContainer: {
    flex: 1,
    padding: Spacing.md + 2,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  friendColumn: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  friendName: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    flexShrink: 1,
  },
  receiptChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  categoryText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.medium,
  },
  dot: {
    fontSize: Typography.fontSizes.xs,
  },
  dueText: {
    fontSize: Typography.fontSizes.xs,
  },
  amountColumn: {
    alignItems: "flex-end",
  },
  amountText: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
  },
  subAmountText: {
    fontSize: 11,
    marginTop: 2,
  },
  notesText: {
    fontSize: Typography.fontSizes.xs,
    fontStyle: "italic",
    marginTop: Spacing.sm,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  settleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  settleButtonText: {
    color: "#FFFFFF",
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  repaidDateText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
});
