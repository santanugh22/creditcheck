import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AlertCircleIcon,
  CalendarIcon,
  CameraIcon,
  CheckCircleIcon,
  CloseIcon,
  ImageIcon,
  RupeeIcon,
  TrashIcon,
} from "../components/icons/LedgerIcons";
import { SpringPressable } from "../components/ui/AnimatedComponents";
import { useLedgerStore } from "../store/useLedgerStore";
import { useTheme } from "../theme/ThemeContext";
import { formatIndianNumber, Radius, Spacing, Typography } from "../theme/tokens";
import { LoanCategory } from "../types/ledger";

interface AddLoanModalProps {
  visible: boolean;
  onClose: () => void;
}

interface CategoryOption {
  key: LoanCategory;
  emoji: string;
  labelKey: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { key: "PERSONAL", emoji: "🤝", labelKey: "categories.PERSONAL" },
  { key: "FOOD_SPLIT", emoji: "🍲", labelKey: "categories.FOOD_SPLIT" },
  { key: "EMERGENCY", emoji: "🚨", labelKey: "categories.EMERGENCY" },
  { key: "TRAVEL", emoji: "✈️", labelKey: "categories.TRAVEL" },
  { key: "RENT", emoji: "🏠", labelKey: "categories.RENT" },
  { key: "OTHER", emoji: "📦", labelKey: "categories.OTHER" },
];

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

interface DatePreset {
  label: string;
  days: number;
}

const DATE_PRESETS: DatePreset[] = [
  { label: "+3 Days", days: 3 },
  { label: "+1 Week", days: 7 },
  { label: "+15 Days", days: 15 },
  { label: "+1 Month", days: 30 },
];

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToToday(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return formatLocalDate(date);
}

function formatDisplayDate(dateStr: string): string {
  try {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    const diffDays = Math.round(
      (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    };
    const formatted = date.toLocaleDateString("en-IN", options);

    if (diffDays === 0) return `${formatted} (Today)`;
    if (diffDays === 1) return `${formatted} (Tomorrow)`;
    if (diffDays > 1) return `${formatted} (in ${diffDays} days)`;
    if (diffDays < 0) return `${formatted} (${Math.abs(diffDays)} days ago)`;
    return formatted;
  } catch (_e) {
    return dateStr;
  }
}

function parseSafeDate(dateStr: string): Date {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
  } catch (_e) {}
  return new Date();
}

