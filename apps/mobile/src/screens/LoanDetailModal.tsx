import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  CameraIcon,
  CheckCircleIcon,
  WhatsAppIcon,
} from "../components/icons/LedgerIcons";
import {
  SpringPressable,
  StatusBadge,
} from "../components/ui/AnimatedComponents";
import { resolveReceiptUrl } from "../services/api";
import { useLedgerStore } from "../store/useLedgerStore";
import { useTheme } from "../theme/ThemeContext";
import { formatINR, Radius, Spacing, Typography } from "../theme/tokens";
import { LoanEntry } from "../types/ledger";

interface LoanDetailModalProps {
  loan: LoanEntry | null;
  visible: boolean;
  onClose: () => void;
}

export function LoanDetailModal({
  loan,
  visible,
  onClose,
}: LoanDetailModalProps) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();

  const { repayLoanEntry, attachReceiptToLoan, deleteLoanEntry, isSubmitting } =
    useLedgerStore();

  const [repayAmount, setRepayAmount] = useState("");
  const [repayNote, setRepayNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  if (!loan) return null;

  const fullReceiptUrl = resolveReceiptUrl(loan.receiptUrl);
  const isRepaid = loan.status === "REPAID";

  const buildReminderMessage = (): string => {
    const formattedRemaining = formatINR(loan.remainingAmount);
    if (i18n.language === "hi") {
      return `नमस्ते ${loan.friendName} 🙏, मिनीलेजर पर आपके उधार की शेष राशि ${formattedRemaining} (देय तिथि: ${loan.dueDate}) बकाया है। कृपया सुविधा अनुसार भुगतान करें। धन्यवाद!`;
    }
    return `Hi ${loan.friendName} 👋, a friendly reminder from MiniLedger regarding the ₹ loan of ${formattedRemaining} (Due Date: ${loan.dueDate}). Please settle via UPI when convenient. Thanks!`;
  };

  const handleWhatsAppReminder = async () => {
    const message = buildReminderMessage();
    const encoded = encodeURIComponent(message);
    const cleanPhone = (loan.friendPhone || "").replace(/[^\d]/g, "");
    const waUrl = cleanPhone
      ? `whatsapp://send?phone=${cleanPhone}&text=${encoded}`
      : `whatsapp://send?text=${encoded}`;

    try {
      const supported = await Linking.canOpenURL(waUrl);
      if (supported) {
        await Linking.openURL(waUrl);
      } else {
        await Share.share({ message });
      }
    } catch (_e) {
      await Share.share({ message });
    }
  };

  const handleRecordRepayment = async () => {
    setActionError(null);
    const trimmed = repayAmount.trim();
    const numericAmount = trimmed.length > 0 ? parseFloat(trimmed) : undefined;

    if (
      numericAmount !== undefined &&
      (isNaN(numericAmount) || numericAmount <= 0)
    ) {
      setActionError("Please enter a valid positive repayment amount.");
      return;
    }

    try {
      await repayLoanEntry(loan.id, {
        amount: numericAmount,
        note: repayNote.trim() || undefined,
      });
      setRepayAmount("");
      setRepayNote("");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to record repayment.",
      );
    }
  };

  const handleAttachReceipt = async () => {
    setActionError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setActionError("Gallery permission is required to attach a receipt.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      try {
        await attachReceiptToLoan(loan.id, result.assets[0].uri);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Failed to upload receipt.",
        );
      }
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t("loanDetail.deleteConfirmTitle"),
      t("loanDetail.deleteConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            await deleteLoanEntry(loan.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Header */}
          <View
            style={[styles.headerRow, { borderBottomColor: colors.border }]}
          >
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {loan.friendName}
              </Text>
              {loan.friendPhone && (
                <Text
                  style={[styles.subtitle, { color: colors.textSecondary }]}
                >
                  {loan.friendPhone}
                </Text>
              )}
            </View>

            <SpringPressable onPress={onClose}>
              <Text style={[styles.closeBtn, { color: colors.textSecondary }]}>
                ✕
              </Text>
            </SpringPressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody}>
            {actionError && (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: colors.dangerSurface,
                    borderColor: colors.danger,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.danger,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {actionError}
                </Text>
              </View>
            )}

            {/* Financial Summary Box */}
            <View
              style={[
                styles.summaryBox,
                {
                  backgroundColor: loan.isOverdue
                    ? colors.dangerSurface
                    : colors.background,
                  borderColor: loan.isOverdue ? colors.danger : colors.border,
                },
              ]}
            >
              <View style={styles.summaryTopRow}>
                <View>
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t("loanDetail.remaining")}
                  </Text>
                  <Text
                    style={[
                      styles.remainingValue,
                      {
                        color: loan.isOverdue
                          ? colors.danger
                          : isRepaid
                            ? colors.success
                            : colors.textPrimary,
                      },
                    ]}
                  >
                    {formatINR(loan.remainingAmount)}
                  </Text>
                </View>

                <StatusBadge
                  status={loan.computedStatus}
                  label={
                    loan.isOverdue
                      ? `${loan.daysOverdue} ${t("dashboard.daysOverdue")}`
                      : loan.computedStatus
                  }
                />
              </View>

              <View
                style={[styles.metaGrid, { borderTopColor: colors.border }]}
              >
                <View>
                  <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
                    {t("loanDetail.principal")}
                  </Text>
                  <Text
                    style={[styles.metaValue, { color: colors.textPrimary }]}
                  >
                    {formatINR(loan.principalAmount)}
                  </Text>
                </View>

                <View>
                  <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
                    {t("loanDetail.repaid")}
                  </Text>
                  <Text style={[styles.metaValue, { color: colors.success }]}>
                    {formatINR(loan.repaidAmount)}
                  </Text>
                </View>

                <View>
                  <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
                    {t("loanDetail.dueDate")}
                  </Text>
                  <Text
                    style={[styles.metaValue, { color: colors.textPrimary }]}
                  >
                    {loan.dueDate}
                  </Text>
                </View>
              </View>
            </View>

            {/* Notes */}
            {loan.notes && (
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.sectionTitle, { color: colors.textSecondary }]}
                >
                  {t("loanDetail.notes")}
                </Text>
                <Text style={[styles.notesBody, { color: colors.textPrimary }]}>
                  {loan.notes}
                </Text>
              </View>
            )}

            {/* Repayment Action Box (Full or Partial) */}
            {!isRepaid && (
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.sectionTitle, { color: colors.textPrimary }]}
                >
                  {t("loanDetail.repayModalTitle")}
                </Text>

                <TextInput
                  value={repayAmount}
                  onChangeText={setRepayAmount}
                  placeholder={t("loanDetail.repayAmountPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderStrong,
                      color: colors.textPrimary,
                    },
                  ]}
                />

                <TextInput
                  value={repayNote}
                  onChangeText={setRepayNote}
                  placeholder={t("loanDetail.repayNotePlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderStrong,
                      color: colors.textPrimary,
                      marginTop: Spacing.sm,
                    },
                  ]}
                />

                <SpringPressable
                  hapticStyle="medium"
                  disabled={isSubmitting}
                  onPress={handleRecordRepayment}
                  style={[styles.repayBtn, { backgroundColor: colors.success }]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <CheckCircleIcon size={16} color="#FFFFFF" />
                      <Text style={styles.repayBtnText}>
                        {repayAmount.trim().length > 0
                          ? `${t("loanDetail.confirmRepay")} (₹${repayAmount})`
                          : `${t("loanDetail.confirmRepay")} (${formatINR(loan.remainingAmount)})`}
                      </Text>
                    </>
                  )}
                </SpringPressable>

                {/* WhatsApp / Share Reminder CTA */}
                <SpringPressable
                  onPress={handleWhatsAppReminder}
                  style={[
                    styles.whatsappBtn,
                    {
                      borderColor: "#25D366",
                      backgroundColor: "rgba(37, 211, 102, 0.1)",
                    },
                  ]}
                >
                  <WhatsAppIcon size={18} color="#25D366" />
                  <Text style={styles.whatsappBtnText}>
                    {t("loanDetail.whatsappReminder")}
                  </Text>
                </SpringPressable>
              </View>
            )}

            {/* Receipt Section */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.receiptHeader}>
                <Text
                  style={[styles.sectionTitle, { color: colors.textPrimary }]}
                >
                  {t("loanDetail.receipt")}
                </Text>
                <SpringPressable onPress={handleAttachReceipt}>
                  <View style={styles.attachInlineBtn}>
                    <CameraIcon size={14} color={colors.primary} />
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {fullReceiptUrl
                        ? t("common.edit")
                        : t("loanDetail.addReceipt")}
                    </Text>
                  </View>
                </SpringPressable>
              </View>

              {fullReceiptUrl ? (
                <Image
                  source={{ uri: fullReceiptUrl }}
                  style={styles.receiptImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {t("loanDetail.noReceipt")}
                </Text>
              )}
            </View>

            {/* Repayment History Timeline */}
            {loan.repayments && loan.repayments.length > 0 && (
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.sectionTitle, { color: colors.textPrimary }]}
                >
                  Repayment History ({loan.repayments.length})
                </Text>
                {loan.repayments.map((rep) => (
                  <View
                    key={rep.id}
                    style={[
                      styles.repaymentRow,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <View>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {rep.note || "Payment"}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                        {new Date(rep.paidAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: colors.success,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      +{formatINR(rep.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Delete Entry Button */}
            <SpringPressable
              onPress={handleDelete}
              style={[
                styles.deleteBtn,
                {
                  borderColor: colors.danger,
                  backgroundColor: colors.dangerSurface,
                },
              ]}
            >
              <Text style={{ color: colors.danger, fontWeight: "700" }}>
                🗑️ {t("common.delete")}
              </Text>
            </SpringPressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(9, 13, 22, 0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "90%",
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
  },
  subtitle: {
    fontSize: Typography.fontSizes.xs,
    marginTop: 2,
  },
  closeBtn: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    padding: 4,
  },
  scrollBody: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  errorBanner: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  summaryBox: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  summaryLabel: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
  },
  remainingValue: {
    fontSize: Typography.fontSizes.xxl,
    fontWeight: Typography.fontWeights.bold,
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
  sectionCard: {
    padding: Spacing.md + 2,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    marginBottom: Spacing.sm,
  },
  notesBody: {
    fontSize: Typography.fontSizes.sm,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Typography.fontSizes.sm,
  },
  repayBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: 13,
    borderRadius: Radius.md,
  },
  repayBtnText: {
    color: "#FFFFFF",
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
  whatsappBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: Spacing.sm,
    paddingVertical: 11,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  whatsappBtnText: {
    color: "#25D366",
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
  receiptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  attachInlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  receiptImage: {
    width: "100%",
    height: 200,
    borderRadius: Radius.md,
    marginTop: 4,
  },
  repaymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  deleteBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
});