export function AddLoanModal({ visible, onClose }: AddLoanModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { createLoanEntry, isSubmitting } = useLedgerStore();

  const [friendName, setFriendName] = useState("");
  const [friendPhone, setFriendPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(addDaysToToday(7));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [category, setCategory] = useState<LoanCategory>("PERSONAL");
  const [notes, setNotes] = useState("");
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const [isNotesFocused, setIsNotesFocused] = useState(false);

  const resetForm = () => {
    setFriendName("");
    setFriendPhone("");
    setAmount("");
    setDueDate(addDaysToToday(7));
    setCategory("PERSONAL");
    setNotes("");
    setReceiptUri(null);
    setFormError(null);
    setShowDatePicker(false);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    resetForm();
    onClose();
  };

  const handleAddQuickAmount = (increment: number) => {
    const current = parseFloat(amount) || 0;
    setAmount(String(current + increment));
  };

  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFormError("Photo gallery permission is required to attach a receipt.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setReceiptUri(result.assets[0].uri);
        setFormError(null);
      }
    } catch (_err) {
      setFormError("Failed to open photo gallery.");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setFormError("Camera permission is required to snap a receipt photo.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setReceiptUri(result.assets[0].uri);
        setFormError(null);
      }
    } catch (_err) {
      setFormError("Failed to open camera.");
    }
  };

  const handleDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (selected) {
      setDueDate(formatLocalDate(selected));
    }
  };

  const handleSubmit = async () => {
    setFormError(null);

    if (!friendName.trim()) {
      setFormError("Please enter your friend’s name.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Please enter a valid loan amount greater than ₹0.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setFormError("Due date must be in YYYY-MM-DD format.");
      return;
    }

    try {
      await createLoanEntry({
        friendName: friendName.trim(),
        friendPhone: friendPhone.trim() || undefined,
        amount: parsedAmount,
        dueDate,
        category,
        notes: notes.trim() || undefined,
        receiptUri,
      });
      handleClose();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not save entry.",
      );
    }
  };

  const numericAmount = parseFloat(amount) || 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        {/* Backdrop dismiss pressable */}
        <Pressable style={styles.backdropDismiss} onPress={handleClose} />

        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Top Pill Drag Handle */}
          <View style={styles.handleContainer}>
            <View
              style={[
                styles.dragHandle,
                { backgroundColor: colors.borderStrong },
              ]}
            />
          </View>

          {/* Sheet Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleBox}>
              <View
                style={[
                  styles.headerIconBadge,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <RupeeIcon size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  {t("addLoan.title")}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Track money given to a friend
                </Text>
              </View>
            </View>
            <SpringPressable
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.closeBtn, { backgroundColor: colors.background }]}
            >
              <CloseIcon size={14} color={colors.textSecondary} />
            </SpringPressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.formScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Error Banner */}
            {formError && (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: colors.dangerSurface,
                    borderColor: colors.danger,
                  },
                ]}
              >
                <AlertCircleIcon size={16} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {formError}
                </Text>
              </View>
            )}

            {/* 1. Hero Amount Input */}
            <View style={styles.sectionBlock}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  {t("addLoan.amountLabel")}
                </Text>
                {numericAmount > 0 && (
                  <Text style={[styles.amountPreview, { color: colors.primary }]}>
                    ₹{formatIndianNumber(numericAmount)}
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.amountInputContainer,
                  {
                    backgroundColor: colors.background,
                    borderColor: isAmountFocused
                      ? colors.primary
                      : numericAmount > 0
                        ? colors.borderStrong
                        : colors.border,
                    shadowColor: isAmountFocused
                      ? colors.primary
                      : "transparent",
                    shadowOpacity: isAmountFocused ? 0.15 : 0,
                    shadowRadius: 6,
                    elevation: isAmountFocused ? 2 : 0,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.amountCurrencyPrefix,
                    {
                      color:
                        isAmountFocused || numericAmount > 0
                          ? colors.primary
                          : colors.textMuted,
                    },
                  ]}
                >
                  ₹
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={(txt) => {
                    const clean = txt.replace(/[^0-9.]/g, "");
                    const parts = clean.split(".");
                    if (parts.length > 2) return;
                    if (parts[1] && parts[1].length > 2) return;
                    setAmount(clean);
                  }}
                  onFocus={() => setIsAmountFocused(true)}
                  onBlur={() => setIsAmountFocused(false)}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  style={[
                    styles.heroAmountTextInput,
                    { color: colors.textPrimary },
                  ]}
                />
                {amount.length > 0 && (
                  <SpringPressable
                    onPress={() => setAmount("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.clearInputPill,
                      { backgroundColor: colors.border },
                    ]}
                  >
                    <CloseIcon size={12} color={colors.textSecondary} />
                  </SpringPressable>
                )}
              </View>

              {/* Quick Preset Amount Chips */}
              <View style={styles.quickAmountRow}>
                {QUICK_AMOUNTS.map((val) => (
                  <SpringPressable
                    key={val}
                    onPress={() => handleAddQuickAmount(val)}
                    style={[
                      styles.quickAmountChip,
                      {
                        backgroundColor: colors.primaryLight,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.quickAmountChipText,
                        { color: colors.primary },
                      ]}
                    >
                      +₹{val >= 1000 ? `${val / 1000}k` : val}
                    </Text>
                  </SpringPressable>
                ))}
              </View>
            </View>

            {/* 2. Friend Name */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t("addLoan.friendNameLabel")}
              </Text>
              <View
                style={[
                  styles.textInputBox,
                  {
                    backgroundColor: colors.background,
                    borderColor: isNameFocused
                      ? colors.primary
                      : colors.borderStrong,
                  },
                ]}
              >
                <Text style={styles.inputLeadingIcon}>👤</Text>
                <TextInput
                  value={friendName}
                  onChangeText={setFriendName}
                  onFocus={() => setIsNameFocused(true)}
                  onBlur={() => setIsNameFocused(false)}
                  placeholder={t("addLoan.friendNamePlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={[
                    styles.innerTextInput,
                    { color: colors.textPrimary },
                  ]}
                />
                {friendName.length > 0 && (
                  <SpringPressable
                    onPress={() => setFriendName("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.clearInputPill,
                      { backgroundColor: colors.border },
                    ]}
                  >
                    <CloseIcon size={12} color={colors.textSecondary} />
                  </SpringPressable>
                )}
              </View>
            </View>

            {/* 3. Friend Phone (With Indian +91 Badge) */}
            <View style={styles.sectionBlock}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  {t("addLoan.friendPhoneLabel")}
                </Text>
                <Text
                  style={[styles.labelOptionalHint, { color: colors.textMuted }]}
                >
                  WhatsApp Reminders
                </Text>
              </View>
              <View
                style={[
                  styles.phoneInputRow,
                  {
                    backgroundColor: colors.background,
                    borderColor: isPhoneFocused
                      ? colors.primary
                      : colors.borderStrong,
                  },
                ]}
              >
                <View
                  style={[
                    styles.phonePrefixBox,
                    { borderRightColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.phonePrefixText,
                      { color: colors.textPrimary },
                    ]}
                  >
                    🇮🇳 +91
                  </Text>
                </View>
                <TextInput
                  value={friendPhone}
                  onChangeText={(txt) => {
                    const cleaned = txt.replace(/\D/g, "");
                    setFriendPhone(cleaned.slice(0, 10));
                  }}
                  onFocus={() => setIsPhoneFocused(true)}
                  onBlur={() => setIsPhoneFocused(false)}
                  placeholder="98765 43210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  style={[
                    styles.phoneTextInput,
                    { color: colors.textPrimary },
                  ]}
                />
                {friendPhone.length > 0 && (
                  <SpringPressable
                    onPress={() => setFriendPhone("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.clearInputPill,
                      { backgroundColor: colors.border },
                    ]}
                  >
                    <CloseIcon size={12} color={colors.textSecondary} />
                  </SpringPressable>
                )}
              </View>
            </View>

            {/* 4. Due Date Card + Presets */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t("addLoan.dueDateLabel")}
              </Text>

              {/* Tappable Date Card */}
              <SpringPressable
                onPress={() => setShowDatePicker((prev) => !prev)}
                style={[
                  styles.dateCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: showDatePicker
                      ? colors.primary
                      : colors.borderStrong,
                  },
                ]}
              >
                <View
                  style={[
                    styles.dateIconCircle,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <CalendarIcon size={18} color={colors.primary} />
                </View>
                <View style={styles.dateCardTextCol}>
                  <Text
                    style={[styles.dateCardDisplay, { color: colors.textPrimary }]}
                  >
                    {formatDisplayDate(dueDate)}
                  </Text>
                  <Text
                    style={[styles.dateCardSub, { color: colors.textMuted }]}
                  >
                    Format: {dueDate}
                  </Text>
                </View>
                <View
                  style={[
                    styles.changeDatePill,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.changeDatePillText, { color: colors.primary }]}
                  >
                    📅 Change
                  </Text>
                </View>
              </SpringPressable>

              {/* Quick Due Date Presets */}
              <View style={styles.presetChipRow}>
                {DATE_PRESETS.map((preset) => {
                  const targetDate = addDaysToToday(preset.days);
                  const isSelected = dueDate === targetDate;
                  return (
                    <SpringPressable
                      key={preset.label}
                      onPress={() => {
                        setDueDate(targetDate);
                        setShowDatePicker(false);
                      }}
                      style={[
                        styles.presetChip,
                        {
                          backgroundColor: isSelected
                            ? colors.primary
                            : colors.background,
                          borderColor: isSelected
                            ? colors.primary
                            : colors.borderStrong,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          {
                            color: isSelected
                              ? "#FFFFFF"
                              : colors.textSecondary,
                            fontWeight: isSelected ? "700" : "500",
                          },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </SpringPressable>
                  );
                })}
              </View>

              {/* iOS Picker Card */}
              {showDatePicker && Platform.OS === "ios" && (
                <View
                  style={[
                    styles.iosPickerCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.iosPickerHeader}>
                    <Text
                      style={[
                        styles.iosPickerTitle,
                        { color: colors.textPrimary },
                      ]}
                    >
                      Select Repayment Due Date
                    </Text>
                    <SpringPressable
                      onPress={() => setShowDatePicker(false)}
                      style={[
                        styles.iosDoneBtn,
                        { backgroundColor: colors.primaryLight },
                      ]}
                    >
                      <Text
                        style={[
                          styles.iosDoneBtnText,
                          { color: colors.primary },
                        ]}
                      >
                        Done
                      </Text>
                    </SpringPressable>
                  </View>
                  <DateTimePicker
                    value={parseSafeDate(dueDate)}
                    mode="date"
                    display="inline"
                    onChange={handleDateChange}
                    textColor={colors.textPrimary}
                  />
                </View>
              )}

              {/* Android Native Picker */}
              {showDatePicker && Platform.OS === "android" && (
                <DateTimePicker
                  value={parseSafeDate(dueDate)}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}
            </View>

            {/* 5. Category Selection Grid */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t("addLoan.categoryLabel")}
              </Text>
              <View style={styles.categoryGrid}>
                {CATEGORY_OPTIONS.map((cat) => {
                  const isSelected = category === cat.key;
                  return (
                    <SpringPressable
                      key={cat.key}
                      onPress={() => setCategory(cat.key)}
                      style={[
                        styles.categoryCard,
                        {
                          backgroundColor: isSelected
                            ? colors.primaryLight
                            : colors.background,
                          borderColor: isSelected
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    >
                      <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                      <Text
                        style={[
                          styles.categoryLabelText,
                          {
                            color: isSelected
                              ? colors.primary
                              : colors.textPrimary,
                            fontWeight: isSelected ? "700" : "500",
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {t(cat.labelKey)}
                      </Text>
                    </SpringPressable>
                  );
                })}
              </View>
            </View>

            {/* 6. Notes / Remarks */}
            <View style={styles.sectionBlock}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  {t("addLoan.notesLabel")}
                </Text>
                <Text
                  style={[styles.labelOptionalHint, { color: colors.textMuted }]}
                >
                  {notes.length}/500
                </Text>
              </View>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                onFocus={() => setIsNotesFocused(true)}
                onBlur={() => setIsNotesFocused(false)}
                placeholder={t("addLoan.notesPlaceholder")}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                maxLength={500}
                style={[
                  styles.notesInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: isNotesFocused
                      ? colors.primary
                      : colors.borderStrong,
                    color: colors.textPrimary,
                  },
                ]}
              />
            </View>

            {/* 7. Receipt Photo Attachment */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t("addLoan.receiptLabel")}
              </Text>

              {receiptUri ? (
                <View
                  style={[
                    styles.receiptAttachedCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: receiptUri }}
                    style={styles.receiptThumbnail}
                    resizeMode="cover"
                  />
                  <View style={styles.receiptDetailsCol}>
                    <View style={styles.receiptSuccessPill}>
                      <CheckCircleIcon size={14} color={colors.success} />
                      <Text
                        style={[
                          styles.receiptSuccessText,
                          { color: colors.success },
                        ]}
                      >
                        Receipt Attached
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.receiptSubtext,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      Ready to upload with entry
                    </Text>
                    <View style={styles.receiptActionRow}>
                      <SpringPressable
                        onPress={handlePickFromGallery}
                        style={[
                          styles.receiptSmallBtn,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <ImageIcon size={13} color={colors.primary} />
                        <Text
                          style={[
                            styles.receiptSmallBtnText,
                            { color: colors.primary },
                          ]}
                        >
                          Change
                        </Text>
                      </SpringPressable>
                      <SpringPressable
                        onPress={() => setReceiptUri(null)}
                        style={[
                          styles.receiptSmallBtn,
                          {
                            backgroundColor: colors.dangerSurface,
                            borderColor: colors.dangerSurface,
                          },
                        ]}
                      >
                        <TrashIcon size={13} color={colors.danger} />
                        <Text
                          style={[
                            styles.receiptSmallBtnText,
                            { color: colors.danger },
                          ]}
                        >
                          Remove
                        </Text>
                      </SpringPressable>
                    </View>
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    styles.receiptDropzone,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.borderStrong,
                    },
                  ]}
                >
                  <View style={styles.dropzoneHeader}>
                    <View
                      style={[
                        styles.dropzoneIconBox,
                        { backgroundColor: colors.primaryLight },
                      ]}
                    >
                      <CameraIcon size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.dropzoneTitle,
                          { color: colors.textPrimary },
                        ]}
                      >
                        Attach Bill or UPI Screenshot
                      </Text>
                      <Text
                        style={[
                          styles.dropzoneSub,
                          { color: colors.textMuted },
                        ]}
                      >
                        Keep photo proof of the loan
                      </Text>
                    </View>
                  </View>

                  <View style={styles.dropzoneBtnRow}>
                    <SpringPressable
                      onPress={handlePickFromGallery}
                      style={[
                        styles.dropzoneBtn,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <ImageIcon size={15} color={colors.primary} />
                      <Text
                        style={[
                          styles.dropzoneBtnText,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {t("addLoan.selectFromGallery")}
                      </Text>
                    </SpringPressable>
                    <SpringPressable
                      onPress={handleTakePhoto}
                      style={[
                        styles.dropzoneBtn,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <CameraIcon size={15} color={colors.primary} />
                      <Text
                        style={[
                          styles.dropzoneBtnText,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {t("addLoan.takePhoto")}
                      </Text>
                    </SpringPressable>
                  </View>
                </View>
              )}
            </View>

            {/* Submit Button */}
            <SpringPressable
              hapticStyle="medium"
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={[
                styles.submitBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: isSubmitting ? 0.7 : 1,
                },
              ]}
            >
              {isSubmitting ? (
                <View style={styles.submittingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={[styles.submitBtnText, { marginLeft: Spacing.sm }]}>
                    Saving Entry...
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>
                  {t("addLoan.submitButton")}
                </Text>
              )}
            </SpringPressable>

            <View style={styles.footerNoteRow}>
              <Text style={[styles.footerNoteText, { color: colors.textMuted }]}>
                🔒 100% private & encrypted ledger on your phone
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(9, 13, 22, 0.65)",
    justifyContent: "flex-end",
  },
  backdropDismiss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 38,
    height: 4.5,
    borderRadius: Radius.full,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
  },
  subtitle: {
    fontSize: Typography.fontSizes.xs,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  formScroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: 44,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    flex: 1,
  },
  sectionBlock: {
    marginBottom: Spacing.lg,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  labelOptionalHint: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.medium,
  },
  amountPreview: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    height: 60,
  },
  amountCurrencyPrefix: {
    fontSize: Typography.fontSizes.xxl,
    fontWeight: Typography.fontWeights.bold,
    marginRight: Spacing.sm,
  },
  heroAmountTextInput: {
    flex: 1,
    height: "100%",
    fontSize: Typography.fontSizes.xxl,
    fontWeight: Typography.fontWeights.bold,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  clearInputPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.xs,
  },
  quickAmountRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  quickAmountChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickAmountChipText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  textInputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  inputLeadingIcon: {
    fontSize: 15,
    marginRight: Spacing.sm,
  },
  innerTextInput: {
    flex: 1,
    height: "100%",
    fontSize: Typography.fontSizes.sm,
    fontWeight: "500",
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: Radius.md,
    height: 48,
    overflow: "hidden",
    paddingRight: Spacing.md,
  },
  phonePrefixBox: {
    paddingHorizontal: Spacing.md,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    marginRight: Spacing.sm,
  },
  phonePrefixText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  phoneTextInput: {
    flex: 1,
    height: "100%",
    fontSize: Typography.fontSizes.sm,
    fontWeight: "500",
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  dateIconCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  dateCardTextCol: {
    flex: 1,
  },
  dateCardDisplay: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
  dateCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  changeDatePill: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  changeDatePillText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
  },
  presetChipRow: {
    flexDirection: "row",
    gap: Spacing.xs + 2,
    marginTop: Spacing.sm,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  presetChipText: {
    fontSize: 11,
  },
  iosPickerCard: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  iosPickerTitle: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
  },
  iosDoneBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  iosDoneBtnText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryCard: {
    width: "31%",
    paddingVertical: 10,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  categoryLabelText: {
    fontSize: 11,
    textAlign: "center",
  },
  notesInput: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Typography.fontSizes.sm,
    minHeight: 72,
    textAlignVertical: "top",
  },
  receiptAttachedCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  receiptThumbnail: {
    width: 68,
    height: 68,
    borderRadius: Radius.md,
  },
  receiptDetailsCol: {
    flex: 1,
  },
  receiptSuccessPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  receiptSuccessText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  receiptSubtext: {
    fontSize: 11,
    marginBottom: 8,
  },
  receiptActionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  receiptSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  receiptSmallBtnText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    marginLeft: 3,
  },
  receiptDropzone: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  dropzoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  dropzoneIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  dropzoneTitle: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  dropzoneSub: {
    fontSize: 11,
    marginTop: 1,
  },
  dropzoneBtnRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  dropzoneBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  dropzoneBtnText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  submitBtn: {
    marginTop: Spacing.md,
    paddingVertical: 15,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  submittingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  footerNoteRow: {
    alignItems: "center",
    marginTop: Spacing.md,
  },
  footerNoteText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.medium,
  },
});
